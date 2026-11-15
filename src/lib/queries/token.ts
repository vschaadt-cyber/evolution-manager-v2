/* eslint-disable no-unused-vars */
// Credenciais usadas nas chamadas à Evolution.
//   - URL do servidor: fixa (URL_EVOLUTION). Não é mais digitada nem guardada.
//   - API key global: só em memória (some ao recarregar ou fechar a aba). Vem da edge `evolution-manager-key`
//     depois do login no Supabase (contexts/AuthContext.tsx). Nunca vai para localStorage/sessionStorage.
//   - Dados da instância aberta (id, nome, token da instância): seguem no localStorage, como antes.
export enum TOKEN_ID {
  API_URL = "apiUrl",
  TOKEN = "token",
  INSTANCE_ID = "instanceId",
  INSTANCE_NAME = "instanceName",
  INSTANCE_TOKEN = "instanceToken",
}

/** Servidor da Evolution (API). Fixo: o painel só atende este servidor. */
export const URL_EVOLUTION = "https://evo.luminaresc.com.br";

let chaveGlobal: string | null = null;

/** Guarda a API key global em memória (ou limpa, com null). */
export const definirChaveGlobal = (chave: string | null) => {
  chaveGlobal = chave;
};

export const temChaveGlobal = () => !!chaveGlobal;

/** Apaga o que o login antigo (URL do servidor + API key) deixava no navegador. Roda uma vez ao abrir o painel. */
export const limparLoginAntigo = () => {
  try {
    for (const chave of ["apiUrl", "token", "version", "facebookAppId", "facebookConfigId", "facebookUserToken", "clientName"]) {
      localStorage.removeItem(chave);
    }
  } catch {
    // localStorage indisponível: não há o que limpar.
  }
};

/** Limpa a chave em memória e os dados da instância aberta (usado no "Sair"). */
export const logout = () => {
  chaveGlobal = null;
  try {
    localStorage.removeItem(TOKEN_ID.INSTANCE_ID);
    localStorage.removeItem(TOKEN_ID.INSTANCE_NAME);
    localStorage.removeItem(TOKEN_ID.INSTANCE_TOKEN);
  } catch {
    // localStorage indisponível
  }
};

export const getToken = (token: TOKEN_ID) => {
  if (token === TOKEN_ID.API_URL) return URL_EVOLUTION;
  if (token === TOKEN_ID.TOKEN) return chaveGlobal;
  return localStorage.getItem(token);
};
