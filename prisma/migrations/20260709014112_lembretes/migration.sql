-- CreateTable
CREATE TABLE "Lembrete" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data" TEXT NOT NULL,
    "repete" BOOLEAN NOT NULL DEFAULT false,
    "aviso" INTEGER NOT NULL DEFAULT 3,
    "cat" TEXT,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Lembrete_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
