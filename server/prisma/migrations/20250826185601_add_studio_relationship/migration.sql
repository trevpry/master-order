-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "url" TEXT,
    "date" TEXT,
    "rating" INTEGER,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "osHash" TEXT,
    "checksum" TEXT,
    "phash" TEXT,
    "oCounter" INTEGER,
    "path" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileModTime" DATETIME,
    "studio" TEXT,
    "studioId" TEXT,
    "code" TEXT,
    "director" TEXT,
    "synopsis" TEXT,
    "lastPlayedAt" DATETIME,
    "resumeTime" REAL,
    "playDuration" REAL,
    "playCount" INTEGER,
    "duration" REAL,
    CONSTRAINT "StashScene_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StashScene" ("checksum", "code", "createdAt", "date", "details", "director", "duration", "fileModTime", "id", "lastPlayedAt", "lastSyncedAt", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "rating", "resumeTime", "studio", "synopsis", "title", "updatedAt", "url") SELECT "checksum", "code", "createdAt", "date", "details", "director", "duration", "fileModTime", "id", "lastPlayedAt", "lastSyncedAt", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "rating", "resumeTime", "studio", "synopsis", "title", "updatedAt", "url" FROM "StashScene";
DROP TABLE "StashScene";
ALTER TABLE "new_StashScene" RENAME TO "StashScene";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
