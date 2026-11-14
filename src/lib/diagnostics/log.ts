// Log de diagnóstico do painel: o que aconteceu com cada número (queda, reconexão, reinício, alerta,
// mensagens atrasadas, envio que falhou, mídia que não baixou) e as mensagens uma a uma.
// Os dados vêm do Gestão, pela edge evolution-painel-acesso (ação diagnostico), que confere a chave global
// da sessão do painel. Aqui ficam a chamada e as regras puras de texto, filtro e agrupamento (testadas).

const URL_FUNCAO = "https://mqbixvpyoqrofnmfadjd.supabase.co/functions/v1/evolution-painel-acesso";

export type NivelLog = "erro" | "aviso" | "info" | "ok";

export type TipoEventoLog =
  | "reconexao"
  | "conectou"
  | "reconectando"
  | "queda"
  | "reinicio"
  | "desconexao"
  | "alerta_atraso"
  | "alerta_silencio"
  | "envio_falhou"
  | "midia_erro"
  | "lote_atrasado"
  | "servidor_reiniciou";

export interface EventoLog {
  em: string;
  instancia_id: string | null;
  tipo: TipoEventoLog | string;
  nivel: NivelLog;
  estado?: string | null;
  origem?: string | null;
  usuario?: string | null;
  contato?: string | null;
  texto?: string | null;
  valor_s?: number | null;
  n?: number | null;
  fim?: string | null;
  /** Só no evento "servidor_reiniciou": nomes dos números que voltaram juntos. */
  numeros?: string[];
}

export interface NumeroLog {
  id: string;
  nome: string;
  exibicao: string;
  numero: string | null;
  conexao_estado: string | null;
  conexao_em: string | null;
  saude: "tempo_real" | "atrasada" | "sem_eventos" | null;
  atraso_mediano_s: number | null;
  medido_em: string | null;
  ultima_recebida_em: string | null;
  ultima_enviada_em: string | null;
  recebidas: number;
  enviadas: number;
  atrasadas: number;
  midias_erro: number;
  quedas: number;
  reinicios: number;
  falhas_envio: number;
  alerta_aberto: boolean;
}

export interface MensagemLog {
  em: string;
  enviado_em: string | null;
  instancia_id: string;
  from_me: boolean;
  tipo: string | null;
  status: string | null;
  origem: string | null;
  contato: string | null;
  telefone: string | null;
  grupo: boolean;
  previa: string | null;
  atraso_s: number | null;
  midia_erro: string | null;
  apagada: boolean;
}

export interface RespostaLog {
  agora: string;
  desde: string;
  limite: number;
  reinicio_automatico: boolean | null;
  instancias: NumeroLog[];
  eventos: EventoLog[];
  mensagens: MensagemLog[];
}

export type ModoMensagens = "nenhuma" | "problemas" | "todas";

export class LogNaoAutorizado extends Error {}

export async function buscarLog(p: { chave: string; instanciaId?: string | null; horas: number; limite?: number; mensagens?: ModoMensagens }): Promise<RespostaLog> {
  const resposta = await fetch(URL_FUNCAO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "diagnostico", chave: p.chave, instancia_id: p.instanciaId ?? null, horas: p.horas, limite: p.limite ?? 500, mensagens: p.mensagens ?? "nenhuma" }),
  });
  const corpo = (await resposta.json().catch(() => null)) as (Partial<RespostaLog> & { ok?: boolean; erro?: string }) | null;
  if (resposta.status === 401) throw new LogNaoAutorizado("Não autorizado");
  if (!resposta.ok || !corpo?.ok) throw new Error(corpo?.erro ?? "Não foi possível ler o log agora");
  return {
    agora: corpo.agora ?? new Date().toISOString(),
    desde: corpo.desde ?? "",
    limite: corpo.limite ?? 0,
    reinicio_automatico: corpo.reinicio_automatico ?? null,
    instancias: corpo.instancias ?? [],
    eventos: corpo.eventos ?? [],
    mensagens: corpo.mensagens ?? [],
  };
}

export const PERIODOS_LOG = [
  { horas: 6, rotulo: "Últimas 6 h" },
  { horas: 24, rotulo: "Últimas 24 h" },
  { horas: 72, rotulo: "Últimos 3 dias" },
  { horas: 168, rotulo: "Últimos 7 dias" },
] as const;

/** "45 s", "12 min", "3 h 05 min", "2 d 4 h". */
export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos == null || Number.isNaN(segundos)) return "—";
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** "há 3 min", "há 2 h 10 min". Sem data: "nunca". */
export function haQuanto(iso: string | null | undefined, agora: number = Date.now()): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (agora - t) / 1000);
  return s < 60 ? "agora há pouco" : `há ${formatarDuracao(s)}`;
}

function segundosEntre(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null;
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.max(0, (b - a) / 1000);
}

function hora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const TIPO_MIDIA: Record<string, string> = { imagem: "imagem", audio: "áudio", video: "vídeo", documento: "documento", sticker: "figurinha" };

/** Título e detalhe, em português simples, de uma linha do log. */
export function descreverEvento(ev: EventoLog): { titulo: string; detalhe: string } {
  const quem = ev.usuario?.trim() || "usuário não identificado";
  switch (ev.tipo) {
    case "reconexao":
      return { titulo: `Conexão caiu e voltou em ${formatarDuracao(ev.valor_s)}`, detalhe: "Queda rápida: o WhatsApp derrubou a conexão e a Evolution reconectou sozinha." };
    case "conectou":
      return { titulo: "Conectou", detalhe: "O número ficou conectado ao WhatsApp." };
    case "reconectando":
      return ev.fim
        ? { titulo: `Ficou ${formatarDuracao(ev.valor_s)} tentando reconectar`, detalhe: "Nesse tempo o número não enviou nem recebeu." }
        : { titulo: `Tentando reconectar há ${formatarDuracao(ev.valor_s)}`, detalhe: "Ainda não voltou. Se continuar, reinicie o número ou gere um novo QR Code." };
    case "queda": {
      const titulo = ev.estado === "refused" ? "Conexão recusada pelo WhatsApp" : "Conexão caiu";
      return ev.fim
        ? { titulo, detalhe: `Ficou fora por ${formatarDuracao(ev.valor_s)}.` }
        : { titulo, detalhe: `Fora do ar há ${formatarDuracao(ev.valor_s)}. Reinicie o número ou gere um novo QR Code.` };
    }
    case "reinicio":
      if (ev.origem === "vigia") {
        const motivo = ev.texto || "recebimento atrasado";
        return { titulo: "Reiniciado automaticamente pelo vigia", detalhe: `Motivo: ${motivo}${ev.valor_s != null ? ` (${formatarDuracao(ev.valor_s)} de atraso)` : ""}.` };
      }
      return { titulo: `Reiniciado por ${quem}`, detalhe: ev.origem === "manager" ? "Feito neste painel." : "Feito pelo Gestão." };
    case "desconexao":
      return { titulo: `Desconectado por ${quem}`, detalhe: ev.origem === "manager" ? "Feito neste painel." : "Feito pelo Gestão." };
    case "alerta_atraso": {
      const durou = segundosEntre(ev.em, ev.fim);
      const reinicios = ev.n ? ` ${ev.n} reinício(s) automático(s).` : "";
      return {
        titulo: `Recebimento atrasado (mensagens chegando com ${formatarDuracao(ev.valor_s)} de atraso)`,
        detalhe: ev.fim ? `Voltou ao normal às ${hora(ev.fim)} (durou ${formatarDuracao(durou)}).${reinicios}` : `Ainda aberto.${reinicios}`,
      };
    }
    case "alerta_silencio": {
      const durou = segundosEntre(ev.em, ev.fim);
      return {
        titulo: `Conectado, mas sem receber mensagem${ev.valor_s != null ? ` há ${formatarDuracao(ev.valor_s)}` : ""}`,
        detalhe: ev.fim ? `Voltou a receber às ${hora(ev.fim)} (durou ${formatarDuracao(durou)}).` : "Ainda aberto.",
      };
    }
    case "envio_falhou":
      return { titulo: `Envio falhou${ev.contato ? ` para ${ev.contato}` : ""}`, detalhe: ev.texto || "Sem motivo informado." };
    case "midia_erro": {
      const midia = TIPO_MIDIA[ev.estado ?? ""] ?? "mídia";
      if (ev.texto === "muito_grande") return { titulo: `Arquivo grande demais (${midia}${ev.contato ? ` de ${ev.contato}` : ""})`, detalhe: "Acima de 20 MB: só abre no celular." };
      return { titulo: `Mídia não baixou (${midia}${ev.contato ? ` de ${ev.contato}` : ""})`, detalhe: `Motivo: ${ev.texto || "desconhecido"}${ev.n ? `. Tentativas: ${ev.n}` : ""}.` };
    }
    case "lote_atrasado":
      return {
        titulo: `${ev.n ?? 0} ${ev.n === 1 ? "mensagem chegou atrasada" : "mensagens chegaram atrasadas"}`,
        detalhe: `Atraso de até ${formatarDuracao(ev.valor_s)}. Entraram no Gestão entre ${hora(ev.em)} e ${hora(ev.fim)}. Veja quais em Mensagens.`,
      };
    case "servidor_reiniciou":
      return { titulo: `Evolution reiniciou: ${ev.n ?? 0} números reconectaram juntos`, detalhe: (ev.numeros ?? []).join(", ") };
    default:
      return { titulo: String(ev.tipo), detalhe: ev.texto ?? "" };
  }
}

/**
 * Quando 3 ou mais números reconectam na mesma janela (90 s), foi a Evolution (o servidor) que reiniciou,
 * não cada número. Troca essas linhas por uma só, "servidor_reiniciou". A lista de entrada vem do mais novo para o mais antigo.
 */
export function juntarReinicioDoServidor(eventos: EventoLog[], nomes: Record<string, string>, minimo = 3, janelaMs = 90_000): EventoLog[] {
  const ehVolta = (ev: EventoLog) => (ev.tipo === "reconexao" || ev.tipo === "conectou") && !!ev.instancia_id;
  const saida: EventoLog[] = [];
  const usados = new Set<number>();

  eventos.forEach((ev, i) => {
    if (usados.has(i)) return;
    if (!ehVolta(ev)) {
      saida.push(ev);
      return;
    }
    const base = new Date(ev.em).getTime();
    const grupo: number[] = [i];
    const instancias = new Set<string>([ev.instancia_id!]);
    for (let j = i + 1; j < eventos.length; j++) {
      const outro = eventos[j];
      const t = new Date(outro.em).getTime();
      if (base - t > janelaMs) break;
      if (usados.has(j) || !ehVolta(outro) || instancias.has(outro.instancia_id!)) continue;
      grupo.push(j);
      instancias.add(outro.instancia_id!);
    }
    if (instancias.size < minimo) {
      saida.push(ev);
      return;
    }
    grupo.forEach((indice) => usados.add(indice));
    saida.push({
      em: ev.em,
      instancia_id: null,
      tipo: "servidor_reiniciou",
      nivel: "aviso",
      origem: "evolution",
      n: instancias.size,
      numeros: [...instancias].map((id) => nomes[id] ?? id).sort((a, b) => a.localeCompare(b)),
    });
  });
  return saida;
}

export type FiltroLog = "problemas" | "tudo" | "conexao" | "reinicios" | "mensagens";

export const FILTROS_LOG: { valor: FiltroLog; rotulo: string }[] = [
  { valor: "problemas", rotulo: "Problemas" },
  { valor: "conexao", rotulo: "Quedas e conexão" },
  { valor: "reinicios", rotulo: "Reinícios" },
  { valor: "mensagens", rotulo: "Mensagens e mídia" },
  { valor: "tudo", rotulo: "Tudo" },
];

const TIPOS_CONEXAO = ["reconexao", "conectou", "reconectando", "queda", "desconexao", "servidor_reiniciou"];
const TIPOS_REINICIO = ["reinicio", "servidor_reiniciou"];
const TIPOS_MENSAGEM = ["lote_atrasado", "envio_falhou", "midia_erro", "alerta_atraso", "alerta_silencio"];

/** "Problemas" deixa de fora a queda rápida que voltou sozinha e o "conectou": eles aparecem em Quedas e conexão. */
export function filtrarEventos(eventos: EventoLog[], filtro: FiltroLog, instanciaId: string | null = null): EventoLog[] {
  return eventos.filter((ev) => {
    if (instanciaId && ev.instancia_id && ev.instancia_id !== instanciaId) return false;
    if (filtro === "tudo") return true;
    if (filtro === "conexao") return TIPOS_CONEXAO.includes(ev.tipo);
    if (filtro === "reinicios") return TIPOS_REINICIO.includes(ev.tipo);
    if (filtro === "mensagens") return TIPOS_MENSAGEM.includes(ev.tipo);
    if (ev.tipo === "reconexao" || ev.tipo === "conectou") return false;
    if (ev.tipo === "midia_erro" && ev.nivel === "info") return false;
    return true;
  });
}

/** Agrupa por dia (data local), mantendo a ordem de chegada. */
export function agruparPorDia<T extends { em: string }>(linhas: T[]): { dia: string; linhas: T[] }[] {
  const grupos: { dia: string; linhas: T[] }[] = [];
  for (const linha of linhas) {
    const d = new Date(linha.em);
    const dia = Number.isNaN(d.getTime()) ? "Sem data" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.linhas.push(linha);
    else grupos.push({ dia, linhas: [linha] });
  }
  return grupos;
}

export interface SituacaoNumero {
  rotulo: string;
  nivel: NivelLog;
  explicacao: string;
}

/** Selo do cartão do número: junta o estado da conexão com a saúde do recebimento medida pelo vigia. */
export function situacaoDoNumero(n: Pick<NumeroLog, "conexao_estado" | "saude" | "atraso_mediano_s" | "alerta_aberto">): SituacaoNumero {
  if (n.conexao_estado === "connecting") return { rotulo: "Reconectando", nivel: "aviso", explicacao: "Tentando voltar. Se demorar, reinicie o número." };
  if (n.conexao_estado !== "open") return { rotulo: "Desconectado", nivel: "erro", explicacao: "Não envia nem recebe. Gere um novo QR Code ou reinicie o número." };
  if (n.saude === "atrasada") return { rotulo: `Atrasado (${formatarDuracao(n.atraso_mediano_s)})`, nivel: "erro", explicacao: "Conectado, mas as mensagens estão chegando com atraso." };
  if (n.alerta_aberto) return { rotulo: "Com alerta aberto", nivel: "aviso", explicacao: "Conectado, com alerta de recebimento ainda aberto." };
  if (n.saude === "tempo_real") return { rotulo: "Tempo real", nivel: "ok", explicacao: "Conectado e recebendo na hora." };
  return { rotulo: "Conectado", nivel: "ok", explicacao: "Conectado. Nenhuma mensagem nova nos últimos 5 min." };
}

/** Uma queda a cada 4 h ou mais é sinal de problema (a conexão normal fica dias sem cair). */
export function quedasDemais(quedas: number, horas: number): boolean {
  return quedas > Math.max(2, Math.ceil(horas / 4));
}

export interface SituacaoMensagem {
  rotulo: string;
  nivel: NivelLog;
}

const STATUS_ENVIO: Record<string, string> = { enviada: "Enviada", entregue: "Entregue", lida: "Lida", erro: "Erro", pendente: "Pendente" };

export function situacaoDaMensagem(m: Pick<MensagemLog, "from_me" | "status" | "atraso_s" | "midia_erro" | "apagada">): SituacaoMensagem {
  if (m.midia_erro && m.midia_erro !== "muito_grande") return { rotulo: `Mídia não baixou: ${m.midia_erro}`, nivel: "aviso" };
  if (m.atraso_s != null && m.atraso_s >= 300 && m.atraso_s <= 259200) return { rotulo: `Chegou com ${formatarDuracao(m.atraso_s)} de atraso`, nivel: "erro" };
  if (m.apagada) return { rotulo: "Apagada", nivel: "info" };
  if (m.from_me) return { rotulo: STATUS_ENVIO[m.status ?? ""] ?? m.status ?? "Enviada", nivel: m.status === "erro" ? "erro" : "ok" };
  return { rotulo: "Recebida na hora", nivel: "ok" };
}
