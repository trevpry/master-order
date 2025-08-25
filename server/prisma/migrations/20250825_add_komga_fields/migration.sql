-- Add Komga fields to CustomOrderItem
ALTER TABLE "CustomOrderItem" ADD COLUMN "komgaSeriesId" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "komgaBookId" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "komgaUrl" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "komgaSeriesUrl" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "komgaMetadata" TEXT; -- JSON string with all Komga metadata
