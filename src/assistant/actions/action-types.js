/* Rende+ — Tipos de ações que o Assistente pode sugerir.
   A IA nunca altera dados diretamente: só pode sugerir uma
   destas ações, que o utilizador terá de confirmar no frontend. */

const TIPOS_ACAO = Object.freeze({
  OPEN_TRANSACTIONS: "OPEN_TRANSACTIONS",
  OPEN_BUDGET: "OPEN_BUDGET",
  OPEN_GOAL: "OPEN_GOAL",
  CREATE_GOAL_DRAFT: "CREATE_GOAL_DRAFT",
  CREATE_BUDGET_DRAFT: "CREATE_BUDGET_DRAFT",
  CREATE_REMINDER_DRAFT: "CREATE_REMINDER_DRAFT",
  FILTER_TRANSACTIONS: "FILTER_TRANSACTIONS",
  OPEN_REPORT: "OPEN_REPORT",
  NO_ACTION: "NO_ACTION",
});

// Ações que criam/alteram dados: exigem sempre confirmação explícita do
// utilizador, mesmo que o fornecedor de IA diga o contrário no futuro.
const ACOES_QUE_ALTERAM_DADOS = new Set([
  TIPOS_ACAO.CREATE_GOAL_DRAFT,
  TIPOS_ACAO.CREATE_BUDGET_DRAFT,
  TIPOS_ACAO.CREATE_REMINDER_DRAFT,
]);

module.exports = { TIPOS_ACAO, ACOES_QUE_ALTERAM_DADOS };
