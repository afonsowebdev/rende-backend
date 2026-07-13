/* =========================================================
   Rende+ — Orquestração do Assistente Financeiro
   ---------------------------------------------------------
   Fluxo desta fase (sem fornecedor de IA ligado):
     1) confirmar que a conversa indicada (se houver) é do utilizador;
     2) verificar o limite de utilização do plano;
     3) validar o período pedido;
     4) gerar o contexto financeiro (resumido, nunca exposto por inteiro);
     5) registar a utilização;
     6) devolver uma resposta técnica confirmando que tudo está pronto.

   Quando existir um fornecedor real, este é o único ficheiro que
   precisa de mudar: entre os passos 4 e 5 passa a construir-se o
   prompt (prompts/prompt-builder.js), chamar `provider.generateResponse`
   (assistant-provider.interface.js) e validar o resultado
   (assistant-response.service.js) antes de responder.
   ========================================================= */

const prismaPadrao = require("../db");
const criarUsageService = require("./assistant-usage.service");
const criarContextService = require("./assistant-context.service");
const criarRepository = require("./assistant.repository");

function erroComStatus(mensagem, status, extra) {
  const erro = new Error(mensagem);
  erro.status = status;
  if (extra) Object.assign(erro, extra);
  return erro;
}

// Um período no futuro não tem dados possíveis — comparação de strings
// funciona porque "AAAA-MM" está sempre no mesmo formato com zeros à esquerda.
function periodoNoFuturo(period) {
  return period > new Date().toISOString().slice(0, 7);
}

// Só os totais/flags que o frontend precisa nesta fase — nunca o contexto completo.
function resumoSeguroParaFrontend(contexto, period) {
  return {
    period,
    currency: contexto.user.currency,
    hasIncomeData: contexto.summary.income > 0,
    hasExpenseData: contexto.summary.expenses > 0,
    hasGoals: contexto.goals.length > 0,
  };
}

function criarAssistantService({
  prisma = prismaPadrao,
  usageService = criarUsageService(prisma),
  contextService = criarContextService(prisma),
  repository = criarRepository(prisma),
} = {}) {
  return {
    async processarChat({ userId, message, period, conversationId }) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw erroComStatus("Utilizador não encontrado.", 404);

      if (conversationId) {
        const conversa = await repository.obterConversa(conversationId, userId);
        if (!conversa) throw erroComStatus("Conversa não encontrada.", 404);
      }

      const plano = user.plano || "free";
      const limite = await usageService.verificarLimite(userId, plano, period);
      if (!limite.permitido) {
        throw erroComStatus(
          "Atingiste o limite de perguntas ao assistente para este período.",
          429,
          { usage: { used: limite.used, limit: limite.limit, remaining: limite.remaining } }
        );
      }

      if (periodoNoFuturo(period)) {
        throw erroComStatus("O período indicado ainda não decorreu.", 400);
      }

      const contexto = await contextService.gerarContexto(user, period);

      await usageService.registarUso(userId, period);
      const usage = await usageService.obterResumo(userId, period, plano);

      return {
        status: "ready",
        message: "A infraestrutura do Assistente Rende+ está preparada para integração.",
        contextSummary: resumoSeguroParaFrontend(contexto, period),
        usage,
      };
    },
  };
}

module.exports = criarAssistantService;
