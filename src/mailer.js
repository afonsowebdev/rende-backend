/* =========================================================
   Rende+ — Envio de email (verificação de conta) via Gmail
   =========================================================
   Usa o Gmail SMTP com nodemailer. Simples, rápido e seguro.

   Variáveis no .env (ou no Render Environment):
     SMTP_HOST   smtp.gmail.com
     SMTP_PORT   587
     SMTP_USER   franciscoafonso014@gmail.com
     SMTP_PASS   (a "App Password" que geraste no Gmail)
     MAIL_FROM   Rende+ <franciscoafonso014@gmail.com>

   Se não tiver SMTP configurado, mostra o código na consola.
   ========================================================= */

const nodemailer = require("nodemailer");

let transporter = null;
let avisou = false;

function smtpConfigurado() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!smtpConfigurado()) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  transporter.verify()
    .then(() => console.log("[mailer] SMTP ligado com sucesso a " + process.env.SMTP_HOST + ":" + port))
    .catch((e) => console.error("[mailer] FALHA ao ligar ao SMTP: " + (e && e.message)));
  return transporter;
}

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
  const from = process.env.MAIL_FROM || "Rende+ <nao-responder@gmail.com>";
  const t = getTransporter();

  if (!t) {
    if (!avisou) {
      console.warn("[mailer] SMTP NÃO configurado — os emails NÃO são enviados.");
      console.warn("[mailer] Define SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM no .env.");
      avisou = true;
    }
    console.log(`[mailer] (modo dev) Código de verificação para ${para}: ${codigo}`);
    return { dev: true };
  }

  try {
    const info = await t.sendMail({
      from,
      to: para,
      subject: "Confirma o teu email — Rende+",
      text: `O teu código de verificação Rende+ é ${codigo}. É válido durante 15 minutos.`,
      html: corpoHtml(nome, codigo),
    });
    console.log("[mailer] Email enviado para " + para + " (messageId: " + info.messageId + ")");
    return { sent: true };
  } catch (e) {
    console.error("[mailer] ERRO ao enviar email para " + para + ": " + (e && e.message));
    throw new Error("Não foi possível enviar o email de verificação: " + (e && e.message ? e.message : "erro SMTP"));
  }
}

module.exports = { enviarEmailVerificacao, smtpConfigurado };