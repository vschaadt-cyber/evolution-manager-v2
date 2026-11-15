import assert from "node:assert/strict";
import test from "node:test";

import { emHorarioComercial, extrairUltimoRecebimento, haQuantoTempo, nivelRecebimento } from "./ultimoRecebimento";

// 2026-11-16 é segunda-feira. 15:00 UTC = 12:00 em Brasília.
const segundaMeioDia = Date.UTC(2026, 10, 16, 15, 0, 0);
const hora = 3_600_000;

test("extrai a primeira recebida, pulando as enviadas", () => {
  const ms = extrairUltimoRecebimento([
    { key: { fromMe: true }, messageTimestamp: 300 },
    { key: { fromMe: false }, messageTimestamp: 200 },
    { key: { fromMe: false }, messageTimestamp: 100 },
  ]);
  assert.equal(ms, 200_000);
  assert.equal(extrairUltimoRecebimento([{ key: { fromMe: true }, messageTimestamp: 1 }]), null);
  assert.equal(extrairUltimoRecebimento([]), null);
});

test("horário comercial: seg a sáb, 8h às 18h de Brasília", () => {
  assert.equal(emHorarioComercial(segundaMeioDia), true);
  assert.equal(emHorarioComercial(Date.UTC(2026, 10, 16, 10, 0, 0)), false); // 07:00
  assert.equal(emHorarioComercial(Date.UTC(2026, 10, 15, 15, 0, 0)), false); // domingo
});

test("níveis: normal até 2 h, amarelo acima de 2 h, vermelho acima de 6 h", () => {
  assert.equal(nivelRecebimento(segundaMeioDia - 1 * hora, segundaMeioDia), "normal");
  assert.equal(nivelRecebimento(segundaMeioDia - 3 * hora, segundaMeioDia), "amarelo");
  assert.equal(nivelRecebimento(segundaMeioDia - 7 * hora, segundaMeioDia), "vermelho");
  assert.equal(nivelRecebimento(null, segundaMeioDia), "normal");
});

test("fora do horário comercial não destaca", () => {
  const domingo = Date.UTC(2026, 10, 15, 15, 0, 0);
  assert.equal(nivelRecebimento(domingo - 20 * hora, domingo), "normal");
});

test("texto de quanto tempo faz", () => {
  assert.equal(haQuantoTempo(0, 12 * 60_000), "há 12 min");
  assert.equal(haQuantoTempo(0, 200 * 60_000), "há 3 h 20 min");
  assert.equal(haQuantoTempo(0, 49 * hora), "há 2 dias");
});
