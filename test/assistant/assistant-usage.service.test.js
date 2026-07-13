const { test } = require("node:test");
const assert = require("node:assert/strict");
const criarAssistantUsageService = require("../../src/assistant/assistant-usage.service");

// Prisma falso, em memória — nenhum teste aqui toca a base de dados real.
function criarPrismaFalso() {
  const tabela = new Map(); // chave "userId:period" -> registo

  return {
    assistantUsage: {
      async findUnique({ where: { userId_period } }) {
        const chave = `${userId_period.userId}:${userId_period.period}`;
        return tabela.get(chave) || null;
      },
      async upsert({ where: { userId_period }, create, update }) {
        const chave = `${userId_period.userId}:${userId_period.period}`;
        const existente = tabela.get(chave);
        if (!existente) {
          const novo = { ...create };
          tabela.set(chave, novo);
          return novo;
        }
        if (update.requestCount && typeof update.requestCount === "object") {
          existente.requestCount += update.requestCount.increment;
        }
        existente.lastRequestAt = update.lastRequestAt;
        return existente;
      },
    },
    _tabela: tabela,
  };
}

test("utilizador Free sem uso ainda tem o limite completo disponível", async () => {
  const service = criarAssistantUsageService(criarPrismaFalso());
  const resumo = await service.obterResumo("user1", "2026-07", "free");
  assert.deepEqual(resumo, { used: 0, limit: 5, remaining: 5 });
});

test("utilizador Premium tem um limite mensal maior", async () => {
  const service = criarAssistantUsageService(criarPrismaFalso());
  const resumo = await service.obterResumo("user1", "2026-07", "premium");
  assert.equal(resumo.limit, 100);
});

test("verificarLimite bloqueia quando o limite Free é atingido", async () => {
  const prisma = criarPrismaFalso();
  const service = criarAssistantUsageService(prisma);
  for (let i = 0; i < 5; i++) await service.registarUso("user1", "2026-07");

  const limite = await service.verificarLimite("user1", "free", "2026-07");
  assert.equal(limite.permitido, false);
  assert.equal(limite.remaining, 0);
});

test("registarUso não cria registos duplicados no mesmo período (upsert)", async () => {
  const prisma = criarPrismaFalso();
  const service = criarAssistantUsageService(prisma);
  await service.registarUso("user1", "2026-07");
  await service.registarUso("user1", "2026-07");
  await service.registarUso("user1", "2026-07");

  assert.equal(prisma._tabela.size, 1);
  const resumo = await service.obterResumo("user1", "2026-07", "free");
  assert.equal(resumo.used, 3);
});

test("períodos diferentes do mesmo utilizador não se misturam", async () => {
  const prisma = criarPrismaFalso();
  const service = criarAssistantUsageService(prisma);
  await service.registarUso("user1", "2026-06");
  await service.registarUso("user1", "2026-07");

  const junho = await service.obterResumo("user1", "2026-06", "free");
  const julho = await service.obterResumo("user1", "2026-07", "free");
  assert.equal(junho.used, 1);
  assert.equal(julho.used, 1);
});
