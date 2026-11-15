// Integração com o Gestão quando o painel abre embutido (iframe) dentro dele.
//
// 1. Modo embutido (?embed=1 ou o painel está num iframe): esconde o cabeçalho e o menu, mantém só o conteúdo.
// 2. Tema: o Gestão envia { type: "gestao:tema", tema } por postMessage. O painel só aceita de origens do Gestão.
//    O painel avisa "evolution:pronto" para essas origens quando carrega, para o Gestão mandar o tema.
// O acesso é sempre pelo login com e-mail e senha (contexts/AuthContext.tsx). A entrada antiga por
// ?acesso=<token> (troca do token pela chave, guardada no navegador) foi removida.

/** Endereço do Gestão que pode embutir o painel (sem curinga). */
export const ORIGENS_GESTAO = ["https://omni-hr-hub-tqwf.vercel.app", "https://gestao.luminaresc.com.br"] as const;

/** Painel carregado dentro do Gestão (parâmetro embed=1 ou iframe). */
export function ehEmbutido(): boolean {
  if (new URLSearchParams(window.location.search).get("embed") === "1") return true;
  try {
    return window.self !== window.top;
  } catch {
    return true; // acesso ao topo bloqueado = está num iframe de outra origem
  }
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
