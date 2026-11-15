import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { registrarEventoInstancia } from "@/lib/historicoInstancia";
import { reiniciarInstancia } from "@/lib/queries/instance/manageInstance";
import { EnvioReinicio, EstadoItem, estadoItem, executarFila, ItemReinicio, resumirLote } from "@/lib/reiniciarTodas";
import { FaseReinicio, lerRegistro } from "@/lib/reinicioInstancia";

const ORIGEM_EM_MASSA = "em massa";

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Params {
  /** Fases de reinício em curso (vêm do useReinicios do Dashboard, que também faz o polling). */
  fases: Record<string, FaseReinicio>;
  iniciar: (nome: string) => void;
  descartar: (nome: string) => void;
  recarregar: () => unknown;
}

/**
 * Reinício em massa: envia um por vez (fila em lib/reiniciarTodas.ts) e junta, por número, o envio com o acompanhamento
 * da reconexão que o useReinicios já faz. Cada reinício e cada reconexão vão para o histórico com origem "em massa".
 */
export function useReiniciarTodas({ fases, iniciar, descartar, recarregar }: Params) {
  const [lote, setLote] = useState<ItemReinicio[]>([]);
  const [envios, setEnvios] = useState<Record<string, EnvioReinicio>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);
  const canceladoRef = useRef(false);
  const reconexaoRegistrada = useRef<Set<string>>(new Set());
  const itensPorNome = useRef<Record<string, ItemReinicio>>({});

  const executar = useCallback(
    async (itens: ItemReinicio[]) => {
      if (rodando || itens.length === 0) return;
      canceladoRef.current = false;
      reconexaoRegistrada.current = new Set();
      itensPorNome.current = Object.fromEntries(itens.map((item) => [item.name, item]));
      setLote(itens);
      setEnvios({});
      setRodando(true);

      const final = await executarFila(itens, {
        esperar,
        cancelado: () => canceladoRef.current,
        antes: (item) => {
          setEnviando(item.name);
          iniciar(item.name); // horário do clique: começa a contar os 60 s deste número
        },
        reiniciar: async (item) => {
          await reiniciarInstancia({ instanceName: item.name, token: item.token });
        },
        depois: (item, envio) => {
          setEnviando(null);
          setEnvios((antigos) => ({ ...antigos, [item.name]: envio }));
          if (envio === "falhou") {
            descartar(item.name);
          } else if (item.token) {
            registrarEventoInstancia({ instanciaId: item.id, chaveInstancia: item.token, tipo: "reinicio", detalhe: { origem: ORIGEM_EM_MASSA } });
          }
          recarregar();
        },
      });

      setEnvios(final);
      setEnviando(null);
      setRodando(false);
      recarregar();
    },
    [rodando, iniciar, descartar, recarregar],
  );

  const estados = useMemo(() => {
    const mapa: Record<string, EstadoItem> = {};
    for (const item of lote) {
      mapa[item.name] = estadoItem({ envio: envios[item.name], enviando: enviando === item.name, temRegistro: lerRegistro(item.name) !== null, fase: fases[item.name] ?? null });
    }
    return mapa;
    // `fases` muda quando o número volta (o registro some junto): é ele que faz recalcular.
  }, [lote, envios, enviando, fases]);

  // Número que voltou a "open" depois do reinício em massa: grava a reconexão no histórico (uma vez por número).
  useEffect(() => {
    for (const item of lote) {
      if (estados[item.name] !== "ok" || reconexaoRegistrada.current.has(item.name)) continue;
      reconexaoRegistrada.current.add(item.name);
      if (item.token) registrarEventoInstancia({ instanciaId: item.id, chaveInstancia: item.token, tipo: "conexao", detalhe: { estado: "open", origem: ORIGEM_EM_MASSA } });
    }
  }, [estados, lote]);

  const resumo = useMemo(() => resumirLote(lote.map((item) => estados[item.name])), [lote, estados]);

  const falhas = useMemo(
    () => ({
      falhou: lote.filter((item) => estados[item.name] === "falhou").map((item) => item.name),
      naoReconectou: lote.filter((item) => estados[item.name] === "nao_reconectou").map((item) => item.name),
      naoEnviado: lote.filter((item) => estados[item.name] === "nao_enviado").map((item) => item.name),
    }),
    [lote, estados],
  );

  /** Repete só os que não deram certo (falhou, não reconectou ou não chegou a ser enviado). */
  const tentarNovamente = useCallback(() => {
    const nomes = new Set([...falhas.falhou, ...falhas.naoReconectou, ...falhas.naoEnviado]);
    return executar(lote.filter((item) => nomes.has(item.name)));
  }, [executar, falhas, lote]);

  const parar = useCallback(() => {
    canceladoRef.current = true;
  }, []);

  const fechar = useCallback(() => {
    if (rodando) return;
    setLote([]);
    setEnvios({});
  }, [rodando]);

  return { lote, estados, resumo, falhas, rodando, ativo: lote.length > 0, executar, tentarNovamente, parar, fechar };
}
