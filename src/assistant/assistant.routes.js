/* =========================================================
   Rende+ — Rotas do Assistente Financeiro (IA)
   ---------------------------------------------------------
   POST /api/assistant/chat — única rota ativa nesta fase.
   Ainda não chama nenhum fornecedor de IA (ver assistant.service.js).

   Roadmap (por implementar quando fizer sentido):
     GET    /api/assistant/conversations
     GET    /api/assistant/conversations/:id
     DELETE /api/assistant/conversations/:id
     POST   /api/assistant/feedback
     GET    /api/assistant/suggestions
     POST   /api/assistant/action-preview
     POST   /api/assistant/action-confirm
   ========================================================= */

const express = require("express");
const router = express.Router();
const { exigirLogin } = require("../auth");
const { aw } = require("../helpers");
const { limitarRajadas } = require("./assistant-rate-limit.middleware");
const criarAssistantController = require("./assistant.controller");

const { postChat } = criarAssistantController();

router.use(exigirLogin);

router.post("/chat", limitarRajadas, aw(postChat));

module.exports = router;
