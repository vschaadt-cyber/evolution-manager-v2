import assert from "node:assert/strict";
import test from "node:test";

import { acharInstanciaPorNumero, aguardar, recebeuTeste, textoTeste } from "./testeEnvio";

test("recebeuTeste: só conta mensagem recebida com o código", () => {
  const recebida = { key: { fromMe: false }, message: { conversation: textoTeste("AB12C") } };
  const enviada = { key: { fromMe: true }, message: { conversation: textoTeste("AB12C") } };
  assert.equal(recebeuTeste([recebida], "AB12C"), true);
  assert.equal(recebeuTeste([enviada], "AB12C"), false);
  assert.equal(recebeuTeste([recebida], "ZZZZZ"), false);
  assert.equal(recebeuTeste([{ key: { fromMe: false }, message: { extendedTextMessage: { text: "oi [AB12C]" } } }], "AB12C"), true);
});

test("acharInstanciaPorNumero: compara dígitos e ignora a instância testada", () => {
  const lista = [
    { name: "a", token: "1", ownerJid: "5547999990001@s.whatsapp.net" },
    { name: "b", token: "2", ownerJid: "5547999990002@s.whatsapp.net" },
  ];
  assert.equal(acharInstanciaPorNumero(lista, "+55 (47) 99999-0002", "a")?.name, "b");
  assert.equal(acharInstanciaPorNumero(lista, "5547999990001", "a"), null);
  assert.equal(acharInstanciaPorNumero(lista, "123", "a"), null);
});

test("aguardar: para quando confere e respeita o limite de tentativas", async () => {
  let chamadas = 0;
  const esperas: number[] = [];
  const esperar = async (ms: number) => {
    esperas.push(ms);
  };
  assert.equal(await aguardar(async () => ++chamadas === 3, { tentativas: 5, intervaloMs: 3000, esperar }), true);
  assert.equal(chamadas, 3);
  assert.deepEqual(esperas, [3000, 3000]);

  esperas.length = 0;
  assert.equal(await aguardar(async () => false, { tentativas: 3, intervaloMs: 1000, esperar }), false);
  assert.deepEqual(esperas, [1000, 1000]);
});
