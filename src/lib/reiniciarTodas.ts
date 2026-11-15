// Fila do "Reiniciar todas" do Dashboard. Lógica pura (sem React, sem rede): quem chama passa as funções.
//
// Regras:
//   - Um reinício por vez, nunca em paralelo, com 3 s de intervalo entre um e outro.
//   - Uma falha não interrompe as demais: o número vira "falhou" e a fila segue.
//   - A fila só ENVIA o pedido de reinício. Se o número voltou (ou não) em 60 s quem decide é o
//     reinicioInstancia.ts (o mesmo do botão "Reiniciar" de uma instância); aqui só se junta tudo no resumo.

import type { FaseReinicio } from "./reinicioInstancia";

export const INTERVALO_ENTRE_REINICIOS_MS = 3_000;

export type FiltroReinicio = "todas" | "conectadas" | "com_problema";

export const ROTULO_FILTRO: Record<FiltroReinicio, string> = {
  todas: "Todas",
  conectadas: "Só conectadas",
  com_problema: "Só com problema (close/connecting)",
};

/** O pedido de reinício saiu ("enviado"), a chamada falhou ("falhou") ou a fila foi parada antes ("nao_enviado"). */
export type EnvioReinicio = "enviado" | "falhou" | "nao_enviado";

export type EstadoItem = "na_fila" | "enviando" | "reiniciando" | "ok" | "falhou" | "nao_reconectou" | "nao_enviado";

export interface ItemReinicio {
  id: string;
  name: string;
  token: string;
}

/** Instâncias que entram no filtro escolhido. "Com problema" = close/closed/connecting. */
export function selecionarParaReinicio<T extends { connectionStatus: string }>(lista: T[], filtro: FiltroReinicio): T[] {
  if (filtro === "conectadas") return lista.filter((item) => item.connectionStatus === "open");
  if (filtro === "com_problema") return lista.filter((item) => item.connectionStatus === "close" || item.connectionStatus === "closed" || item.connectionStatus === "connecting");
  return [...lista];
}

export interface DepsFila {
  /** Chama a API de reinício. Rejeitar = falhou. */
  reiniciar: (item: ItemReinicio) => Promise<void>;
  esperar: (ms: number) => Promise<void>;
  /** Roda logo antes da chamada (marca o horário do clique, para o timeout de 60 s). */
  antes?: (item: ItemReinicio) => void;
  /** Roda logo depois, com o resultado do envio. */
  depois?: (item: ItemReinicio, envio: "enviado" | "falhou", erro?: unknown) => void;
  /** Consultado antes de cada item: true para parar a fila (os que faltam ficam "nao_enviado"). */
  cancelado?: () => boolean;
  intervaloMs?: number;
}

/** Envia os reinícios em sequência. Devolve o resultado do envio de cada nome. */
export async function executarFila(itens: ItemReinicio[], deps: DepsFila): Promise<Record<string, EnvioReinicio>> {
  const envios: Record<string, EnvioReinicio> = {};
  const intervalo = deps.intervaloMs ?? INTERVALO_ENTRE_REINICIOS_MS;

  for (let i = 0; i < itens.length; i++) {
    if (i > 0) await deps.esperar(intervalo);
    if (deps.cancelado?.()) {
      for (const restante of itens.slice(i)) envios[restante.name] = "nao_enviado";
      break;
    }

    const item = itens[i];
    deps.antes?.(item);
    try {
      await deps.reiniciar(item);
      envios[item.name] = "enviado";
      deps.depois?.(item, "enviado");
    } catch (erro) {
      envios[item.name] = "falhou";
      deps.depois?.(item, "falhou", erro);
    }
  }
  return envios;
}

/**
 * Estado de um número no lote. `temRegistro` = o reinício ainda está sendo acompanhado (reinicioInstancia.ts apaga o
 * registro quando o número volta a "open"). `fase` é a fase atual, se houver ("sem_resposta" = estourou os 60 s).
 */
export function estadoItem(p: { envio?: EnvioReinicio; enviando?: boolean; temRegistro: boolean; fase?: FaseReinicio | null }): EstadoItem {
  if (!p.envio) return p.enviando ? "enviando" : "na_fila";
  if (p.envio === "falhou") return "falhou";
  if (p.envio === "nao_enviado") return "nao_enviado";
  if (!p.temRegistro) return "ok";
  if (p.fase === "sem_resposta") return "nao_reconectou";
  return "reiniciando";
}

export interface ResumoLote {
  total: number;
  ok: number;
  falhou: number;
  naoReconectou: number;
  naoEnviado: number;
  /** Já têm resultado final (inclui os que a fila não chegou a enviar). */
  concluidas: number;
  emAndamento: number;
  terminou: boolean;
}

export function resumirLote(estados: EstadoItem[]): ResumoLote {
  const conta = (alvo: EstadoItem) => estados.filter((estado) => estado === alvo).length;
  const ok = conta("ok");
  const falhou = conta("falhou");
  const naoReconectou = conta("nao_reconectou");
  const naoEnviado = conta("nao_enviado");
  const concluidas = ok + falhou + naoReconectou + naoEnviado;
  return { total: estados.length, ok, falhou, naoReconectou, naoEnviado, concluidas, emAndamento: estados.length - concluidas, terminou: estados.length > 0 && concluidas === estados.length };
}
