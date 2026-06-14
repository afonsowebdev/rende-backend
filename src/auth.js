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

/* "Guarda" de rotas protegidas.
   Lê o token do cabeçalho  Authorization: Bearer <token>.
   Se for válido, guarda o id do utilizador em req.userId e deixa passar.
   Se não, responde 401 (não autorizado). */
function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "É preciso iniciar sessão." });
  }
  try {
    const dados = jwt.verify(token, SEGREDO);
    req.userId = dados.userId;
    next(); // tudo certo — segue para a rota
  } catch {
    res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }
}

module.exports = { cifrarPassword, compararPassword, criarToken, exigirLogin };
