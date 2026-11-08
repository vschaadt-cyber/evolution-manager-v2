// Histórico de reinício, desconexão e reconexão de uma instância (quem fez e quando).
// Grava e lê pela edge evolution-painel-acesso (ações registrar e eventos). Autoriza com a chave da própria
// instância, que o Manager já tem; a chave nunca é exibida nem entra no detalhe.
// Gravar é "melhor esforço": se falhar, a ação na Evolution segue e só o histórico fica sem o evento.

const URL_FUNCAO = "https://mqbixvpyoqrofnmfadjd.supabase.co/functions/v1/evolution-painel-acesso";
const CHAVE_USUARIO_PAINEL = "gestao:painel-usuario";

export type TipoEventoInstancia = "reinicio" | "desconexao" | "conexao";

export interface EventoInstancia {
  id: string;
  tipo: string;
  estado: string | null;
  estado_anterior: string | null;
  origem: string;
  usuario: string | null;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
}

/** Nome de quem abriu o painel pelo Gestão (vem da troca do token). Sem nome: null. */
export function guardarUsuarioPainel(nome: string | null): void {
  try {
    if (nome) localStorage.setItem(CHAVE_USUARIO_PAINEL, nome);
    else localStorage.removeItem(CHAVE_USUARIO_PAINEL);
  } catch {
    // localStorage indisponível: o evento segue sem o nome.
  }
}

export function usuarioDoPainel(): string | null {
  try {
    return localStorage.getItem(CHAVE_USUARIO_PAINEL);
  } catch {
    return null;
  }
}

export async function registrarEventoInstancia(p: { instanciaId: string; chaveInstancia: string; tipo: TipoEventoInstancia; detalhe?: Record<string, unknown> }): Promise<void> {
  try {
    const resposta = await fetch(URL_FUNCAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "registrar",
        instancia_id: p.instanciaId,
        chave_instancia: p.chaveInstancia,
        tipo: p.tipo,
        usuario: usuarioDoPainel(),
        detalhe: p.detalhe ?? {},
      }),
    });
    if (!resposta.ok) console.warn("[historico] evento não gravado", p.tipo, resposta.status);
  } catch {
    console.warn("[historico] evento não gravado (sem conexão)", p.tipo);
  }
}

export async function listarEventosInstancia(p: { instanciaId: string; chaveInstancia: string; limite?: number }): Promise<EventoInstancia[]> {
  const resposta = await fetch(URL_FUNCAO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "eventos", instancia_id: p.instanciaId, chave_instancia: p.chaveInstancia, limite: p.limite ?? 50 }),
  });
  const corpo = (await resposta.json().catch(() => null)) as { ok?: boolean; eventos?: EventoInstancia[]; erro?: string } | null;
  if (!resposta.ok || !corpo?.ok) throw new Error(corpo?.erro ?? "Não foi possível ler o histórico");
  return corpo.eventos ?? [];
}
