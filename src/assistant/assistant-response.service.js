/* =========================================================
   Rende+ — Validação da resposta do fornecedor de IA (futuro)
   ---------------------------------------------------------
   Nunca confiamos diretamente no JSON devolvido por um fornecedor
   de IA: este serviço confirma o formato e limpa/normaliza os
   campos antes de a resposta poder seguir para o frontend.
   ========================================================= */

const { validarAcao, SEM_ACAO } = require("./actions/action-validator");

function comoTexto(valor, max) {
  return typeof valor === "string" ? valor.slice(0, max) : "";
}

function validarRespostaEstruturada(bruto) {
  let obj = bruto;
  if (typeof bruto === "string") {
    try {
      obj = JSON.parse(bruto);
    } catch {
      return { valido: false, erro: "A resposta do fornecedor não é JSON válido." };
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { valido: false, erro: "A resposta do fornecedor está num formato inesperado." };
  }

  const metrics = Array.isArray(obj.metrics)
    ? obj.metrics
        .filter((m) => m && typeof m.label === "string" && (typeof m.value === "string" || typeof m.value === "number"))
        .slice(0, 20)
        .map((m) => ({ label: comoTexto(m.label, 100), value: comoTexto(String(m.value), 100) }))
    : [];

  const recommendedAction = validarAcao(obj.recommendedAction) || SEM_ACAO;

  const resposta = {
    summary: comoTexto(obj.summary, 2000),
    metrics,
    observation: comoTexto(obj.observation, 2000),
    recommendedAction,
  };
  if (typeof obj.disclaimer === "string" && obj.disclaimer.trim()) {
    resposta.disclaimer = comoTexto(obj.disclaimer, 500);
  }

  return { valido: true, resposta };
}

module.exports = { validarRespostaEstruturada };
