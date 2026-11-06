import { useEffect } from "react";

import { avisarGestaoPronto, origemDoGestaoValida } from "@/lib/acessoGestao";

import { useTheme } from "./theme-provider";

/** Recebe o tema do Gestão por postMessage (só de origem confiável) e avisa que o painel está pronto. */
export function TemaDoGestao() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      if (!origemDoGestaoValida(evento)) return;
      const dados = evento.data as { type?: string; tema?: string } | null;
      if (dados?.type !== "gestao:tema") return;
      if (dados.tema === "light" || dados.tema === "dark") setTheme(dados.tema);
    };
    window.addEventListener("message", aoReceber);
    avisarGestaoPronto();
    return () => window.removeEventListener("message", aoReceber);
  }, [setTheme]);

  return null;
}
