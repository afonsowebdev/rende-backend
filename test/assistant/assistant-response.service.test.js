const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarRespostaEstruturada } = require("../../src/assistant/assistant-response.service");

test("rejeita texto que não é JSON", () => {
  const r = validarRespostaEstruturada("isto não é JSON {{{");
  assert.equal(r.valido, false);
});

test("rejeita um array ou primitivo como resposta", () => {
  assert.equal(validarRespostaEstruturada("[1,2,3]").valido, false);
  assert.equal(validarRespostaEstruturada("42").valido, false);
});

test("aceita uma resposta válida e normaliza os campos", () => {
  const r = validarRespostaEstruturada(
    JSON.stringify({
      summary: "Gastaste mais este mês.",
      metrics: [{ label: "Poupança", value: "25%" }],
      observation: "As despesas subiram.",
      recommendedAction: { type: "OPEN_BUDGET", label: "Ver orçamento", payload: {} },
      disclaimer: "Isto não é aconselhamento financeiro.",
    })
  );
  assert.equal(r.valido, true);
  assert.equal(r.resposta.summary, "Gastaste mais este mês.");
  assert.equal(r.resposta.metrics.length, 1);
  assert.equal(r.resposta.recommendedAction.type, "OPEN_BUDGET");
  assert.equal(r.resposta.disclaimer, "Isto não é aconselhamento financeiro.");
});

test("campos em falta não fazem a validação rebentar (usam defaults seguros)", () => {
  const r = validarRespostaEstruturada(JSON.stringify({}));
  assert.equal(r.valido, true);
  assert.equal(r.resposta.summary, "");
  assert.deepEqual(r.resposta.metrics, []);
  assert.equal(r.resposta.recommendedAction.type, "NO_ACTION");
  assert.equal("disclaimer" in r.resposta, false);
});

test("ignora métricas mal formadas e limita a 20", () => {
  const metrics = Array.from({ length: 30 }, (_, i) => ({ label: `m${i}`, value: i }));
  metrics.push({ label: "sem valor" }); // inválida, deve ser filtrada
  const r = validarRespostaEstruturada(JSON.stringify({ metrics }));
  assert.equal(r.valido, true);
  assert.equal(r.resposta.metrics.length, 20);
});

test("recommendedAction inválido cai para NO_ACTION em vez de rebentar", () => {
  const r = validarRespostaEstruturada(JSON.stringify({ recommendedAction: { type: "ISTO_NAO_EXISTE" } }));
  assert.equal(r.valido, true);
  assert.equal(r.resposta.recommendedAction.type, "NO_ACTION");
});
