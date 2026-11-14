// Conferência da configuração de cada instância na Evolution: conexão, webhook e proxy.
// É o diagnóstico que a tela já tinha, agora num bloco compacto abaixo do log: mostra primeiro o que precisa de ação.
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { diagnoseInstance, DiagnosticLevel, DiagnosticRow, RECOMMENDED_WEBHOOK_EVENTS } from "@/lib/diagnostics/rules";
import { useFetchInstances } from "@/lib/queries/instance/fetchInstances";
import { fetchProxy } from "@/lib/queries/proxy/fetchProxy";
import { fetchWebhook } from "@/lib/queries/webhook/fetchWebhook";
import { useManageWebhook } from "@/lib/queries/webhook/manageWebhook";

import { Instance } from "@/types/evolution.types";

const LEVEL_LABEL: Record<DiagnosticLevel, string> = { error: "Erro", warn: "Aviso", ok: "OK", info: "Info" };

const LEVEL_BADGE: Record<DiagnosticLevel, { variant: "destructive" | "warning" | "success" | "secondary"; icon: typeof Info }> = {
  error: { variant: "destructive", icon: AlertTriangle },
  warn: { variant: "warning", icon: AlertTriangle },
  ok: { variant: "success", icon: CheckCircle2 },
  info: { variant: "secondary", icon: Info },
};

const CHECK_LABEL: Record<DiagnosticRow["check"], string> = { conexao: "Conexão", webhook: "Webhook", proxy: "Proxy", "ultimo-evento": "Último evento" };

function errorMessage(error: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = (error as any)?.response?.data?.response?.message ?? (error as any)?.response?.data?.message ?? (error as any)?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" && message ? message : "Erro desconhecido.";
}

type Entry = DiagnosticRow & { instance: Instance; webhookIndex: number };

export function ConfiguracaoInstancias() {
  const { data: instances, isLoading, isError } = useFetchInstances();
  const { createWebhook } = useManageWebhook();
  const [busyName, setBusyName] = useState<string | null>(null);
  const [verTudo, setVerTudo] = useState(false);

  const list = useMemo(() => (Array.isArray(instances) ? [...instances].sort((a, b) => a.name.localeCompare(b.name)) : []), [instances]);

  // Webhook e proxy de cada instância, lidos com o token da própria instância.
  const webhookQueries = useQueries({
    queries: list.map((item) => ({
      queryKey: ["diagnostics", "webhook", item.name, item.token],
      queryFn: () => fetchWebhook({ instanceName: item.name, token: item.token }),
      retry: false,
    })),
  });

  const proxyQueries = useQueries({
    queries: list.map((item) => ({
      queryKey: ["diagnostics", "proxy", item.name, item.token],
      queryFn: () => fetchProxy({ instanceName: item.name, token: item.token }),
      retry: false,
    })),
  });

  const entries = useMemo<Entry[]>(() => {
    const all: Entry[] = [];
    list.forEach((instance, index) => {
      const webhookQuery = webhookQueries[index];
      const rows = diagnoseInstance({ instance, webhook: webhookQuery?.data, webhookReadFailed: webhookQuery?.isError, proxy: proxyQueries[index]?.data });
      // "Último evento" saiu: o log acima mostra todas as quedas com horário.
      rows.filter((row) => row.check !== "ultimo-evento").forEach((row) => all.push({ ...row, instance, webhookIndex: index }));
    });
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, webhookQueries.map((q) => q.dataUpdatedAt).join(), webhookQueries.map((q) => q.isError).join(), proxyQueries.map((q) => q.dataUpdatedAt).join()]);

  const pendentes = entries.filter((row) => row.level === "error" || row.level === "warn");
  const visiveis = verTudo ? entries : pendentes;
  const loading = isLoading || webhookQueries.some((q) => q.isLoading);

  const enableWebhook = async (entry: Entry) => {
    const webhook = webhookQueries[entry.webhookIndex]?.data;
    if (!webhook?.url) return;
    setBusyName(entry.instance.name);
    try {
      await createWebhook({
        instanceName: entry.instance.name,
        token: entry.instance.token,
        data: { enabled: true, url: webhook.url, events: RECOMMENDED_WEBHOOK_EVENTS, base64: !!webhook.webhookBase64, byEvents: !!webhook.webhookByEvents },
      });
      toast.success(`Webhook de ${entry.instance.name} ligado com os eventos recomendados.`);
      await webhookQueries[entry.webhookIndex]?.refetch();
    } catch (error) {
      toast.error(`Não foi possível ligar o webhook: ${errorMessage(error)}`);
    } finally {
      setBusyName(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <p className="font-semibold">Configuração na Evolution</p>
          <p className="text-xs text-muted-foreground">Conexão, webhook e proxy de cada instância, conferidos ao abrir esta tela.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && !isError && list.length > 0 && (pendentes.length > 0 ? <Badge variant="warning">{pendentes.length} ponto(s) para conferir</Badge> : <Badge variant="success">Tudo certo</Badge>)}
          <Button size="sm" variant="outline" onClick={() => setVerTudo((v) => !v)}>
            {verTudo ? "Ver só pendências" : "Ver tudo"}
          </Button>
        </div>
      </div>

      {isError && <p className="px-4 py-6 text-center text-sm text-destructive">Não foi possível carregar as instâncias. Confira a conexão com a Evolution.</p>}
      {loading && (
        <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Conferindo…
        </p>
      )}
      {!loading && !isError && visiveis.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{list.length === 0 ? "Nenhuma instância encontrada na Evolution." : "Nenhuma pendência de configuração."}</p>
      )}

      {!loading && visiveis.length > 0 && (
        <ul className="divide-y">
          {visiveis.map((row, index) => {
            const { variant, icon: Icon } = LEVEL_BADGE[row.level];
            const webhookUrl = webhookQueries[row.webhookIndex]?.data?.url;
            return (
              <li key={`${row.instance.id}-${row.check}-${index}`} className="grid gap-2 px-4 py-2.5 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.instance.name}</span>
                    <span className="text-xs text-muted-foreground">· {CHECK_LABEL[row.check]}</span>
                    <Badge variant={variant} className="gap-1">
                      <Icon size={12} />
                      {LEVEL_LABEL[row.level]}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.title !== CHECK_LABEL[row.check] ? `${row.title}. ` : ""}
                    {row.message}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {row.action === "enable-webhook" && webhookUrl && (
                    <Button size="sm" onClick={() => enableWebhook(row)} disabled={busyName === row.instance.name}>
                      {busyName === row.instance.name ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      Ligar e marcar eventos recomendados
                    </Button>
                  )}
                  {(row.action === "open-webhook" || (row.action === "enable-webhook" && !webhookUrl)) && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/manager/instance/${row.instance.id}/webhook`}>
                        <ExternalLink size={14} />
                        Informar URL do webhook
                      </Link>
                    </Button>
                  )}
                  {row.action === "open-instance" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/manager/instance/${row.instance.id}/dashboard`}>
                        <ExternalLink size={14} />
                        Abrir instância
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
