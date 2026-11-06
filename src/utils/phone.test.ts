// Testes simples do formatador de telefone. Rodar com: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_INSTANCE_LABEL, formatBrazilPhone, getInstanceLabel } from "./phone";

test("formata celular com JID e DDI 55", () => {
  assert.equal(formatBrazilPhone("5547999991234@s.whatsapp.net"), "(47) 99999-1234");
});

test("formata fixo de 10 dígitos", () => {
  assert.equal(formatBrazilPhone("554733511647"), "(47) 3351-1647");
});

test("aceita número sem DDI e com máscara", () => {
  assert.equal(formatBrazilPhone("(11) 91234-5678"), "(11) 91234-5678");
  assert.equal(formatBrazilPhone("11912345678"), "(11) 91234-5678");
});

test("retorna null para vazio ou tamanho inválido", () => {
  assert.equal(formatBrazilPhone(""), null);
  assert.equal(formatBrazilPhone(null), null);
  assert.equal(formatBrazilPhone("123"), null);
  assert.equal(formatBrazilPhone("123456789012345678@lid"), null);
});

test("sem localStorage, o rótulo cai no padrão", () => {
  assert.equal(getInstanceLabel("abc"), DEFAULT_INSTANCE_LABEL);
  assert.equal(DEFAULT_INSTANCE_LABEL, "(47) 3351-1647");
});
