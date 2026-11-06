/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormInput, FormItem, FormLabel, FormSwitch } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { useInstance } from "@/contexts/InstanceContext";

import { useFetchWebhook } from "@/lib/queries/webhook/fetchWebhook";
import { useManageWebhook } from "@/lib/queries/webhook/manageWebhook";
import { cn } from "@/lib/utils";

import { Webhook as WebhookType } from "@/types/evolution.types";

// Eventos que o Gestão e o n8n usam. Os demais só valem se houver um destino para eles.
const RECOMMENDED_EVENTS = ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "QRCODE_UPDATED", "CONTACTS_UPSERT"];

const ALL_EVENTS = [
  "APPLICATION_STARTUP",
  "QRCODE_UPDATED",
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONTACTS_SET",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "PRESENCE_UPDATE",
  "CHATS_SET",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CHATS_DELETE",
  "GROUPS_UPSERT",
  "GROUP_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "CONNECTION_UPDATE",
  "REMOVE_INSTANCE",
  "LOGOUT_INSTANCE",
  "LABELS_EDIT",
  "LABELS_ASSOCIATION",
  "CALL",
];

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const FormSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().trim(),
    events: z.array(z.string()),
    base64: z.boolean(),
    byEvents: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Com o webhook desligado a URL pode ficar vazia; ligado, ela é obrigatória.
    if (data.enabled || data.url !== "") {
      if (!isHttpUrl(data.url)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Informe uma URL válida, começando com http:// ou https://" });
      }
    }
  });

type FormSchemaType = z.infer<typeof FormSchema>;

function Webhook() {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const { createWebhook } = useManageWebhook();
  const { data: webhook } = useFetchWebhook({
    instanceName: instance?.name,
    token: instance?.token,
  });

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      enabled: false,
      url: "",
      events: [],
      base64: false,
      byEvents: false,
    },
  });

  useEffect(() => {
    if (webhook) {
      form.reset({
        enabled: webhook.enabled,
        url: webhook.url ?? "",
        events: webhook.events ?? [],
        base64: webhook.webhookBase64,
        byEvents: webhook.webhookByEvents,
      });
    }
  }, [webhook]); // eslint-disable-line react-hooks/exhaustive-deps

  const enabled = form.watch("enabled");
  const url = form.watch("url");
  const events = form.watch("events");

  // Avisos que aparecem antes de salvar, sem bloquear o formulário.
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (enabled && events.length === 0) {
      list.push("O webhook está ligado, mas nenhum evento está marcado. Nada será enviado até você marcar pelo menos um.");
    }
    if (enabled && !isHttpUrl(url.trim())) {
      list.push("O webhook está ligado, mas a URL de destino está vazia ou inválida. Os eventos não chegam a lugar nenhum.");
    }
    return list;
  }, [enabled, events, url]);

  const onSubmit = async (data: FormSchemaType) => {
    if (!instance) return;
    setLoading(true);
    try {
      const webhookData: WebhookType = {
        enabled: data.enabled,
        url: data.url,
        events: data.events,
        base64: data.base64,
        byEvents: data.byEvents,
      };

      await createWebhook({
        instanceName: instance.name,
        token: instance.token,
        data: webhookData,
      });
      toast.success(t("webhook.toast.success"));
    } catch (error: any) {
      console.error(t("webhook.toast.error"));
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // O navegador não consegue ler a resposta de um destino externo (CORS), então o teste
  // confirma apenas que o envio saiu. Quem confirma o recebimento é o destino (n8n, log etc.).
  const handleTest = async () => {
    const target = form.getValues("url").trim();
    if (!isHttpUrl(target)) {
      toast.error("Informe uma URL válida antes de testar.");
      return;
    }
    setTesting(true);
    try {
      await fetch(target, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          event: "WEBHOOK_TESTE",
          instance: instance?.name,
          data: { origem: "Gestão", mensagem: "Teste de webhook" },
          date_time: new Date().toISOString(),
        }),
      });
      toast.info("Teste enviado. Confira no destino se chegou (o navegador não consegue ler a resposta).");
    } catch {
      toast.error("Não foi possível enviar o teste. Verifique a URL, se ela usa https e se o destino está no ar.");
    } finally {
      setTesting(false);
    }
  };

  const setEvents = (next: string[]) => form.setValue("events", next, { shouldDirty: true });

  const sortedEvents = [...ALL_EVENTS].sort((a, b) => a.localeCompare(b));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <div>
          <h3 className="mb-1 text-lg font-medium">{t("webhook.title")}</h3>
          <p className="text-sm text-muted-foreground">Envia para a sua URL (n8n ou outro sistema) os eventos desta instância.</p>
          <Separator className="my-4" />

          {warnings.length > 0 && (
            <div role="alert" className="mx-4 mb-4 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {warnings.map((warning) => (
                <p key={warning} className="flex gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          )}

          <div className="mx-4 space-y-2 divide-y [&>*]:p-4">
            <FormSwitch name="enabled" label={t("webhook.form.enabled.label")} className="w-full justify-between" helper={t("webhook.form.enabled.description")} />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <FormInput name="url" label={t("webhook.form.url.label", "URL de destino")}>
                  <Input placeholder="https://seu-n8n.exemplo.com/webhook/evolution" inputMode="url" autoComplete="off" />
                </FormInput>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={handleTest} disabled={testing || !url.trim()}>
                <Send size={16} /> {testing ? "Enviando..." : "Testar webhook"}
              </Button>
            </div>

            <FormSwitch name="byEvents" label={t("webhook.form.byEvents.label")} className="w-full justify-between" helper={t("webhook.form.byEvents.description")} />
            <FormSwitch name="base64" label={t("webhook.form.base64.label")} className="w-full justify-between" helper={t("webhook.form.base64.description")} />

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg font-medium">{t("webhook.form.events.label")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" type="button" size="sm" className="gap-2" onClick={() => setEvents(RECOMMENDED_EVENTS)}>
                  <Sparkles size={15} /> Eventos recomendados
                </Button>
                <Button variant="outline" type="button" size="sm" onClick={() => setEvents(ALL_EVENTS)}>
                  {t("button.markAll")}
                </Button>
                <Button variant="outline" type="button" size="sm" onClick={() => setEvents([])}>
                  {t("button.unMarkAll")}
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="events"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormControl>
                    <div className="grid gap-x-6 sm:grid-cols-2">
                      {sortedEvents.map((event) => {
                        const checked = field.value.includes(event);
                        const recommended = RECOMMENDED_EVENTS.includes(event);
                        return (
                          <div key={event} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                            <FormLabel className={cn("break-all font-mono text-xs", checked ? "text-foreground" : "text-muted-foreground")}>
                              {event}
                              {recommended && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">recomendado</span>}
                            </FormLabel>
                            <Switch
                              checked={checked}
                              onCheckedChange={(on) => {
                                if (on) {
                                  field.onChange([...field.value, event]);
                                } else {
                                  field.onChange(field.value.filter((e) => e !== event));
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="mx-4 flex justify-end pt-6">
            <Button type="submit" disabled={loading}>
              {loading ? t("webhook.button.saving") : t("webhook.button.save")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

function errorMessage(error: any): string {
  const message = error?.response?.data?.response?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
  return "Não foi possível salvar. Verifique a conexão com a Evolution.";
}

export { Webhook };
