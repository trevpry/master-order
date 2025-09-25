-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HistoryVideo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "courseTitle" TEXT,
    "lectureNumber" INTEGER,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    "channelId" INTEGER,
    "assignLater" BOOLEAN NOT NULL DEFAULT false,
    "assignedByAI" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HistoryVideo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "HistoryChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HistoryVideo" ("assignLater", "assignedByAI", "channelId", "courseTitle", "createdAt", "description", "duration", "eventId", "id", "lectureNumber", "publishedAt", "status", "thumbnailUrl", "title", "type", "updatedAt", "url") SELECT "assignLater", "assignedByAI", "channelId", "courseTitle", "createdAt", "description", "duration", "eventId", "id", "lectureNumber", "publishedAt", "status", "thumbnailUrl", "title", "type", "updatedAt", "url" FROM "HistoryVideo";
DROP TABLE "HistoryVideo";
ALTER TABLE "new_HistoryVideo" RENAME TO "HistoryVideo";
CREATE UNIQUE INDEX "HistoryVideo_url_key" ON "HistoryVideo"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
