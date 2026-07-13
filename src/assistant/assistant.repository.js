/* =========================================================
   Rende+ — Acesso a dados do Assistente (conversas, mensagens,
   utilização e feedback)
   ---------------------------------------------------------
   Todas as consultas são sempre filtradas por userId: nenhum
   método aqui permite ler ou alterar dados de outro utilizador.
   ========================================================= */

const prismaPadrao = require("../db");

function criarAssistantRepository(prisma = prismaPadrao) {
  return {
    async obterConversa(conversationId, userId) {
      if (!conversationId) return null;
      return prisma.assistantConversation.findFirst({ where: { id: conversationId, userId } });
    },

    async criarConversa(userId, titulo = null) {
      return prisma.assistantConversation.create({ data: { userId, titulo } });
    },

    async listarConversas(userId) {
      return prisma.assistantConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
    },

    async listarMensagens(conversationId, userId) {
      const conversa = await this.obterConversa(conversationId, userId);
      if (!conversa) return null;
      return prisma.assistantMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      });
    },

    async apagarConversa(conversationId, userId) {
      const conversa = await this.obterConversa(conversationId, userId);
      if (!conversa) return false;
      await prisma.assistantConversation.delete({ where: { id: conversationId } });
      return true;
    },

    async guardarMensagem({ conversationId, userId, role, content, structuredResponse = null }) {
      return prisma.assistantMessage.create({
        data: { conversationId, userId, role, content, structuredResponse },
      });
    },

    // Confirma que a mensagem é mesmo do utilizador antes de aceitar feedback.
    async guardarFeedback({ messageId, userId, rating = null, comment = null }) {
      const mensagem = await prisma.assistantMessage.findFirst({ where: { id: messageId, userId } });
      if (!mensagem) return null;
      return prisma.assistantFeedback.create({ data: { messageId, userId, rating, comment } });
    },
  };
}

module.exports = criarAssistantRepository;
