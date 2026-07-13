/* =========================================================
   Rende+ — Validação do pedido de chat do Assistente
   ---------------------------------------------------------
   O utilizador é identificado só pela sessão (req.userId, vindo
   do middleware exigirLogin) — por isso "userId" nunca consta
   dos campos permitidos: se vier no corpo do pedido, é rejeitado
   como campo desconhecido.
   ========================================================= */

const { MENSAGEM } = require("./config");

const CAMPOS_PERMITIDOS = new Set(["message", "period", "conversationId"]);
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodoAtualPadrao() {
  return new Date().toISOString().slice(0, 7); // "AAAA-MM"
}

function validarPedidoChat(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valido: false, erro: "Pedido inválido." };
  }

  const desconhecidos = Object.keys(body).filter((c) => !CAMPOS_PERMITIDOS.has(c));
  if (desconhecidos.length > 0) {
    return { valido: false, erro: `Campo(s) não reconhecido(s): ${desconhecidos.join(", ")}.` };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { valido: false, erro: "O campo 'message' é obrigatório." };
  if (message.length < MENSAGEM.MIN_CHARS) {
    return { valido: false, erro: `A mensagem tem de ter pelo menos ${MENSAGEM.MIN_CHARS} caracteres.` };
  }
  if (message.length > MENSAGEM.MAX_CHARS) {
    return { valido: false, erro: `A mensagem não pode ter mais de ${MENSAGEM.MAX_CHARS} caracteres.` };
  }

  let period = periodoAtualPadrao();
  if (body.period !== undefined) {
    if (typeof body.period !== "string" || !PERIOD_REGEX.test(body.period)) {
      return { valido: false, erro: "O campo 'period' tem de estar no formato AAAA-MM." };
    }
    period = body.period;
  }

  let conversationId;
  if (body.conversationId !== undefined && body.conversationId !== null && body.conversationId !== "") {
    if (typeof body.conversationId !== "string") {
      return { valido: false, erro: "O campo 'conversationId' é inválido." };
    }
    conversationId = body.conversationId;
  }

  return { valido: true, dados: { message, period, conversationId } };
}

module.exports = { validarPedidoChat };
