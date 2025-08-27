-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashClip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneId" TEXT NOT NULL,
    "clipIndex" INTEGER NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "duration" REAL NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "markerBased" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StashClip_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StashClip" ("clipIndex", "createdAt", "duration", "endTime", "id", "sceneId", "startTime", "watched", "watchedAt") SELECT "clipIndex", "createdAt", "duration", "endTime", "id", "sceneId", "startTime", "watched", "watchedAt" FROM "StashClip";
DROP TABLE "StashClip";
ALTER TABLE "new_StashClip" RENAME TO "StashClip";
CREATE UNIQUE INDEX "StashClip_sceneId_clipIndex_key" ON "StashClip"("sceneId", "clipIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
