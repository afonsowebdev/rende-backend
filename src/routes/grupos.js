/* =========================================================
   Rende+ — Rotas de Partilha (grupos partilhados)
   ---------------------------------------------------------
   Fase 1 (real): só grupos, membros e convites são reais, com
   email a sério. Despesas partilhadas, saldos e chat de grupo
   continuam simulados no frontend (localStorage — ver
   premium.jsx) por agora; ficam para uma fase seguinte.

   Regras de negócio (aplicadas sempre aqui, nunca só no frontend):
   - Só quem é Premium pode criar um grupo ou convidar alguém.
   - Só quem já tem conta Rende+ pode ser convidado (procurado por email).
   - Para ACEITAR um convite, o próprio convidado tem de ter sessão
     iniciada, ser a pessoa certa, e ser Premium. Para recusar, não
     precisa de ser Premium — só a pessoa certa.
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin, criarTokenConvite, verificarTokenConvite } = require("../auth");
const { aw } = require("../helpers");
const { enviarEmailConvite } = require("../mailer");

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5500";

router.use(exigirLogin);

// "Guarda" extra: só quem é Premium passa. Vai sempre à base de dados
// confirmar o plano atual — nunca confia em nada vindo do token/pedido.
const exigirPremium = aw(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { plano: true } });
  if (!user || user.plano !== "premium") {
    return res.status(403).json({ erro: "Esta funcionalidade é exclusiva do Rende+ Premium." });
  }
  next();
});

/* ---- OS MEUS CONVITES PENDENTES (para o sino de notificações) ----
   Tem de vir ANTES de "/:id/convites" — caso contrário "convites" seria
   interpretado como um :id e esta rota nunca seria alcançada. */
router.get("/convites/pendentes", aw(async (req, res) => {
  const convites = await prisma.grupoConvite.findMany({
    where: { convidadoId: req.userId, estado: "pendente" },
    include: { grupo: true, convidante: { select: { nome: true, email: true } } },
    orderBy: { criadoEm: "desc" },
  });

  res.json({
    convites: convites.map((c) => ({
      id: c.id,
      grupoId: c.grupoId,
      grupoNome: c.grupo.nome,
      convidadoPorNome: c.convidante.nome || c.convidante.email,
      criadoEm: c.criadoEm,
    })),
  });
}));

/* ---- RESOLVER TOKEN DE CONVITE (vindo do link do email) ----
   Devolve os detalhes do convite (sem o aceitar) para o frontend mostrar
   "X convidou-te para Y" antes de o utilizador confirmar. */
router.get("/convites/resolver", aw(async (req, res) => {
  const conviteId = verificarTokenConvite(String(req.query.token || ""));
  if (!conviteId) return res.status(400).json({ erro: "Link de convite inválido ou expirado." });

  const convite = await prisma.grupoConvite.findUnique({
    where: { id: conviteId },
    include: { grupo: true, convidante: { select: { nome: true, email: true } } },
  });
  if (!convite) return res.status(404).json({ erro: "Convite não encontrado." });
  if (convite.convidadoId !== req.userId) {
    return res.status(403).json({ erro: "Este convite não é para a tua conta. Inicia sessão com o email para quem foi enviado." });
  }

  res.json({
    id: convite.id,
    estado: convite.estado,
    grupoId: convite.grupoId,
    grupoNome: convite.grupo.nome,
    convidadoPorNome: convite.convidante.nome || convite.convidante.email,
  });
}));

/* ---- ACEITAR CONVITE (Premium) ---- */
router.post("/convites/:id/aceitar", exigirPremium, aw(async (req, res) => {
  const convite = await prisma.grupoConvite.findUnique({ where: { id: req.params.id } });
  if (!convite) return res.status(404).json({ erro: "Convite não encontrado." });
  if (convite.convidadoId !== req.userId) return res.status(403).json({ erro: "Este convite não é para a tua conta." });
  if (convite.estado !== "pendente") return res.status(409).json({ erro: "Este convite já foi respondido." });

  await prisma.$transaction([
    prisma.grupoConvite.update({ where: { id: convite.id }, data: { estado: "aceite", respondidoEm: new Date() } }),
    prisma.grupoMembro.create({ data: { grupoId: convite.grupoId, userId: req.userId, papel: "membro" } }),
  ]);

  const grupo = await prisma.grupo.findUnique({ where: { id: convite.grupoId } });
  res.json({ ok: true, grupoId: grupo.id, grupoNome: grupo.nome });
}));

/* ---- RECUSAR CONVITE (não exige Premium — só recusa) ---- */
router.post("/convites/:id/recusar", aw(async (req, res) => {
  const convite = await prisma.grupoConvite.findUnique({ where: { id: req.params.id } });
  if (!convite) return res.status(404).json({ erro: "Convite não encontrado." });
  if (convite.convidadoId !== req.userId) return res.status(403).json({ erro: "Este convite não é para a tua conta." });
  if (convite.estado !== "pendente") return res.status(409).json({ erro: "Este convite já foi respondido." });

  await prisma.grupoConvite.update({ where: { id: convite.id }, data: { estado: "recusado", respondidoEm: new Date() } });
  res.json({ ok: true });
}));

/* ---- LISTAR OS MEUS GRUPOS (onde sou membro) ---- */
router.get("/", aw(async (req, res) => {
  const membros = await prisma.grupoMembro.findMany({
    where: { userId: req.userId },
    include: { grupo: { include: { _count: { select: { membros: true } } } } },
    orderBy: { entradaEm: "desc" },
  });

  res.json({
    grupos: membros.map((m) => ({
      id: m.grupo.id,
      nome: m.grupo.nome,
      descricao: m.grupo.descricao,
      papel: m.papel,
      totalMembros: m.grupo._count.membros,
      criadoEm: m.grupo.createdAt,
    })),
  });
}));

/* ---- CRIAR GRUPO (Premium) ---- */
router.post("/", exigirPremium, aw(async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  if (!nome) return res.status(400).json({ erro: "Dá um nome ao grupo." });
  const descricao = req.body.descricao ? String(req.body.descricao).slice(0, 300) : null;

  const grupo = await prisma.grupo.create({
    data: {
      nome,
      descricao,
      criadoPorId: req.userId,
      membros: { create: { userId: req.userId, papel: "owner" } },
    },
  });

  res.status(201).json({ id: grupo.id, nome: grupo.nome, descricao: grupo.descricao, criadoEm: grupo.createdAt });
}));

/* ---- CONVIDAR ALGUÉM PARA UM GRUPO (Premium, só quem já é membro do grupo) ---- */
router.post("/:id/convites", exigirPremium, aw(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "Indica o email da pessoa a convidar." });

  const souMembro = await prisma.grupoMembro.findUnique({ where: { grupoId_userId: { grupoId: req.params.id, userId: req.userId } } });
  if (!souMembro) return res.status(404).json({ erro: "Grupo não encontrado." });

  const convidado = await prisma.user.findUnique({ where: { email } });
  if (!convidado) {
    return res.status(404).json({ erro: "Não há nenhuma conta Rende+ com esse email. A pessoa precisa de criar conta primeiro." });
  }
  if (convidado.id === req.userId) return res.status(400).json({ erro: "Já estás neste grupo." });

  const jaEMembro = await prisma.grupoMembro.findUnique({ where: { grupoId_userId: { grupoId: req.params.id, userId: convidado.id } } });
  if (jaEMembro) return res.status(409).json({ erro: "Essa pessoa já faz parte do grupo." });

  const conviteExistente = await prisma.grupoConvite.findFirst({ where: { grupoId: req.params.id, convidadoId: convidado.id, estado: "pendente" } });
  if (conviteExistente) return res.status(409).json({ erro: "Já há um convite pendente para essa pessoa." });

  const [grupo, convidante] = await Promise.all([
    prisma.grupo.findUnique({ where: { id: req.params.id } }),
    prisma.user.findUnique({ where: { id: req.userId } }),
  ]);

  const convite = await prisma.grupoConvite.create({
    data: { grupoId: req.params.id, convidadoId: convidado.id, convidadoPorId: req.userId },
  });

  const token = criarTokenConvite(convite.id);
  const link = `${FRONTEND}/?convite=${token}`;
  await enviarEmailConvite(convidado.email, convidado.nome, grupo.nome, convidante.nome || convidante.email, link);

  res.status(201).json({ id: convite.id, email: convidado.email, estado: convite.estado });
}));

module.exports = router;
