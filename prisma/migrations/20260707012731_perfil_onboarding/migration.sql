-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fontesRendimento" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notificacoes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "objetivo" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "partilha" TEXT,
ADD COLUMN     "planeamento" TEXT,
ADD COLUMN     "preferencia" TEXT,
ADD COLUMN     "principaisDespesas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resumoSemanal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "situacao" TEXT,
ADD COLUMN     "sobre" TEXT,
ADD COLUMN     "telefone" TEXT;
