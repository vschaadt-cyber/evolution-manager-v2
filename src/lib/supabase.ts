// Cliente do Supabase do Gestão: o painel usa só o Auth (login com e-mail e senha) e a edge
// `evolution-manager-key`. A URL e a anon key vêm do build (.env.production). A anon key é pública.
// A API key da Evolution nunca fica aqui nem no .env: vem da edge e fica só em memória (lib/queries/token.ts).
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Só a sessão do Supabase fica salva no navegador: abrir /manager de novo entra direto até clicar em "Sair".
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "gestao-painel-sessao",
  },
});
