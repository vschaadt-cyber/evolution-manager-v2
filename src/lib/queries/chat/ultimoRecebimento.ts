import { useQuery } from "@tanstack/react-query";

import { extrairUltimoRecebimento, RegistroMensagem } from "@/lib/ultimoRecebimento";

import { api } from "../api";

const POR_PAGINA = 50;
const MAX_PAGINAS = 3;

/** Horário (ms) da última mensagem recebida, ou null se não há nenhuma nas últimas 150 mensagens guardadas. */
export async function buscarUltimoRecebimento(instanceName: string, token: string): Promise<number | null> {
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const resposta = await api.post(`/chat/findMessages/${instanceName}`, { where: {}, page, offset: POR_PAGINA }, { headers: { apikey: token } });
    const dados = resposta.data?.messages;
    const registros: RegistroMensagem[] = Array.isArray(dados?.records) ? dados.records : Array.isArray(dados) ? dados : [];
    const achou = extrairUltimoRecebimento(registros);
    if (achou !== null) return achou;
    if (registros.length < POR_PAGINA) break;
  }
  return null;
}

export const useUltimoRecebimento = (instanceName: string, token: string, enabled = true) =>
  useQuery<number | null>({
    queryKey: ["chat", "ultimoRecebimento", instanceName],
    queryFn: () => buscarUltimoRecebimento(instanceName, token),
    enabled: enabled && !!instanceName && !!token,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
