/* =========================================================
   Rende+ — Contrato do fornecedor de IA (futuro)
   ---------------------------------------------------------
   Nenhuma implementação real existe nesta fase (sem OpenAI,
   Anthropic, Google, etc.). Este ficheiro define só o contrato
   que qualquer fornecedor terá de cumprir, mais um "stub" que
   permite ao resto do módulo já chamar `provider.generateResponse(...)`
   sem saber que ainda não há nenhum fornecedor ligado.

   Uma implementação futura (ex.: src/assistant/providers/openai.provider.js)
   só precisa de exportar um objeto com o mesmo método `generateResponse`.
   ========================================================= */

/**
 * @typedef {Object} AssistantProviderInput
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {string} [conversationId]
 * @property {number} maxTokens
 * @property {number} timeoutMs
 *
 * @typedef {Object} AssistantProviderOutput
 * @property {string} raw - texto (idealmente JSON) devolvido pelo fornecedor
 * @property {{inputTokens?: number, outputTokens?: number}} [usage]
 *
 * @typedef {Object} AssistantProvider
 * @property {(input: AssistantProviderInput) => Promise<AssistantProviderOutput>} generateResponse
 */

function erroProviderNaoConfigurado() {
  const erro = new Error("Nenhum fornecedor de IA está configurado ainda.");
  erro.status = 503;
  erro.code = "AI_PROVIDER_NOT_CONFIGURED";
  return erro;
}

/** @type {AssistantProvider} */
const providerNaoConfigurado = {
  async generateResponse() {
    throw erroProviderNaoConfigurado();
  },
};

module.exports = { providerNaoConfigurado, erroProviderNaoConfigurado };
