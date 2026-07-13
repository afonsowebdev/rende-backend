/* =========================================================
   Rende+ — Serviço de chat do Assistente (Fase 1, em streaming)
   ---------------------------------------------------------
   Junta as peças que já tinhas e liga-as ao Claude:
     1) mapeia o histórico do frontend ({role, texto}) para o
        formato da Anthropic ({role, content});
     2) confirma o utilizador e o limite do plano (config.js);
     3) gera o contexto financeiro REAL da conta (nunca inventado);
     4) monta o system prompt com esse contexto e pede a resposta
        ao fornecedor, aos pedaços (onDelta);
     5) só regista o uso DEPOIS de a resposta correr bem.

   Está dividido em dois passos de propósito:
     - prepararChat(): faz as validações que podem devolver um
       código de estado (404/429) ANTES de começarmos a enviar o
       streaming, para o controller poder responder em condições;
     - stream(): a partir daqui já não há códigos de estado — o
       texto começa a fluir.
   ========================================================= */

const prismaPadrao = require("../db");
const criarUsageService = require("./assistant-usage.service");
const criarContextService = require("./assistant-context.service");
const criarAnthropicProvider = require("./providers/anthropic.provider");
const { SYSTEM_PROMPT } = require("./prompts/system-prompt");
const { AI_ENV, MENSAGEM } = require("./config");

function erroComStatus(mensagem, status, extra) {
  const erro = new Error(mensagem);
  erro.status = status;
  if (extra) Object.assign(erro, extra);
  return erro;
}

// Aceita o formato do frontend ({role, texto}) e também {role, content}.
// Fica só com mensagens de "user"/"assistant" e com texto não vazio.
function mapearMensagens(mensagens) {
  if (!Array.isArray(mensagens)) return [];
  return mensagens
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: String(m.texto != null ? m.texto : m.content != null ? m.content : "")
        .slice(0, MENSAGEM.MAX_CHARS)
        .trim(),
    }))
    .filter((m) => m.content);
}

function criarAssistantChatService({
  prisma = prismaPadrao,
  usageService = criarUsageService(prisma),
  contextService = criarContextService(prisma),
  provider = criarAnthropicProvider(),
} = {}) {
  return {
    async prepararChat({ userId, mensagens }) {
      const historico = mapearMensagens(mensagens);
      if (!historico.length || historico[historico.length - 1].role !== "user") {
        throw erroComStatus("A última mensagem tem de ser do utilizador.", 400);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw erroComStatus("Utilizador não encontrado.", 404);

      const plano = user.plano || "free";
      const period = usageService.periodoAtual();

      const limite = await usageService.verificarLimite(userId, plano, period);
      if (!limite.permitido) {
        throw erroComStatus(
          "Atingiste o limite de perguntas ao assistente para este período.",
          429,
          { usage: { used: limite.used, limit: limite.limit, remaining: limite.remaining } }
        );
      }

      const contexto = await contextService.gerarContexto(user, period);
      return { userId, period, historico, contexto };
    },

    async stream({ userId, period, historico, contexto, onDelta }) {
      // O contexto financeiro entra no system prompt: o modelo passa a
      // "ver" os teus totais reais, mas continua proibido de inventar.
      const system =
        SYSTEM_PROMPT +
        "\n\nContexto financeiro do utilizador (JSON, apenas dados reais da conta autenticada). " +
        "Baseia-te só nestes valores; se faltar informação, di-lo em vez de inventar:\n" +
        JSON.stringify(contexto);

      await provider.streamChat({
        system,
        messages: historico,
        maxTokens: AI_ENV.MAX_TOKENS,
        timeoutMs: AI_ENV.TIMEOUT_MS,
        onDelta,
      });

      // Só conta como "pergunta usada" quando a resposta correu bem.
      await usageService.registarUso(userId, period);
    },
  };
}

module.exports = criarAssistantChatService;