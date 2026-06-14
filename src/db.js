/* =========================================================
   Rende+ — Ligação à base de dados (Prisma)
   =========================================================
   Criamos AQUI uma única ligação à base de dados e partilhamo-la
   com o resto da app. Assim não abrimos ligações a mais.
   ========================================================= */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
