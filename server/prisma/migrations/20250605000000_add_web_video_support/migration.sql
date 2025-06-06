-- Add web video support fields to CustomOrderItem table
-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN "webTitle" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "webUrl" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "webDescription" TEXT;
