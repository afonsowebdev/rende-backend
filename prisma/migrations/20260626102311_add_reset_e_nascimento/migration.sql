-- AlterTable
ALTER TABLE "User" ADD COLUMN     "codigoReset" TEXT,
ADD COLUMN     "codigoResetExpira" TIMESTAMP(3),
ADD COLUMN     "dataNascimento" TEXT,
ADD COLUMN     "nascimentoDefinidoEm" TIMESTAMP(3);
