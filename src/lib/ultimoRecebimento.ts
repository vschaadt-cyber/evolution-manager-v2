// "Último recebimento" de uma instância: a mensagem mais recente RECEBIDA (fromMe=false).
// Na Evolution 2.3.7 o /chat/findMessages ignora o filtro fromMe=false (testa o valor como verdadeiro), então o painel
// busca as mensagens mais recentes (ordem decrescente) e escolhe a primeira recebida.

export const LIMITE_AMARELO_MS = 2 * 60 * 60 * 1000;
export const LIMITE_VERMELHO_MS = 6 * 60 * 60 * 1000;

export interface RegistroMensagem {
  key?: { fromMe?: boolean } | null;
  messageTimestamp?: number | string | null;
}

/** Horário (ms) da primeira mensagem recebida da lista (já em ordem do mais recente para o mais antigo). */
export function extrairUltimoRecebimento(registros: RegistroMensagem[]): number | null {
  for (const registro of registros) {
    if (registro.key?.fromMe !== false) continue;
    const segundos = Number(registro.messageTimestamp);
    if (Number.isFinite(segundos) && segundos > 0) return segundos * 1000;
  }
  return null;
}

/** Horário comercial: segunda a sábado, das 8h às 18h (fuso de Brasília). */
export function emHorarioComercial(agoraMs: number): boolean {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(agoraMs));
  const dia = partes.find((p) => p.type === "weekday")?.value;
  const hora = Number(partes.find((p) => p.type === "hour")?.value);
  return dia !== "Sun" && hora >= 8 && hora < 18;
}

export type NivelRecebimento = "normal" | "amarelo" | "vermelho";

/** Amarelo acima de 2 h, vermelho acima de 6 h. Só destaca em horário comercial; fora dele fica normal. */
export function nivelRecebimento(ultimoMs: number | null, agoraMs: number): NivelRecebimento {
  if (ultimoMs === null || !emHorarioComercial(agoraMs)) return "normal";
  const atraso = agoraMs - ultimoMs;
  if (atraso > LIMITE_VERMELHO_MS) return "vermelho";
  if (atraso > LIMITE_AMARELO_MS) return "amarelo";
  return "normal";
}

/** "há 12 min", "há 3 h 20 min", "há 2 dias". */
export function haQuantoTempo(ultimoMs: number, agoraMs: number): string {
  const min = Math.max(0, Math.floor((agoraMs - ultimoMs) / 60_000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h${min % 60 ? ` ${min % 60} min` : ""}`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}
