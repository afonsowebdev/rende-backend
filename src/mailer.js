/* =========================================================
   Rende+ — Envio de email via Resend
   =========================================================
   Usa a API HTTP do Resend. Simples e profissional.

   Templates de email (verificação, recuperação, mudar password,
   convite, campanha de reengajamento) — todos partilham a mesma
   moldura de marca: cabeçalho verde-escuro com logótipo + mockup,
   fila de vantagens antes do rodapé, e rodapé com redes sociais.
   Só o "miolo" (o corpo específico) muda de email para email.

   Regras de compatibilidade com clientes de email (Outlook em
   particular, que usa o motor do Word e não suporta CSS moderno):
     - layout inteiro em <table>, nunca flexbox/grid;
     - todos os estilos inline, nunca classes CSS externas;
     - cor de fundo sempre com o atributo bgcolor E background-color
       inline (o Outlook ignora "background" sozinho em <td>);
     - border-radius/sombras são só bónus visual — o Outlook ignora-os
       e mostra cantos retos, o que não parte o email, só o "achata";
     - o único SVG usado (o logótipo) fica escondido do Outlook com
       comentários condicionais MSO, com um símbolo de texto como
       alternativa — o Outlook clássico não renderiza SVG inline;
     - os restantes ícones (vantagens, redes sociais) usam apenas
       emoji/símbolos Unicode, nunca SVG nem webfonts de ícones.

   Variáveis no .env (ou no Render Environment):
     RESEND_API_KEY   (a chave que geraste no Resend)
     MAIL_FROM        Rende+ <geral@rendemais.pt>

   Se não houver RESEND_API_KEY, mostra o código na consola (modo dev).
   ========================================================= */

function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

// Paleta oficial de marca (mesma usada na app e na landing page).
const COR = {
  headerBg: "#0C3D2C",   // fundo do cabeçalho
  logoBg: "#1AAB78",     // círculo do logótipo
  accent: "#1D9E75",     // botões de ação, destaques
  accentDark: "#0C7A54", // texto/ícone sobre fundo claro
  ink: "#0E1F1A",
  tela: "#f4f7f5",       // fundo fora do cartão do email
  cartao: "#ffffff",
  borda: "#e2e8e5",
  mutedTxt: "#5b6b64",
  tagline: "#bfe3d3",    // tagline sobre o fundo escuro do cabeçalho
};

/* Logótipo (círculo verde + ícone de linha ascendente). O SVG é o
   fornecido pela marca; fica escondido do Outlook clássico (que não
   suporta SVG inline) através de comentários condicionais MSO, e
   mostra em alternativa uma seta de texto simples só nesse caso —
   nunca fica um ícone partido, só um pouco mais simples. */
function logoBadge() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="40" height="40" style="width:40px;height:40px;">
    <tr><td width="40" height="40" bgcolor="${COR.logoBg}" align="center" valign="middle" style="width:40px;height:40px;background-color:${COR.logoBg};border-radius:50%;text-align:center;vertical-align:middle;font-size:0;line-height:0;">
      <!--[if !mso]><!-->
      <svg width="21" height="21" viewBox="0 0 256 256" style="display:inline-block;vertical-align:middle;"><polyline points="72,166 110,138 140,152 184,96" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><path d="M156 103 L185 95 L182 125" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <!--<![endif]-->
      <!--[if mso]>
      <span style="font-size:18px;line-height:40px;color:#ffffff;font-weight:800;">&#8599;</span>
      <![endif]-->
    </td></tr>
  </table>`;
}

/* Mockup simplificado do telemóvel: em vez de tentar desenhar um
   contorno de telemóvel (frágil em Outlook, que não faz cantos
   arredondados nem sombras), mostra-se um "cartão de saldo" — a
   mesma informação que apareceria no ecrã, sem depender de nada
   que não seja tabelas e cor sólida. Números fixos e ilustrativos
   (nunca dados reais de quem recebe o email). */
function mockupSaldo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="136" style="width:136px;background-color:#0F2E22;border:1px solid #1c4a37;border-radius:14px;" bgcolor="#0F2E22">
    <tr><td style="padding:13px 15px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8fcbb0;padding-bottom:5px;">Saldo atual</td></tr>
        <tr><td style="font-size:18px;font-weight:800;letter-spacing:-.02em;color:#ffffff;">&euro; 2.480</td></tr>
        <tr><td style="padding-top:5px;font-size:10.5px;font-weight:700;color:#5fe3a8;">&#9650; 12% este m&ecirc;s</td></tr>
      </table>
    </td></tr>
  </table>`;
}

/* Cabeçalho: fundo verde-escuro sólido, logótipo + "Rende+" + tagline
   à esquerda, mockup de saldo à direita. Igual em todos os emails. */
function cabecalho() {
  return `<tr><td bgcolor="${COR.headerBg}" style="background-color:${COR.headerBg};padding:26px 26px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">${logoBadge()}</td>
          <td style="vertical-align:middle;padding-left:12px;">
            <span style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
          </td>
        </tr></table>
        <div style="font-size:11.5px;color:${COR.tagline};font-weight:600;margin-top:10px;line-height:1.4;max-width:260px;">O seu dinheiro. Os seus objetivos. O seu futuro.</div>
      </td>
      <td width="136" align="right" style="vertical-align:top;">${mockupSaldo()}</td>
    </tr></table>
  </td></tr>`;
}

/* Fila de vantagens (4 colunas): ícone + título curto + descrição breve.
   Tabela de 4 células lado a lado — o padrão mais seguro para colunas
   em Outlook (não depende de flexbox/grid nem de media queries). */
function filaVantagens() {
  const itens = [
    ["&#128274;", "Seguro", "Dados protegidos"],
    ["&#9889;", "R&aacute;pido", "Tudo num lugar"],
    ["&#127919;", "Com controlo", "Decide melhor"],
    ["&#9989;", "Sem stress", "Finan&ccedil;as simples"],
  ];
  const colunas = itens.map(([ic, titulo, desc]) => `
    <td width="25%" align="center" valign="top" style="width:25%;padding:0 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="34" height="34" style="width:34px;height:34px;margin:0 auto;">
        <tr><td width="34" height="34" bgcolor="#e8f6ef" align="center" valign="middle" style="width:34px;height:34px;background-color:#e8f6ef;border-radius:50%;font-size:15px;line-height:34px;text-align:center;">${ic}</td></tr>
      </table>
      <div style="margin-top:8px;font-size:12px;font-weight:800;color:${COR.ink};line-height:1.3;">${titulo}</div>
      <div style="margin-top:2px;font-size:11px;font-weight:500;color:${COR.mutedTxt};line-height:1.35;">${desc}</div>
    </td>`).join("");
  return `<tr><td style="padding:6px 20px 8px;">
    <div style="border-top:1px solid ${COR.borda};padding-top:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${colunas}</tr></table>
    </div>
  </td></tr>`;
}

/* Ícone circular de rede social (link + emoji/letra, nunca SVG de marca
   — os logótipos oficiais das redes são demasiado complexos para SVG
   inline fiável em email; um símbolo simples chega para identificar). */
function iconeSocial(href, simbolo, label) {
  return `<a href="${href}" style="text-decoration:none;" aria-label="${label}">
    <table role="presentation" cellpadding="0" cellspacing="0" width="30" height="30" style="width:30px;height:30px;">
      <tr><td width="30" height="30" bgcolor="#e8f6ef" align="center" valign="middle" style="width:30px;height:30px;background-color:#e8f6ef;border-radius:50%;font-size:13px;font-weight:800;color:${COR.accentDark};text-align:center;vertical-align:middle;">${simbolo}</td></tr>
    </table>
  </a>`;
}

/* Rodapé: redes sociais, link do site, nota de "email automático".
   Igual em todos os emails. O link do Facebook fica pronto a usar
   assim que a página oficial existir (mesmo critério já usado na
   landing page — nunca inventa um endereço). */
function rodape() {
  return `<tr><td style="background-color:#f6faf8;padding:22px 26px 24px;border-top:1px solid ${COR.borda};" bgcolor="#f6faf8">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;">${iconeSocial("https://instagram.com/rendemais.pt", "&#128247;", "Instagram")}</td>
      <td style="padding-right:8px;">${iconeSocial("#", "f", "Facebook")}</td>
      <td>${iconeSocial("https://rendemais.pt", "&#127760;", "Site")}</td>
    </tr></table>
    <p style="margin:14px 0 0;font-size:12.5px;">
      <a href="https://rendemais.pt" style="color:${COR.accentDark};text-decoration:none;font-weight:700;">rendemais.pt</a>
    </p>
    <p style="margin:9px 0 0;font-size:11px;color:#9aa8a2;">Email autom&aacute;tico &middot; n&atilde;o &eacute; preciso responder.</p>
  </td></tr>`;
}

/* Molde comum a todos os emails. Recebe o "miolo" (HTML do meio, específico
   de cada email) e devolve o email completo: cabeçalho, miolo, vantagens
   e rodapé — sempre a mesma estrutura, só o miolo muda. */
function moldura(miolo) {
  return `<!doctype html><html lang="pt"><body style="margin:0;background-color:${COR.tela};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${COR.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR.tela};padding:32px 16px;" bgcolor="${COR.tela}">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${COR.cartao};border-radius:18px;overflow:hidden;border:1px solid ${COR.borda};box-shadow:0 8px 28px -16px rgba(10,60,40,.35);" bgcolor="${COR.cartao}">
        ${cabecalho()}
        ${miolo}
        ${filaVantagens()}
        ${rodape()}
      </table>
    </td></tr>
  </table></body></html>`;
}

/* Caixa com o código de 6 dígitos — com etiqueta e selo de validade. */
function caixaCodigo(codigo) {
  return `<tr><td style="padding:20px 26px 6px;">
    <div style="background-color:#e8f6ef;border:1px solid #b7e4cd;border-radius:16px;padding:22px 18px;text-align:center;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:${COR.accentDark};text-transform:uppercase;opacity:.85;margin-bottom:10px;">O teu código</div>
      <div style="font-size:40px;line-height:1;font-weight:800;letter-spacing:.30em;color:${COR.accentDark};font-family:'SFMono-Regular',Consolas,Menlo,monospace;text-indent:.30em;">${codigo}</div>
      <div style="margin-top:14px;"><span style="display:inline-block;background-color:${COR.accentDark};color:#ffffff;font-size:11px;font-weight:700;padding:5px 13px;border-radius:999px;">válido durante 15 minutos</span></div>
    </div>
  </td></tr>`;
}

/* Botão de ação (CTA) — mesmo tratamento visual da caixa do código, mas com
   um link em vez de um código para escrever. Usado no convite de grupo,
   na campanha de reengajamento e no questionário. */
function caixaBotao(link, texto) {
  return `<tr><td style="padding:20px 26px 6px;">
    <div style="background-color:#e8f6ef;border:1px solid #b7e4cd;border-radius:16px;padding:26px 18px;text-align:center;">
      <a href="${link}" style="display:inline-block;background-color:${COR.accent};color:#ffffff;font-size:15px;font-weight:800;padding:13px 28px;border-radius:999px;text-decoration:none;">${texto}</a>
    </div>
  </td></tr>`;
}

/* ---- Email 1: verificação de conta ---- */
function htmlVerificacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}! Bem-vindo/a ao Rende+</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Falta só um passo para começares a organizar as tuas finanças. Confirma o teu email com o código abaixo:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:8px 26px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Escreve este código na app para ativares a conta. Se não foste tu a registar-te, podes ignorar este email.</p>
    </td></tr>`);
}

/* ---- Email 2: recuperação de palavra-passe ---- */
function htmlRecuperacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Recebemos um pedido para repor a tua palavra-passe. Usa este código para definires uma nova:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:8px 26px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Se não foste tu a pedir isto, <strong>ignora este email</strong>. A tua palavra-passe continua igual e a tua conta está segura.</p>
    </td></tr>`);
}

/* ---- Email 3: confirmar alteração de palavra-passe (utilizador já com sessão
   iniciada, a pedir para mudar a password nas Definições — diferente do "Recuperação",
   que é para quem não consegue entrar). ---- */
function htmlMudarPassword(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Pediste para alterar a palavra-passe da tua conta Rende+. Usa este código para confirmar:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:8px 26px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Depois de confirmares, a tua sessão é terminada em todos os dispositivos por segurança. Vais precisar de entrar de novo com a palavra-passe nova. Se não foste tu a pedir isto, <strong>ignora este email</strong>: a tua palavra-passe atual continua válida.</p>
    </td></tr>`);
}

/* ---- Email 4: convite para grupo de Partilha ---- */
function htmlConvite(nomeConvidado, nomeGrupo, nomeConvidante, linkAceitar) {
  const ola = nomeConvidado ? `Olá, ${nomeConvidado}` : "Olá";
  return moldura(`
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;"><strong>${nomeConvidante}</strong> convidou-te para o grupo <strong>${nomeGrupo}</strong> no Rende+, para partilharem despesas em conjunto.</p>
    </td></tr>
    ${caixaBotao(linkAceitar, "Ver convite no Rende+")}
    <tr><td style="padding:8px 26px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Precisas de ter sessão iniciada e conta Premium para aceitar. Se não conheces ${nomeConvidante} ou não esperavas este convite, podes ignorar este email.</p>
    </td></tr>`);
}

/* ---- Email 5: campanha de reengajamento (painel de administração) ----
   `corpoHtml` já vem com as variáveis (ex.: {{nome}}) substituídas pelo
   chamador — este ficheiro só trata da moldura de marca à volta do texto,
   que agora é a mesma dos restantes emails (cabeçalho, vantagens, rodapé). */
function htmlCampanha(corpoHtml) {
  return moldura(`<tr><td style="padding:28px 26px 6px;font-size:14.5px;line-height:1.6;color:#334155;">${corpoHtml}</td></tr>`);
}

/* ---- Email 6: questionário de opinião (reengajamento) ----
   Convida o utilizador a responder a um questionário breve. `linkQuestionario`
   é sempre recebido de fora (nunca inventado aqui) — este ficheiro só cuida
   do template; quem chamar esta função é responsável por indicar o link real
   do questionário no momento em que essa funcionalidade for ligada a um envio. */
function htmlQuestionario(nome, linkQuestionario) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">A tua opinião ajuda-nos a melhorar o Rende+. Preparámos um questionário breve, com cerca de 2 minutos, sobre a tua experiência até agora.</p>
    </td></tr>
    ${caixaBotao(linkQuestionario, "Responder ao questionário")}
    <tr><td style="padding:8px 26px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">É opcional e as tuas respostas não são associadas ao teu nome nos relatórios internos. Obrigado pelo teu tempo.</p>
    </td></tr>`);
}

/* Função interna que faz o pedido ao Resend. */
async function enviar(para, assunto, html, codigo, etiqueta) {
  const from = process.env.MAIL_FROM || "Rende+ <geral@rendemais.pt>";

  if (!emailConfigurado()) {
    console.warn("[mailer] RESEND_API_KEY NÃO configurada — os emails NÃO são enviados.");
    console.log(`[mailer] (modo dev) ${etiqueta} para ${para}: ${codigo}`);
    return { dev: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: para, subject: assunto, html }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[mailer] ERRO ao enviar email (HTTP ${response.status}): ${error}`);
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    console.log(`[mailer] Email enviado para ${para} (id: ${data.id})`);
    return { sent: true };
  } catch (e) {
    console.error(`[mailer] ERRO ao enviar email para ${para}: ${e && e.message}`);
    throw new Error(`Não foi possível enviar o email: ${e && e.message ? e.message : "erro Resend"}`);
  }
}

async function enviarEmailVerificacao(para, nome, codigo) {
  return enviar(para, "Confirma o teu email — Rende+", htmlVerificacao(nome, codigo), codigo, "Código de verificação");
}

async function enviarEmailRecuperacao(para, nome, codigo) {
  return enviar(para, "Repor a palavra-passe — Rende+", htmlRecuperacao(nome, codigo), codigo, "Código de recuperação");
}

async function enviarEmailConvite(para, nomeConvidado, nomeGrupo, nomeConvidante, linkAceitar) {
  return enviar(para, `${nomeConvidante} convidou-te para um grupo — Rende+`, htmlConvite(nomeConvidado, nomeGrupo, nomeConvidante, linkAceitar), linkAceitar, "Link de convite");
}

async function enviarEmailMudarPassword(para, nome, codigo) {
  return enviar(para, "Confirma a alteração da palavra-passe — Rende+", htmlMudarPassword(nome, codigo), codigo, "Código para mudar a palavra-passe");
}

async function enviarEmailCampanha(para, assunto, corpoHtml) {
  return enviar(para, assunto, htmlCampanha(corpoHtml), assunto, "Email de campanha");
}

async function enviarEmailQuestionario(para, nome, linkQuestionario) {
  return enviar(para, "A tua opinião conta — Rende+", htmlQuestionario(nome, linkQuestionario), linkQuestionario, "Email de questionário");
}

module.exports = {
  enviarEmailVerificacao,
  enviarEmailRecuperacao,
  enviarEmailConvite,
  enviarEmailMudarPassword,
  enviarEmailCampanha,
  enviarEmailQuestionario,
  emailConfigurado,
  smtpConfigurado: emailConfigurado,
};
