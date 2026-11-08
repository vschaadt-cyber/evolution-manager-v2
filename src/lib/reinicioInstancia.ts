// Estado do "Reiniciar" de uma instância no Manager. Só front: nenhuma chamada nova à API.
// Regra igual à do Gestão (src/lib/whatsappHistoricoConexao.ts › faseReinicio): "Conectado" só com a
// transição real depois do clique. Exceção (8 s): conectada e com updatedAt recente, para o caso de a
// troca de estado acontecer entre dois polls. Timeout de 60 s → "sem_resposta".
// O horário do clique fica em sessionStorage por instância (some ao fechar a aba). Nunca guarda chave.

export type FaseReinicio = "reiniciando" | "iniciando" | "conectado" | "sem_resposta";

export const TIMEOUT_REINICIO_MS = 60_000;
export const JANELA_CONEXAO_RECENTE_MS = 8_000;
export const INTERVALO_POLLING_MS = 2_000;

const PREFIXO = "gestao:manager:reinicio:";

export interface RegistroReinicio {
  inicioMs: number;
  viuOutroEstado: boolean;
}

/** Fase do reinício. Pura: recebe o relógio e o estado observado. */
export function faseReinicio(p: { inicioMs: number; agoraMs: number; estadoAtual: string | null; viuOutroEstado: boolean; updatedAtMs: number | null }): FaseReinicio {
  const houveTransicao = p.viuOutroEstado;
  const decorrido = p.agoraMs - p.inicioMs;
  const conectadaRecente = decorrido >= JANELA_CONEXAO_RECENTE_MS && p.updatedAtMs !== null && p.updatedAtMs >= p.inicioMs - JANELA_CONEXAO_RECENTE_MS;
  if (p.estadoAtual === "open" && (houveTransicao || conectadaRecente)) return "conectado";
  if (decorrido >= TIMEOUT_REINICIO_MS) return "sem_resposta";
  return houveTransicao ? "iniciando" : "reiniciando";
}

/** Estado "fora do aberto" que conta como transição depois do clique. */
export function estadoEhFora(estado: string | null | undefined): boolean {
  return !!estado && estado !== "open";
}

function chave(nome: string): string {
  return `${PREFIXO}${nome}`;
}

export function lerRegistro(nome: string): RegistroReinicio | null {
  try {
    const bruto = sessionStorage.getItem(chave(nome));
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<RegistroReinicio>;
    if (typeof dados.inicioMs !== "number") return null;
    return { inicioMs: dados.inicioMs, viuOutroEstado: !!dados.viuOutroEstado };
  } catch {
    return null;
  }
}

function gravar(nome: string, registro: RegistroReinicio): void {
  try {
    sessionStorage.setItem(chave(nome), JSON.stringify(registro));
  } catch {
    // sessionStorage indisponível (modo privado, bloqueado): o reinício segue sem o horário guardado.
  }
}

export function iniciarRegistro(nome: string, agoraMs: number): void {
  gravar(nome, { inicioMs: agoraMs, viuOutroEstado: false });
}

export function marcarOutroEstado(nome: string, registro: RegistroReinicio): void {
  if (!registro.viuOutroEstado) gravar(nome, { ...registro, viuOutroEstado: true });
}

export function limparRegistro(nome: string): void {
  try {
    sessionStorage.removeItem(chave(nome));
  } catch {
    // ignora
  }
}

export interface InstanciaParaReinicio {
  name: string;
  connectionStatus: string;
  updatedAt?: string | null;
}

/**
 * Confere as instâncias contra os registros guardados: marca a transição observada e, quando a fase
 * vira "conectado", apaga o registro. Retorna a fase por nome das instâncias com reinício em curso
 * (inclui "sem_resposta", que fica até o usuário tentar de novo).
 */
export function sincronizarReinicios(instancias: InstanciaParaReinicio[], agoraMs: number): Record<string, FaseReinicio> {
  const fases: Record<string, FaseReinicio> = {};
  for (const inst of instancias) {
    const registro = lerRegistro(inst.name);
    if (!registro) continue;
    const atualizado = estadoEhFora(inst.connectionStatus) ? { ...registro, viuOutroEstado: true } : registro;
    if (atualizado !== registro) marcarOutroEstado(inst.name, registro);
    const updatedAtMs = inst.updatedAt ? new Date(inst.updatedAt).getTime() : NaN;
    const fase = faseReinicio({
      inicioMs: registro.inicioMs,
      agoraMs,
      estadoAtual: inst.connectionStatus,
      viuOutroEstado: atualizado.viuOutroEstado,
      updatedAtMs: Number.isNaN(updatedAtMs) ? null : updatedAtMs,
    });
    if (fase === "conectado") {
      limparRegistro(inst.name);
      continue;
    }
    fases[inst.name] = fase;
  }
  return fases;
}
