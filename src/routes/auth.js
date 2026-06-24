/* =========================================================
   Rende+ — Rotas de AUTENTICAÇÃO (com verificação de email)
   ---------------------------------------------------------
   Fluxo novo e SEGURO de criação de conta:
     1) POST /api/auth/registar          — dá email/nome/moeda → enviamos um código por email
     2) POST /api/auth/verificar-email   — dá email + código    → devolvemos um "setupToken"
     3) POST /api/auth/definir-password  — dá setupToken + password → conta criada + sessão iniciada
     (extra) POST /api/auth/reenviar-codigo — envia um novo código

   Outras:
     POST  /api/auth/login   — entrar (exige email confirmado)
     GET   /api/auth/eu      — ver perfil (protegida)
     PATCH /api/auth/eu      — atualizar perfil (protegida)
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const {
  cifrarPassword, compararPassword, criarToken, exigirLogin,
  gerarCodigo, criarTokenSetup, verificarTokenSetup, validarPassword,
} = require("../auth");
const { aw } = require("../helpers");
const { enviarEmailVerificacao } = require("../mailer");

const QUINZE_MIN = 15 * 60 * 1000;
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Nunca devolvemos a password. Só os campos seguros.
const dadosPublicos = (user) => ({
  id: user.id,
  email: user.email,
  nome: user.nome,
  moeda: user.moeda,
  poupancaPct: user.poupancaPct,
  orcamento: user.orcamento,
  emailVerificado: user.emailVerificado,
});

/* ---- 1) REGISTAR: cria (ou reaproveita) a conta por confirmar e envia o código ---- */
router.post("/registar", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const { nome, moeda } = req.body;
  if (!email || !emailValido(email)) {
    return res.status(400).json({ erro: "Indica um email válido." });
  }
  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe && existe.emailVerificado && existe.password) {
    return res.status(409).json({ erro: "Já existe uma conta com esse email." });
  }

  const codigo = gerarCodigo();
  const dados = {
    nome: nome || null,
    moeda: moeda || "EUR",
    codigoVerif: await cifrarPassword(codigo), // guardamos o código CIFRADO
    codigoExpira: new Date(Date.now() + QUINZE_MIN),
    emailVerificado: false,
  };
  const user = existe
    ? await prisma.user.update({ where: { email }, data: dados })
    : await prisma.user.create({ data: { email, ...dados } });

  await enviarEmailVerificacao(email, user.nome, codigo);
  res.status(201).json({ ok: true, email, mensagem: "Enviámos um código de 6 dígitos para o teu email." });
}));

/* ---- (extra) REENVIAR CÓDIGO ---- */
router.post("/reenviar-codigo", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ erro: "Não há registo com esse email. Cria a conta primeiro." });
  if (user.emailVerificado && user.password) return res.status(409).json({ erro: "Esta conta já está confirmada." });

  const codigo = gerarCodigo();
  await prisma.user.update({
    where: { email },
    data: { codigoVerif: await cifrarPassword(codigo), codigoExpira: new Date(Date.now() + QUINZE_MIN) },
  });
  await enviarEmailVerificacao(email, user.nome, codigo);
  res.json({ ok: true, mensagem: "Enviámos um novo código." });
}));

/* ---- 2) VERIFICAR EMAIL: confirma o código e devolve um setupToken ---- */
router.post("/verificar-email", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const codigo = String(req.body.codigo || "").trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.codigoVerif || !user.codigoExpira) {
    return res.status(400).json({ erro: "Pede um novo código." });
  }
  if (new Date() > user.codigoExpira) {
    return res.status(400).json({ erro: "O código expirou. Pede um novo." });
  }
  if (!(await compararPassword(codigo, user.codigoVerif))) {
    return res.status(400).json({ erro: "Código incorreto." });
  }
  await prisma.user.update({
    where: { email },
    data: { emailVerificado: true, codigoVerif: null, codigoExpira: null },
  });
  const setupToken = criarTokenSetup(user.id);
  res.json({ ok: true, setupToken, mensagem: "Email confirmado. Agora define a tua palavra-passe." });
}));

/* ---- 3) DEFINIR PASSWORD: valida a força, guarda-a e inicia sessão ---- */
router.post("/definir-password", aw(async (req, res) => {
  const { setupToken, password } = req.body;
  const userId = verificarTokenSetup(setupToken || "");
  if (!userId) {
    return res.status(401).json({ erro: "Sessão de configuração inválida ou expirada. Confirma o email de novo." });
  }
  const erroPw = validarPassword(password);
  if (erroPw) return res.status(400).json({ erro: erroPw });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ erro: "Conta não encontrada." });
  if (!user.emailVerificado) return res.status(403).json({ erro: "Confirma o email primeiro." });

  const atualizado = await prisma.user.update({
    where: { id: userId },
    data: { password: await cifrarPassword(password) },
  });
  const token = criarToken(atualizado.id);
  res.status(201).json({ token, user: dadosPublicos(atualizado) });
}));

/* ---- LOGIN (exige email confirmado e password definida) ---- */
router.post("/login", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const { password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: "Email e password são obrigatórios." });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password || !(await compararPassword(password, user.password))) {
    return res.status(401).json({ erro: "Email ou password incorretos." });
  }
  if (!user.emailVerificado) {
    return res.status(403).json({ erro: "Confirma o teu email antes de entrar." });
  }
  const token = criarToken(user.id);
  res.json({ token, user: dadosPublicos(user) });
}));

/* ---- VER PERFIL (protegida) ---- */
router.get("/eu", exigirLogin, aw(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });
  res.json(dadosPublicos(user));
}));

/* ---- ATUALIZAR PERFIL / DEFINIÇÕES (protegida) ---- */
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

/* ---- ELIMINAR CONTA (protegida) ----
   Apaga o utilizador. Como todas as relações têm onDelete: Cascade,
   as despesas, rendimentos, metas, aforros, contas e categorias são
   apagadas automaticamente. O email fica livre para criar tudo de novo. */
router.delete("/eu", exigirLogin, aw(async (req, res) => {
  await prisma.user.delete({ where: { id: req.userId } });
  res.json({ ok: true, mensagem: "Conta eliminada." });
}));

module.exports = router;