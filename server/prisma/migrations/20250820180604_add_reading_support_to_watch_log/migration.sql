-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaType" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'watch',
    "title" TEXT NOT NULL,
    "seriesTitle" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "plexKey" TEXT,
    "customOrderItemId" INTEGER,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "totalWatchTime" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchLog_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WatchLog" ("createdAt", "customOrderItemId", "duration", "endTime", "episodeNumber", "id", "isCompleted", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "startTime", "title", "totalWatchTime", "updatedAt") SELECT "createdAt", "customOrderItemId", "duration", "endTime", "episodeNumber", "id", "isCompleted", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "startTime", "title", "totalWatchTime", "updatedAt" FROM "WatchLog";
DROP TABLE "WatchLog";
ALTER TABLE "new_WatchLog" RENAME TO "WatchLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
