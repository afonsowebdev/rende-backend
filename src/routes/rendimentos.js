/* Rende+ — Rotas dos RENDIMENTOS (usa a fábrica CRUD) */
const crudRouter = require("./crud");

module.exports = crudRouter({
  modelo: "rendimento",
  campos: ["fonte", "cat", "valor", "data", "rec", "origem"],
  obrigatorios: ["fonte", "valor"],
  numeros: ["valor"],
  booleanos: ["rec"],
  defaults: { cat: "Outros", rec: false },
  nomeSingular: "Rendimento",
});
