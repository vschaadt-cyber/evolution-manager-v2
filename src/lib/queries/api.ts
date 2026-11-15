import axios from "axios";

import { getToken, TOKEN_ID } from "./token";

export const api = axios.create({
  timeout: 30000,
});

api.interceptors.request.use(
  async (config) => {
    const apiUrl = getToken(TOKEN_ID.API_URL);
    if (apiUrl) {
      config.baseURL = apiUrl.toString();
    }

    // Só completa a chave se a chamada não trouxe uma (sem diferenciar apikey/apiKey). Antes, a chave de outra
    // instância guardada no navegador sobrescrevia a passada pela chamada, o que quebraria ações em várias instâncias.
    if (!config.headers.get("apikey")) {
      const token = getToken(TOKEN_ID.INSTANCE_TOKEN);
      if (token) {
        config.headers.apikey = `${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export const apiGlobal = axios.create({
  timeout: 30000,
});

apiGlobal.interceptors.request.use(
  async (config) => {
    const apiUrl = getToken(TOKEN_ID.API_URL);
    if (apiUrl) {
      config.baseURL = apiUrl.toString();
    }

    if (!config.headers.get("apikey")) {
      const token = getToken(TOKEN_ID.TOKEN);
      if (token) {
        config.headers.apikey = `${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
