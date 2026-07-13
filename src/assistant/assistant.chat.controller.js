/* =========================================================
   Rende+ — Controller do chat (streaming SSE)
   ---------------------------------------------------------
   Trata só do HTTP. Envia a resposta em "Server-Sent Events":
   linhas   data: {...}\n\n   que o frontend (api.js) já sabe ler.
   Formatos enviados:
     { delta: "texto" }  — pedaço de texto a acrescentar
     { done: true }      — fim
     { error: "msg" }    — erro a meio do streaming

   Regra importante: fazemos TODAS as validações (login, limite,
   utilizador) ANTES de abrir o streaming. Assim, se algo falhar
   cedo, ainda conseguimos responder com o código certo (404/429);
   depois de o streaming abrir, os erros vão como evento { error }.
   ========================================================= */

const criarAssistantChatService = require("./assistant.chat.service");

function criarAssistantChatController({ chatService = criarAssistantChatService() } = {}) {
  async function postChatStream(req, res) {
    const mensagens = req.body && req.body.mensagens;
    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return res.status(400).json({ erro: "Faltam mensagens no pedido." });
    }

    // 1) Validações que podem devolver código de estado (antes do streaming).
    let prep;
    try {
      prep = await chatService.prepararChat({ userId: req.userId, mensagens });
    } catch (erro) {
      if (erro.status) {
        const corpo = { erro: erro.message };
        if (erro.usage) corpo.usage = erro.usage;
        return res.status(erro.status).json(corpo);
      }
      throw erro; // erro inesperado -> tratador central (aw + server.js)
    }

    // 2) Abrimos o streaming SSE.
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // evita buffering em proxies (ex.: Render)
    if (res.flushHeaders) res.flushHeaders();

    const enviar = (obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");

    // Se o cliente fechar o separador, deixamos de escrever.
    let fechado = false;
    req.on("close", () => { fechado = true; });

    try {
      await chatService.stream({
        ...prep,
        onDelta: (delta) => { if (!fechado) enviar({ delta }); },
      });
      if (!fechado) enviar({ done: true });
    } catch (erro) {
      // Aqui já não dá para mudar o código de estado — mandamos evento de erro.
      if (!fechado) enviar({ error: erro.message || "Erro ao gerar a resposta." });
    } finally {
      res.end();
    }
  }

  return { postChatStream };
}

module.exports = criarAssistantChatController;