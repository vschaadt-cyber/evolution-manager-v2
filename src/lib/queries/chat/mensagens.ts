import type { MensagemRegistro } from "@/lib/testeEnvio";

import { api } from "../api";

/** Envia um texto pela instância. `numero`: só dígitos com DDI (ex.: 5547999999999). */
export async function enviarTexto(instanceName: string, token: string, numero: string, text: string): Promise<void> {
  await api.post(`/message/sendText/${instanceName}`, { number: numero, text }, { headers: { apikey: token } });
}

/** Mensagens mais recentes guardadas pela instância (a mais nova primeiro). */
export async function mensagensRecentes(instanceName: string, token: string, quantidade = 20): Promise<MensagemRegistro[]> {
  const resposta = await api.post(`/chat/findMessages/${instanceName}`, { where: {}, page: 1, offset: quantidade }, { headers: { apikey: token } });
  const registros = resposta.data?.messages?.records;
  return Array.isArray(registros) ? registros : [];
}
