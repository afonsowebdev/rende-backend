/* =========================================================
   Rende+ — Pequenos ajudantes partilhados
   ========================================================= */

// Embrulha uma função "async" para que, se houver um erro,
// ele seja enviado ao tratador de erros central (em server.js)
// em vez de derrubar o servidor.
const aw = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Data de hoje no formato "AAAA-MM-DD".
const hoje = () => new Date().toISOString().slice(0, 10);

module.exports = { aw, hoje };
