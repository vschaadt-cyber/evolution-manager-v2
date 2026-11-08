import { useCallback, useEffect, useRef, useState } from "react";

import { FaseReinicio, INTERVALO_POLLING_MS, InstanciaParaReinicio, iniciarRegistro, limparRegistro, sincronizarReinicios } from "@/lib/reinicioInstancia";

/**
 * Fases do "Reiniciar" das instâncias recebidas. Enquanto alguma está "reiniciando" ou "iniciando",
 * chama `reload` a cada 2 s e recalcula a fase (também para o timeout de 60 s).
 * `instancias` precisa ser memoizado pelo chamador.
 */
export function useReinicios(instancias: InstanciaParaReinicio[], reload: () => unknown) {
  const [fases, setFases] = useState<Record<string, FaseReinicio>>({});
  const [agora, setAgora] = useState(() => Date.now());
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Confere as instâncias contra o sessionStorage a cada mudança de dados e a cada tick.
  useEffect(() => {
    const novas = sincronizarReinicios(instancias, Date.now());
    setFases((antigas) => (JSON.stringify(antigas) === JSON.stringify(novas) ? antigas : novas));
  }, [instancias, agora]);

  const emCurso = Object.values(fases).some((fase) => fase === "reiniciando" || fase === "iniciando");

  useEffect(() => {
    if (!emCurso) return;
    const timer = setInterval(() => {
      setAgora(Date.now());
      reloadRef.current();
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(timer);
  }, [emCurso]);

  /** Marca o início do reinício (horário do clique) e acompanha a instância a partir daqui. */
  const iniciar = useCallback((nome: string) => {
    iniciarRegistro(nome, Date.now());
    setAgora(Date.now());
  }, []);

  /** Tira o registro da instância (ex.: o reinício falhou antes de sair da tela). */
  const descartar = useCallback((nome: string) => {
    limparRegistro(nome);
    setAgora(Date.now());
  }, []);

  return { fases, emCurso, iniciar, descartar };
}
