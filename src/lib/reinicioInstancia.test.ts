import assert from "node:assert/strict";
import test from "node:test";

import { faseReinicio } from "./reinicioInstancia";

const base = { inicioMs: 1_000_000, viuOutroEstado: false, updatedAtMs: null as number | null };

test("logo após o clique: reiniciando", () => {
  assert.equal(faseReinicio({ ...base, agoraMs: 1_001_000, estadoAtual: "open" }), "reiniciando");
});

test("saiu do aberto e voltou: conectado só com a transição", () => {
  assert.equal(faseReinicio({ ...base, viuOutroEstado: true, agoraMs: 1_003_000, estadoAtual: "connecting" }), "iniciando");
  assert.equal(faseReinicio({ ...base, viuOutroEstado: true, agoraMs: 1_004_000, estadoAtual: "open" }), "conectado");
});

test("open sem transição antes de 8 s não vira conectado", () => {
  assert.equal(faseReinicio({ ...base, agoraMs: 1_005_000, estadoAtual: "open", updatedAtMs: 1_004_000 }), "reiniciando");
});

test("open em 8 s com conexão recente vira conectado", () => {
  assert.equal(faseReinicio({ ...base, agoraMs: 1_008_500, estadoAtual: "open", updatedAtMs: 1_000_500 }), "conectado");
});

test("sem resposta em 60 s", () => {
  assert.equal(faseReinicio({ ...base, agoraMs: 1_060_000, estadoAtual: "close" }), "sem_resposta");
});
