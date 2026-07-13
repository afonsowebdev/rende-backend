const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarPedidoChat } = require("../../src/assistant/assistant.schemas");

test("rejeita corpo sem 'message'", () => {
  const r = validarPedidoChat({ period: "2026-07" });
  assert.equal(r.valido, false);
});

test("rejeita 'message' vazia (só espaços)", () => {
  const r = validarPedidoChat({ message: "   " });
  assert.equal(r.valido, false);
});

test("rejeita 'message' demasiado curta", () => {
  const r = validarPedidoChat({ message: "oi" }); // 2 chars, mínimo é 3
  assert.equal(r.valido, false);
});

test("rejeita 'message' demasiado longa", () => {
  const r = validarPedidoChat({ message: "a".repeat(1501) });
  assert.equal(r.valido, false);
});

test("remove espaços à volta da mensagem", () => {
  const r = validarPedidoChat({ message: "  Como estão as minhas finanças?  " });
  assert.equal(r.valido, true);
  assert.equal(r.dados.message, "Como estão as minhas finanças?");
});

test("rejeita 'period' em formato inválido", () => {
  const r = validarPedidoChat({ message: "Como estão as minhas finanças?", period: "2026/07" });
  assert.equal(r.valido, false);
});

test("usa o mês atual quando 'period' não é indicado", () => {
  const r = validarPedidoChat({ message: "Como estão as minhas finanças?" });
  assert.equal(r.valido, true);
  assert.equal(r.dados.period, new Date().toISOString().slice(0, 7));
});

test("nunca aceita 'userId' vindo do corpo do pedido", () => {
  const r = validarPedidoChat({ message: "Como estão as minhas finanças?", userId: "outro-utilizador" });
  assert.equal(r.valido, false);
  assert.match(r.erro, /userId/);
});

test("rejeita qualquer campo desconhecido", () => {
  const r = validarPedidoChat({ message: "Como estão as minhas finanças?", campoInventado: true });
  assert.equal(r.valido, false);
});

test("aceita um pedido válido completo", () => {
  const r = validarPedidoChat({
    message: "Como estão as minhas finanças este mês?",
    period: "2026-07",
    conversationId: "conv_123",
  });
  assert.equal(r.valido, true);
  assert.deepEqual(r.dados, {
    message: "Como estão as minhas finanças este mês?",
    period: "2026-07",
    conversationId: "conv_123",
  });
});
