const { test } = require("node:test");
const assert = require("node:assert/strict");
const criarAssistantService = require("../../src/assistant/assistant.service");

const PERIOD_ATUAL = new Date().toISOString().slice(0, 7);

function criarDependenciasFalsas(overrides = {}) {
  const user = overrides.user !== undefined ? overrides.user : { id: "user1", plano: "free", moeda: "EUR", orcamento: 0 };

  const prisma = { user: { findUnique: async () => user } };

  const contextoFalso = overrides.contexto || {
    user: { currency: "EUR", locale: "pt-PT", plan: "free" },
    summary: { income: 1000, expenses: 500, net: 500, savingsRate: 50 },
    goals: [],
  };

  const chamadas = { registarUso: [] };

  const usageService = overrides.usageService || {
    async verificarLimite() {
      return { permitido: true, used: 0, limit: 5, remaining: 5 };
    },
    async registarUso(userId, period) {
      chamadas.registarUso.push({ userId, period });
    },
    async obterResumo() {
      return { used: 1, limit: 5, remaining: 4 };
    },
  };

  const contextService = overrides.contextService || {
    async gerarContexto() {
      return contextoFalso;
    },
  };

  const repository = overrides.repository || {
    async obterConversa() {
      return null;
    },
  };

  return { prisma, usageService, contextService, repository, chamadas };
}

test("rejeita com 404 quando o utilizador autenticado não existe", async () => {
  const deps = criarDependenciasFalsas({ user: null });
  const service = criarAssistantService(deps);

  await assert.rejects(
    () => service.processarChat({ userId: "fantasma", message: "olá", period: PERIOD_ATUAL }),
    (erro) => erro.status === 404
  );
});

test("rejeita com 404 quando o conversationId não pertence ao utilizador", async () => {
  const deps = criarDependenciasFalsas({
    repository: { async obterConversa() { return null; } },
  });
  const service = criarAssistantService(deps);

  await assert.rejects(
    () => service.processarChat({ userId: "user1", message: "olá", period: PERIOD_ATUAL, conversationId: "conv-de-outro" }),
    (erro) => erro.status === 404
  );
});

test("rejeita com 429 e devolve o uso quando o limite do plano foi atingido", async () => {
  const deps = criarDependenciasFalsas({
    usageService: {
      async verificarLimite() { return { permitido: false, used: 5, limit: 5, remaining: 0 }; },
      async registarUso() { throw new Error("não devia ser chamado"); },
      async obterResumo() { throw new Error("não devia ser chamado"); },
    },
  });
  const service = criarAssistantService(deps);

  await assert.rejects(
    () => service.processarChat({ userId: "user1", message: "olá", period: PERIOD_ATUAL }),
    (erro) => erro.status === 429 && erro.usage.remaining === 0
  );
});

test("rejeita com 400 quando o período pedido ainda não decorreu", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantService(deps);
  const futuro = String(Number(PERIOD_ATUAL.slice(0, 4)) + 1) + PERIOD_ATUAL.slice(4);

  await assert.rejects(
    () => service.processarChat({ userId: "user1", message: "olá", period: futuro }),
    (erro) => erro.status === 400
  );
});

test("caminho feliz: devolve status 'ready', contextSummary seguro e uso atualizado", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantService(deps);

  const resposta = await service.processarChat({ userId: "user1", message: "Como estão as minhas finanças?", period: PERIOD_ATUAL });

  assert.equal(resposta.status, "ready");
  assert.deepEqual(resposta.contextSummary, {
    period: PERIOD_ATUAL,
    currency: "EUR",
    hasIncomeData: true,
    hasExpenseData: true,
    hasGoals: false,
  });
  assert.deepEqual(resposta.usage, { used: 1, limit: 5, remaining: 4 });
  assert.equal(deps.chamadas.registarUso.length, 1);
});

test("nunca devolve o contexto financeiro completo ao frontend", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantService(deps);
  const resposta = await service.processarChat({ userId: "user1", message: "Como estão as minhas finanças?", period: PERIOD_ATUAL });

  const chaves = Object.keys(resposta.contextSummary);
  assert.deepEqual(chaves.sort(), ["currency", "hasExpenseData", "hasGoals", "hasIncomeData", "period"]);
});
