-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaType" TEXT NOT NULL,
    "movieId" INTEGER,
    "episodeId" INTEGER,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchProgress_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WatchProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WatchProgress_completed_idx" ON "WatchProgress"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_mediaType_movieId_episodeId_key" ON "WatchProgress"("mediaType", "movieId", "episodeId");
