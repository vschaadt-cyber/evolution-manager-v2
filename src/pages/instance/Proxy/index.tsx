/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormInput, FormSelect, FormSwitch } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { useInstance } from "@/contexts/InstanceContext";

import { useFetchProxy } from "@/lib/queries/proxy/fetchProxy";
import { useManageProxy } from "@/lib/queries/proxy/manageProxy";

import { Proxy as ProxyType } from "@/types/evolution.types";

const formSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.string(),
  protocol: z.string(),
  username: z.string(),
  password: z.string(),
});

type FormSchemaType = z.infer<typeof formSchema>;

const PROTOCOLS = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks4", label: "SOCKS4" },
  { value: "socks5", label: "SOCKS5" },
];

function errorMessage(error: any): string {
  const message = error?.response?.data?.response?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
  return "Não foi possível salvar o proxy. Verifique a conexão com a Evolution.";
}

function Proxy() {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const [loading, setLoading] = useState(false);

  const { createProxy } = useManageProxy();
  const { data: proxy } = useFetchProxy({
    instanceName: instance?.name,
  });

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: false,
      host: "",
      port: "",
      protocol: "http",
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (proxy) {
      form.reset({
        enabled: proxy.enabled,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        username: proxy.username,
        password: proxy.password,
      });
    }
  }, [proxy]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormSchemaType) => {
    if (!instance) return;

    setLoading(true);
    try {
      const proxyData: ProxyType = {
        enabled: data.enabled,
        host: data.host,
        port: data.port,
        protocol: data.protocol,
        username: data.username,
        password: data.password,
      };

      await createProxy({
        instanceName: instance.name,
        token: instance.token,
        data: proxyData,
      });
      toast.success(t("proxy.toast.success"));
    } catch (error: any) {
      console.error(t("proxy.toast.error"), (error as Error)?.message);
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <div>
            <h3 className="mb-1 text-lg font-medium">{t("proxy.title")}</h3>
            <Separator className="my-4" />
            <div className="mx-4 space-y-2 divide-y [&>*]:p-4">
              <FormSwitch name="enabled" label={t("proxy.form.enabled.label")} className="w-full justify-between" helper={t("proxy.form.enabled.description")} />
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr_10rem] md:gap-8">
                <FormSelect name="protocol" label={t("proxy.form.protocol.label")} options={PROTOCOLS} />
                <FormInput name="host" label={t("proxy.form.host.label")}>
                  <Input />
                </FormInput>
                <FormInput name="port" label={t("proxy.form.port.label")}>
                  <Input type="number" />
                </FormInput>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:gap-8">
                <FormInput name="username" label={t("proxy.form.username.label")}>
                  <Input />
                </FormInput>
                <FormInput name="password" label={t("proxy.form.password.label")}>
                  <Input type="password" />
                </FormInput>
              </div>
              <div className="flex justify-end px-4 pt-6">
                <Button type="submit" disabled={loading}>
                  {loading ? t("proxy.button.saving") : t("proxy.button.save")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

export { Proxy };
