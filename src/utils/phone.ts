// Formata o número de WhatsApp no padrão brasileiro: (DD) XXXX-XXXX ou (DD) 9XXXX-XXXX.

export const DEFAULT_INSTANCE_LABEL = "(47) 3351-1647";

const LABEL_KEY_PREFIX = "gestao-instance-label:";

// Aceita JID ("5547999991234@s.whatsapp.net"), número puro ou com máscara.
// Remove o DDI 55 quando existir. Retorna null se não sobrar 10 ou 11 dígitos.
export function formatBrazilPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.split("@")[0].replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return null;
}

// Rótulo local (só neste navegador) para instâncias sem número.
export function getInstanceLabel(instanceId: string): string {
  try {
    return localStorage.getItem(LABEL_KEY_PREFIX + instanceId) || DEFAULT_INSTANCE_LABEL;
  } catch {
    return DEFAULT_INSTANCE_LABEL;
  }
}

export function setInstanceLabel(instanceId: string, label: string): void {
  try {
    const value = label.trim();
    if (value) {
      localStorage.setItem(LABEL_KEY_PREFIX + instanceId, value);
    } else {
      localStorage.removeItem(LABEL_KEY_PREFIX + instanceId);
    }
  } catch {
    // Armazenamento indisponível (modo privado, por exemplo): o rótulo só não é salvo.
  }
}
