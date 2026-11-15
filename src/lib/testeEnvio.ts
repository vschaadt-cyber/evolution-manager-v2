// Teste de envio e recebimento de uma instância.
//   1. A instância testada envia um texto para o número de teste.
//   2. Se o número de teste for de OUTRA instância do painel, esta confere se a mensagem chegou (recebimento da outra)
//      e responde; a instância testada confere se a resposta chegou (recebimento da testada).
// Tudo sai do navegador, com o painel aberto. Não existe "resposta automática" na Evolution 2.3.7.

import { soDigitosDoNumero } from "./numero";

export const CHAVE_NUMERO_TESTE = "gestao:numero-teste";

export interface InstanciaTeste {
  name: string;
  token: string;
  ownerJid?: string | null;
  number?: string | null;
}

export interface MensagemRegistro {
  key?: { fromMe?: boolean } | null;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } } | null;
}

export function novoIdTeste(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export const textoTeste = (id: string) => `Teste do painel Gestão [${id}]. Pode ignorar.`;
export const textoResposta = (id: string) => `Resposta do teste [${id}]. Pode ignorar.`;

/** Tem, entre os registros, uma mensagem RECEBIDA com o código do teste? */
export function recebeuTeste(registros: MensagemRegistro[], id: string): boolean {
  return registros.some((registro) => {
    if (registro.key?.fromMe !== false) return false;
    const texto = registro.message?.conversation ?? registro.message?.extendedTextMessage?.text ?? "";
    return texto.includes(`[${id}]`);
  });
}

/** Dono do número de teste entre as instâncias (compara os dígitos; ignora a própria instância testada). */
export function acharInstanciaPorNumero<T extends InstanciaTeste>(lista: T[], numero: string, ignorar: string): T | null {
  const alvo = soDigitosDoNumero(numero);
  if (alvo.length < 8) return null;
  return lista.find((inst) => inst.name !== ignorar && [inst.ownerJid, inst.number].some((valor) => soDigitosDoNumero(valor) === alvo)) ?? null;
}

/** Repete `conferir` até dar true ou acabarem as tentativas. */
export async function aguardar(conferir: () => Promise<boolean>, p: { tentativas: number; intervaloMs: number; esperar: (ms: number) => Promise<void> }): Promise<boolean> {
  for (let i = 0; i < p.tentativas; i++) {
    if (await conferir()) return true;
    if (i < p.tentativas - 1) await p.esperar(p.intervaloMs);
  }
  return false;
}
