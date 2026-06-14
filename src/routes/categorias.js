/* Rende+ — Rotas das CATEGORIAS personalizadas (usa a fábrica CRUD) */
const crudRouter = require("./crud");

module.exports = crudRouter({
  modelo: "categoria",
  campos: ["nome", "cor", "icon"],
  obrigatorios: ["nome"],
  nomeSingular: "Categoria",
});
