/* =========================================================
   Rende+ — Construtor do prompt do Assistente (futuro)
   ---------------------------------------------------------
   Junta o system prompt, o contexto financeiro resumido, a
   pergunta do utilizador e o formato de resposta esperado.
   Não chama nenhum fornecedor — só prepara o texto que, no
   futuro, será passado a `provider.generateResponse(...)`.
   ========================================================= */

const { SYSTEM_PROMPT } = require("./system-prompt");

const FORMATO_RESPOSTA = `Responde SEMPRE em JSON válido, exatamente com este formato:
{
  "summary": "string",
  "metrics": [{ "label": "string", "value": "string" }],
  "observation": "string",
  "recommendedAction": { "type": "string", "label": "string", "payload": {} },
  "disclaimer": "string opcional"
}`;

// `contexto` vem de assistant-context.service.js (já resumido, sem dados sensíveis).
function construirPrompt({ mensagem, contexto }) {
  const userPrompt = [
    `Pergunta do utilizador: ${mensagem}`,
    "",
    "Contexto financeiro (JSON):",
    JSON.stringify(contexto),
    "",
    FORMATO_RESPOSTA,
  ].join("\n");

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

module.exports = { construirPrompt, FORMATO_RESPOSTA };
