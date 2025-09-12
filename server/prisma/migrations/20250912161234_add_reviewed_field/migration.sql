-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HistoricalEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "details" TEXT,
    "category" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HistoricalEvent" ("category", "createdAt", "details", "endDate", "hidden", "id", "startDate", "title", "updatedAt") SELECT "category", "createdAt", "details", "endDate", "hidden", "id", "startDate", "title", "updatedAt" FROM "HistoricalEvent";
DROP TABLE "HistoricalEvent";
ALTER TABLE "new_HistoricalEvent" RENAME TO "HistoricalEvent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
