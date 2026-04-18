-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "embedding" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "ollamaEmbeddingModel" TEXT;
