const { test } = require("node:test");
const assert = require("node:assert/strict");
const criarAssistantContextService = require("../../src/assistant/assistant-context.service");

// Prisma falso: cada teste define os dados que quer que cada tabela devolva.
function criarPrismaFalso({ despesas = [], rendimentos = [], metas = [], contas = [], lembretes = [] } = {}) {
  return {
    despesa: { findMany: async () => despesas },
    rendimento: { findMany: async () => rendimentos },
    meta: { findMany: async () => metas },
    conta: { findMany: async () => contas },
    lembrete: { findMany: async () => lembretes },
  };
}

const USER_BASE = { id: "user1", moeda: "EUR", plano: "free", orcamento: 0 };

test("utilizador sem despesas nem rendimentos dá zeros, não valores inventados", async () => {
  const service = criarAssistantContextService(criarPrismaFalso());
  const ctx = await service.gerarContexto(USER_BASE, "2026-07");

  assert.deepEqual(ctx.summary, { income: 0, expenses: 0, net: 0, savingsRate: 0 });
  assert.deepEqual(ctx.categories, []);
});

test("utilizador sem metas devolve lista vazia (nunca null nem inventado)", async () => {
  const service = criarAssistantContextService(criarPrismaFalso());
  const ctx = await service.gerarContexto(USER_BASE, "2026-07");
  assert.deepEqual(ctx.goals, []);
});

test("calcula corretamente o resumo financeiro do período", async () => {
  const despesas = [
    { cat: "Habitação", valor: 475 },
    { cat: "Alimentação", valor: 200 },
  ];
  const rendimentos = [{ fonte: "Salário", valor: 1500, rec: true }];
  const service = criarAssistantContextService(criarPrismaFalso({ despesas, rendimentos }));
  const ctx = await service.gerarContexto(USER_BASE, "2026-07");

  assert.equal(ctx.summary.income, 1500);
  assert.equal(ctx.summary.expenses, 675);
  assert.equal(ctx.summary.net, 825);
  assert.equal(ctx.summary.savingsRate, 55);
});

test("agrupa despesas por categoria com percentagens", async () => {
  const despesas = [
    { cat: "Habitação", valor: 475 },
    { cat: "Alimentação", valor: 225 },
  ];
  const service = criarAssistantContextService(criarPrismaFalso({ despesas }));
  const ctx = await service.gerarContexto(USER_BASE, "2026-07");

  const habitacao = ctx.categories.find((c) => c.name === "Habitação");
  assert.equal(habitacao.total, 475);
  assert.equal(habitacao.percentage, 67.86);
});

test("usa a moeda principal do utilizador, sem converter", async () => {
  const service = criarAssistantContextService(criarPrismaFalso());
  const ctx = await service.gerarContexto({ ...USER_BASE, moeda: "USD" }, "2026-07");
  assert.equal(ctx.user.currency, "USD");
});

test("nunca inclui dados sensíveis ou técnicos no contexto", async () => {
  const userComDadosSensiveis = {
    ...USER_BASE,
    email: "user@example.com",
    password: "hash-secreto",
    codigoVerif: "hash-do-codigo",
    stripeCustomerId: "cus_123",
  };
  const service = criarAssistantContextService(criarPrismaFalso());
  const ctx = await service.gerarContexto(userComDadosSensiveis, "2026-07");

  const bruto = JSON.stringify(ctx);
  assert.doesNotMatch(bruto, /user@example\.com/);
  assert.doesNotMatch(bruto, /hash-secreto/);
  assert.doesNotMatch(bruto, /hash-do-codigo/);
  assert.doesNotMatch(bruto, /cus_123/);
});

test("isola dados por período: startDate/endDate correspondem ao mês pedido", async () => {
  const service = criarAssistantContextService(criarPrismaFalso());
  const ctx = await service.gerarContexto(USER_BASE, "2026-02");
  assert.equal(ctx.period.startDate, "2026-02-01");
  assert.equal(ctx.period.endDate, "2026-02-28");
});
