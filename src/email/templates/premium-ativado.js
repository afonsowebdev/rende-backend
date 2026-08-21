/* =========================================================
   Rende+ — Template do email de "Premium ativado"
   ---------------------------------------------------------
   Disparado em GET /api/pagamentos/confirmar (ver src/routes/pagamentos.js),
   logo a seguir a confirmarmos junto do Stripe que o pagamento está mesmo
   feito e a atualizarmos plano="premium" na base de dados — nunca antes
   disso, e nunca a partir do frontend a dizer "paguei".

   Segue a mesma linguagem de marca dos outros templates (cabeçalho
   verde-escuro, cores, tipografia — ver src/mailer.js), com um cabeçalho
   próprio (selo "PREMIUM" ao lado do logótipo, sem o mockup de saldo —
   não faz sentido mostrar um saldo de exemplo num email sobre a
   subscrição) e um cartão de resumo do plano que os outros emails não têm.

   Recebe as peças de marca partilhadas (cores, casca exterior, logótipo,
   botão) por parâmetro em vez de fazer require("../../mailer") — mesmo
   motivo do template de boas-vindas: evita uma dependência circular entre
   este ficheiro e src/mailer.js (que é quem faz require deste ficheiro).
   ========================================================= */

function criarTemplatePremiumAtivado({ COR, casca, logoBadge, caixaBotao }) {
  /* Cabeçalho com o selo "PREMIUM" ao lado do logótipo — a única
     diferença visual em relação ao cabeçalho partilhado dos outros
     emails "cheios". Sem o mockup de saldo, pelo mesmo motivo do email
     de boas-vindas: não há nada de exemplo para mostrar que faça sentido
     aqui, o assunto é a subscrição, não o saldo. */
  function cabecalho() {
    return `<tr><td bgcolor="${COR.headerBg}" style="background-color:${COR.headerBg};padding:26px 26px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">${logoBadge()}</td>
        <td style="vertical-align:middle;padding-left:12px;">
          <span style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Rende+</span>
        </td>
        <td style="vertical-align:middle;padding-left:10px;">
          <span style="display:inline-block;background-color:#F5C451;color:${COR.headerBg};font-size:10.5px;font-weight:800;letter-spacing:.08em;padding:4px 10px;border-radius:999px;">PREMIUM</span>
        </td>
      </tr></table>
      <div style="font-size:11.5px;color:${COR.tagline};font-weight:600;margin-top:10px;line-height:1.4;">O seu dinheiro. Os seus objetivos. O seu futuro.</div>
    </td></tr>`;
  }

  /* Cartão de resumo do plano — mesmo tratamento visual da caixa de código/
     botão dos outros templates (fundo verde muito claro, borda, cantos
     arredondados), só que com duas linhas de texto em vez de um código
     ou um link, porque aqui o que importa é confirmar o que foi pago. */
  function cartaoResumo(plano, proximaRenovacao) {
    return `<tr><td style="padding:20px 26px 6px;">
      <div style="background-color:#e8f6ef;border:1px solid #b7e4cd;border-radius:16px;padding:20px 22px;">
        <div style="font-size:14px;font-weight:800;color:${COR.ink};line-height:1.5;">Plano: Rende+ Premium &middot; ${plano}</div>
        <div style="margin-top:4px;font-size:13px;font-weight:600;color:${COR.mutedTxt};line-height:1.5;">Próxima renovação: ${proximaRenovacao}</div>
      </div>
    </td></tr>`;
  }

  /* Um item de "Já podes usar": círculo com marca de verificação + título +
     descrição — mesma linguagem visual dos círculos numerados do email de
     boas-vindas, com um símbolo de "check" em vez de número (aqui não é
     uma sequência de passos, é uma lista do que já está disponível). */
  function item(titulo, descricao) {
    return `<tr><td style="padding:0 0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="30" valign="top" style="width:30px;padding-right:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="26" height="26" style="width:26px;height:26px;">
            <tr><td width="26" height="26" bgcolor="${COR.accent}" align="center" valign="middle" style="width:26px;height:26px;background-color:${COR.accent};border-radius:50%;color:#ffffff;font-size:13px;font-weight:800;text-align:center;vertical-align:middle;">&#10003;</td></tr>
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
     outros templates ("Email automático"), explica porque é que a pessoa
     o recebeu, no espírito do rodapé do email de boas-vindas. */
  function rodape() {
    return `<tr><td style="background-color:#f6faf8;padding:22px 26px 24px;border-top:1px solid ${COR.borda};" bgcolor="#f6faf8">
      <p style="margin:0;font-size:12.5px;">
        <a href="https://rendemais.pt" style="color:${COR.accentDark};text-decoration:none;font-weight:700;">rendemais.pt</a>
        &nbsp;&middot;&nbsp;
        <a href="https://instagram.com/rendemais.pt" style="color:${COR.accentDark};text-decoration:none;font-weight:700;">Instagram @rendemais.pt</a>
      </p>
      <p style="margin:9px 0 0;font-size:11px;color:#9aa8a2;">Recebeste este email porque ativaste o Rende+ Premium.</p>
    </td></tr>`;
  }

  return function htmlPremiumAtivado(nome, plano, proximaRenovacao) {
    const miolo = `
      <tr><td style="padding:28px 26px 6px;">
        <h1 style="margin:0 0 6px;font-size:21px;font-weight:800;letter-spacing:-.02em;">O teu Premium está ativo.</h1>
        <p style="margin:0 0 10px;font-size:14.5px;font-weight:700;color:${COR.accentDark};">Obrigado por apoiares o Rende+${nome ? `, ${nome}` : ""}.</p>
        <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569;">A tua subscrição foi confirmada e todas as funcionalidades Premium já estão disponíveis na tua conta.</p>
      </td></tr>
      ${cartaoResumo(plano, proximaRenovacao)}
      <tr><td style="padding:22px 26px 2px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${COR.accentDark};margin-bottom:14px;">Já podes usar</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${item("Despesas recorrentes", "Automatiza os movimentos que se repetem todos os meses.")}
          ${item("Previsão financeira", "Vê como o teu saldo deve evoluir nos próximos meses.")}
          ${item("Mais perguntas ao Analista Rende+", "O teu limite mensal de perguntas ao assistente aumentou.")}
        </table>
      </td></tr>
      ${caixaBotao("https://rendemais.pt", "Explorar o Premium")}
      <tr><td style="padding:8px 26px 4px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Podes gerir ou cancelar a tua subscrição a qualquer momento, nas Definições da conta.</p>
      </td></tr>`;

    return casca(`${cabecalho()}${miolo}${rodape()}`);
  };
}

module.exports = criarTemplatePremiumAtivado;
