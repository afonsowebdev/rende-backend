/* =========================================================
   Rende+ — Travão de rajadas do Assistente
   ---------------------------------------------------------
   Independente do limite mensal por plano (assistant-usage.service):
   este middleware só impede o MESMO utilizador de disparar pedidos
   em cima uns dos outros (ex.: duplo clique, chamadas simultâneas).

   Guardado em memória — está bem para uma única instância do servidor;
   se um dia houver várias instâncias, isto deve passar para Redis.
   ========================================================= */

const { RATE_LIMIT_MIN_INTERVALO_MS } = require("./config");

const ultimoPedidoPorUtilizador = new Map();

function limitarRajadas(req, res, next) {
  const agora = Date.now();
  const anterior = ultimoPedidoPorUtilizador.get(req.userId);
  if (anterior && agora - anterior < RATE_LIMIT_MIN_INTERVALO_MS) {
    return res.status(429).json({ erro: "Aguarda uns segundos antes de tentares novamente." });
  }
  ultimoPedidoPorUtilizador.set(req.userId, agora);
  next();
}

module.exports = { limitarRajadas };
