/* =========================================================
   Rende+ — Limites de utilização do Assistente Financeiro
   ---------------------------------------------------------
   Conta perguntas por utilizador e por período ("AAAA-MM") e
   compara com o limite do plano (config.js). Não decide o que
   fazer quando o limite é atingido — isso é do assistant.service.
   ========================================================= */

const prismaPadrao = require("../db");
const { limiteMensalDoPlano } = require("./config");

function periodoAtual() {
  return new Date().toISOString().slice(0, 7); // "AAAA-MM"
}

// Recebe o cliente Prisma por parâmetro (por omissão, o partilhado em
// src/db.js) para que os testes possam passar um cliente falso.
function criarAssistantUsageService(prisma = prismaPadrao) {
  return {
    periodoAtual,

    async obterResumo(userId, period = periodoAtual(), plano = "free") {
      const uso = await prisma.assistantUsage.findUnique({
        where: { userId_period: { userId, period } },
      });
      const used = uso ? uso.requestCount : 0;
      const limit = limiteMensalDoPlano(plano);
      return { used, limit, remaining: Math.max(0, limit - used) };
    },

    async verificarLimite(userId, plano, period = periodoAtual()) {
      const resumo = await this.obterResumo(userId, period, plano);
      return { permitido: resumo.remaining > 0, ...resumo };
    },

    async registarUso(userId, period = periodoAtual()) {
      return prisma.assistantUsage.upsert({
        where: { userId_period: { userId, period } },
        create: { userId, period, requestCount: 1, lastRequestAt: new Date() },
        update: { requestCount: { increment: 1 }, lastRequestAt: new Date() },
      });
    },
  };
}

module.exports = criarAssistantUsageService;
