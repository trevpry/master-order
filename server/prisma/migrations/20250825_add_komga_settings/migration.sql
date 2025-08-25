-- Add Komga API key to Settings
ALTER TABLE "Settings" ADD COLUMN "komgaApiKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN "komgaUrl" TEXT;
