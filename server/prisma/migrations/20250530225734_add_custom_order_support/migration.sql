-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customOrderId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "plexKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "seriesTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "collectionName" TEXT,
    "tvdbToken" TEXT,
    "tvdbTokenExpiry" DATETIME,
    "tvGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "moviesGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "customOrderPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("collectionName", "createdAt", "id", "moviesGeneralPercent", "tvGeneralPercent", "tvdbToken", "tvdbTokenExpiry", "updatedAt") SELECT "collectionName", "createdAt", "id", "moviesGeneralPercent", "tvGeneralPercent", "tvdbToken", "tvdbTokenExpiry", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
