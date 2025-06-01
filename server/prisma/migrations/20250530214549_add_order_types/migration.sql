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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("collectionName", "createdAt", "id", "tvdbToken", "tvdbTokenExpiry", "updatedAt") SELECT "collectionName", "createdAt", "id", "tvdbToken", "tvdbTokenExpiry", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
