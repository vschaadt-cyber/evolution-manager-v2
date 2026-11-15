import { useEffect, useState } from "react";

import { useUltimoRecebimento } from "@/lib/queries/chat/ultimoRecebimento";
import { haQuantoTempo, nivelRecebimento } from "@/lib/ultimoRecebimento";
import { cn } from "@/lib/utils";

const COR = {
  normal: "text-muted-foreground",
  amarelo: "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  vermelho: "rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

/** Data e hora da última mensagem RECEBIDA. Amarelo acima de 2 h e vermelho acima de 6 h, em horário comercial. */
export function UltimoRecebimento({ name, token, className }: { name: string; token: string; className?: string }) {
  const { data, isLoading, isError } = useUltimoRecebimento(name, token);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) return <span className={cn("text-xs text-muted-foreground", className)}>…</span>;
  if (isError) return <span className={cn("text-xs text-muted-foreground", className)}>não consultou</span>;
  if (data == null) return <span className={cn("text-xs text-muted-foreground", className)}>sem recebimento registrado</span>;

  const nivel = nivelRecebimento(data, agora);
  const quando = new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <span className={cn("inline-flex flex-col text-xs leading-tight", className)} title={nivel === "normal" ? undefined : "Sem receber mensagem há muito tempo em horário comercial"}>
      <span className={cn("w-fit", COR[nivel])}>{haQuantoTempo(data, agora)}</span>
      <span className="text-muted-foreground">{quando}</span>
    </span>
  );
}
