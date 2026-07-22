/* =========================================================
   Rende+ — Configuração central do Assistente Financeiro (IA)
   ---------------------------------------------------------
   Este ficheiro não liga nenhum fornecedor de IA. Serve só para
   concentrar valores (limites por plano, tamanhos de mensagem,
   nomes de variáveis de ambiente) num único sítio, para não os
   espalhar por vários ficheiros do módulo.
   ========================================================= */

// Perguntas permitidas por mês, por plano. Ajustável sem tocar
// no resto do módulo — quem consome isto chama limiteMensalDoPlano().
const LIMITES_POR_PLANO = {
  free: { perMonth: 5 },
  premium: { perMonth: 100 },
};

const MENSAGEM = {
  MIN_CHARS: 3,
  MAX_CHARS: 1500,
};

// Intervalo mínimo entre pedidos do mesmo utilizador — trava rajadas
// (ex.: duplo clique), independente do limite mensal por plano.
const RATE_LIMIT_MIN_INTERVALO_MS = 3000;

// Variáveis de ambiente do fornecedor de IA (Anthropic — ver providers/anthropic.provider.js).
// A chave real só existe aqui (.env do servidor); nunca é exposta ao frontend.
const AI_ENV = {
  PROVIDER: process.env.AI_PROVIDER || null,
  API_KEY: process.env.AI_API_KEY || null,
  MODEL: process.env.AI_MODEL || null,
  TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 30000,
  MAX_TOKENS: Number(process.env.AI_MAX_TOKENS) || 1024,
};

function limiteMensalDoPlano(plano) {
  return (LIMITES_POR_PLANO[plano] || LIMITES_POR_PLANO.free).perMonth;
}

module.exports = { LIMITES_POR_PLANO, MENSAGEM, RATE_LIMIT_MIN_INTERVALO_MS, AI_ENV, limiteMensalDoPlano };
