-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fonteRegisto" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN     "aceitaEmailsReengajamento" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ReengajamentoEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'enviado',
    "erro" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReengajamentoEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReengajamentoEmail_campanhaId_idx" ON "ReengajamentoEmail"("campanhaId");

-- CreateIndex
CREATE INDEX "ReengajamentoEmail_userId_idx" ON "ReengajamentoEmail"("userId");

-- AddForeignKey
ALTER TABLE "ReengajamentoEmail" ADD CONSTRAINT "ReengajamentoEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
