/* =========================================================
   Rende+ — Envio de email via Resend
   =========================================================
   Usa a API HTTP do Resend. Simples e profissional.

   Dois tipos de email, ambos com código de 6 dígitos:
     1) Verificação de conta (registo)
     2) Recuperação de palavra-passe (esqueci-me)

   Variáveis no .env (ou no Render Environment):
     RESEND_API_KEY   (a chave que geraste no Resend)
     MAIL_FROM        Rende+ <geral@rendemais.pt>

   Se não houver RESEND_API_KEY, mostra o código na consola (modo dev).
   ========================================================= */

function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

/* Molde comum a todos os emails. Recebe o "miolo" (HTML do meio) e
   devolve o email completo, com cabeçalho e rodapé do Rende+. */
function moldura(miolo) {
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#eef2f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1b2d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:472px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8e5;box-shadow:0 8px 28px -16px rgba(10,90,60,.35);">
        <tr><td style="background:#0a5a3c;background:linear-gradient(135deg,#14a06b 0%,#0a5a3c 100%);padding:26px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <img src="https://rendemais.pt/icon-192.png" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0;outline:none;text-decoration:none;" />
            </td>
            <td style="vertical-align:middle;padding-left:13px;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
              <div style="font-size:12px;color:#d3f3e6;font-weight:600;margin-top:1px;">Finanças pessoais, sem complicações</div>
            </td>
          </tr></table>
        </td></tr>
        ${miolo}
        <tr><td style="background:#f6faf8;padding:20px 28px;border-top:1px solid #e6eae8;">
          <p style="margin:0 0 5px;font-size:12.5px;color:#334155;font-weight:700;">Rende+ · gestão de finanças pessoais</p>
          <p style="margin:0;font-size:11.5px;color:#8a99a8;">
            <a href="https://rendemais.pt" style="color:#0a5a3c;text-decoration:none;font-weight:700;">rendemais.pt</a>
            &nbsp;·&nbsp;
            <a href="https://instagram.com/rendemais.pt" style="color:#0a5a3c;text-decoration:none;font-weight:700;">Instagram @rendemais.pt</a>
          </p>
          <p style="margin:9px 0 0;font-size:11px;color:#aab6c0;">Email automático — não é preciso responder.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

/* Caixa com o código de 6 dígitos — com etiqueta e selo de validade. */
function caixaCodigo(codigo) {
  return `<tr><td style="padding:16px 28px 6px;">
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:22px 18px;text-align:center;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#0a5a3c;text-transform:uppercase;opacity:.85;margin-bottom:10px;">O teu código</div>
      <div style="font-size:40px;line-height:1;font-weight:800;letter-spacing:.30em;color:#0a5a3c;font-family:'SFMono-Regular',Consolas,Menlo,monospace;text-indent:.30em;">${codigo}</div>
      <div style="margin-top:14px;"><span style="display:inline-block;background:#0a5a3c;color:#ffffff;font-size:11px;font-weight:700;padding:5px 13px;border-radius:999px;">válido durante 15 minutos</span></div>
    </div>
  </td></tr>`;
}

/* Bloco curto de apresentação do produto (mantém-se discreto para não afetar a entrega). */
function blocoPromo() {
  const itens = [
    ["Vê para onde vai o teu dinheiro", "Despesas e rendimentos organizados, mês a mês."],
    ["Define metas de poupança", "Junta para o que importa, ao teu ritmo."],
    ["Pensado para ti", "Simples, em português e sem palavrões financeiros."],
  ];
  const linhas = itens.map(([t, d]) => `<tr>
    <td style="padding:7px 0;vertical-align:top;width:20px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#14a06b;"></span></td>
    <td style="padding:5px 0;"><span style="font-size:13.5px;font-weight:700;color:#0f1b2d;">${t}</span><br><span style="font-size:12.5px;color:#64748b;line-height:1.5;">${d}</span></td>
  </tr>`).join("");
  return `<tr><td style="padding:10px 28px 4px;">
    <div style="border-top:1px solid #eef2f0;padding-top:18px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#0f1b2d;">Já agora, o que é o Rende+?</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>
    </div>
  </td></tr>`;
}

/* ---- Email 1: verificação de conta ---- */
function htmlVerificacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:30px 28px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}! Bem-vindo/a ao Rende+</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Falta só um passo para começares a organizar as tuas finanças. Confirma o teu email com o código abaixo:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:8px 28px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Escreve este código na app para ativares a conta. Se não foste tu a registar-te, podes ignorar este email.</p>
    </td></tr>
    ${blocoPromo()}
    <tr><td style="padding:6px 28px 26px;"></td></tr>`);
}

/* ---- Email 2: recuperação de palavra-passe ---- */
function htmlRecuperacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:30px 28px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Recebemos um pedido para repor a tua palavra-passe. Usa este código para definires uma nova:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:8px 28px 26px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Se não foste tu a pedir isto, <strong>ignora este email</strong> — a tua palavra-passe continua igual e a tua conta está segura.</p>
    </td></tr>`);
}

/* Botão de ação (CTA) — mesmo tratamento visual da caixa do código, mas com
   um link em vez de um código para escrever. Usado no convite de grupo. */
function caixaBotao(link, texto) {
  return `<tr><td style="padding:16px 28px 6px;">
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:26px 18px;text-align:center;">
      <a href="${link}" style="display:inline-block;background:#0a5a3c;color:#ffffff;font-size:15px;font-weight:800;padding:13px 28px;border-radius:999px;text-decoration:none;">${texto}</a>
    </div>
  </td></tr>`;
}

/* ---- Email 3: convite para grupo de Partilha ---- */
function htmlConvite(nomeConvidado, nomeGrupo, nomeConvidante, linkAceitar) {
  const ola = nomeConvidado ? `Olá, ${nomeConvidado}` : "Olá";
  return moldura(`
    <tr><td style="padding:30px 28px 6px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;"><strong>${nomeConvidante}</strong> convidou-te para o grupo <strong>${nomeGrupo}</strong> no Rende+, para partilharem despesas em conjunto.</p>
    </td></tr>
    ${caixaBotao(linkAceitar, "Ver convite no Rende+")}
    <tr><td style="padding:8px 28px 4px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Precisas de ter sessão iniciada e conta Premium para aceitar. Se não conheces ${nomeConvidante} ou não esperavas este convite, podes ignorar este email.</p>
    </td></tr>
    ${blocoPromo()}
    <tr><td style="padding:6px 28px 26px;"></td></tr>`);
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

module.exports = {
  enviarEmailVerificacao,
  enviarEmailRecuperacao,
  enviarEmailConvite,
  emailConfigurado,
  smtpConfigurado: emailConfigurado,
};