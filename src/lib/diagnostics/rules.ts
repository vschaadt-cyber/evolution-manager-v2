// Regras de diagnóstico do painel Gestão. Funções puras: não fazem chamadas de rede.

export type DiagnosticLevel = "ok" | "info" | "warn" | "error";

export type DiagnosticCheck = "conexao" | "webhook" | "proxy" | "ultimo-evento";

// Ação que o painel pode executar diretamente. As demais só orientam o usuário.
export type DiagnosticAction = "enable-webhook" | "open-webhook" | "open-instance" | "none";

export interface DiagnosticRow {
  check: DiagnosticCheck;
  level: DiagnosticLevel;
  title: string;
  message: string;
  action: DiagnosticAction;
  at?: string | null;
}

export interface InstanceForDiagnosis {
  connectionStatus: string;
  disconnectionReasonCode?: number | null;
  disconnectionAt?: string | null;
}

export interface WebhookForDiagnosis {
  enabled?: boolean;
  url?: string | null;
  events?: string[] | null;
}

export interface ProxyForDiagnosis {
  enabled?: boolean;
  host?: string | null;
  protocol?: string | null;
}

// Eventos que o Gestão e o n8n usam. Mesma lista da tela Webhook.
export const RECOMMENDED_WEBHOOK_EVENTS = ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "QRCODE_UPDATED", "CONTACTS_UPSERT"];

// Códigos do Baileys DisconnectReason, usados pela Evolution para marcar a desconexão.
// Confirmar na versão do Baileys usada pela Evolution 2.3.7 antes de depender deles.
export const DISCONNECT_REASONS: Record<number, { title: string; hint: string; action: "reconnect" | "restart" | "recreate" | "none" }> = {
  401: { title: "Sessão encerrada no celular", hint: "Gere um novo QR Code e leia com o celular.", action: "reconnect" },
  403: { title: "Bloqueado pelo WhatsApp", hint: "Verifique o número no celular antes de tentar reconectar.", action: "none" },
  408: { title: "Queda de rede", hint: "Aguarde alguns minutos. Se continuar, reinicie a instância.", action: "restart" },
  428: { title: "Conexão fechada", hint: "Aguarde alguns minutos. Se continuar, reinicie a instância.", action: "restart" },
  440: { title: "Conexão substituída por outro WhatsApp Web", hint: "Desconecte o outro WhatsApp Web ou reinicie esta instância.", action: "restart" },
  500: { title: "Sessão corrompida", hint: "Apague a instância e pareie de novo.", action: "recreate" },
  515: { title: "Reinício necessário", hint: "Reinicie a instância.", action: "restart" },
};

const ACTION_TEXT: Record<"reconnect" | "restart" | "recreate" | "none", string> = {
  reconnect: "Gere um novo QR Code na tela da instância.",
  restart: "Reinicie a instância na tela da instância.",
  recreate: "Apague a instância e crie de novo.",
  none: "",
};

export function isValidHttpUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function diagnoseConnection(instance: InstanceForDiagnosis): DiagnosticRow {
  const status = instance.connectionStatus;
  const at = instance.disconnectionAt ?? null;

  if (status === "open") {
    return { check: "conexao", level: "ok", title: "Conexão", message: "Conectada.", action: "none", at };
  }

  if (status === "connecting") {
    return {
      check: "conexao",
      level: "warn",
      title: "Conexão",
      message: "Conectando. Se demorar, gere um novo QR Code ou reinicie a instância.",
      action: "open-instance",
      at,
    };
  }

  if (status === "close" || status === "closed") {
    const code = instance.disconnectionReasonCode;
    const known = code != null ? DISCONNECT_REASONS[code] : undefined;
    if (known) {
      const actionText = ACTION_TEXT[known.action];
      return {
        check: "conexao",
        level: "error",
        title: known.title,
        message: [known.hint, actionText].filter(Boolean).join(" "),
        action: known.action === "none" ? "none" : "open-instance",
        at,
      };
    }
    return {
      check: "conexao",
      level: "error",
      title: "Desconectada",
      message: code != null ? `Código ${code} não mapeado. Reinicie a instância e veja se volta.` : "Desconectada, sem código de motivo. Reinicie a instância.",
      action: "open-instance",
      at,
    };
  }

  return { check: "conexao", level: "warn", title: "Conexão", message: `Estado desconhecido: ${status || "vazio"}.`, action: "open-instance", at };
}

export function diagnoseWebhook(webhook: WebhookForDiagnosis | null | undefined, readFailed = false): DiagnosticRow {
  if (readFailed || webhook === undefined) {
    return { check: "webhook", level: "warn", title: "Webhook", message: "Não foi possível ler o webhook desta instância.", action: "open-webhook" };
  }
  if (webhook === null || !webhook.enabled) {
    return {
      check: "webhook",
      level: "error",
      title: "Webhook desligado",
      message: "Sem webhook, o Gestão e o n8n não recebem os eventos desta instância.",
      action: webhook && isValidHttpUrl(webhook.url) ? "enable-webhook" : "open-webhook",
    };
  }
  if (!isValidHttpUrl(webhook.url)) {
    return { check: "webhook", level: "error", title: "Webhook sem URL válida", message: "Informe uma URL http ou https para receber os eventos.", action: "open-webhook" };
  }
  if (!webhook.events || webhook.events.length === 0) {
    return {
      check: "webhook",
      level: "warn",
      title: "Webhook sem eventos",
      message: "Ligado, mas nenhum evento marcado. Nada será enviado.",
      action: "enable-webhook",
    };
  }
  return { check: "webhook", level: "ok", title: "Webhook", message: `Ligado com ${webhook.events.length} evento(s).`, action: "none" };
}

export function diagnoseProxy(proxy: ProxyForDiagnosis | null | undefined): DiagnosticRow {
  if (!proxy || !proxy.enabled) {
    return { check: "proxy", level: "info", title: "Proxy", message: "Desligado. A conexão sai direto.", action: "none" };
  }
  return { check: "proxy", level: "info", title: "Proxy", message: `Ligado (${proxy.protocol ?? "?"}://${proxy.host ?? "?"}).`, action: "none" };
}

// A Evolution não guarda histórico de eventos: só mostramos o último horário de desconexão conhecido.
export function lastEventRow(instance: InstanceForDiagnosis): DiagnosticRow {
  const at = instance.disconnectionAt ?? null;
  return {
    check: "ultimo-evento",
    level: "info",
    title: "Última desconexão",
    message: at ? "Último horário de desconexão registrado pela Evolution." : "Nenhuma desconexão registrada.",
    action: "none",
    at,
  };
}

export function diagnoseInstance(args: { instance: InstanceForDiagnosis; webhook?: WebhookForDiagnosis | null; webhookReadFailed?: boolean; proxy?: ProxyForDiagnosis | null }): DiagnosticRow[] {
  return [diagnoseConnection(args.instance), diagnoseWebhook(args.webhook, args.webhookReadFailed), diagnoseProxy(args.proxy), lastEventRow(args.instance)];
}

// Conta instâncias com erro de conexão (usado no badge do menu).
export function countConnectionErrors(instances: InstanceForDiagnosis[]): number {
  return instances.filter((item) => diagnoseConnection(item).level === "error").length;
}

export const PERIOD_OPTIONS = [
  { value: "1d", label: "Últimas 24 h", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Últimos 30 dias", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "Todo o período", ms: null },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

// Linha com horário fica de fora se for mais antiga que o período. Linha sem horário sempre aparece.
export function withinPeriod(row: Pick<DiagnosticRow, "at">, period: PeriodValue, now: number = Date.now()): boolean {
  const option = PERIOD_OPTIONS.find((item) => item.value === period);
  if (!option || option.ms === null || !row.at) return true;
  const time = new Date(row.at).getTime();
  if (Number.isNaN(time)) return true;
  return now - time <= option.ms;
}
