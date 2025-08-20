-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbArtworkUrl" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbDirector" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbGenres" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbId" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbOverview" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbStudio" TEXT;
ALTER TABLE "CustomOrderItem" ADD COLUMN "tvdbYear" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "icon" TEXT,
    "parentOrderId" INTEGER,
    CONSTRAINT "CustomOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrder" ("createdAt", "description", "icon", "id", "isActive", "name", "updatedAt") SELECT "createdAt", "description", "icon", "id", "isActive", "name", "updatedAt" FROM "CustomOrder";
DROP TABLE "CustomOrder";
ALTER TABLE "new_CustomOrder" RENAME TO "CustomOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
