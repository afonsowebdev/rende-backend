/* =========================================================
   Rende+ — Anúncios (avisos dentro da app, lado normal)
   ---------------------------------------------------------
   Só esta rota, pública para qualquer utilizador com sessão iniciada
   (exigirLogin, SEM exigirAdmin — ao contrário de routes/admin.js).
   A gestão dos anúncios (criar/ativar/desativar) é feita em
   /api/admin/anuncios, protegida por exigirAdmin.
   ========================================================= */

const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { exigirLogin } = require("../auth");
const { aw } = require("../helpers");

/* ---- ANÚNCIO ATIVO (o mais recente, se houver algum) ---- */
router.get("/ativo", exigirLogin, aw(async (req, res) => {
  const anuncio = await prisma.anuncio.findFirst({
    where: { ativo: true },
    orderBy: { criadoEm: "desc" },
    select: { id: true, titulo: true, mensagem: true, criadoEm: true },
  });
  res.json({ anuncio: anuncio || null });
}));

module.exports = router;
