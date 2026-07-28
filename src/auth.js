/* =========================================================
   Rende+ — Ferramentas de autenticação
   =========================================================
   Aqui ficam as funções de segurança:
   - cifrar e comparar palavras-passe (com bcrypt);
   - criar e verificar "fichas de acesso" (tokens JWT);
   - um "guarda" que protege rotas, deixando passar só quem
     tem um token válido.
   ========================================================= */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("./db");
const { aw } = require("./helpers");

// O segredo que assina os tokens. Vem do .env (JWT_SECRET).
const SEGREDO = process.env.JWT_SECRET || "muda-este-segredo-no-.env";

// Transforma a password numa versão cifrada (hash), impossível de reverter.
async function cifrarPassword(password) {
  return bcrypt.hash(password, 10);
}

// Confirma se uma password corresponde ao hash guardado.
async function compararPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Cria um token que prova quem é o utilizador (válido por 7 dias).
function criarToken(userId) {
  return jwt.sign({ userId }, SEGREDO, { expiresIn: "7d" });
}

/* ----- Verificação de email ----- */

// Gera um código aleatório de 6 dígitos (criptograficamente seguro).
function gerarCodigo() {
  return String(crypto.randomInt(100000, 1000000));
}

// Token curto que autoriza SÓ definir a password, logo após confirmar o email.
function criarTokenSetup(userId) {
  return jwt.sign({ userId, scope: "set-password" }, SEGREDO, { expiresIn: "20m" });
}
// Confirma esse token; devolve o userId ou null.
function verificarTokenSetup(token) {
  try {
    const d = jwt.verify(token, SEGREDO);
    return d.scope === "set-password" ? d.userId : null;
  } catch {
    return null;
  }
}

/* ----- Convites para grupos de Partilha ----- */

// Token que vai no link do email de convite (7 dias, tal como a sessão normal).
// Só identifica QUAL convite é — quem clica ainda tem de confirmar sessão
// (exigirLogin) e ser o próprio convidado antes de aceitar/recusar.
function criarTokenConvite(conviteId) {
  return jwt.sign({ conviteId, scope: "grupo-convite" }, SEGREDO, { expiresIn: "7d" });
}
// Confirma esse token; devolve o conviteId ou null.
function verificarTokenConvite(token) {
  try {
    const d = jwt.verify(token, SEGREDO);
    return d.scope === "grupo-convite" ? d.conviteId : null;
  } catch {
    return null;
  }
}

/* Regras de força da palavra-passe (validadas no servidor, não dá para contornar).
   Devolve uma mensagem de erro, ou null se estiver tudo bem. */
const PW_COMUNS = new Set(["12345678", "123456789", "1234567890", "password", "password1", "qwerty123", "11111111", "00000000", "abc12345", "senha123", "12341234", "aa123456"]);
function temSequencia(p) {
  const s = p.toLowerCase();
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d === 1 || d === -1) { run++; if (run >= 5) return true; } else run = 1;
  }
  return false;
}
function validarPassword(p) {
  if (typeof p !== "string" || p.length < 8) return "A palavra-passe tem de ter pelo menos 8 caracteres.";
  if (p.length > 72) return "A palavra-passe é demasiado longa.";
  if (!/[a-z]/.test(p)) return "Inclui pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(p)) return "Inclui pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(p)) return "Inclui pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Inclui pelo menos um símbolo (ex: ! @ # ?).";
  if (PW_COMUNS.has(p.toLowerCase())) return "Essa palavra-passe é demasiado comum.";
  if (/^(.)\1+$/.test(p)) return "Não uses o mesmo caractere repetido.";
  if (temSequencia(p)) return "Evita sequências como 12345 ou abcde.";
  return null;
}

/* "Guarda" de rotas protegidas.
   Lê o token do cabeçalho  Authorization: Bearer <token>.
   Se for válido, guarda o id do utilizador em req.userId e deixa passar.
   Se não, responde 401 (não autorizado).

   Além de verificar a assinatura, confirma que o token não é anterior a um
   eventual "forçar logout" feito por um admin (User.sessaoInvalidadaEm): o
   JWT já traz sempre um "iat" (data de emissão, em segundos) mesmo sem o
   definirmos explicitamente — comparamos isso com essa data. Isto obriga a
   uma leitura extra à base de dados em (quase) todos os pedidos autenticados,
   mas é a forma mais simples de suportar logout forçado sem introduzir uma
   blacklist de tokens (ex.: Redis) só para este caso raro. */
const exigirLogin = aw(async (req, res, next) => {
  const cabecalho = req.headers.authorization || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "É preciso iniciar sessão." });
  }

  let dados;
  try {
    dados = jwt.verify(token, SEGREDO);
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }

  const user = await prisma.user.findUnique({ where: { id: dados.userId }, select: { sessaoInvalidadaEm: true } });
  if (!user) {
    return res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }
  if (user.sessaoInvalidadaEm && dados.iat && dados.iat * 1000 < user.sessaoInvalidadaEm.getTime()) {
    return res.status(401).json({ erro: "A tua sessão foi terminada. Inicia sessão novamente." });
  }

  req.userId = dados.userId;
  next();
});

/* "Guarda" extra para rotas de administração. Corre SEMPRE depois de
   exigirLogin (precisa de req.userId já definido). Vai à base de dados
   confirmar o role atual do utilizador — nunca confia em nada vindo do
   token ou do pedido, só no que está guardado no User. */
const exigirAdmin = aw(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (!user || user.role !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito a administradores." });
  }
  next();
});

module.exports = { cifrarPassword, compararPassword, criarToken, exigirLogin, exigirAdmin, gerarCodigo, criarTokenSetup, verificarTokenSetup, criarTokenConvite, verificarTokenConvite, validarPassword };