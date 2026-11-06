// Integração com o Gestão: o painel abre embutido (iframe) dentro do Gestão, já autenticado.
//
// 1. Entrada com ?acesso=<token> (token de uso único, 60 s, gerado pelo Gestão): troca o token pela chave
//    na edge `evolution-painel-acesso` e guarda a chave na sessão do painel (mesmo localStorage do login por chave).
//    Depois limpa o parâmetro da URL. Token inválido ou expirado: vai para o login com aviso.
// 2. Modo embutido (?embed=1 ou o painel está num iframe): esconde o cabeçalho e o menu, mantém só o conteúdo.
// 3. Tema: o Gestão envia { type: "gestao:tema", tema } por postMessage. O painel só aceita de origens do Gestão.
//    O painel avisa "evolution:pronto" para essas origens quando carrega, para o Gestão mandar o tema.

import { verifyCreds } from "@/lib/queries/auth/verifyCreds";
import { verifyServer } from "@/lib/queries/auth/verifyServer";
import { saveToken } from "@/lib/queries/token";

/** Endereço do Gestão que pode embutir o painel (sem curinga). */
export const ORIGENS_GESTAO = ["https://omni-hr-hub-tqwf.vercel.app", "https://gestao.luminaresc.com.br"] as const;

const URL_TROCA_ACESSO = "https://mqbixvpyoqrofnmfadjd.supabase.co/functions/v1/evolution-painel-acesso";

export const MENSAGEM_LINK_EXPIRADO = "Link expirado, reabra pelo Gestão";

/** Painel carregado dentro do Gestão (parâmetro embed=1 ou iframe). */
export function ehEmbutido(): boolean {
  if (new URLSearchParams(window.location.search).get("embed") === "1") return true;
  try {
    return window.self !== window.top;
  } catch {
    return true; // acesso ao topo bloqueado = está num iframe de outra origem
  }
}

/** Troca o token de uso único pela chave e grava a sessão. Retorna false se o token não serve. */
async function trocarToken(token: string): Promise<boolean> {
  const url = window.location.origin;
  try {
    const resposta = await fetch(URL_TROCA_ACESSO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "trocar", token }),
    });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json()) as { ok?: boolean; chave?: string };
    if (!corpo.ok || !corpo.chave) return false;

    // Mesmo caminho do login por chave: confere o servidor e a chave antes de gravar a sessão.
    const servidor = await verifyServer({ url });
    if (!servidor?.version) return false;
    const confere = await verifyCreds({ url, token: corpo.chave });
    if (!confere) return false;

    saveToken({ version: servidor.version, clientName: servidor.clientName, url, token: corpo.chave });
    return true;
  } catch {
    return false;
  }
}

/**
 * Roda antes de a aplicação montar. Se a URL tem ?acesso=, troca o token e limpa a URL.
 * Com token inválido, deixa a URL em /manager/login?motivo=link-expirado (login normal por chave).
 */
export async function tratarAcessoDaUrl(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("acesso");
  if (!token) return;

  const ok = await trocarToken(token);
  params.delete("acesso");

  if (ok) {
    const busca = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${busca ? `?${busca}` : ""}`);
    return;
  }
  params.set("motivo", "link-expirado");
  window.history.replaceState(null, "", `/manager/login?${params.toString()}`);
}

/** Origem válida de quem enviou a mensagem: está na lista e é o pai desta janela. */
export function origemDoGestaoValida(evento: MessageEvent): boolean {
  return ORIGENS_GESTAO.includes(evento.origin as (typeof ORIGENS_GESTAO)[number]) && evento.source === window.parent;
}

/** Avisa o Gestão que o painel carregou (ele responde com o tema). Destino: só as origens do Gestão. */
export function avisarGestaoPronto(): void {
  if (!ehEmbutido()) return;
  for (const origem of ORIGENS_GESTAO) {
    window.parent.postMessage({ type: "evolution:pronto" }, origem);
  }
}
