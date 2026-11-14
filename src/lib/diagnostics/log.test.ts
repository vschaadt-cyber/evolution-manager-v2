// Testes das regras do log de diagnóstico. Rodar com: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import { agruparPorDia, descreverEvento, EventoLog, filtrarEventos, formatarDuracao, haQuanto, juntarReinicioDoServidor, quedasDemais, situacaoDaMensagem, situacaoDoNumero } from "./log";

const ev = (p: Partial<EventoLog>): EventoLog => ({ em: "2026-11-14T14:00:00Z", instancia_id: "a", tipo: "reconexao", nivel: "aviso", ...p });

test("duração em segundos, minutos, horas e dias", () => {
  assert.equal(formatarDuracao(45), "45 s");
  assert.equal(formatarDuracao(12 * 60), "12 min");
  assert.equal(formatarDuracao(3 * 3600 + 5 * 60), "3 h 05 min");
  assert.equal(formatarDuracao(52 * 3600), "2 d 4 h");
  assert.equal(formatarDuracao(null), "—");
});

test("há quanto tempo", () => {
  const agora = new Date("2026-11-14T15:00:00Z").getTime();
  assert.equal(haQuanto("2026-11-14T14:57:00Z", agora), "há 3 min");
  assert.equal(haQuanto("2026-11-14T14:59:40Z", agora), "agora há pouco");
  assert.equal(haQuanto(null, agora), "nunca");
});

test("queda rápida diz em quanto tempo voltou", () => {
  assert.equal(descreverEvento(ev({ tipo: "reconexao", valor_s: 3 })).titulo, "Conexão caiu e voltou em 3 s");
});

test("reinício do vigia mostra o motivo; reinício manual mostra quem fez", () => {
  const vigia = descreverEvento(ev({ tipo: "reinicio", origem: "vigia", texto: "recebimento atrasado", valor_s: 720 }));
  assert.equal(vigia.titulo, "Reiniciado automaticamente pelo vigia");
  assert.match(vigia.detalhe, /recebimento atrasado \(12 min de atraso\)/);
  const manual = descreverEvento(ev({ tipo: "reinicio", origem: "manager", usuario: "Vitor" }));
  assert.equal(manual.titulo, "Reiniciado por Vitor");
  assert.match(manual.detalhe, /painel/);
  assert.match(descreverEvento(ev({ tipo: "reinicio", origem: "gestao" })).titulo, /usuário não identificado/);
});

test("queda aberta e queda encerrada", () => {
  assert.match(descreverEvento(ev({ tipo: "queda", estado: "close", valor_s: 600 })).detalhe, /Fora do ar há 10 min/);
  assert.match(descreverEvento(ev({ tipo: "queda", estado: "close", valor_s: 600, fim: "2026-11-14T14:10:00Z" })).detalhe, /Ficou fora por 10 min/);
  assert.equal(descreverEvento(ev({ tipo: "queda", estado: "refused" })).titulo, "Conexão recusada pelo WhatsApp");
});

test("lote atrasado conta mensagens e o maior atraso", () => {
  const d = descreverEvento(ev({ tipo: "lote_atrasado", n: 37, valor_s: 47 * 60, fim: "2026-11-14T14:03:00Z" }));
  assert.equal(d.titulo, "37 mensagens chegaram atrasadas");
  assert.match(d.detalhe, /até 47 min/);
  assert.equal(descreverEvento(ev({ tipo: "lote_atrasado", n: 1, valor_s: 400 })).titulo, "1 mensagem chegou atrasada");
});

test("envio que falhou e mídia que não baixou trazem o contato e o motivo", () => {
  const envio = descreverEvento(ev({ tipo: "envio_falhou", contato: "João", texto: "O provedor recusou o envio." }));
  assert.equal(envio.titulo, "Envio falhou para João");
  assert.equal(envio.detalhe, "O provedor recusou o envio.");
  const midia = descreverEvento(ev({ tipo: "midia_erro", estado: "imagem", contato: "Maria", texto: "getBase64FromMediaMessage 400", n: 2 }));
  assert.equal(midia.titulo, "Mídia não baixou (imagem de Maria)");
  assert.match(midia.detalhe, /400.*Tentativas: 2/);
});

test("3 números voltando juntos viram um único 'Evolution reiniciou'", () => {
  const nomes = { a: "Luminare", b: "Crediario", c: "Compras", d: "Vendas" };
  const lista = [
    ev({ em: "2026-11-14T14:06:52Z", instancia_id: "a" }),
    ev({ em: "2026-11-14T14:06:52Z", instancia_id: "b" }),
    ev({ em: "2026-11-14T14:06:50Z", instancia_id: "c", tipo: "conectou", nivel: "ok" }),
    ev({ em: "2026-11-14T13:00:00Z", instancia_id: "d" }),
  ];
  const saida = juntarReinicioDoServidor(lista, nomes);
  assert.equal(saida.length, 2);
  assert.equal(saida[0].tipo, "servidor_reiniciou");
  assert.equal(saida[0].n, 3);
  assert.deepEqual(saida[0].numeros, ["Compras", "Crediario", "Luminare"]);
  assert.equal(saida[1].instancia_id, "d");
  assert.match(descreverEvento(saida[0]).titulo, /Evolution reiniciou: 3 números/);
});

test("2 números voltando juntos não bastam; o mesmo número duas vezes não conta em dobro", () => {
  const dois = [ev({ instancia_id: "a" }), ev({ instancia_id: "b" })];
  assert.equal(juntarReinicioDoServidor(dois, {}).length, 2);
  const repetido = [ev({ instancia_id: "a" }), ev({ instancia_id: "a" }), ev({ instancia_id: "b" })];
  assert.equal(juntarReinicioDoServidor(repetido, {}).filter((e) => e.tipo === "servidor_reiniciou").length, 0);
});

test("filtro Problemas esconde queda rápida e conectou; Quedas e conexão mostra", () => {
  const lista = [
    ev({ tipo: "reconexao" }),
    ev({ tipo: "conectou", nivel: "ok" }),
    ev({ tipo: "queda", nivel: "erro" }),
    ev({ tipo: "lote_atrasado", nivel: "erro" }),
    ev({ tipo: "reinicio", nivel: "info" }),
  ];
  assert.deepEqual(
    filtrarEventos(lista, "problemas").map((e) => e.tipo),
    ["queda", "lote_atrasado", "reinicio"],
  );
  assert.deepEqual(
    filtrarEventos(lista, "conexao").map((e) => e.tipo),
    ["reconexao", "conectou", "queda"],
  );
  assert.equal(filtrarEventos(lista, "tudo").length, 5);
  assert.deepEqual(
    filtrarEventos(lista, "mensagens").map((e) => e.tipo),
    ["lote_atrasado"],
  );
});

test("filtro por número mantém o evento do servidor (sem número)", () => {
  const lista = [ev({ instancia_id: "a" }), ev({ instancia_id: "b" }), ev({ instancia_id: null, tipo: "servidor_reiniciou" })];
  assert.equal(filtrarEventos(lista, "tudo", "a").length, 2);
});

test("agrupa por dia mantendo a ordem", () => {
  const grupos = agruparPorDia([{ em: "2026-11-14T15:00:00Z" }, { em: "2026-11-14T14:00:00Z" }, { em: "2026-11-12T14:00:00Z" }]);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].linhas.length, 2);
});

test("selo do número", () => {
  const base = { conexao_estado: "open", saude: "tempo_real" as const, atraso_mediano_s: null, alerta_aberto: false };
  assert.equal(situacaoDoNumero(base).rotulo, "Tempo real");
  assert.equal(situacaoDoNumero({ ...base, saude: "sem_eventos" }).rotulo, "Conectado");
  assert.equal(situacaoDoNumero({ ...base, saude: "atrasada", atraso_mediano_s: 840 }).rotulo, "Atrasado (14 min)");
  assert.equal(situacaoDoNumero({ ...base, conexao_estado: "close" }).nivel, "erro");
  assert.equal(situacaoDoNumero({ ...base, conexao_estado: "connecting" }).rotulo, "Reconectando");
  assert.equal(situacaoDoNumero({ ...base, saude: "sem_eventos", alerta_aberto: true }).nivel, "aviso");
});

test("quedas demais: mais de uma a cada 4 h", () => {
  assert.equal(quedasDemais(2, 24), false);
  assert.equal(quedasDemais(6, 24), false);
  assert.equal(quedasDemais(7, 24), true);
  assert.equal(quedasDemais(3, 6), true);
});

test("situação da mensagem", () => {
  const base = { from_me: false, status: null, atraso_s: 2, midia_erro: null, apagada: false };
  assert.equal(situacaoDaMensagem(base).rotulo, "Recebida na hora");
  assert.equal(situacaoDaMensagem({ ...base, atraso_s: 2820 }).rotulo, "Chegou com 47 min de atraso");
  assert.equal(situacaoDaMensagem({ ...base, atraso_s: 400000 }).nivel, "ok"); // histórico importado não é atraso
  assert.equal(situacaoDaMensagem({ ...base, from_me: true, status: "entregue" }).rotulo, "Entregue");
  assert.match(situacaoDaMensagem({ ...base, midia_erro: "getBase64 400" }).rotulo, /Mídia não baixou/);
});
