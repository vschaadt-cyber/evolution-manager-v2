// Perfil do número no WhatsApp (nome, foto e recado). Endpoints da Evolution 2.3.7: /chat/fetchProfile,
// /chat/updateProfileName, /chat/updateProfilePicture e /chat/updateProfileStatus.

import { api } from "../api";

export interface PerfilInstancia {
  name: string | null;
  picture: string | null;
  /** Recado (“Info”) do WhatsApp. */
  status: string | null;
}

/** Só os dígitos de um número ou JID (ex.: 5547999999999@s.whatsapp.net → 5547999999999). */
export const soDigitosDoNumero = (valor: string | null | undefined) => (valor ?? "").split("@")[0].replace(/\D/g, "");

/** Lê o perfil do próprio número. Passa o número para a Evolution devolver o recado (sem número ela devolve o estado da conexão). */
export async function buscarPerfil(instanceName: string, token: string, ownerJid: string): Promise<PerfilInstancia> {
  const resposta = await api.post(`/chat/fetchProfile/${instanceName}`, { number: soDigitosDoNumero(ownerJid) }, { headers: { apikey: token } });
  return { name: resposta.data?.name ?? null, picture: resposta.data?.picture ?? null, status: resposta.data?.status ?? null };
}

export async function atualizarNomePerfil(instanceName: string, token: string, name: string): Promise<void> {
  await api.post(`/chat/updateProfileName/${instanceName}`, { name }, { headers: { apikey: token } });
}

export async function atualizarRecadoPerfil(instanceName: string, token: string, status: string): Promise<void> {
  await api.post(`/chat/updateProfileStatus/${instanceName}`, { status }, { headers: { apikey: token } });
}

/** `picture`: URL pública ou a imagem em base64 (sem o prefixo data:). */
export async function atualizarFotoPerfil(instanceName: string, token: string, picture: string): Promise<void> {
  await api.post(`/chat/updateProfilePicture/${instanceName}`, { picture }, { headers: { apikey: token } });
}

/** Lê um arquivo de imagem e devolve o base64 puro (sem “data:image/...;base64,”). */
export function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^,]*,/, ""));
    leitor.readAsDataURL(arquivo);
  });
}
