/* =========================================================
   Rende+ — Envio de email (verificação de conta) via RESEND
   =========================================================
   Em vez de SMTP (que alguns alojamentos, como o Render, podem
   bloquear), enviamos por HTTP com a API do Resend (porta 443).
   Só precisas de UMA variável: RESEND_API_KEY.

   Variáveis no .env (ou nas Environment do Render):
     RESEND_API_KEY   a chave da API do Resend (começa por "re_")
     MAIL_FROM        ex: "Rende+ <nao-responder@rendemais.pt>"
                      O domínio do remetente TEM de estar verificado
                      no Resend. Para testar sem domínio, podes usar
                      "Rende+ <onboarding@resend.dev>" (só envia para
                      o email com que criaste a conta Resend).

   Se RESEND_API_KEY não estiver definido, mostramos o código na
   consola do servidor (modo de teste) em vez de enviar.
   ========================================================= */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
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
  const from = process.env.MAIL_FROM || "Rende+ <onboarding@resend.dev>";
  const key = process.env.RESEND_API_KEY;

  // Sem chave -> modo de teste: o código aparece nos logs, não há envio.
  if (!key) {
    console.warn("[mailer] RESEND_API_KEY não definido — os emails NÃO são enviados.");
    console.log(`[mailer] (modo dev) Código de verificação para ${para}: ${codigo}`);
    return { dev: true };
  }

  if (typeof fetch !== "function") {
    throw new Error("O Node deste servidor não tem fetch global. Usa Node 18+ no Render.");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000); // não ficar pendurado
  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [para],
        subject: "Confirma o teu email — Rende+",
        text: `O teu código de verificação Rende+ é ${codigo}. É válido durante 15 minutos.`,
        html: corpoHtml(nome, codigo),
      }),
      signal: ctrl.signal,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (data && (data.message || data.name)) || ("HTTP " + resp.status);
      console.error("[mailer] ERRO Resend (" + resp.status + "): " + msg);
      throw new Error("Não foi possível enviar o email de verificação: " + msg);
    }
    console.log("[mailer] Email enviado para " + para + " (id: " + (data && data.id) + ")");
    return { sent: true, id: data && data.id };
  } catch (e) {
    if (e && e.name === "AbortError") {
      console.error("[mailer] Tempo esgotado a contactar o Resend.");
      throw new Error("Tempo esgotado ao enviar o email. Tenta novamente.");
    }
    console.error("[mailer] Falha no envio: " + (e && e.message));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { enviarEmailVerificacao, emailConfigurado, smtpConfigurado: emailConfigurado };