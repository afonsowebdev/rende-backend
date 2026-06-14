/* =========================================================
   Rende+ — Rotas de AUTENTICAÇÃO
   POST  /api/auth/registar  — criar conta
   POST  /api/auth/login     — entrar
   GET   /api/auth/eu        — ver o meu perfil (protegida)
   PATCH /api/auth/eu        — atualizar perfil/definições (protegida)
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { cifrarPassword, compararPassword, criarToken, exigirLogin } = require("../auth");
const { aw } = require("../helpers");

// Nunca devolvemos a password. Só os campos seguros.
const dadosPublicos = (user) => ({
  id: user.id,
  email: user.email,
  nome: user.nome,
  moeda: user.moeda,
  poupancaPct: user.poupancaPct,
  orcamento: user.orcamento,
});

// ---- REGISTAR ----
router.post("/registar", aw(async (req, res) => {
  const { email, password, nome, moeda } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: "Email e password são obrigatórios." });
  }
  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) {
    return res.status(409).json({ erro: "Já existe uma conta com esse email." });
  }
  const user = await prisma.user.create({
    data: {
      email,
      password: await cifrarPassword(password),
      nome: nome || null,
      moeda: moeda || "EUR",
    },
  });
  const token = criarToken(user.id);
  res.status(201).json({ token, user: dadosPublicos(user) });
}));

// ---- LOGIN ----
router.post("/login", aw(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: "Email e password são obrigatórios." });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await compararPassword(password, user.password))) {
    return res.status(401).json({ erro: "Email ou password incorretos." });
  }
  const token = criarToken(user.id);
  res.json({ token, user: dadosPublicos(user) });
}));

// ---- VER PERFIL (protegida) ----
router.get("/eu", exigirLogin, aw(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
  res.json(dadosPublicos(user));
}));

// ---- ATUALIZAR PERFIL / DEFINIÇÕES (protegida) ----
router.patch("/eu", exigirLogin, aw(async (req, res) => {
  const { nome, moeda, poupancaPct, orcamento } = req.body;
  const a = {};
  if (nome !== undefined) a.nome = nome;
  if (moeda !== undefined) a.moeda = moeda;
  if (poupancaPct !== undefined) a.poupancaPct = Number(poupancaPct);
  if (orcamento !== undefined) a.orcamento = Number(orcamento);
  const user = await prisma.user.update({ where: { id: req.userId }, data: a });
  res.json(dadosPublicos(user));
}));

module.exports = router;
