/* Rende+ — Rotas das CONTAS ligadas (usa a fábrica CRUD) */
const crudRouter = require("./crud");
const { hoje } = require("../helpers");

module.exports = crudRouter({
  modelo: "conta",
  campos: ["banco", "nome", "saldo", "moeda", "ligadoEm", "sincronizadoEm"],
  obrigatorios: ["banco", "nome"],
  numeros: ["saldo"],
  defaults: { saldo: 0, moeda: "EUR", ligadoEm: hoje },
  nomeSingular: "Conta",
});
