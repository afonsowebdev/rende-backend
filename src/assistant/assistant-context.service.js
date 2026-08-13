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

   Inclui também `monthlyHistory`: um resumo real (nunca inventado)
   dos últimos MESES_DE_HISTORICO meses, o pedido incluído — é o que
   dá "memória" ao assistente para responder sobre um mês anterior
   sem ter de o pedir explicitamente ao utilizador.
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

// Chave "AAAA-MM" de uma data ISO ("AAAA-MM-DD").
function chaveDoMes(data) {
  return String(data).slice(0, 7);
}

// Mesma janela de "últimos 6 meses" já usada no resto da app (Evolução mensal
// do Painel, gráfico de poupanças) — mantém a Rita a falar da mesma janela
// que o utilizador já vê nos gráficos, em vez de um número arbitrário.
const MESES_DE_HISTORICO = 6;

// Datas de início/fim de uma janela de `meses` meses terminada no mês
// `period` (incluído) — usada para trazer, numa só consulta, os dados de
// todos os meses do histórico em vez de uma consulta por mês.
function limitesDaJanela(period, meses) {
  const [ano, mes] = period.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - meses, 1));
  const fim = new Date(Date.UTC(ano, mes, 0));
  const paraISO = (d) => d.toISOString().slice(0, 10);
  return { startDate: paraISO(inicio), endDate: paraISO(fim) };
}

// Agrupa despesas por categoria (só totais e percentagens, nunca a lista completa)
// e fica só com as 5 categorias com mais peso — chega para a Rita responder a
// "onde gastei mais", sem inflar o contexto com uma cauda longa de categorias
// residuais (mantém o resumo perto do limite de ~1500 tokens).
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
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

// Resumo real de cada um dos últimos `meses` meses terminados em `period`
// (o próprio incluído) — só totais e a categoria com mais peso de cada mês,
// nunca a lista de transações (mantém o contexto pequeno mesmo com 6 meses).
// É isto que dá à Rita "memória" de meses anteriores: sem isto, ela só via
// o mês pedido e não tinha como responder a "e no mês passado?".
function historicoMensal(despesasJanela, rendimentosJanela, period, meses) {
  const [anoRef, mesRef] = period.split("-").map(Number);
  const chaves = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anoRef, mesRef - 1 - i, 1));
    chaves.push(d.toISOString().slice(0, 7));
  }
  return chaves.map((chave) => {
    const despesasMes = despesasJanela.filter((d) => chaveDoMes(d.data) === chave);
    const rendimentosMes = rendimentosJanela.filter((r) => chaveDoMes(r.data) === chave);
    const income = arredondar(rendimentosMes.reduce((soma, r) => soma + r.valor, 0));
    const expenses = arredondar(despesasMes.reduce((soma, d) => soma + d.valor, 0));
    const net = arredondar(income - expenses);
    const savingsRate = income > 0 ? arredondar((net / income) * 100) : 0;
    const [topCategory] = agruparPorCategoria(despesasMes, expenses);
    return { month: chave, income, expenses, net, savingsRate, topCategory: topCategory || null };
  });
}

// Últimas transações do período (despesas + rendimentos juntas, ordenadas por
// data desc), limitadas a 10 — nunca a lista completa. Se o período tiver mais
// do que isso, as restantes já ficam representadas de forma agregada em
// `categories`/`summary`, por isso não é preciso listar tudo.
function ultimasTransacoes(despesas, rendimentos, limite = 10) {
  const todas = [
    ...despesas.map((d) => ({ date: d.data, type: "despesa", label: d.nome, category: d.cat || "outros", amount: arredondar(d.valor) })),
    ...rendimentos.map((r) => ({ date: r.data, type: "rendimento", label: r.fonte, category: r.cat || "outros", amount: arredondar(r.valor) })),
  ];
  return todas.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limite);
}

function criarAssistantContextService(prisma = prismaPadrao) {
  return {
    // `user` já autenticado e carregado pelo chamador (evita duas consultas).
    async gerarContexto(user, period) {
      const { startDate, endDate } = limitesDoMes(period);
      const userId = user.id;

      // Uma só consulta cobrindo os últimos MESES_DE_HISTORICO meses (o pedido
      // incluído) — dá para montar o resumo do mês atual E o histórico mensal
      // sem duplicar consultas. O mês atual é depois filtrado deste mesmo
      // conjunto, nunca pedido à parte.
      const { startDate: startJanela } = limitesDaJanela(period, MESES_DE_HISTORICO);
      const [despesasJanela, rendimentosJanela, metas, contas, lembretes] = await Promise.all([
        prisma.despesa.findMany({ where: { userId, data: { gte: startJanela, lte: endDate } } }),
        prisma.rendimento.findMany({ where: { userId, data: { gte: startJanela, lte: endDate } } }),
        prisma.meta.findMany({ where: { userId } }),
        prisma.conta.findMany({ where: { userId } }),
        prisma.lembrete.findMany({ where: { userId, pago: false } }),
      ]);

      const despesas = despesasJanela.filter((d) => chaveDoMes(d.data) === period);
      const rendimentos = rendimentosJanela.filter((r) => chaveDoMes(r.data) === period);

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
        // global opcional no perfil do utilizador (User.orcamento). "used" é o
        // total já gasto no período — dá para a Rita dizer se está dentro ou
        // acima do limite, sem inventar uma divisão por categoria que não existe.
        budgets: user.orcamento > 0 ? [{
          total: user.orcamento,
          used: totalDespesas,
          remaining: arredondar(user.orcamento - totalDespesas),
          percentageUsed: arredondar((totalDespesas / user.orcamento) * 100),
        }] : [],
        // Sem "prazo"/data-alvo no schema (Meta só tem nome/alvo/atual) — não se
        // inventa uma data; a Rita só tem o progresso real para trabalhar.
        goals: metas.map((m) => ({
          id: m.id,
          name: m.nome,
          target: m.alvo,
          current: m.atual,
          progressPct: m.alvo > 0 ? arredondar((m.atual / m.alvo) * 100) : null,
        })),
        accounts: contas.map((c) => ({ id: c.id, name: c.nome, bank: c.banco, balance: c.saldo, currency: c.moeda })),
        upcomingPayments: lembretes.map((l) => ({
          id: l.id, title: l.titulo, amount: l.valor, date: l.data, recurring: l.repete,
        })),
        recurringTransactions: rendimentos
          .filter((r) => r.rec)
          .map((r) => ({ id: r.id, source: r.fonte, amount: r.valor })),
        recentTransactions: ultimasTransacoes(despesas, rendimentos, 10),
        // Resumo real dos últimos MESES_DE_HISTORICO meses (o atual incluído), do
        // mais antigo ao mais recente — é isto que dá à Rita "memória" para
        // responder com exatidão sobre um mês anterior, em vez de só ter acesso
        // ao mês pedido no momento.
        monthlyHistory: historicoMensal(despesasJanela, rendimentosJanela, period, MESES_DE_HISTORICO),
      };
    },
  };
}

module.exports = criarAssistantContextService;
