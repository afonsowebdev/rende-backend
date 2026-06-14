/* Rende+ — Rotas das DESPESAS (usa a fábrica CRUD) */
const crudRouter = require("./crud");

module.exports = crudRouter({
  modelo: "despesa",
  campos: ["nome", "cat", "valor", "data", "tipo", "origem"],
  obrigatorios: ["nome", "valor"],
  numeros: ["valor"],
  defaults: { cat: "outros", tipo: "variavel" },
  nomeSingular: "Despesa",
});
