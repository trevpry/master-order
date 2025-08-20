-- CreateTable
CREATE TABLE "WatchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaType" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchLog_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
