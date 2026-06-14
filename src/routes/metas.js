/* Rende+ — Rotas das METAS de poupança (protegidas e por utilizador) */
const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin } = require("../auth");
const { aw } = require("../helpers");

router.use(exigirLogin);

// LISTAR (com os aforros de cada meta)
router.get("/", aw(async (req, res) => {
  const metas = await prisma.meta.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { aforros: true },
  });
  res.json(metas);
}));

// CRIAR
router.post("/", aw(async (req, res) => {
  const { nome, alvo, atual } = req.body;
  if (!nome) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const meta = await prisma.meta.create({
    data: { nome, alvo: Number(alvo) || 0, atual: Number(atual) || 0, userId: req.userId },
  });
  res.status(201).json(meta);
}));

// EDITAR
router.patch("/:id", aw(async (req, res) => {
  const existe = await prisma.meta.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existe) return res.status(404).json({ erro: "Meta não encontrada." });

  const { nome, alvo, atual } = req.body;
  const a = {};
  if (nome !== undefined) a.nome = nome;
  if (alvo !== undefined) a.alvo = Number(alvo);
  if (atual !== undefined) a.atual = Number(atual);

  const meta = await prisma.meta.update({ where: { id: req.params.id }, data: a });
  res.json(meta);
}));

// APAGAR (os aforros da meta são apagados automaticamente)
router.delete("/:id", aw(async (req, res) => {
  const existe = await prisma.meta.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existe) return res.status(404).json({ erro: "Meta não encontrada." });

  await prisma.meta.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
