/* Rende+ — Controller do Assistente: só trata do pedido/resposta HTTP.
   Toda a lógica de negócio vive em assistant.service.js. */

const { validarPedidoChat } = require("./assistant.schemas");
const criarAssistantService = require("./assistant.service");

// Recebe o serviço por parâmetro (por omissão, o real) para que os
// testes possam injetar um assistant.service com dependências falsas.
function criarAssistantController({ assistantService = criarAssistantService() } = {}) {
  async function postChat(req, res) {
    const validado = validarPedidoChat(req.body);
    if (!validado.valido) {
      return res.status(400).json({ erro: validado.erro });
    }

    try {
      const resposta = await assistantService.processarChat({
        userId: req.userId, // o utilizador vem SEMPRE da sessão autenticada, nunca do body
        message: validado.dados.message,
        period: validado.dados.period,
        conversationId: validado.dados.conversationId,
      });
      res.status(200).json(resposta);
    } catch (erro) {
      if (!erro.status) throw erro; // erro inesperado: cai no tratador central (server.js)
      const corpo = { erro: erro.message };
      if (erro.usage) corpo.usage = erro.usage;
      res.status(erro.status).json(corpo);
    }
  }

  return { postChat };
}

module.exports = criarAssistantController;
