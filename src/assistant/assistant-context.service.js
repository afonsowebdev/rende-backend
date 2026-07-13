/* =========================================================
   Rende+ — Contexto financeiro para o Assistente
   ---------------------------------------------------------
   Consulta APENAS os dados do utilizador autenticado e devolve
   um resumo estruturado (nunca as transações completas, nunca
   dados de outros utilizadores, nunca campos técnicos/sensíveis).

   Não existe ainda um modelo de dados de "Partilha" (grupos
   partilhados) no schema — só uma preferência do utilizador
   (User.partilha). Por isso não há dados agregados de grupo
   para incluir aqui; nada é inventado.
   ========================================================= */

const prismaPadrao = require("../db");

function arredondar(n) {
  return Math.round(n * 100) / 100;
}

// Datas de início/fim do mês pedido, a partir de "AAAA-MM".
function limitesDoMes(period) {
  const [ano, mes] = period.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // último dia do mês
  const paraISO = (d) => d.toISOString().slice(0, 10);
  return { startDate: paraISO(inicio), endDate: paraISO(fim) };
}

// Agrupa despesas por categoria (só totais e percentagens, nunca a lista completa).
function agruparPorCategoria(despesas, totalDespesas) {
  const totais = new Map();
  for (const d of despesas) {
    const cat = d.cat || "outros";
    totais.set(cat, (totais.get(cat) || 0) + d.valor);
  }
  return [...totais.entries()]
    .map(([name, total]) => ({
      name,
      total: arredondar(total),
      percentage: totalDespesas > 0 ? arredondar((total / totalDespesas) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function criarAssistantContextService(prisma = prismaPadrao) {
  return {
    // `user` já autenticado e carregado pelo chamador (evita duas consultas).
    async gerarContexto(user, period) {
      const { startDate, endDate } = limitesDoMes(period);
      const userId = user.id;

      const [despesas, rendimentos, metas, contas, lembretes] = await Promise.all([
        prisma.despesa.findMany({ where: { userId, data: { gte: startDate, lte: endDate } } }),
        prisma.rendimento.findMany({ where: { userId, data: { gte: startDate, lte: endDate } } }),
        prisma.meta.findMany({ where: { userId } }),
        prisma.conta.findMany({ where: { userId } }),
        prisma.lembrete.findMany({ where: { userId, pago: false } }),
      ]);

      const totalDespesas = arredondar(despesas.reduce((soma, d) => soma + d.valor, 0));
      const totalRendimentos = arredondar(rendimentos.reduce((soma, r) => soma + r.valor, 0));
      const net = arredondar(totalRendimentos - totalDespesas);
      const savingsRate = totalRendimentos > 0 ? arredondar((net / totalRendimentos) * 100) : 0;

      return {
        user: {
          currency: user.moeda || "EUR",
          locale: "pt-PT",
          plan: user.plano || "free",
        },
        period: { month: period, startDate, endDate },
        summary: { income: totalRendimentos, expenses: totalDespesas, net, savingsRate },
        categories: agruparPorCategoria(despesas, totalDespesas),
        // Não há tabela de orçamentos por categoria — só um orçamento
        // global opcional no perfil do utilizador (User.orcamento).
        budgets: user.orcamento > 0 ? [{ total: user.orcamento }] : [],
        goals: metas.map((m) => ({ id: m.id, name: m.nome, target: m.alvo, current: m.atual })),
        accounts: contas.map((c) => ({ id: c.id, name: c.nome, bank: c.banco, balance: c.saldo, currency: c.moeda })),
        upcomingPayments: lembretes.map((l) => ({
          id: l.id, title: l.titulo, amount: l.valor, date: l.data, recurring: l.repete,
        })),
        recurringTransactions: rendimentos
          .filter((r) => r.rec)
          .map((r) => ({ id: r.id, source: r.fonte, amount: r.valor })),
      };
    },
  };
}

module.exports = criarAssistantContextService;
