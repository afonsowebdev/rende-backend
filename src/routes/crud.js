/* =========================================================
   Rende+ — Fábrica de rotas CRUD
   =========================================================
   Em vez de repetir as mesmas 4 rotas (listar, criar, editar,
   apagar) em cada ficheiro, esta função cria-as para qualquer
   tabela. Tudo protegido por login, e cada utilizador só vê e
   mexe nos SEUS dados (filtro por userId).

   Parâmetros:
   - modelo: nome do modelo no Prisma (ex.: "despesa")
   - campos: campos aceites do utilizador
   - obrigatorios: campos sem os quais não se cria
   - numeros: campos convertidos para número
   - booleanos: campos convertidos para verdadeiro/falso
   - defaults: valores por defeito (podem ser função)
   - nomeSingular: nome amigável para mensagens de erro
   ========================================================= */

const express = require("express");
const prisma = require("../db");
const { exigirLogin, } = require("../auth");
const { aw, hoje } = require("../helpers");

function crudRouter({
  modelo,
  campos,
  obrigatorios = [],
  numeros = [],
  booleanos = [],
  defaults = {},
  nomeSingular = "Registo",
}) {
  const router = express.Router();
  const tabela = () => prisma[modelo];

  // Todas as rotas abaixo exigem login.
  router.use(exigirLogin);

  // Tira do corpo do pedido só os campos que aceitamos, com conversões.
  function limpar(body) {
    const out = {};
    for (const c of campos) {
      if (body[c] === undefined) continue;
      if (numeros.includes(c)) out[c] = Number(body[c]);
      else if (booleanos.includes(c)) out[c] = body[c] === true;
      else out[c] = body[c];
    }
    return out;
  }

  // LISTAR (só os do utilizador autenticado)
  router.get("/", aw(async (req, res) => {
    const itens = await tabela().findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(itens);
  }));

  // CRIAR
  router.post("/", aw(async (req, res) => {
    const dados = limpar(req.body);

    // Aplica valores por defeito em falta.
    for (const [chave, valor] of Object.entries(defaults)) {
      if (dados[chave] === undefined) dados[chave] = typeof valor === "function" ? valor() : valor;
    }
    // Se existir um campo "data" e estiver em falta, usa hoje.
    if (campos.includes("data") && !dados.data) dados.data = hoje();

    // Valida obrigatórios.
    for (const campo of obrigatorios) {
      if (dados[campo] === undefined || dados[campo] === "") {
        return res.status(400).json({ erro: `O campo '${campo}' é obrigatório.` });
      }
    }

    const novo = await tabela().create({ data: { ...dados, userId: req.userId } });
    res.status(201).json(novo);
  }));

  // EDITAR (só se o registo for do utilizador)
  router.patch("/:id", aw(async (req, res) => {
    const existe = await tabela().findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existe) return res.status(404).json({ erro: `${nomeSingular} não encontrado.` });

    const atualizado = await tabela().update({ where: { id: req.params.id }, data: limpar(req.body) });
    res.json(atualizado);
  }));

  // APAGAR (só se o registo for do utilizador)
  router.delete("/:id", aw(async (req, res) => {
    const existe = await tabela().findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existe) return res.status(404).json({ erro: `${nomeSingular} não encontrado.` });

    await tabela().delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }));

  return router;
}

module.exports = crudRouter;
