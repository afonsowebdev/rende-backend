/* Rende+ — Validador de ações sugeridas pelo Assistente.
   Nunca confia no "requiresConfirmation" que venha do fornecedor
   de IA: esse valor é sempre recalculado aqui a partir da lista
   de ações que alteram dados (action-types.js). */

const { TIPOS_ACAO, ACOES_QUE_ALTERAM_DADOS } = require("./action-types");

const SEM_ACAO = Object.freeze({ type: TIPOS_ACAO.NO_ACTION, label: "", payload: {}, requiresConfirmation: false });

// Devolve a ação validada e normalizada, ou null se for inválida.
function validarAcao(acao) {
  if (acao == null) return SEM_ACAO;
  if (typeof acao !== "object") return null;
  if (!Object.values(TIPOS_ACAO).includes(acao.type)) return null;

  return {
    type: acao.type,
    label: typeof acao.label === "string" ? acao.label.slice(0, 200) : "",
    payload: acao.payload && typeof acao.payload === "object" && !Array.isArray(acao.payload) ? acao.payload : {},
    requiresConfirmation: ACOES_QUE_ALTERAM_DADOS.has(acao.type),
  };
}

module.exports = { validarAcao, SEM_ACAO };
