import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Info, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  agruparPorDia,
  buscarLog,
  descreverEvento,
  EventoLog,
  FILTROS_LOG,
  filtrarEventos,
  FiltroLog,
  haQuanto,
  juntarReinicioDoServidor,
  LogNaoAutorizado,
  MensagemLog,
  ModoMensagens,
  NivelLog,
  NumeroLog,
  PERIODOS_LOG,
  quedasDemais,
  situacaoDaMensagem,
  situacaoDoNumero,
} from "@/lib/diagnostics/log";
import { getToken, TOKEN_ID } from "@/lib/queries/token";
import { cn } from "@/lib/utils";
import { formatBrazilPhone } from "@/utils/phone";

import { ConfiguracaoInstancias } from "./Configuracao";

const NIVEL_BADGE: Record<NivelLog, "destructive" | "warning" | "success" | "secondary"> = { erro: "destructive", aviso: "warning", ok: "success", info: "secondary" };

const NIVEL_ICONE: Record<NivelLog, typeof Info> = { erro: XCircle, aviso: AlertTriangle, ok: CheckCircle2, info: Info };

const NIVEL_COR: Record<NivelLog, string> = {
  erro: "text-red-600 dark:text-red-400",
  aviso: "text-amber-600 dark:text-amber-400",
  ok: "text-emerald-600 dark:text-emerald-400",
  info: "text-muted-foreground",
};

const TIPO_MENSAGEM: Record<string, string> = {
  texto: "Texto",
  imagem: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  documento: "Documento",
  sticker: "Figurinha",
  contato: "Contato",
  localizacao: "Localização",
  outro: "Outro",
};

function horaCompleta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("pt-BR");
}

function Contador({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-base font-semibold tabular-nums", alerta && valor > 0 && "text-red-600 dark:text-red-400")}>{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function CartaoNumero({ numero, horas, selecionado, onClick }: { numero: NumeroLog; horas: number; selecionado: boolean; onClick: () => void }) {
  const situacao = situacaoDoNumero(numero);
  return (
    <button type="button" onClick={onClick} className="text-left" title={selecionado ? "Clique para ver todos os números" : "Clique para ver só este número"}>
      <Card className={cn("h-full space-y-3 p-4 transition-colors hover:border-primary/60", selecionado && "border-primary ring-1 ring-primary")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{numero.exibicao}</p>
            <p className="truncate text-xs text-muted-foreground">{formatBrazilPhone(numero.numero) ?? numero.nome}</p>
          </div>
          <Badge variant={NIVEL_BADGE[situacao.nivel]} className="shrink-0">
            {situacao.rotulo}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{situacao.explicacao}</p>
        <div className="space-y-0.5 text-xs">
          <p>
            <span className="text-muted-foreground">Última recebida:</span> {haQuanto(numero.ultima_recebida_em)}
          </p>
          <p>
            <span className="text-muted-foreground">Última enviada:</span> {haQuanto(numero.ultima_enviada_em)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <Contador rotulo="Quedas" valor={numero.quedas} alerta={quedasDemais(numero.quedas, horas)} />
          <Contador rotulo="Reinícios" valor={numero.reinicios} />
          <Contador rotulo="Msgs atrasadas" valor={numero.atrasadas} alerta />
          <Contador rotulo="Recebidas" valor={numero.recebidas} />
          <Contador rotulo="Enviadas" valor={numero.enviadas} />
          <Contador rotulo="Falhas envio/mídia" valor={numero.falhas_envio + numero.midias_erro} alerta />
        </div>
      </Card>
    </button>
  );
}

function LinhaEvento({ evento, nomeNumero }: { evento: EventoLog; nomeNumero: string }) {
  const { titulo, detalhe } = descreverEvento(evento);
  const Icone = NIVEL_ICONE[evento.nivel] ?? Info;
  return (
    <li className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)] items-start gap-2 px-4 py-2.5 text-sm">
      <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{horaCompleta(evento.em)}</span>
      <Icone size={16} className={cn("mt-0.5", NIVEL_COR[evento.nivel])} />
      <div className="min-w-0">
        <p>
          <span className="font-medium">{titulo}</span>
          {nomeNumero && <span className="text-muted-foreground"> · {nomeNumero}</span>}
        </p>
        {detalhe && <p className="break-words text-xs text-muted-foreground">{detalhe}</p>}
      </div>
    </li>
  );
}

function TabelaMensagens({ mensagens, nomes, limite }: { mensagens: MensagemLog[]; nomes: Record<string, string>; limite: number }) {
  if (mensagens.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem com esses filtros.</p>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Chegou no Gestão</th>
              <th className="px-2 py-2 font-medium">Número</th>
              <th className="px-2 py-2 font-medium">Direção</th>
              <th className="px-2 py-2 font-medium">Contato</th>
              <th className="px-2 py-2 font-medium">Mensagem</th>
              <th className="px-4 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mensagens.map((m, i) => {
              const situacao = situacaoDaMensagem(m);
              const d = new Date(m.em);
              return (
                <tr key={`${m.em}-${i}`} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {d.toLocaleTimeString("pt-BR")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs">{nomes[m.instancia_id] ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs">
                    <span className="inline-flex items-center gap-1">
                      {m.from_me ? <ArrowUpRight size={13} className="text-sky-600" /> : <ArrowDownLeft size={13} className="text-emerald-600" />}
                      {m.from_me ? "Enviada" : "Recebida"}
                    </span>
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-2 text-xs" title={m.contato ?? ""}>
                    {m.contato ?? "—"}
                    {m.grupo && <span className="text-muted-foreground"> (grupo)</span>}
                  </td>
                  <td className="max-w-[22rem] truncate px-2 py-2 text-xs" title={m.previa ?? ""}>
                    <span className="text-muted-foreground">{TIPO_MENSAGEM[m.tipo ?? ""] ?? m.tipo ?? "—"}</span>
                    {m.previa ? ` · ${m.previa}` : ""}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={cn(situacao.nivel !== "ok" && "font-medium", NIVEL_COR[situacao.nivel])}>{situacao.rotulo}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mensagens.length >= limite && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Mostrando as {limite} mais recentes. Escolha um número ou um período menor para ver as demais.</p>}
    </>
  );
}

const LIMITE = 500;

function DiagnosticsPage() {
  const chave = getToken(TOKEN_ID.TOKEN) ?? "";
  const [horas, setHoras] = useState<number>(24);
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroLog>("problemas");
  const [modoMensagens, setModoMensagens] = useState<ModoMensagens>("nenhuma");

  const log = useQuery({
    queryKey: ["diagnostics", "log", horas, instanciaId, modoMensagens],
    queryFn: () => buscarLog({ chave, instanciaId, horas, limite: LIMITE, mensagens: modoMensagens }),
    enabled: chave.length > 0,
    refetchInterval: 60_000,
    placeholderData: (anterior) => anterior,
    retry: (tentativas, erro) => !(erro instanceof LogNaoAutorizado) && tentativas < 2,
  });

  const numeros = useMemo(() => log.data?.instancias ?? [], [log.data]);
  const nomes = useMemo(() => Object.fromEntries(numeros.map((n) => [n.id, n.exibicao])), [numeros]);

  const eventos = useMemo(() => {
    const juntos = juntarReinicioDoServidor(log.data?.eventos ?? [], nomes);
    return filtrarEventos(juntos, filtro, instanciaId);
  }, [log.data, nomes, filtro, instanciaId]);

  const dias = useMemo(() => agruparPorDia(eventos), [eventos]);
  const comProblema = numeros.filter((n) => situacaoDoNumero(n).nivel !== "ok").length;
  const semAcesso = log.error instanceof LogNaoAutorizado;
  const cortado = (log.data?.eventos.length ?? 0) >= LIMITE;

  return (
    <div className="space-y-6">
      {/* Resumo e controles */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {log.data && (comProblema > 0 ? <Badge variant="destructive">{comProblema} número(s) com problema agora</Badge> : <Badge variant="success">Todos os números funcionando agora</Badge>)}
        {log.data?.reinicio_automatico != null && <Badge variant="secondary">Reinício automático {log.data.reinicio_automatico ? "ligado" : "desligado"}</Badge>}
        <span className="text-xs text-muted-foreground">
          {log.dataUpdatedAt ? `Atualizado às ${new Date(log.dataUpdatedAt).toLocaleTimeString("pt-BR")} · atualiza sozinho a cada 1 min` : "Carregando…"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={horas} onChange={(e) => setHoras(Number(e.target.value))} aria-label="Período">
            {PERIODOS_LOG.map((p) => (
              <option key={p.horas} value={p.horas}>
                {p.rotulo}
              </option>
            ))}
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={instanciaId ?? ""} onChange={(e) => setInstanciaId(e.target.value || null)} aria-label="Número">
            <option value="">Todos os números</option>
            {numeros.map((n) => (
              <option key={n.id} value={n.id}>
                {n.exibicao}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => log.refetch()} disabled={log.isFetching}>
            {log.isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </Button>
        </div>
      </div>

      {semAcesso && (
        <Card className="p-4 text-sm">
          <p className="font-medium">O log não abriu com esta chave.</p>
          <p className="text-muted-foreground">O log vem do Gestão e só abre com a chave global. Abra o painel pelo Gestão (Sistema › Integrações › WhatsApp) e volte a esta tela.</p>
        </Card>
      )}
      {log.isError && !semAcesso && <p className="text-sm text-destructive">Não foi possível ler o log agora. Tente Atualizar.</p>}

      {log.isLoading && (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Carregando o log…
        </p>
      )}

      {/* Um cartão por número */}
      {numeros.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {numeros.map((n) => (
            <CartaoNumero key={n.id} numero={n} horas={horas} selecionado={instanciaId === n.id} onClick={() => setInstanciaId(instanciaId === n.id ? null : n.id)} />
          ))}
        </div>
      )}

      {/* Linha do tempo */}
      {log.data && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="font-semibold">O que aconteceu{instanciaId ? ` · ${nomes[instanciaId] ?? ""}` : ""}</p>
              <p className="text-xs text-muted-foreground">Do mais recente para o mais antigo, no horário do seu computador.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_LOG.map((f) => (
                <Button key={f.valor} size="sm" variant={filtro === f.valor ? "default" : "outline"} onClick={() => setFiltro(f.valor)}>
                  {f.rotulo}
                </Button>
              ))}
            </div>
          </div>

          {eventos.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <CheckCircle2 size={16} className="text-emerald-600" />
              {filtro === "problemas" ? "Nenhum problema registrado neste período." : "Nada registrado neste período com esse filtro."}
            </p>
          )}

          {dias.map((grupo) => (
            <div key={grupo.dia}>
              <p className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium capitalize text-muted-foreground">{grupo.dia}</p>
              <ul className="divide-y">
                {grupo.linhas.map((evento, i) => (
                  <LinhaEvento key={`${evento.em}-${evento.tipo}-${i}`} evento={evento} nomeNumero={evento.instancia_id ? (nomes[evento.instancia_id] ?? "") : ""} />
                ))}
              </ul>
            </div>
          ))}

          {cortado && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Mostrando os {LIMITE} registros mais recentes. Escolha um número ou um período menor para ver os demais.</p>}
        </Card>
      )}

      {/* Mensagens uma a uma */}
      {log.data && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="font-semibold">Mensagens{instanciaId ? ` · ${nomes[instanciaId] ?? ""}` : ""}</p>
              <p className="text-xs text-muted-foreground">Cada mensagem com a hora em que entrou no Gestão, de quem é e se chegou atrasada ou com erro.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["nenhuma", "Ocultar"],
                  ["problemas", "Só com problema"],
                  ["todas", "Todas"],
                ] as [ModoMensagens, string][]
              ).map(([valor, rotulo]) => (
                <Button key={valor} size="sm" variant={modoMensagens === valor ? "default" : "outline"} onClick={() => setModoMensagens(valor)}>
                  {rotulo}
                </Button>
              ))}
            </div>
          </div>
          {modoMensagens === "nenhuma" ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Escolha “Só com problema” para ver as que atrasaram ou falharam, ou “Todas” para o registro completo.</p>
          ) : log.isFetching && log.data.mensagens.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Carregando mensagens…
            </p>
          ) : (
            <TabelaMensagens mensagens={log.data.mensagens} nomes={nomes} limite={LIMITE} />
          )}
        </Card>
      )}

      {/* Configuração: webhook e proxy de cada instância (o diagnóstico que já existia) */}
      <ConfiguracaoInstancias />
    </div>
  );
}

export default DiagnosticsPage;
