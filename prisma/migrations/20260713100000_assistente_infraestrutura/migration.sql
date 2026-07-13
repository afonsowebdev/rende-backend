-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER DEFAULT 0,
    "outputTokens" INTEGER DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION DEFAULT 0,
    "lastRequestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantConversation_userId_idx" ON "AssistantConversation"("userId");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_idx" ON "AssistantMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AssistantMessage_userId_idx" ON "AssistantMessage"("userId");

-- CreateIndex
CREATE INDEX "AssistantUsage_userId_idx" ON "AssistantUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantUsage_userId_period_key" ON "AssistantUsage"("userId", "period");

-- CreateIndex
CREATE INDEX "AssistantFeedback_messageId_idx" ON "AssistantFeedback"("messageId");

-- CreateIndex
CREATE INDEX "AssistantFeedback_userId_idx" ON "AssistantFeedback"("userId");

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
