const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarAcao } = require("../../src/assistant/actions/action-validator");

test("null/undefined devolve NO_ACTION", () => {
  assert.equal(validarAcao(null).type, "NO_ACTION");
  assert.equal(validarAcao(undefined).type, "NO_ACTION");
  assert.equal(validarAcao(null).requiresConfirmation, false);
});

test("tipo de ação desconhecido é inválido", () => {
  assert.equal(validarAcao({ type: "APAGAR_TUDO" }), null);
});

test("nunca confia no requiresConfirmation do fornecedor para ações que alteram dados", () => {
  const acao = validarAcao({
    type: "CREATE_BUDGET_DRAFT",
    label: "Preparar orçamento",
    payload: { categoryId: "abc", suggestedAmount: 250 },
    requiresConfirmation: false, // a IA tenta dizer que não precisa de confirmação
  });
  assert.equal(acao.requiresConfirmation, true);
});

test("ações de navegação não exigem confirmação", () => {
  const acao = validarAcao({ type: "OPEN_BUDGET" });
  assert.equal(acao.requiresConfirmation, false);
});

test("limita o tamanho do label e ignora payload inválido", () => {
  const acao = validarAcao({ type: "OPEN_REPORT", label: "x".repeat(500), payload: "não é um objeto" });
  assert.equal(acao.label.length, 200);
  assert.deepEqual(acao.payload, {});
});
