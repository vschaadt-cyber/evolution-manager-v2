import { ChevronDown, Power } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useReiniciarTodas } from "@/hooks/useReiniciarTodas";

import { FiltroReinicio, ROTULO_FILTRO, selecionarParaReinicio } from "@/lib/reiniciarTodas";
import { FaseReinicio } from "@/lib/reinicioInstancia";
import { cn } from "@/lib/utils";

import { Instance } from "@/types/evolution.types";

interface Props {
  instancias: Instance[];
  fases: Record<string, FaseReinicio>;
  iniciar: (nome: string) => void;
  descartar: (nome: string) => void;
  recarregar: () => unknown;
}

const FILTROS: FiltroReinicio[] = ["todas", "conectadas", "com_problema"];

function Lista({ titulo, nomes, className }: { titulo: string; nomes: string[]; className: string }) {
  if (nomes.length === 0) return null;
  return (
    <p className={cn("text-sm", className)}>
      <strong>
        {titulo} ({nomes.length}):
      </strong>{" "}
      {nomes.join(", ")}
    </p>
  );
}

export function ReiniciarTodas({ instancias, fases, iniciar, descartar, recarregar }: Props) {
  const [escolhido, setEscolhido] = useState<FiltroReinicio | null>(null);
  const { resumo, falhas, rodando, ativo, executar, tentarNovamente, parar, fechar } = useReiniciarTodas({ fases, iniciar, descartar, recarregar });

  const selecionadas = useMemo(() => (escolhido ? selecionarParaReinicio(instancias, escolhido) : []), [instancias, escolhido]);
  const contagens = useMemo(() => Object.fromEntries(FILTROS.map((filtro) => [filtro, selecionarParaReinicio(instancias, filtro).length])) as Record<FiltroReinicio, number>, [instancias]);

  const confirmar = () => {
    const itens = selecionadas.map((item) => ({ id: item.id, name: item.name, token: item.token }));
    setEscolhido(null);
    executar(itens);
  };

  const porcentagem = resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0;
  const naoDeramCerto = resumo.falhou + resumo.naoReconectou + resumo.naoEnviado;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2" disabled={rodando || instancias.length === 0}>
            <Power size={16} />
            Reiniciar todas
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {FILTROS.map((filtro) => (
            <DropdownMenuItem key={filtro} disabled={contagens[filtro] === 0} onClick={() => setEscolhido(filtro)}>
              {ROTULO_FILTRO[filtro]} <span className="ml-2 text-xs opacity-70">{contagens[filtro]}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {escolhido && (
        <Dialog onOpenChange={() => setEscolhido(null)} open>
          <DialogContent>
            <DialogClose />
            <DialogHeader>Reiniciar todas ({ROTULO_FILTRO[escolhido].toLowerCase()})</DialogHeader>
            <p>Vai reiniciar {selecionadas.length} números. As mensagens ficam pausadas ~30 s em cada um.</p>
            <p className="text-sm text-muted-foreground">Um de cada vez, com 3 s de intervalo. Você pode parar a fila enquanto ela roda.</p>
            <DialogFooter>
              <div className="flex items-center gap-4">
                <Button onClick={() => setEscolhido(null)} size="sm" variant="outline">
                  Cancelar
                </Button>
                <Button onClick={confirmar}>Reiniciar {selecionadas.length}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {ativo && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(26rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-card p-4 shadow-lg" role="status">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{resumo.terminou ? "Reinício em massa concluído" : "Reiniciando números"}</p>
            <span className="text-sm tabular-nums text-muted-foreground">
              {resumo.concluidas}/{resumo.total} reiniciadas
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${porcentagem}%` }} />
          </div>

          {resumo.terminou ? (
            <div className="space-y-1.5">
              <p className="text-sm">
                <strong className="text-emerald-600 dark:text-emerald-400">OK: {resumo.ok}</strong>
                {" · "}
                <strong className={resumo.falhou > 0 ? "text-destructive" : undefined}>Falhou: {resumo.falhou}</strong>
                {" · "}
                <strong className={resumo.naoReconectou > 0 ? "text-destructive" : undefined}>Não reconectou: {resumo.naoReconectou}</strong>
                {resumo.naoEnviado > 0 && <> · Não enviados: {resumo.naoEnviado}</>}
              </p>
              <Lista titulo="Falhou" nomes={falhas.falhou} className="text-destructive" />
              <Lista titulo="Não reconectou em 60 s" nomes={falhas.naoReconectou} className="text-destructive" />
              <Lista titulo="Não enviados (fila parada)" nomes={falhas.naoEnviado} className="text-muted-foreground" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Cada número volta a “Conectado” sozinho; passou de 60 s sem voltar, aparece como “Não reconectou”.</p>
          )}

          <div className="flex justify-end gap-2">
            {rodando && (
              <Button size="sm" variant="outline" onClick={parar}>
                Parar a fila
              </Button>
            )}
            {resumo.terminou && naoDeramCerto > 0 && (
              <Button size="sm" onClick={() => tentarNovamente()}>
                Tentar de novo as que falharam ({naoDeramCerto})
              </Button>
            )}
            {!rodando && (
              <Button size="sm" variant="outline" onClick={fechar}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
