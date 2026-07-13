/* =========================================================
   Rende+ — Tipos partilhados do Assistente Financeiro
   ---------------------------------------------------------
   Sem TypeScript no projeto, este ficheiro documenta as formas
   dos dados via JSDoc (ajuda o editor) e centraliza as poucas
   constantes partilhadas entre serviços do módulo.
   ========================================================= */

// Papel de cada mensagem numa conversa.
const PAPEL_MENSAGEM = Object.freeze({
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
});

/**
 * @typedef {Object} AssistantChatInput
 * @property {string} message
 * @property {string} period - formato "AAAA-MM"
 * @property {string} [conversationId]
 */

/**
 * @typedef {Object} AssistantFinancialContext
 * @property {{currency: string, locale: string, plan: string}} user
 * @property {{month: string, startDate: string, endDate: string}} period
 * @property {{income: number, expenses: number, net: number, savingsRate: number}} summary
 * @property {Array<{name: string, total: number, percentage: number}>} categories
 * @property {Array<object>} budgets
 * @property {Array<object>} goals
 * @property {Array<object>} accounts
 * @property {Array<object>} upcomingPayments
 * @property {Array<object>} recurringTransactions
 */

/**
 * @typedef {Object} AssistantStructuredResponse
 * @property {string} summary
 * @property {Array<{label: string, value: string}>} metrics
 * @property {string} observation
 * @property {{type: string, label: string, payload: object, requiresConfirmation: boolean}} recommendedAction
 * @property {string} [disclaimer]
 */

module.exports = { PAPEL_MENSAGEM };
