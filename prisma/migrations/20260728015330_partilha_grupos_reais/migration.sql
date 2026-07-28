-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoMembro" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'membro',
    "entradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoMembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoConvite" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "convidadoId" TEXT NOT NULL,
    "convidadoPorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "GrupoConvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grupo_criadoPorId_idx" ON "Grupo"("criadoPorId");

-- CreateIndex
CREATE INDEX "GrupoMembro_userId_idx" ON "GrupoMembro"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoMembro_grupoId_userId_key" ON "GrupoMembro"("grupoId", "userId");

-- CreateIndex
CREATE INDEX "GrupoConvite_grupoId_idx" ON "GrupoConvite"("grupoId");

-- CreateIndex
CREATE INDEX "GrupoConvite_convidadoId_idx" ON "GrupoConvite"("convidadoId");

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoMembro" ADD CONSTRAINT "GrupoMembro_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoMembro" ADD CONSTRAINT "GrupoMembro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoConvite" ADD CONSTRAINT "GrupoConvite_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoConvite" ADD CONSTRAINT "GrupoConvite_convidadoId_fkey" FOREIGN KEY ("convidadoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoConvite" ADD CONSTRAINT "GrupoConvite_convidadoPorId_fkey" FOREIGN KEY ("convidadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
