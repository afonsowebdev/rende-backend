/* =========================================================
   Rende+ — Rotas do PAINEL DE ADMINISTRAÇÃO
   ---------------------------------------------------------
   Todas as rotas exigem sessão iniciada E role === "admin"
   (ver exigirLogin + exigirAdmin em ../auth). O role nunca é
   definido por nenhum fluxo automático — só manualmente na
   base de dados (ver README do painel admin).
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin, exigirAdmin } = require("../auth");
const { aw } = require("../helpers");

const TAMANHO_PAGINA = 20;
const paginaPedida = (req) => Math.max(1, parseInt(req.query.page, 10) || 1);

router.use(exigirLogin, exigirAdmin);

/* ---- LISTAR UTILIZADORES (paginado, pesquisa por email) ---- */
router.get("/utilizadores", aw(async (req, res) => {
  const page = paginaPedida(req);
  const pesquisa = String(req.query.pesquisa || "").trim();
  const where = pesquisa ? { email: { contains: pesquisa, mode: "insensitive" } } : {};

  const [total, utilizadores] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
      select: {
        id: true, email: true, nome: true, plano: true, planoExpira: true, role: true, createdAt: true,
        _count: { select: { despesas: true, rendimentos: true } },
      },
    }),
  ]);

  res.json({
    utilizadores: utilizadores.map((u) => ({
      id: u.id, email: u.email, nome: u.nome, plano: u.plano, planoExpira: u.planoExpira, role: u.role, createdAt: u.createdAt,
      totalDespesas: u._count.despesas, totalRendimentos: u._count.rendimentos,
    })),
    pagina: page,
    tamanhoPagina: TAMANHO_PAGINA,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
  });
}));

/* ---- DETALHE DE UM UTILIZADOR ---- */
router.get("/utilizadores/:id", aw(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, email: true, nome: true, moeda: true, plano: true, planoExpira: true, role: true,
      emailVerificado: true, createdAt: true,
      _count: { select: { despesas: true, rendimentos: true, metas: true, contas: true } },
    },
  });
  if (!u) return res.status(404).json({ erro: "Utilizador não encontrado." });

  res.json({
    id: u.id, email: u.email, nome: u.nome, moeda: u.moeda, plano: u.plano, planoExpira: u.planoExpira,
    role: u.role, emailVerificado: u.emailVerificado, createdAt: u.createdAt,
    totalDespesas: u._count.despesas, totalRendimentos: u._count.rendimentos,
    totalMetas: u._count.metas, totalContas: u._count.contas,
  });
}));

/* ---- MUDAR O PLANO DE UM UTILIZADOR (manual, fica registado na auditoria) ---- */
router.patch("/utilizadores/:id/plano", aw(async (req, res) => {
  const { plano, planoExpira } = req.body;
  if (plano !== "free" && plano !== "premium") {
    return res.status(400).json({ erro: "O campo 'plano' tem de ser 'free' ou 'premium'." });
  }

  let planoExpiraData = null;
  if (planoExpira !== undefined && planoExpira !== null && planoExpira !== "") {
    const d = new Date(planoExpira);
    if (isNaN(d.getTime())) return res.status(400).json({ erro: "Data de expiração do plano inválida." });
    planoExpiraData = d;
  }

  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ erro: "Utilizador não encontrado." });

  const atualizado = await prisma.user.update({
    where: { id: req.params.id },
    data: { plano, planoExpira: planoExpiraData },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: req.userId,
      acao: "mudar_plano",
      alvoUserId: alvo.id,
      detalhes: JSON.stringify({
        planoAntes: alvo.plano, planoDepois: plano,
        planoExpiraAntes: alvo.planoExpira, planoExpiraDepois: planoExpiraData,
      }),
    },
  });

  res.json({
    id: atualizado.id, email: atualizado.email, plano: atualizado.plano,
    planoExpira: atualizado.planoExpira, role: atualizado.role,
  });
}));

/* ---- MÉTRICAS AGREGADAS ---- */
router.get("/metricas", aw(async (req, res) => {
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const periodoAtual = agora.toISOString().slice(0, 7); // "AAAA-MM"

  const [totalUtilizadores, totalPremium, novosUtilizadores7dias, novosUtilizadores30dias, usoAssistente] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plano: "premium" } }),
    prisma.user.count({ where: { createdAt: { gte: seteDiasAtras } } }),
    prisma.user.count({ where: { createdAt: { gte: trintaDiasAtras } } }),
    prisma.assistantUsage.aggregate({ where: { period: periodoAtual }, _sum: { requestCount: true } }),
  ]);

  res.json({
    totalUtilizadores,
    totalPremium,
    novosUtilizadores7dias,
    novosUtilizadores30dias,
    usoAssistenteMesAtual: usoAssistente._sum.requestCount || 0,
    periodoAtual,
  });
}));

/* ---- AUDITORIA (histórico de ações administrativas, paginado) ---- */
router.get("/auditoria", aw(async (req, res) => {
  const page = paginaPedida(req);

  const [total, registos] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
      include: { admin: { select: { email: true } } },
    }),
  ]);

  res.json({
    registos: registos.map((r) => ({
      id: r.id,
      adminEmail: r.admin ? r.admin.email : "(conta apagada)",
      acao: r.acao,
      alvoUserId: r.alvoUserId,
      detalhes: r.detalhes,
      createdAt: r.createdAt,
    })),
    pagina: page,
    tamanhoPagina: TAMANHO_PAGINA,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
  });
}));

module.exports = router;
