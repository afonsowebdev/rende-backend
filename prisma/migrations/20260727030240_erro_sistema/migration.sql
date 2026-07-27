-- CreateTable
CREATE TABLE "ErroSistema" (
    "id" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "stack" TEXT,
    "rota" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErroSistema_pkey" PRIMARY KEY ("id")
);
