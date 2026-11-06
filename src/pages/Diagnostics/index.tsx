import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { diagnoseInstance, DiagnosticLevel, DiagnosticRow, PERIOD_OPTIONS, PeriodValue, RECOMMENDED_WEBHOOK_EVENTS, withinPeriod } from "@/lib/diagnostics/rules";
import { fetchProxy } from "@/lib/queries/proxy/fetchProxy";
import { fetchWebhook } from "@/lib/queries/webhook/fetchWebhook";
import { useManageWebhook } from "@/lib/queries/webhook/manageWebhook";
import { useFetchInstances } from "@/lib/queries/instance/fetchInstances";

import { Instance } from "@/types/evolution.types";

type LevelFilter = "all" | DiagnosticLevel;

const LEVEL_LABEL: Record<DiagnosticLevel, string> = { error: "Erro", warn: "Aviso", ok: "OK", info: "Info" };

const LEVEL_BADGE: Record<DiagnosticLevel, { variant: "destructive" | "warning" | "success" | "secondary"; icon: typeof Info }> = {
  error: { variant: "destructive", icon: AlertTriangle },
  warn: { variant: "warning", icon: AlertTriangle },
  ok: { variant: "success", icon: CheckCircle2 },
  info: { variant: "secondary", icon: Info },
};

const CHECK_LABEL: Record<DiagnosticRow["check"], string> = {
  conexao: "Conexão",
  webhook: "Webhook",
  proxy: "Proxy",
  "ultimo-evento": "Último evento",
};

function errorMessage(error: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = (error as any)?.response?.data?.response?.message ?? (error as any)?.response?.data?.message ?? (error as any)?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" && message ? message : "Erro desconhecido.";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

type Entry = DiagnosticRow & { instance: Instance; webhookIndex: number };

function DiagnosticsPage() {
  const { data: instances, isLoading, isError } = useFetchInstances();
  const { createWebhook } = useManageWebhook();

  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodValue>("all");
  const [busyName, setBusyName] = useState<string | null>(null);

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
      const rows = diagnoseInstance({
        instance,
        webhook: webhookQuery?.data,
        webhookReadFailed: webhookQuery?.isError,
        proxy: proxyQueries[index]?.data,
      });
      rows.forEach((row) => all.push({ ...row, instance, webhookIndex: index }));
    });
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, webhookQueries.map((q) => q.dataUpdatedAt).join(), webhookQueries.map((q) => q.isError).join(), proxyQueries.map((q) => q.dataUpdatedAt).join()]);

  const filtered = useMemo(
    () => entries.filter((row) => (instanceFilter === "all" || row.instance.name === instanceFilter) && (levelFilter === "all" || row.level === levelFilter) && withinPeriod(row, periodFilter)),
    [entries, instanceFilter, levelFilter, periodFilter],
  );

  const summary = useMemo(() => {
    const errors = entries.filter((row) => row.level === "error").length;
    const warnings = entries.filter((row) => row.level === "warn").length;
    return { errors, warnings };
  }, [entries]);

  const enableWebhook = async (entry: Entry) => {
    const webhook = webhookQueries[entry.webhookIndex]?.data;
    if (!webhook?.url) return;
    setBusyName(entry.instance.name);
    try {
      await createWebhook({
        instanceName: entry.instance.name,
        token: entry.instance.token,
        data: {
          enabled: true,
          url: webhook.url,
          events: RECOMMENDED_WEBHOOK_EVENTS,
          base64: !!webhook.webhookBase64,
          byEvents: !!webhook.webhookByEvents,
        },
      });
      toast.success(`Webhook de ${entry.instance.name} ligado com os eventos recomendados.`);
      await webhookQueries[entry.webhookIndex]?.refetch();
    } catch (error) {
      toast.error(`Não foi possível ligar o webhook: ${errorMessage(error)}`);
    } finally {
      setBusyName(null);
    }
  };

  const loading = isLoading || webhookQueries.some((q) => q.isLoading);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="destructive">{summary.errors} erro(s)</Badge>
        <Badge variant="warning">{summary.warnings} aviso(s)</Badge>
        <span className="text-muted-foreground">Verificado a cada carregamento desta página.</span>
      </div>

      <Card className="grid gap-3 p-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Instância
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={instanceFilter} onChange={(e) => setInstanceFilter(e.target.value)}>
            <option value="all">Todas</option>
            {list.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Nível
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}>
            <option value="all">Todos</option>
            <option value="error">Erro</option>
            <option value="warn">Aviso</option>
            <option value="ok">OK</option>
            <option value="info">Informação</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Período
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as PeriodValue)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <p className="text-xs text-muted-foreground">
        A Evolution API não guarda histórico de eventos. Aqui aparecem só o estado atual e o último horário de desconexão registrado. O período filtra por esse horário.
      </p>

      {isError && <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar as instâncias. Confira a conexão com a Evolution.</p>}

      {!isError && !loading && list.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma instância cadastrada. Crie uma na lista de instâncias.</p>}

      {loading && (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Carregando diagnóstico…
        </p>
      )}

      {!loading && list.length > 0 && filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum registro com esses filtros.</p>}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((row, index) => {
            const { variant, icon: Icon } = LEVEL_BADGE[row.level];
            const webhookUrl = webhookQueries[row.webhookIndex]?.data?.url;
            return (
              <Card key={`${row.instance.id}-${row.check}-${index}`} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{row.instance.name}</span>
                    <span className="text-xs text-muted-foreground">· {CHECK_LABEL[row.check]}</span>
                    <Badge variant={variant} className="gap-1">
                      <Icon size={12} />
                      {LEVEL_LABEL[row.level]}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{row.message}</p>
                  {row.at !== undefined && row.check === "ultimo-evento" && <p className="text-xs text-muted-foreground">Horário: {formatDate(row.at)}</p>}
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DiagnosticsPage;
