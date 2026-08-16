/* =========================================================
   Rende+ — Template do email de "Boas-vindas"
   ---------------------------------------------------------
   Disparado em POST /api/auth/definir-password (ver src/routes/auth.js),
   ou seja, só depois de a conta estar mesmo pronta a usar: email já
   confirmado E palavra-passe já definida. Ver a nota junto a essa rota
   para a justificação de porque não é disparado logo em /verificar-email.

   Segue a mesma linguagem de marca dos outros templates (cabeçalho
   verde-escuro, cores, tipografia — ver src/mailer.js), mas com uma
   estrutura mais simples: sem o mockup do telemóvel nem a fila de
   "vantagens" dos restantes emails. Ficaram de fora de propósito:
     - o mockup mostra sempre um saldo de exemplo (ex.: "€ 2 480"), o que
       não faz sentido logo na conta de alguém que ainda não registou nada;
     - a fila de vantagens seria redundante com a secção "Primeiros passos"
       deste email, que já cumpre esse papel de forma mais concreta.

   Recebe as peças de marca partilhadas (cores, casca exterior, logótipo,
   botão) por parâmetro em vez de fazer require("../../mailer") — evitava
   assim uma dependência circular entre este ficheiro e src/mailer.js
   (que é quem faz require deste ficheiro).
   ========================================================= */

function criarTemplateBoasVindas({ COR, casca, logoBadge, caixaBotao }) {
  /* Cabeçalho simplificado: logótipo + "Rende+" + tagline, sem o mockup
     de saldo (não há dados nenhuns ainda a mostrar a um utilizador novo). */
  function cabecalho() {
    return `<tr><td bgcolor="${COR.headerBg}" style="background-color:${COR.headerBg};padding:26px 26px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">${logoBadge()}</td>
        <td style="vertical-align:middle;padding-left:12px;">
          <span style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
        </td>
      </tr></table>
      <div style="font-size:11.5px;color:${COR.tagline};font-weight:600;margin-top:10px;line-height:1.4;">O seu dinheiro. Os seus objetivos. O seu futuro.</div>
    </td></tr>`;
  }

  /* Um item de "Primeiros passos": círculo numerado + título + descrição,
     a mesma linguagem visual dos círculos de ícone dos outros templates,
     só que com números em vez de emoji (faz mais sentido numa sequência
     de passos do que numa lista de vantagens lado a lado). */
  function passo(numero, titulo, descricao) {
    return `<tr><td style="padding:0 0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="30" valign="top" style="width:30px;padding-right:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="26" height="26" style="width:26px;height:26px;">
            <tr><td width="26" height="26" bgcolor="${COR.accent}" align="center" valign="middle" style="width:26px;height:26px;background-color:${COR.accent};border-radius:50%;color:#ffffff;font-size:12px;font-weight:800;text-align:center;vertical-align:middle;">${numero}</td></tr>
          </table>
        </td>
        <td valign="top">
          <div style="font-size:13.5px;font-weight:800;color:${COR.ink};line-height:1.35;">${titulo}</div>
          <div style="margin-top:2px;font-size:12.5px;font-weight:500;color:${COR.mutedTxt};line-height:1.5;">${descricao}</div>
        </td>
      </tr></table>
    </td></tr>`;
  }

  /* Rodapé próprio deste email — texto diferente do rodapé genérico dos
     outros templates ("Email automático"), mais no espírito de um email
     de boas-vindas: explica porque é que a pessoa o recebeu. */
  function rodape() {
    return `<tr><td style="background-color:#f6faf8;padding:22px 26px 24px;border-top:1px solid ${COR.borda};" bgcolor="#f6faf8">
      <p style="margin:0;font-size:12.5px;">
        <a href="https://rendemais.pt" style="color:${COR.accentDark};text-decoration:none;font-weight:700;">rendemais.pt</a>
        &nbsp;&middot;&nbsp;
        <a href="https://instagram.com/rendemais.pt" style="color:${COR.accentDark};text-decoration:none;font-weight:700;">Instagram @rendemais.pt</a>
      </p>
      <p style="margin:9px 0 0;font-size:11px;color:#9aa8a2;">Recebeste este email porque criaste uma conta no Rende+.</p>
    </td></tr>`;
  }

  return function htmlBoasVindas(nome) {
    const saudacao = nome ? `Bem-vindo, ${nome}.` : "Bem-vindo.";
    const miolo = `
      <tr><td style="padding:28px 26px 6px;">
        <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;letter-spacing:-.02em;">${saudacao}</h1>
        <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">A tua conta já está pronta. O Rende+ ajuda-te a organizar rendimentos, despesas e objetivos de poupança num só lugar, de forma simples e privada.</p>
      </td></tr>
      <tr><td style="padding:22px 26px 2px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${COR.accentDark};margin-bottom:14px;">Primeiros passos</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${passo("1", "Regista o teu primeiro movimento", "Uma despesa ou um rendimento. O painel começa a fazer sentido a partir do primeiro registo.")}
          ${passo("2", "Define um objetivo de poupança", "Um fundo de emergência, uma viagem. Acompanha o progresso em tempo real.")}
          ${passo("3", "Explora o painel", "Vê a evolução do teu saldo e o resumo por categoria, tudo num só ecrã.")}
        </table>
      </td></tr>
      ${caixaBotao("https://rendemais.pt", "Aceder ao Rende+")}
      <tr><td style="padding:8px 26px 4px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Se tiveres alguma dúvida, é só responder a este email.<br/>— Equipa Rende+</p>
      </td></tr>`;

    return casca(`${cabecalho()}${miolo}${rodape()}`);
  };
}

module.exports = criarTemplateBoasVindas;
