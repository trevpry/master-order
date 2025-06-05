-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN "artworkLastCached" DATETIME;
ALTER TABLE "CustomOrderItem" ADD COLUMN "artworkMimeType" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "localArtworkPath" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "originalArtworkUrl" TEXT;
