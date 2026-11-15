/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Hash curto do commit do painel, injetado no build pelo Vite (define). */
declare const __PAINEL_COMMIT__: string;
