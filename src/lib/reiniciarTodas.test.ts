import assert from "node:assert/strict";
import test from "node:test";

import { executarFila, estadoItem, INTERVALO_ENTRE_REINICIOS_MS, ItemReinicio, resumirLote, selecionarParaReinicio } from "./reiniciarTodas";
import { faseReinicio } from "./reinicioInstancia";

const item = (name: string): ItemReinicio => ({ id: `id-${name}`, name, token: `tk-${name}` });

test("filtros: todas, só conectadas e só com problema", () => {
  const lista = [
    { name: "a", connectionStatus: "open" },
    { name: "b", connectionStatus: "close" },
    { name: "c", connectionStatus: "connecting" },
    { name: "d", connectionStatus: "closed" },
  ];
  assert.deepEqual(selecionarParaReinicio(lista, "todas").map((i) => i.name), ["a", "b", "c", "d"]);
  assert.deepEqual(selecionarParaReinicio(lista, "conectadas").map((i) => i.name), ["a"]);
  assert.deepEqual(selecionarParaReinicio(lista, "com_problema").map((i) => i.name), ["b", "c", "d"]);
});

test("fila: ordem preservada e 3 s entre um e outro (sem espera antes do primeiro nem depois do último)", async () => {
  const eventos: string[] = [];
  const esperas: number[] = [];
  const envios = await executarFila([item("a"), item("b"), item("c")], {
    reiniciar: async (i) => {
      eventos.push(`reiniciar:${i.name}`);
    },
    esperar: async (ms) => {
      esperas.push(ms);
      eventos.push("espera");
    },
  });
  assert.deepEqual(eventos, ["reiniciar:a", "espera", "reiniciar:b", "espera", "reiniciar:c"]);
  assert.deepEqual(esperas, [INTERVALO_ENTRE_REINICIOS_MS, INTERVALO_ENTRE_REINICIOS_MS]);
  assert.equal(INTERVALO_ENTRE_REINICIOS_MS, 3_000);
  assert.deepEqual(envios, { a: "enviado", b: "enviado", c: "enviado" });
});

test("fila: nunca dois reinícios ao mesmo tempo", async () => {
  let ativos = 0;
  let maximo = 0;
  await executarFila([item("a"), item("b"), item("c"), item("d")], {
    reiniciar: async () => {
      ativos++;
      maximo = Math.max(maximo, ativos);
      await new Promise((resolve) => setTimeout(resolve, 5));
      ativos--;
    },
    esperar: async () => {},
  });
  assert.equal(maximo, 1);
});

test("fila: uma falha não interrompe as demais", async () => {
  const chamados: string[] = [];
  const resultados: string[] = [];
  const envios = await executarFila([item("a"), item("b"), item("c")], {
    reiniciar: async (i) => {
      chamados.push(i.name);
      if (i.name === "b") throw new Error("401");
    },
    esperar: async () => {},
    depois: (i, envio) => {
      resultados.push(`${i.name}:${envio}`);
    },
  });
  assert.deepEqual(chamados, ["a", "b", "c"]);
  assert.deepEqual(resultados, ["a:enviado", "b:falhou", "c:enviado"]);
  assert.deepEqual(envios, { a: "enviado", b: "falhou", c: "enviado" });
});

test("fila: 'antes' roda antes da chamada de cada número", async () => {
  const eventos: string[] = [];
  await executarFila([item("a"), item("b")], {
    antes: (i) => eventos.push(`antes:${i.name}`),
    reiniciar: async (i) => {
      eventos.push(`reiniciar:${i.name}`);
    },
    esperar: async () => {},
  });
  assert.deepEqual(eventos, ["antes:a", "reiniciar:a", "antes:b", "reiniciar:b"]);
});

test("fila parada: os que faltam ficam como não enviados", async () => {
  let parar = false;
  const envios = await executarFila([item("a"), item("b"), item("c")], {
    reiniciar: async (i) => {
      if (i.name === "a") parar = true;
    },
    esperar: async () => {},
    cancelado: () => parar,
  });
  assert.deepEqual(envios, { a: "enviado", b: "nao_enviado", c: "nao_enviado" });
});

test("timeout: sem voltar a 'open' em 60 s, o número vira 'não reconectou'", () => {
  const base = { inicioMs: 1_000_000, viuOutroEstado: true, updatedAtMs: null as number | null };
  const aos59 = faseReinicio({ ...base, agoraMs: 1_059_000, estadoAtual: "connecting" });
  const aos60 = faseReinicio({ ...base, agoraMs: 1_060_000, estadoAtual: "connecting" });
  assert.equal(estadoItem({ envio: "enviado", temRegistro: true, fase: aos59 }), "reiniciando");
  assert.equal(estadoItem({ envio: "enviado", temRegistro: true, fase: aos60 }), "nao_reconectou");
});

test("estados: na fila, enviando, ok (registro apagado), falhou e não enviado", () => {
  assert.equal(estadoItem({ temRegistro: false }), "na_fila");
  assert.equal(estadoItem({ enviando: true, temRegistro: true }), "enviando");
  assert.equal(estadoItem({ envio: "enviado", temRegistro: false }), "ok");
  assert.equal(estadoItem({ envio: "falhou", temRegistro: false }), "falhou");
  assert.equal(estadoItem({ envio: "nao_enviado", temRegistro: false }), "nao_enviado");
});

test("resumo: contagens, progresso e fim do lote", () => {
  const andamento = resumirLote(["ok", "ok", "reiniciando", "na_fila"]);
  assert.equal(andamento.concluidas, 2);
  assert.equal(andamento.total, 4);
  assert.equal(andamento.terminou, false);

  const fim = resumirLote(["ok", "falhou", "nao_reconectou", "ok"]);
  assert.deepEqual({ ok: fim.ok, falhou: fim.falhou, naoReconectou: fim.naoReconectou, terminou: fim.terminou }, { ok: 2, falhou: 1, naoReconectou: 1, terminou: true });
  assert.equal(resumirLote([]).terminou, false);
});
