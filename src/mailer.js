/* =========================================================
   Rende+ — Envio de email (verificação de conta)
   =========================================================
   Usa o nodemailer com um servidor SMTP (definido no .env).
   Funciona com qualquer fornecedor: Brevo, Gmail (palavra-passe
   de app), Mailgun, SendGrid, Resend SMTP, etc.

   Variáveis necessárias no .env:
     SMTP_HOST   ex: smtp-relay.brevo.com
     SMTP_PORT   ex: 587
     SMTP_USER   o utilizador/login do SMTP
     SMTP_PASS   a palavra-passe/chave do SMTP
     MAIL_FROM   ex: "Rende+ <nao-responder@rendemais.pt>"

   Se o SMTP NÃO estiver configurado, em vez de enviar mostramos
   o código na consola do servidor (útil para testar localmente).
   ========================================================= */

const nodemailer = require("nodemailer");

let transporter = null;
let avisou = false;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// Modelo do email (HTML simples, com a marca Rende+).
function corpoHtml(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1b2d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eae8;">
        <tr><td style="background:#0a5a3c;padding:22px 28px;">
          <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
          <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Para confirmar o teu email e ativar a conta, usa este código:</p>
        </td></tr>
        <tr><td style="padding:18px 28px;">
          <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:18px;text-align:center;">
            <span style="font-size:34px;font-weight:800;letter-spacing:.32em;color:#0a5a3c;">${codigo}</span>
          </div>
        </td></tr>
        <tr><td style="padding:6px 28px 26px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">O código é válido durante <strong>15 minutos</strong>. Se não foste tu a criar esta conta, ignora este email.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e6eae8;">
          <p style="margin:0;font-size:11.5px;color:#94a3b8;">Rende+ · Gestão de finanças pessoais · rendemais.pt</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

async function enviarEmailVerificacao(para, nome, codigo) {
  const from = process.env.MAIL_FROM || "Rende+ <nao-responder@rendemais.pt>";
  const t = getTransporter();

  if (!t) {
    if (!avisou) {
      console.warn("[mailer] SMTP não configurado no .env — os emails NÃO são enviados de verdade.");
      console.warn("[mailer] Define SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS para ativar o envio real.");
      avisou = true;
    }
    console.log(`[mailer] (modo dev) Código de verificação para ${para}: ${codigo}`);
    return { dev: true };
  }

  await t.sendMail({
    from,
    to: para,
    subject: "Confirma o teu email — Rende+",
    text: `O teu código de verificação Rende+ é ${codigo}. É válido durante 15 minutos.`,
    html: corpoHtml(nome, codigo),
  });
  return { sent: true };
}

module.exports = { enviarEmailVerificacao };