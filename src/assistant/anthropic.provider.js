/* =========================================================
   Rende+ — Fornecedor de IA: Anthropic (Claude)
   ---------------------------------------------------------
   O que este ficheiro faz, por palavras simples:
   - fala com a API da Anthropic e devolve a resposta AOS PEDAÇOS
     (streaming), para o texto aparecer a fluir no chat;
   - usa só o `fetch` nativo (Node 18+), sem SDK a instalar;
   - lê a chave e o modelo das variáveis de ambiente (config.js),
     por isso NUNCA há chaves escritas aqui.

   Contrato: expõe `streamChat({ system, messages, maxTokens,
   timeoutMs, onDelta })`. Chama `onDelta(texto)` para cada pedaço
   de texto que chega. Lança erro (com .status) se algo correr mal.
   ========================================================= */

const { AI_ENV } = require("../config");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Modelo por omissão: económico e rápido, bom para um assistente de finanças.
// Podes trocar sem tocar no código, definindo AI_MODEL no .env (ex.: um modelo
// mais capaz). Confirma os nomes disponíveis na tua conta na doc da Anthropic.
const MODELO_PADRAO = "claude-3-5-haiku-latest";

function erroProviderNaoConfigurado() {
  const erro = new Error("O assistente ainda não está configurado (falta a chave da IA).");
  erro.status = 503;
  erro.code = "AI_PROVIDER_NOT_CONFIGURED";
  return erro;
}

function criarAnthropicProvider({ apiKey = AI_ENV.API_KEY, model = AI_ENV.MODEL } = {}) {
  return {
    async streamChat({ system, messages, maxTokens = 800, timeoutMs = 30000, onDelta }) {
      // Sem chave não há assistente — falha de forma clara (503).
      if (!apiKey) throw erroProviderNaoConfigurado();

      // Trava de segurança: se a IA demorar demasiado, cancelamos o pedido.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let resp;
      try {
        resp = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model || MODELO_PADRAO,
            max_tokens: maxTokens,
            system,
            messages,
            stream: true,
          }),
          signal: controller.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        if (e.name === "AbortError") {
          const err = new Error("O assistente demorou demasiado a responder. Tenta outra vez.");
          err.status = 504;
          throw err;
        }
        throw e;
      }

      if (!resp.ok || !resp.body) {
        clearTimeout(timer);
        let detalhe = "";
        try {
          const j = await resp.json();
          detalhe = (j && j.error && j.error.message) || "";
        } catch (_) {}
        const err = new Error("Não foi possível contactar a IA" + (detalhe ? ": " + detalhe : "."));
        err.status = 502;
        throw err;
      }

      // A Anthropic também responde em streaming SSE. Lemos linha a linha
      // e, sempre que chega um pedaço de texto, chamamos onDelta(texto).
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocos = buffer.split("\n\n");
          buffer = blocos.pop() || "";
          for (const bloco of blocos) {
            const linha = bloco.split("\n").find((l) => l.startsWith("data:"));
            if (!linha) continue;
            const jsonTxt = linha.slice(5).trim();
            if (!jsonTxt || jsonTxt === "[DONE]") continue;
            let ev;
            try {
              ev = JSON.parse(jsonTxt);
            } catch (_) {
              continue;
            }
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
              if (onDelta) onDelta(ev.delta.text);
            }
            if (ev.type === "error") {
              const err = new Error((ev.error && ev.error.message) || "Erro da IA a meio da resposta.");
              err.status = 502;
              throw err;
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = criarAnthropicProvider;