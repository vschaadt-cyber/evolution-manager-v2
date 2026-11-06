// Testes simples das regras de diagnóstico. Rodar com: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import { countConnectionErrors, diagnoseConnection, diagnoseInstance, diagnoseWebhook, isValidHttpUrl, withinPeriod } from "./rules";

test("conexão aberta é OK", () => {
  assert.equal(diagnoseConnection({ connectionStatus: "open" }).level, "ok");
});

test("connecting é aviso", () => {
  const row = diagnoseConnection({ connectionStatus: "connecting" });
  assert.equal(row.level, "warn");
});

test("código 401 traduz para sessão encerrada no celular", () => {
  const row = diagnoseConnection({ connectionStatus: "close", disconnectionReasonCode: 401 });
  assert.equal(row.level, "error");
  assert.equal(row.title, "Sessão encerrada no celular");
  assert.match(row.message, /QR Code/);
});

test("código 440 traduz para conexão substituída", () => {
  assert.equal(diagnoseConnection({ connectionStatus: "closed", disconnectionReasonCode: 440 }).title, "Conexão substituída por outro WhatsApp Web");
});

test("código 500 indica apagar e parear de novo", () => {
  const row = diagnoseConnection({ connectionStatus: "close", disconnectionReasonCode: 500 });
  assert.equal(row.action, "open-instance");
  assert.match(row.message, /Apague/);
});

test("código desconhecido não quebra", () => {
  const row = diagnoseConnection({ connectionStatus: "close", disconnectionReasonCode: 999 });
  assert.equal(row.level, "error");
  assert.match(row.message, /999/);
});

test("webhook desligado é erro com ação de ligar", () => {
  const row = diagnoseWebhook({ enabled: false, url: "https://n8n.exemplo.com/hook" });
  assert.equal(row.level, "error");
  assert.equal(row.action, "enable-webhook");
});

test("webhook ligado sem URL pede a URL, sem ação automática", () => {
  const row = diagnoseWebhook({ enabled: true, url: "", events: ["MESSAGES_UPSERT"] });
  assert.equal(row.level, "error");
  assert.equal(row.action, "open-webhook");
});

test("webhook ligado sem eventos é aviso com ação", () => {
  const row = diagnoseWebhook({ enabled: true, url: "https://n8n.exemplo.com/hook", events: [] });
  assert.equal(row.level, "warn");
  assert.equal(row.action, "enable-webhook");
});

test("webhook não lido é aviso", () => {
  assert.equal(diagnoseWebhook(undefined, true).level, "warn");
});

test("diagnóstico completo traz conexão, webhook, proxy e último evento", () => {
  const rows = diagnoseInstance({
    instance: { connectionStatus: "open", disconnectionAt: null },
    webhook: { enabled: true, url: "https://n8n.exemplo.com/hook", events: ["CONNECTION_UPDATE"] },
    proxy: null,
  });
  assert.deepEqual(
    rows.map((row) => row.check),
    ["conexao", "webhook", "proxy", "ultimo-evento"],
  );
});

test("conta só instâncias com erro de conexão", () => {
  const count = countConnectionErrors([{ connectionStatus: "open" }, { connectionStatus: "close", disconnectionReasonCode: 401 }, { connectionStatus: "connecting" }, { connectionStatus: "closed" }]);
  assert.equal(count, 2);
});

test("valida URL http e https", () => {
  assert.equal(isValidHttpUrl("https://a.com/x"), true);
  assert.equal(isValidHttpUrl("ftp://a.com"), false);
  assert.equal(isValidHttpUrl("não é url"), false);
  assert.equal(isValidHttpUrl(""), false);
});

test("filtro de período esconde evento antigo e mantém linha sem horário", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(withinPeriod({ at: "2026-11-06T06:00:00Z" }, "1d", now), true);
  assert.equal(withinPeriod({ at: "2026-11-01T06:00:00Z" }, "1d", now), false);
  assert.equal(withinPeriod({ at: "2026-11-01T06:00:00Z" }, "7d", now), true);
  assert.equal(withinPeriod({ at: null }, "1d", now), true);
  assert.equal(withinPeriod({ at: "2020-01-01T00:00:00Z" }, "all", now), true);
});
