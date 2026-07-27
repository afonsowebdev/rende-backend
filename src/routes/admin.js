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
const { exigirLogin, exigirAdmin, gerarCodigo, cifrarPassword } = require("../auth");
const { aw } = require("../helpers");
const { enviarEmailVerificacao } = require("../mailer");
const { limiteMensalDoPlano } = require("../assistant/config");
const criarAssistantUsageService = require("../assistant/assistant-usage.service");
const assistantUsage = criarAssistantUsageService(prisma);

const QUINZE_MIN = 15 * 60 * 1000;

const TAMANHO_PAGINA = 20;
const paginaPedida = (req) => Math.max(1, parseInt(req.query.page, 10) || 1);

router.use(exigirLogin, exigirAdmin);

/* ---- LISTAR UTILIZADORES (paginado, pesquisa por email, ordenação e filtros) ---- */
const CAMPOS_ORDENAVEIS = { createdAt: "createdAt", email: "email", plano: "plano" };
router.get("/utilizadores", aw(async (req, res) => {
  const page = paginaPedida(req);
  const pesquisa = String(req.query.pesquisa || "").trim();
  const campoOrdem = CAMPOS_ORDENAVEIS[req.query.sort] || "createdAt";
  const dir = req.query.dir === "asc" ? "asc" : "desc";
  const filtroPlano = ["free", "premium"].includes(req.query.plano) ? req.query.plano : null;
  const filtroRole = ["user", "admin"].includes(req.query.role) ? req.query.role : null;
  // inativoDias: filtra utilizadores cujo último login é mais antigo que N dias,
  // OU que nunca fizeram login e a conta já tem mais de N dias (nunca "começaram").
  const inativoDias = parseInt(req.query.inativoDias, 10);
  const corteInatividade = inativoDias > 0 ? new Date(Date.now() - inativoDias * 24 * 60 * 60 * 1000) : null;

  const where = {
    ...(pesquisa ? { email: { contains: pesquisa, mode: "insensitive" } } : {}),
    ...(filtroPlano ? { plano: filtroPlano } : {}),
    ...(filtroRole ? { role: filtroRole } : {}),
    ...(corteInatividade ? {
      OR: [
        { ultimoLogin: { lt: corteInatividade } },
        { AND: [{ ultimoLogin: null }, { createdAt: { lt: corteInatividade } }] },
      ],
    } : {}),
  };

  const [total, utilizadores] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [campoOrdem]: dir },
      skip: (page - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
      select: {
        id: true, email: true, nome: true, plano: true, planoExpira: true, role: true, createdAt: true,
        emailVerificado: true, ultimoLogin: true,
        _count: { select: { despesas: true, rendimentos: true } },
      },
    }),
  ]);

  res.json({
    utilizadores: utilizadores.map((u) => ({
      id: u.id, email: u.email, nome: u.nome, plano: u.plano, planoExpira: u.planoExpira, role: u.role, createdAt: u.createdAt,
      emailVerificado: u.emailVerificado, ultimoLogin: u.ultimoLogin,
      totalDespesas: u._count.despesas, totalRendimentos: u._count.rendimentos,
    })),
    pagina: page,
    tamanhoPagina: TAMANHO_PAGINA,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
  });
}));

/* ---- EXPORTAR UTILIZADORES PARA CSV ----
   Tem de vir ANTES de "/utilizadores/:id" — senão o Express interpretava
   "exportar" como um :id e esta rota nunca seria alcançada. Mesmas colunas
   já visíveis na tabela do painel (ver GET /utilizadores acima). */
function csvEscape(valor) {
  const s = valor === null || valor === undefined ? "" : String(valor);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

router.get("/utilizadores/exportar", aw(async (req, res) => {
  const utilizadores = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      email: true, nome: true, plano: true, role: true, createdAt: true,
      _count: { select: { despesas: true, rendimentos: true } },
    },
  });

  const cabecalho = ["email", "nome", "plano", "role", "despesas", "rendimentos", "criado_em"];
  const linhas = utilizadores.map((u) => [
    u.email, u.nome || "", u.plano, u.role, u._count.despesas, u._count.rendimentos, u.createdAt.toISOString(),
  ].map(csvEscape).join(","));
  const csv = [cabecalho.join(","), ...linhas].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="utilizadores-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
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

/* ---- FICHA DETALHADA DE UM UTILIZADOR (tudo o que a listagem tem + histórico
   de mudanças de plano + campos do Stripe, se existirem) ---- */
router.get("/utilizadores/:id/detalhe", aw(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, email: true, nome: true, moeda: true, plano: true, planoExpira: true, role: true,
      emailVerificado: true, createdAt: true, ultimoLogin: true,
      stripeCustomerId: true, stripeSubId: true,
      _count: { select: { despesas: true, rendimentos: true, metas: true, contas: true } },
    },
  });
  if (!u) return res.status(404).json({ erro: "Utilizador não encontrado." });

  const historicoPlano = await prisma.adminAuditLog.findMany({
    where: { alvoUserId: u.id, acao: "mudar_plano" },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { email: true } } },
  });

  res.json({
    id: u.id, email: u.email, nome: u.nome, moeda: u.moeda, plano: u.plano, planoExpira: u.planoExpira,
    role: u.role, emailVerificado: u.emailVerificado, createdAt: u.createdAt, ultimoLogin: u.ultimoLogin,
    stripeCustomerId: u.stripeCustomerId, stripeSubId: u.stripeSubId,
    totalDespesas: u._count.despesas, totalRendimentos: u._count.rendimentos,
    totalMetas: u._count.metas, totalContas: u._count.contas,
    historicoPlano: historicoPlano.map((r) => ({
      id: r.id,
      adminEmail: r.admin ? r.admin.email : "(conta apagada)",
      detalhes: r.detalhes,
      createdAt: r.createdAt,
    })),
  });
}));

/* ---- FORÇAR LOGOUT: invalida qualquer token emitido até agora (ver exigirLogin) ---- */
router.post("/utilizadores/:id/forcar-logout", aw(async (req, res) => {
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ erro: "Utilizador não encontrado." });

  await prisma.user.update({ where: { id: alvo.id }, data: { sessaoInvalidadaEm: new Date() } });

  await prisma.adminAuditLog.create({
    data: { adminId: req.userId, acao: "forcar_logout", alvoUserId: alvo.id, detalhes: JSON.stringify({}) },
  });

  res.json({ ok: true, mensagem: "A sessão deste utilizador foi terminada." });
}));

/* ---- REENVIAR EMAIL DE VERIFICAÇÃO: só faz sentido para contas ainda não
   verificadas — reutiliza o mesmo código/mailer do registo (registo/auth.js),
   não duplica nada. ---- */
router.post("/utilizadores/:id/reenviar-verificacao", aw(async (req, res) => {
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ erro: "Utilizador não encontrado." });
  if (alvo.emailVerificado) {
    return res.status(409).json({ erro: "Este email já está verificado." });
  }

  const codigo = gerarCodigo();
  await prisma.user.update({
    where: { id: alvo.id },
    data: { codigoVerif: await cifrarPassword(codigo), codigoExpira: new Date(Date.now() + QUINZE_MIN) },
  });
  await enviarEmailVerificacao(alvo.email, alvo.nome, codigo);

  await prisma.adminAuditLog.create({
    data: { adminId: req.userId, acao: "reenviar_verificacao", alvoUserId: alvo.id, detalhes: JSON.stringify({}) },
  });

  res.json({ ok: true, mensagem: "Email de verificação reenviado." });
}));

/* ---- ELIMINAR CONTA (destrutivo — cascade confirmado no schema: todas as
   tabelas do utilizador têm onDelete: Cascade, exceto AdminAuditLog, cujo
   alvoUserId sobrevive de propósito para o histórico de auditoria). A
   confirmação "escreve o email" é feita no frontend, mas repetimos aqui a
   validação no backend (confirmarEmail no corpo) como defesa em profundidade,
   já que esta ação não tem volta atrás. ---- */
router.delete("/utilizadores/:id", aw(async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ erro: "Não podes eliminar a tua própria conta a partir daqui." });
  }
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ erro: "Utilizador não encontrado." });

  const confirmarEmail = String(req.body.confirmarEmail || "").trim().toLowerCase();
  if (confirmarEmail !== alvo.email.toLowerCase()) {
    return res.status(400).json({ erro: "O email de confirmação não corresponde ao da conta." });
  }

  await prisma.user.delete({ where: { id: alvo.id } });

  await prisma.adminAuditLog.create({
    data: { adminId: req.userId, acao: "eliminar_conta", alvoUserId: alvo.id, detalhes: JSON.stringify({ email: alvo.email }) },
  });

  res.json({ ok: true, mensagem: "Conta eliminada." });
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

  // Novos utilizadores por mês, últimos 6 meses (incluindo o atual) — para o
  // gráfico de evolução no painel. Uma contagem por mês (não há muitos meses,
  // não vale a pena complicar com groupBy/raw SQL só por isto).
  // Nota: a "chave" (AAAA-MM) vem sempre do ano/mês LOCAIS do próprio "inicio"
  // (nunca de toISOString, que pode recuar um dia — e por vezes um mês inteiro,
  // se o dia 1 cair perto da meia-noite — consoante o fuso horário do servidor).
  const mesesRange = Array.from({ length: 6 }, (_, i) => {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1);
    const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    const chave = inicio.getFullYear() + "-" + String(inicio.getMonth() + 1).padStart(2, "0");
    return { chave, inicio, fim };
  });

  const [
    totalUtilizadores, totalPremium, novosUtilizadores7dias, novosUtilizadores30dias,
    usoAssistente, totalDespesas, totalRendimentos, totalEmailVerificado, contagensPorMes,
    nuncaComecaram,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plano: "premium" } }),
    prisma.user.count({ where: { createdAt: { gte: seteDiasAtras } } }),
    prisma.user.count({ where: { createdAt: { gte: trintaDiasAtras } } }),
    prisma.assistantUsage.aggregate({ where: { period: periodoAtual }, _sum: { requestCount: true } }),
    prisma.despesa.count(),
    prisma.rendimento.count(),
    prisma.user.count({ where: { emailVerificado: true } }),
    Promise.all(mesesRange.map((m) => prisma.user.count({ where: { createdAt: { gte: m.inicio, lt: m.fim } } }))),
    // Funil de onboarding: utilizadores que criaram conta mas nunca registaram
    // nada (0 despesas E 0 rendimentos) — nunca chegaram a usar a app a sério.
    prisma.user.count({ where: { despesas: { none: {} }, rendimentos: { none: {} } } }),
  ]);

  res.json({
    totalUtilizadores,
    totalPremium,
    novosUtilizadores7dias,
    novosUtilizadores30dias,
    usoAssistenteMesAtual: usoAssistente._sum.requestCount || 0,
    periodoAtual,
    totalDespesas,
    totalRendimentos,
    totalEmailVerificado,
    novosPorMes: mesesRange.map((m, i) => ({ mes: m.chave, total: contagensPorMes[i] })),
    nuncaComecaram,
    pctNuncaComecaram: totalUtilizadores > 0 ? Math.round((nuncaComecaram / totalUtilizadores) * 100) : 0,
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

/* ---- RECEITA (Stripe/MRR) ----
   NOTA IMPORTANTE: pagamentos.js define PRECOS como o mapa "plano -> id do
   preço no Stripe" (STRIPE_PRICE_MENSAL/ANUAL, do .env) — não guarda valores
   monetários, só identificadores. Os únicos valores em euros que existem no
   projeto são os mostrados ao utilizador em premium.jsx (2,99 €/mês e
   29,99 €/ano), por isso são esses que replicamos aqui. Além disso, a base de
   dados não distingue se um utilizador premium escolheu o plano mensal ou o
   anual (não há esse campo) — por isso o MRR abaixo é uma ESTIMATIVA que
   assume o preço mensal para todos os premium ativos, e deve ser lido como
   tal, não como um valor exato vindo do Stripe. Também não existe nenhum
   webhook do Stripe nem campo de cancelamento — "cancelamentos" é aproximado
   pelo número de planos premium cuja validade (planoExpira) terminou
   recentemente e ainda não foi renovada. */
const PRECO_MENSAL_EUR = 2.99;
const PRECO_ANUAL_EUR = 29.99;

router.get("/receita", aw(async (req, res) => {
  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const seteDiasDepois = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [premiumAtivos, canceladasRecentemente, expiramEm7Dias] = await Promise.all([
    prisma.user.count({ where: { plano: "premium", OR: [{ planoExpira: null }, { planoExpira: { gte: agora } }] } }),
    prisma.user.count({ where: { planoExpira: { gte: trintaDiasAtras, lt: agora } } }),
    prisma.user.count({ where: { plano: "premium", planoExpira: { gte: agora, lte: seteDiasDepois } } }),
  ]);

  res.json({
    premiumAtivos,
    mrrEstimado: Math.round(premiumAtivos * PRECO_MENSAL_EUR * 100) / 100,
    precoMensal: PRECO_MENSAL_EUR,
    precoAnual: PRECO_ANUAL_EUR,
    canceladasUltimos30Dias: canceladasRecentemente,
    expiramProximos7Dias: expiramEm7Dias,
  });
}));

/* ---- ANÚNCIOS (avisos dentro da app) ----
   A rota pública que os utilizadores normais consultam vive à parte, em
   routes/anuncios.js (só exigirLogin, sem exigirAdmin — ver server.js). ---- */
router.get("/anuncios", aw(async (req, res) => {
  const anuncios = await prisma.anuncio.findMany({ orderBy: { criadoEm: "desc" } });
  res.json({ anuncios });
}));

router.post("/anuncios", aw(async (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const mensagem = String(req.body.mensagem || "").trim();
  if (!titulo || !mensagem) {
    return res.status(400).json({ erro: "Título e mensagem são obrigatórios." });
  }

  const anuncio = await prisma.anuncio.create({
    data: { titulo, mensagem, criadoPorAdminId: req.userId },
  });

  await prisma.adminAuditLog.create({
    data: { adminId: req.userId, acao: "criar_anuncio", alvoUserId: anuncio.id, detalhes: JSON.stringify({ titulo }) },
  });

  res.status(201).json(anuncio);
}));

router.patch("/anuncios/:id", aw(async (req, res) => {
  if (typeof req.body.ativo !== "boolean") {
    return res.status(400).json({ erro: "O campo 'ativo' tem de ser verdadeiro ou falso." });
  }
  const existe = await prisma.anuncio.findUnique({ where: { id: req.params.id } });
  if (!existe) return res.status(404).json({ erro: "Anúncio não encontrado." });

  const atualizado = await prisma.anuncio.update({ where: { id: req.params.id }, data: { ativo: req.body.ativo } });

  await prisma.adminAuditLog.create({
    data: {
      adminId: req.userId, acao: "mudar_estado_anuncio", alvoUserId: atualizado.id,
      detalhes: JSON.stringify({ titulo: atualizado.titulo, ativo: atualizado.ativo }),
    },
  });

  res.json(atualizado);
}));

/* ---- ERROS RECENTES DO BACKEND (últimos 50, mais recente primeiro) ---- */
router.get("/erros", aw(async (req, res) => {
  const registos = await prisma.erroSistema.findMany({
    orderBy: { criadoEm: "desc" },
    take: 50,
  });
  res.json({ erros: registos });
}));

/* ---- USO DO ASSISTENTE IA POR UTILIZADOR (mês atual) ---- */
router.get("/assistente-uso", aw(async (req, res) => {
  const period = assistantUsage.periodoAtual();

  const registos = await prisma.assistantUsage.findMany({
    where: { period },
    orderBy: { requestCount: "desc" },
    include: { user: { select: { id: true, email: true, nome: true, plano: true } } },
  });

  res.json({
    periodoAtual: period,
    utilizadores: registos
      .filter((r) => r.user) // ignora registos cujo utilizador já foi apagado
      .map((r) => {
        const limit = limiteMensalDoPlano(r.user.plano);
        return {
          userId: r.user.id,
          email: r.user.email,
          nome: r.user.nome,
          plano: r.user.plano,
          usadas: r.requestCount,
          limite: limit,
          restantes: Math.max(0, limit - r.requestCount),
        };
      }),
  });
}));

module.exports = router;
