-- CreateIndex
-- Add book reading progress fields to CustomOrderItem table

-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN "bookPageCount" INTEGER;
ALTER TABLE "CustomOrderItem" ADD COLUMN "bookCurrentPage" INTEGER;
ALTER TABLE "CustomOrderItem" ADD COLUMN "bookPercentRead" REAL;
