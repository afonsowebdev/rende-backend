/* Rende+ — Rotas dos AFORROS (depósitos numa meta; por utilizador) */
const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin } = require("../auth");
const { aw, hoje } = require("../helpers");

router.use(exigirLogin);

// LISTAR (só os aforros das metas do utilizador)
router.get("/", aw(async (req, res) => {
  const aforros = await prisma.aforro.findMany({
    where: { meta: { userId: req.userId } },
    orderBy: { createdAt: "desc" },
  });
  res.json(aforros);
}));

// CRIAR (a meta indicada tem de ser do utilizador)
router.post("/", aw(async (req, res) => {
  const { valor, data, metaId } = req.body;
  if (valor === undefined || valor === null || !metaId) {
    return res.status(400).json({ erro: "É preciso indicar 'valor' e 'metaId'." });
  }
  const meta = await prisma.meta.findFirst({ where: { id: metaId, userId: req.userId } });
  if (!meta) return res.status(400).json({ erro: "metaId inválido ou a meta não é sua." });

  const aforro = await prisma.aforro.create({
    data: { valor: Number(valor), data: data || hoje(), metaId },
  });
  res.status(201).json(aforro);
}));

// APAGAR
router.delete("/:id", aw(async (req, res) => {
  const aforro = await prisma.aforro.findFirst({
    where: { id: req.params.id, meta: { userId: req.userId } },
  });
  if (!aforro) return res.status(404).json({ erro: "Aforro não encontrado." });

  await prisma.aforro.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
