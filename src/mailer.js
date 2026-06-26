/* =========================================================
   Rende+ — Envio de email via Resend
   =========================================================
   Usa a API HTTP do Resend. Simples e profissional.

   Dois tipos de email, ambos com código de 6 dígitos:
     1) Verificação de conta (registo)
     2) Recuperação de palavra-passe (esqueci-me)

   Variáveis no .env (ou no Render Environment):
     RESEND_API_KEY   (a chave que geraste no Resend)
     MAIL_FROM        Rende+ <nao-responder@rendemais.pt>

   Se não houver RESEND_API_KEY, mostra o código na consola (modo dev).
   ========================================================= */

function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

/* Molde comum a todos os emails. Recebe o "miolo" (HTML do meio) e
   devolve o email completo, com cabeçalho e rodapé do Rende+. */
function moldura(miolo) {
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1b2d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eae8;">
        <tr><td style="background:#0a5a3c;padding:22px 28px;">
          <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
        </td></tr>
        ${miolo}
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e6eae8;">
          <p style="margin:0;font-size:11.5px;color:#94a3b8;">Rende+ · Gestão de finanças pessoais · rendemais.pt</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

/* Caixa verde com o código de 6 dígitos. */
function caixaCodigo(codigo) {
  return `<tr><td style="padding:18px 28px;">
    <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:18px;text-align:center;">
      <span style="font-size:34px;font-weight:800;letter-spacing:.32em;color:#0a5a3c;">${codigo}</span>
    </div>
  </td></tr>`;
}

/* ---- Email 1: verificação de conta ---- */
function htmlVerificacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:30px 28px 8px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Para confirmar o teu email e ativar a conta, usa este código:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:6px 28px 26px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">O código é válido durante <strong>15 minutos</strong>. Se não foste tu a criar esta conta, ignora este email.</p>
    </td></tr>`);
}

/* ---- Email 2: recuperação de palavra-passe ---- */
function htmlRecuperacao(nome, codigo) {
  const ola = nome ? `Olá, ${nome}` : "Olá";
  return moldura(`
    <tr><td style="padding:30px 28px 8px;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${ola}!</h1>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">Recebemos um pedido para repor a tua palavra-passe. Usa este código para continuar:</p>
    </td></tr>
    ${caixaCodigo(codigo)}
    <tr><td style="padding:6px 28px 26px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">O código é válido durante <strong>15 minutos</strong>. Se não foste tu a pedir isto, <strong>ignora este email</strong> — a tua palavra-passe continua igual.</p>
    </td></tr>`);
}

/* Função interna que faz o pedido ao Resend. */
async function enviar(para, assunto, html, codigo, etiqueta) {
  const from = process.env.MAIL_FROM || "Rende+ <onboarding@resend.dev>";

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

module.exports = {
  enviarEmailVerificacao,
  enviarEmailRecuperacao,
  emailConfigurado,
  smtpConfigurado: emailConfigurado,
};