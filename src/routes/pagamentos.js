/* =========================================================
   Rende+ — Pagamentos (Stripe)
   =========================================================
   Fluxo (versão sem webhooks, simples de testar):
   1) O frontend chama POST /api/pagamentos/checkout com o plano
      escolhido ("mensal" ou "anual"). Criamos uma sessão de
      checkout no Stripe e devolvemos o URL para onde redirecionar.
   2) O utilizador paga na página do Stripe (nunca no nosso site).
   3) O Stripe devolve o utilizador ao frontend com um session_id.
      O frontend chama GET /api/pagamentos/confirmar?session_id=...
      Nós perguntamos ao Stripe se aquela sessão foi mesmo paga e,
      se sim, ativamos o premium na base de dados.

   IMPORTANTE: a "verdade" do pagamento vem sempre do Stripe
   (nós perguntamos-lhe), nunca de o frontend dizer "paguei".
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin } = require("../auth");
const { aw } = require("../helpers");
const { enviarEmailPremiumAtivado } = require("../mailer");

// Liga à biblioteca do Stripe usando a chave secreta do .env.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Mapa: nome do plano -> id do preço no Stripe (vem do .env).
const PRECOS = {
  mensal: process.env.STRIPE_PRICE_MENSAL,
  anual: process.env.STRIPE_PRICE_ANUAL,
};

// Endereço do frontend, para onde o Stripe devolve o utilizador.
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5500";

// Todas as rotas abaixo exigem login.
router.use(exigirLogin);

/* -------- 1) Criar a sessão de checkout -------- */
router.post("/checkout", aw(async (req, res) => {
  const { plano } = req.body; // "mensal" | "anual"
  const priceId = PRECOS[plano];
  if (!priceId) return res.status(400).json({ erro: "Plano inválido. Usa 'mensal' ou 'anual'." });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ erro: "Utilizador não encontrado." });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Se já é cliente Stripe, reutilizamos; senão, o Stripe cria um a partir do email.
    customer: user.stripeCustomerId || undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${FRONTEND}/?pagamento=sucesso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND}/?pagamento=cancelado`,
    metadata: { userId: req.userId },
  });

  res.json({ url: session.url });
}));

/* -------- 2) Confirmar o pagamento (no regresso do Stripe) -------- */
router.get("/confirmar", aw(async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ erro: "Falta o session_id." });

  // Perguntamos ao Stripe os detalhes desta sessão (com a subscrição incluída).
  const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });

  const sub = session.subscription; // objeto da subscrição (por termos pedido expand)
  const ativa = session.payment_status === "paid" || (sub && (sub.status === "active" || sub.status === "trialing"));

  if (!ativa) return res.json({ premium: false, mensagem: "Pagamento ainda não confirmado." });

  // O premium é válido até ao fim do período pago (Stripe dá isto em segundos Unix).
  // Desde a versão da API do Stripe usada aqui, current_period_end já não vive no
  // topo da subscrição — mudou-se para dentro de cada item (subscrição pode ter
  // vários itens, cada um com o seu próprio ciclo). Como só temos sempre 1 item
  // (1 plano por subscrição), vamos buscá-lo aí.
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const expira = item && item.current_period_end ? new Date(item.current_period_end * 1000) : null;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      plano: "premium",
      planoExpira: expira,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : (session.customer && session.customer.id) || null,
      stripeSubId: sub ? sub.id : null,
    },
  });

  // Email de "Premium ativado": só agora, com o Stripe já confirmado e o plano
  // já atualizado na base de dados — nunca deve impedir nem reverter a
  // ativação do pagamento. Uma falha aqui fica só registada nos logs, a
  // resposta ao cliente segue na mesma (mesmo padrão do email de boas-vindas
  // em src/routes/auth.js).
  try {
    const intervalo = item && item.price && item.price.recurring ? item.price.recurring.interval : null;
    const planoLabel = intervalo === "year" ? "Anual" : "Mensal";
    const proximaRenovacao = expira
      ? expira.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
      : "—";
    await enviarEmailPremiumAtivado(user.email, user.nome, planoLabel, proximaRenovacao);
  } catch (e) {
    console.error("[pagamentos] falha ao enviar o email de Premium ativado:", e && e.message);
  }

  res.json({ premium: true, plano: user.plano, planoExpira: user.planoExpira });
}));

module.exports = router;