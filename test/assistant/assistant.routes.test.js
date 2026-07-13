/* Testa só a exigência de autenticação ao nível HTTP real (via express).
   Não avança para a lógica de negócio aqui — isso está coberto, com
   dependências falsas, em assistant.controller.test.js e
   assistant.service.test.js. Assim evitamos chamar a base de dados real
   a partir dos testes. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const assistantRouter = require("../../src/assistant/assistant.routes");

function comecarServidor() {
  const app = express();
  app.use(express.json());
  app.use("/api/assistant", assistantRouter);
  return new Promise((resolve) => {
    const servidor = app.listen(0, () => resolve(servidor));
  });
}

test("POST /api/assistant/chat sem token devolve 401", async () => {
  const servidor = await comecarServidor();
  const { port } = servidor.address();
  try {
    const resposta = await fetch(`http://localhost:${port}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Como estão as minhas finanças?" }),
    });
    assert.equal(resposta.status, 401);
  } finally {
    servidor.close();
  }
});

test("POST /api/assistant/chat com token inválido devolve 401", async () => {
  const servidor = await comecarServidor();
  const { port } = servidor.address();
  try {
    const resposta = await fetch(`http://localhost:${port}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-invalido" },
      body: JSON.stringify({ message: "Como estão as minhas finanças?" }),
    });
    assert.equal(resposta.status, 401);
  } finally {
    servidor.close();
  }
});
