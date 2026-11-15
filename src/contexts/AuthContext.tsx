// Login do painel: e-mail e senha no Supabase Auth do Gestão.
//
// Depois do login (ou ao abrir o painel com a sessão do Supabase ainda válida), busca a API key global da
// Evolution na edge `evolution-manager-key` e guarda só em memória. A edge só entrega para master_admin.
//   carregando    → conferindo a sessão salva / buscando a chave
//   sem-sessao    → sem login (ou a sessão expirou e não deu para renovar): as rotas mandam para o login
//   pronto        → sessão válida e chave em memória
//   erro          → sessão válida, mas a chave não veio (rede, edge fora do ar): tela com "Tentar de novo"
// "Sair" faz signOut no Supabase e limpa a chave.
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { guardarUsuarioPainel } from "@/lib/historicoInstancia";
import { queryClient } from "@/lib/queries/react-query";
import { definirChaveGlobal, limparLoginAntigo, logout as limparCredenciais } from "@/lib/queries/token";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

export type EstadoAuth = "carregando" | "sem-sessao" | "pronto" | "erro";

type ResultadoChave = "ok" | "sem-permissao" | "sessao-invalida" | "erro";

interface AuthContextValue {
  estado: EstadoAuth;
  email: string | null;
  /** Faz o login. Devolve null se entrou, ou a mensagem de erro (em português) para mostrar na tela. */
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  tentarDeNovo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const MENSAGEM_SEM_PERMISSAO = "Sem permissão";

/** Mensagem em português para o erro de login do Supabase. */
export function mensagemErroLogin(erro: { code?: string; status?: number; message?: string } | null): string {
  const codigo = erro?.code ?? "";
  const texto = (erro?.message ?? "").toLowerCase();
  if (codigo === "invalid_credentials" || texto.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (codigo === "email_not_confirmed" || texto.includes("email not confirmed")) return "E-mail ainda não confirmado.";
  if (codigo === "user_banned" || texto.includes("banned")) return "Usuário bloqueado. Fale com o administrador.";
  if (erro?.status === 429 || codigo.includes("rate_limit")) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (texto.includes("fetch") || texto.includes("network")) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "Não foi possível entrar. Tente de novo.";
}

/** Pede a API key global à edge e guarda em memória. */
async function buscarChave(session: Session): Promise<ResultadoChave> {
  try {
    const resposta = await fetch(`${SUPABASE_URL}/functions/v1/evolution-manager-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: "{}",
    });
    if (resposta.status === 403) return "sem-permissao";
    if (resposta.status === 401) return "sessao-invalida";
    if (!resposta.ok) return "erro";
    const corpo = (await resposta.json()) as { ok?: boolean; chave?: string; usuario?: string | null };
    if (!corpo.ok || !corpo.chave) return "erro";
    definirChaveGlobal(corpo.chave);
    guardarUsuarioPainel(corpo.usuario ?? session.user.email ?? null);
    return "ok";
  } catch {
    return "erro";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>("carregando");
  const [email, setEmail] = useState<string | null>(null);
  // Durante o login pelo formulário, quem decide o estado é o `entrar` (evita piscar a tela de erro).
  const entrando = useRef(false);

  const limparTudo = useCallback(() => {
    limparCredenciais();
    guardarUsuarioPainel(null);
    queryClient.clear();
    setEmail(null);
    setEstado("sem-sessao");
  }, []);

  /** Sessão salva → busca a chave. Sem sessão, sem permissão ou sessão inválida → login. */
  const carregar = useCallback(async () => {
    setEstado("carregando");
    // getSession renova o token se ele já venceu; se não der para renovar, devolve sessão nula.
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      limparTudo();
      return;
    }
    const resultado = await buscarChave(session);
    if (resultado === "ok") {
      setEmail(session.user.email ?? null);
      setEstado("pronto");
    } else if (resultado === "erro") {
      setEmail(session.user.email ?? null);
      setEstado("erro");
    } else {
      await supabase.auth.signOut();
      limparTudo();
    }
  }, [limparTudo]);

  useEffect(() => {
    limparLoginAntigo();
    carregar();

    // Sessão encerrada (Sair, em outra aba, ou token vencido sem renovação): limpa a chave e volta ao login.
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT" && !entrando.current) limparTudo();
    });
    return () => data.subscription.unsubscribe();
  }, [carregar, limparTudo]);

  const entrar = useCallback(
    async (emailDigitado: string, senha: string): Promise<string | null> => {
      entrando.current = true;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: emailDigitado.trim(), password: senha });
        if (error || !data.session) return mensagemErroLogin(error);

        const resultado = await buscarChave(data.session);
        if (resultado === "ok") {
          setEmail(data.session.user.email ?? null);
          setEstado("pronto");
          return null;
        }
        // Não é master_admin (ou a chave não veio): não fica logado no painel.
        await supabase.auth.signOut();
        limparTudo();
        if (resultado === "sem-permissao") return MENSAGEM_SEM_PERMISSAO;
        return "Não foi possível carregar o painel. Tente de novo em instantes.";
      } catch {
        return "Sem conexão com o servidor. Confira a internet e tente de novo.";
      } finally {
        entrando.current = false;
      }
    },
    [limparTudo],
  );

  const sair = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      limparTudo();
    }
  }, [limparTudo]);

  const valor = useMemo<AuthContextValue>(() => ({ estado, email, entrar, sair, tentarDeNovo: carregar }), [estado, email, entrar, sair, carregar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro do AuthProvider");
  return contexto;
}
