const { test } = require("node:test");
const assert = require("node:assert/strict");
const criarAssistantChatService = require("../../src/assistant/assistant.chat.service");

const PERIOD_ATUAL = new Date().toISOString().slice(0, 7);
const USER_BASE = { id: "user1", plano: "free", moeda: "EUR", orcamento: 0 };

function criarDependenciasFalsas(overrides = {}) {
  const user = overrides.user !== undefined ? overrides.user : USER_BASE;
  const prisma = { user: { findUnique: async () => user } };

  const chamadas = { registarUso: [], streamChat: [] };

  const usageService = overrides.usageService || {
    periodoAtual: () => PERIOD_ATUAL,
    async verificarLimite() { return { permitido: true, used: 0, limit: 5, remaining: 5 }; },
    async registarUso(userId, period) { chamadas.registarUso.push({ userId, period }); },
  };

  const contextService = overrides.contextService || {
    async gerarContexto() { return { summary: { income: 0, expenses: 0, net: 0, savingsRate: 0 } }; },
  };

  const provider = overrides.provider || {
    async streamChat({ messages, onDelta }) {
      chamadas.streamChat.push({ messages });
      onDelta("Olá!");
    },
  };

  return { prisma, usageService, contextService, provider, chamadas };
}

test("prepararChat rejeita com 400 quando a última mensagem não é do utilizador", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantChatService(deps);
  await assert.rejects(
    () => service.prepararChat({ userId: "user1", mensagens: [{ role: "assistant", texto: "olá" }] }),
    (erro) => erro.status === 400
  );
});

test("prepararChat rejeita com 404 quando o utilizador não existe", async () => {
  const deps = criarDependenciasFalsas({ user: null });
  const service = criarAssistantChatService(deps);
  await assert.rejects(
    () => service.prepararChat({ userId: "fantasma", mensagens: [{ role: "user", texto: "olá" }] }),
    (erro) => erro.status === 404
  );
});

test("prepararChat rejeita com 429 quando o limite do plano foi atingido", async () => {
  const deps = criarDependenciasFalsas({
    usageService: {
      periodoAtual: () => PERIOD_ATUAL,
      async verificarLimite() { return { permitido: false, used: 5, limit: 5, remaining: 0 }; },
      async registarUso() { throw new Error("não devia ser chamado"); },
    },
  });
  const service = criarAssistantChatService(deps);
  await assert.rejects(
    () => service.prepararChat({ userId: "user1", mensagens: [{ role: "user", texto: "olá" }] }),
    (erro) => erro.status === 429 && erro.usage.remaining === 0
  );
});

test("só envia ao fornecedor as últimas ~10 trocas (20 mensagens), não a conversa inteira", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantChatService(deps);

  // 29 mensagens alternadas (14 trocas completas + a pergunta atual, sem
  // resposta ainda) — só as últimas 20 devem seguir.
  const mensagens = [];
  for (let i = 0; i < 14; i++) {
    mensagens.push({ role: "user", texto: `pergunta ${i}` });
    mensagens.push({ role: "assistant", texto: `resposta ${i}` });
  }
  mensagens.push({ role: "user", texto: "pergunta 14" });

  const prep = await service.prepararChat({ userId: "user1", mensagens });
  assert.equal(prep.historico.length, 20);
  // A última mensagem (a mais recente) tem de se manter, nunca ser cortada.
  assert.equal(prep.historico[prep.historico.length - 1].content, "pergunta 14");

  await service.stream({ ...prep, onDelta: () => {} });
  assert.equal(deps.chamadas.streamChat[0].messages.length, 20);
});

test("stream() só regista uso depois do streaming correr bem", async () => {
  const deps = criarDependenciasFalsas();
  const service = criarAssistantChatService(deps);
  const prep = await service.prepararChat({ userId: "user1", mensagens: [{ role: "user", texto: "Como estão as minhas finanças?" }] });

  await service.stream({ ...prep, onDelta: () => {} });
  assert.equal(deps.chamadas.registarUso.length, 1);
  assert.deepEqual(deps.chamadas.registarUso[0], { userId: "user1", period: PERIOD_ATUAL });
});

test("stream() mostra a mensagem da Rita quando o streaming falha a meio, e não regista uso", async () => {
  const deps = criarDependenciasFalsas({
    provider: {
      async streamChat({ onDelta }) {
        onDelta("Em ju"); // já começou a responder...
        throw new Error("ligação caiu");
      },
    },
  });
  const service = criarAssistantChatService(deps);
  const prep = await service.prepararChat({ userId: "user1", mensagens: [{ role: "user", texto: "Como estão as minhas finanças?" }] });

  await assert.rejects(
    () => service.stream({ ...prep, onDelta: () => {} }),
    (erro) => erro.message === "Perdi-me a meio da resposta — tenta outra vez?"
  );
  assert.equal(deps.chamadas.registarUso.length, 0);
});

test("stream() mantém a mensagem original quando a IA não está configurada (chave em falta)", async () => {
  const deps = criarDependenciasFalsas({
    provider: {
      async streamChat() {
        const erro = new Error("O assistente ainda não está configurado (falta a chave da IA).");
        erro.status = 503;
        erro.code = "AI_PROVIDER_NOT_CONFIGURED";
        throw erro;
      },
    },
  });
  const service = criarAssistantChatService(deps);
  const prep = await service.prepararChat({ userId: "user1", mensagens: [{ role: "user", texto: "olá" }] });

  await assert.rejects(
    () => service.stream({ ...prep, onDelta: () => {} }),
    (erro) => erro.code === "AI_PROVIDER_NOT_CONFIGURED"
  );
});
