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
const { enviarEmailVerificacao, enviarEmailRecuperacao } = require("../mailer");

const QUINZE_MIN = 15 * 60 * 1000;
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Valida o formato AAAA-MM-DD e se é uma data real.
const dataNascValida = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime());

// Idade em anos completos a partir de AAAA-MM-DD (ou null se inválida).
function calcIdade(iso) {
  const n = new Date(iso + "T00:00:00");
  if (isNaN(n.getTime())) return null;
  const h = new Date();
  let idade = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) idade--;
  return idade;
}

// A data de nascimento bloqueia 7 dias DEPOIS de ter sido definida.
function nascimentoBloqueado(user) {
  if (!user.dataNascimento || !user.nascimentoDefinidoEm) return false;
  return Date.now() - new Date(user.nascimentoDefinidoEm).getTime() > SETE_DIAS;
}

// Nunca devolvemos a password. Só os campos seguros.
const dadosPublicos = (user) => ({
  id: user.id,
  email: user.email,
  nome: user.nome,
  moeda: user.moeda,
  poupancaPct: user.poupancaPct,
  orcamento: user.orcamento,
  emailVerificado: user.emailVerificado,
  dataNascimento: user.dataNascimento || null,
  nascimentoBloqueado: nascimentoBloqueado(user),
  // ---- perfil do onboarding (passo 3) ----
  pais: user.pais || null,
  telefone: user.telefone || null,
  preferencia: user.preferencia || null,
  sobre: user.sobre || null,
  situacao: user.situacao || null,
  objetivo: user.objetivo || null,
  planeamento: user.planeamento || null,
  partilha: user.partilha || null,
  fontesRendimento: user.fontesRendimento || [],
  principaisDespesas: user.principaisDespesas || [],
  notificacoes: user.notificacoes,
  resumoSemanal: user.resumoSemanal,
});

// Recolhe (de forma segura) os campos de perfil do onboarding a partir do corpo do pedido.
// Só copia os que vierem definidos, para não apagar dados por engano.
function recolherPerfil(body) {
  const a = {};
  const texto = ["pais", "telefone", "preferencia", "sobre", "situacao", "objetivo", "planeamento", "partilha"];
  for (const k of texto) {
    if (body[k] !== undefined) a[k] = body[k] === null ? null : String(body[k]).slice(0, 500);
  }
  if (Array.isArray(body.fontesRendimento)) a.fontesRendimento = body.fontesRendimento.map(String).slice(0, 30);
  if (Array.isArray(body.principaisDespesas)) a.principaisDespesas = body.principaisDespesas.map(String).slice(0, 40);
  if (body.notificacoes !== undefined) a.notificacoes = !!body.notificacoes;
  if (body.resumoSemanal !== undefined) a.resumoSemanal = !!body.resumoSemanal;
  return a;
}

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
  const { setupToken, password, dataNascimento } = req.body;
  const userId = verificarTokenSetup(setupToken || "");
  if (!userId) {
    return res.status(401).json({ erro: "Sessão de configuração inválida ou expirada. Confirma o email de novo." });
  }
  const erroPw = validarPassword(password);
  if (erroPw) return res.status(400).json({ erro: erroPw });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ erro: "Conta não encontrada." });
  if (!user.emailVerificado) return res.status(403).json({ erro: "Confirma o email primeiro." });

  const dados = { password: await cifrarPassword(password) };

  // Perfil do onboarding (passo 3): guardado logo no registo, se vier no pedido.
  Object.assign(dados, recolherPerfil(req.body));

  // Data de nascimento (opcional aqui, mas é o sítio certo para a guardar no registo).
  if (dataNascimento !== undefined && dataNascimento !== null && dataNascimento !== "") {
    if (!dataNascValida(dataNascimento)) {
      return res.status(400).json({ erro: "Data de nascimento inválida." });
    }
    const idade = calcIdade(dataNascimento);
    if (idade == null || idade < 16) {
      return res.status(400).json({ erro: "Tens de ter pelo menos 16 anos para criar conta." });
    }
    dados.dataNascimento = dataNascimento;
    dados.nascimentoDefinidoEm = new Date(); // começa a contar os 7 dias
  }

  const atualizado = await prisma.user.update({ where: { id: userId }, data: dados });
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
  const { nome, moeda, poupancaPct, orcamento, dataNascimento } = req.body;
  const a = {};
  if (nome !== undefined) a.nome = nome;
  if (moeda !== undefined) a.moeda = moeda;
  if (poupancaPct !== undefined) a.poupancaPct = Number(poupancaPct);
  if (orcamento !== undefined) a.orcamento = Number(orcamento);

  // Campos do perfil do onboarding (passo 3): o utilizador pode editá-los nas definições.
  Object.assign(a, recolherPerfil(req.body));

  // Data de nascimento: só se pode mudar nos primeiros 7 dias depois de definida.
  if (dataNascimento !== undefined) {
    const atual = await prisma.user.findUnique({ where: { id: req.userId } });
    if (nascimentoBloqueado(atual)) {
      return res.status(400).json({ erro: "A data de nascimento já não pode ser alterada (passaram mais de 7 dias)." });
    }
    if (!dataNascValida(dataNascimento)) {
      return res.status(400).json({ erro: "Data de nascimento inválida." });
    }
    const idade = calcIdade(dataNascimento);
    if (idade == null || idade < 16) {
      return res.status(400).json({ erro: "Tens de ter pelo menos 16 anos." });
    }
    a.dataNascimento = dataNascimento;
    if (!atual.nascimentoDefinidoEm) a.nascimentoDefinidoEm = new Date(); // 1.ª vez: arranca o contador
  }

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

/* =========================================================
   RECUPERAÇÃO DE PALAVRA-PASSE (via código por email)
   ---------------------------------------------------------
   1) POST /api/auth/esqueci-password  — dá email → enviamos um código
   2) POST /api/auth/redefinir-password — dá email + código + nova password
   ========================================================= */

/* ---- 1) PEDIR CÓDIGO DE RECUPERAÇÃO ----
   Por segurança, respondemos SEMPRE a mesma mensagem, exista ou não a conta.
   Assim ninguém consegue descobrir que emails estão registados. */
router.post("/esqueci-password", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const resposta = { ok: true, mensagem: "Se existir uma conta com esse email, enviámos um código." };

  if (!email || !emailValido(email)) return res.json(resposta);

  const user = await prisma.user.findUnique({ where: { email } });
  // Só faz sentido recuperar contas já confirmadas e com password definida.
  if (!user || !user.emailVerificado || !user.password) return res.json(resposta);

  const codigo = gerarCodigo();
  await prisma.user.update({
    where: { email },
    data: {
      codigoReset: await cifrarPassword(codigo), // guardamos o código CIFRADO
      codigoResetExpira: new Date(Date.now() + QUINZE_MIN),
    },
  });
  await enviarEmailRecuperacao(email, user.nome, codigo);
  res.json(resposta);
}));

/* ---- 2) REDEFINIR A PASSWORD COM O CÓDIGO ---- */
router.post("/redefinir-password", aw(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const codigo = String(req.body.codigo || "").trim();
  const { password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.codigoReset || !user.codigoResetExpira) {
    return res.status(400).json({ erro: "Pede um novo código." });
  }
  if (new Date() > user.codigoResetExpira) {
    return res.status(400).json({ erro: "O código expirou. Pede um novo." });
  }
  if (!(await compararPassword(codigo, user.codigoReset))) {
    return res.status(400).json({ erro: "Código incorreto." });
  }
  const erroPw = validarPassword(password);
  if (erroPw) return res.status(400).json({ erro: erroPw });

  const atualizado = await prisma.user.update({
    where: { email },
    data: {
      password: await cifrarPassword(password),
      codigoReset: null,         // o código só serve uma vez
      codigoResetExpira: null,
    },
  });
  const token = criarToken(atualizado.id); // inicia sessão logo, já que provou o código
  res.json({ ok: true, token, user: dadosPublicos(atualizado), mensagem: "Palavra-passe alterada com sucesso." });
}));

module.exports = router;