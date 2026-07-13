/* =========================================================
   Rende+ — Rotas do Assistente Financeiro (IA)
   ---------------------------------------------------------
   POST /api/assistant/chat — chat em streaming (Fase 1).
   O frontend envia { mensagens: [{role, texto}] } e recebe a
   resposta aos pedaços (SSE). A ligação ao Claude vive em
   providers/anthropic.provider.js.

   Roadmap (Fase 2, por implementar quando fizer sentido):
     GET    /api/assistant/conversations
     GET    /api/assistant/conversations/:id
     DELETE /api/assistant/conversations/:id
     POST   /api/assistant/feedback
   ========================================================= */

const express = require("express");
const router = express.Router();
const { exigirLogin } = require("../auth");
const { aw } = require("../helpers");
const { limitarRajadas } = require("./assistant-rate-limit.middleware");
const criarAssistantChatController = require("./assistant.chat.controller");

const { postChatStream } = criarAssistantChatController();

// Tudo aqui exige sessão iniciada; o utilizador vem SEMPRE do token.
router.use(exigirLogin);

router.post("/chat", limitarRajadas, aw(postChatStream));

module.exports = router;