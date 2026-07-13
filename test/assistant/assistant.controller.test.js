const { test } = require("node:test");
const assert = require("node:assert/strict");
const criarAssistantController = require("../../src/assistant/assistant.controller");

// req/res mínimos, ao estilo Express — sem precisar de um servidor real.
function criarRes() {
  const res = { statusCode: null, corpo: null };
  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };
  res.json = (obj) => {
    res.corpo = obj;
    return res;
  };
  return res;
}

test("400 quando o body não passa a validação (sem message)", async () => {
  const { postChat } = criarAssistantController({ assistantService: { processarChat: async () => { throw new Error("não devia ser chamado"); } } });
  const req = { userId: "user1", body: {} };
  const res = criarRes();

  await postChat(req, res);
  assert.equal(res.statusCode, 400);
});

test("400 quando o body tenta enviar userId", async () => {
  const { postChat } = criarAssistantController({ assistantService: { processarChat: async () => { throw new Error("não devia ser chamado"); } } });
  const req = { userId: "user1", body: { message: "Como estão as minhas finanças?", userId: "outro" } };
  const res = criarRes();

  await postChat(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.corpo.erro, /userId/);
});

test("200 no caminho feliz, usando sempre req.userId (nunca o body)", async () => {
  let userIdRecebido = null;
  const assistantService = {
    async processarChat({ userId }) {
      userIdRecebido = userId;
      return { status: "ready", message: "ok", contextSummary: {}, usage: { used: 1, limit: 5, remaining: 4 } };
    },
  };
  const { postChat } = criarAssistantController({ assistantService });
  const req = { userId: "user-autenticado", body: { message: "Como estão as minhas finanças?" } };
  const res = criarRes();

  await postChat(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.corpo.status, "ready");
  assert.equal(userIdRecebido, "user-autenticado");
});

test("propaga o status e o uso quando o serviço rejeita com 429", async () => {
  const assistantService = {
    async processarChat() {
      const erro = new Error("Limite atingido.");
      erro.status = 429;
      erro.usage = { used: 5, limit: 5, remaining: 0 };
      throw erro;
    },
  };
  const { postChat } = criarAssistantController({ assistantService });
  const req = { userId: "user1", body: { message: "Como estão as minhas finanças?" } };
  const res = criarRes();

  await postChat(req, res);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.corpo.usage, { used: 5, limit: 5, remaining: 0 });
});

test("erros sem status são relançados (tratador central trata deles)", async () => {
  const assistantService = {
    async processarChat() {
      throw new Error("Falha inesperada de base de dados.");
    },
  };
  const { postChat } = criarAssistantController({ assistantService });
  const req = { userId: "user1", body: { message: "Como estão as minhas finanças?" } };
  const res = criarRes();

  await assert.rejects(() => postChat(req, res));
});
