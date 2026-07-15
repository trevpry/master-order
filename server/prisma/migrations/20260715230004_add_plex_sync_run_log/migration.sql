-- CreateTable
CREATE TABLE "PlexSyncRunLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "durationSeconds" REAL NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "sections" INTEGER NOT NULL DEFAULT 0,
    "totalShows" INTEGER NOT NULL DEFAULT 0,
    "totalMovies" INTEGER NOT NULL DEFAULT 0,
    "totalArtists" INTEGER NOT NULL DEFAULT 0,
    "cleanupEpisodes" INTEGER NOT NULL DEFAULT 0,
    "cleanupSeasons" INTEGER NOT NULL DEFAULT 0,
    "cleanupShows" INTEGER NOT NULL DEFAULT 0,
    "cleanupMovies" INTEGER NOT NULL DEFAULT 0,
    "cleanupArtists" INTEGER NOT NULL DEFAULT 0,
    "cleanupAlbums" INTEGER NOT NULL DEFAULT 0,
    "cleanupTracks" INTEGER NOT NULL DEFAULT 0,
    "cleanupPlaylists" INTEGER NOT NULL DEFAULT 0,
    "cleanupComplexFields" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlexSyncRunLog_createdAt_idx" ON "PlexSyncRunLog"("createdAt");
