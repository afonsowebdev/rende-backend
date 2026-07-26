/* =========================================================
   Rende+ — Servidor (Backend)
   Peça 1: o servidor mínimo a responder.
   =========================================================
   O que este ficheiro faz, por palavras simples:
   - cria um servidor web com a ferramenta "express";
   - define dois "endereços" (rotas) que respondem a quem os visita;
   - põe o servidor à escuta numa porta (uma "porta de entrada").
   ========================================================= */

// 0) Carregamos as variáveis do ficheiro .env para o ambiente,
//    para o servidor poder usar o DATABASE_URL e o JWT_SECRET.
require("dotenv").config();

// 1) Importamos o express e o cors.
const express = require("express");
const cors = require("cors");

// 2) Criamos a nossa aplicação/servidor.
const app = express();

// 2b) Importamos as rotas de cada tabela (ficheiros em src/routes/).
const despesasRouter   = require("./routes/despesas");
const rendimentosRouter = require("./routes/rendimentos");
const metasRouter      = require("./routes/metas");
const aforrosRouter    = require("./routes/aforros");
const contasRouter     = require("./routes/contas");
const categoriasRouter = require("./routes/categorias");
const authRouter       = require("./routes/auth");
const pagamentosRouter = require("./routes/pagamentos");
const assistantRouter  = require("./assistant/assistant.routes");
const adminRouter      = require("./routes/admin");

// Recurso Premium criado com a fábrica CRUD (crud.js): as 4 rotas
// (listar, criar, editar, apagar) são geradas automaticamente.
const crudRouter = require("./routes/crud");
const lembretesRouter = crudRouter({
  modelo: "lembrete",
  campos: ["titulo", "valor", "data", "repete", "aviso", "cat", "pago"],
  obrigatorios: ["titulo"],
  numeros: ["valor", "aviso"],
  booleanos: ["repete", "pago"],
  nomeSingular: "Lembrete",
});

// 3) Definimos a porta. Em produção (no Render) a porta vem do ambiente;
//    no teu computador, usamos a 3000 por defeito.
const PORT = process.env.PORT || 3000;

// 4) CORS: deixa o teu frontend (noutro endereço) falar com esta API.
app.use(cors());

// 4b) Permite que o servidor entenda pedidos com corpo em JSON.
app.use(express.json());

// 5) Primeira rota: a "página inicial" da API, com a lista de endereços disponíveis.
app.get("/", (req, res) => {
  res.json({
    app: "Rende+ API",
    estado: "a funcionar",
    mensagem: "O backend do Rende+ está vivo!",
    endpoints: [
      "/api/auth/registar",
      "/api/auth/login",
      "/api/despesas",
      "/api/rendimentos",
      "/api/metas",
      "/api/aforros",
      "/api/contas",
      "/api/categorias",
      "/api/lembretes",
      "/api/pagamentos/checkout",
      "/api/assistant/chat",
    ],
  });
});

// 6) Rota de "saúde": serve para confirmar rapidamente que o servidor responde.
//    É uma boa prática tê-la — o Render também a pode usar para verificar a app.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hora: new Date().toISOString() });
});

// 6b) Ligamos as rotas de cada tabela. Tudo o que começar por um destes
//     endereços passa a ser tratado pelo router correspondente.
app.use("/api/despesas", despesasRouter);
app.use("/api/rendimentos", rendimentosRouter);
app.use("/api/metas", metasRouter);
app.use("/api/aforros", aforrosRouter);
app.use("/api/contas", contasRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/lembretes", lembretesRouter);
app.use("/api/pagamentos", pagamentosRouter);
app.use("/api/auth", authRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/admin", adminRouter);

// 6c) Tratador de erros central: se algo correr mal numa rota,
//     respondemos com um JSON em vez de derrubar o servidor.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

// 7) Ligamos o servidor. A partir daqui ele fica à espera de visitas.
app.listen(PORT, () => {
  console.log(`Rende+ backend a correr em http://localhost:${PORT}`);
});