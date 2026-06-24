-- Verificação de email + password definida só após confirmar o email
-- A password passa a poder ser NULL (fica vazia até o utilizador a definir).
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Novos campos de verificação
ALTER TABLE "User" ADD COLUMN "emailVerificado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "codigoVerif" TEXT;
ALTER TABLE "User" ADD COLUMN "codigoExpira" TIMESTAMP(3);

-- Contas que já existiam continuam a funcionar (consideramo-las confirmadas).
UPDATE "User" SET "emailVerificado" = true WHERE "password" IS NOT NULL;
