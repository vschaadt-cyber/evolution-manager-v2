/** Só os dígitos de um número ou JID (ex.: 5547999999999@s.whatsapp.net → 5547999999999). */
export const soDigitosDoNumero = (valor: string | null | undefined) => (valor ?? "").split("@")[0].replace(/\D/g, "");
