-- CreateTable
CREATE TABLE "StashSceneWatchHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneId" TEXT NOT NULL,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT,
    "progress" REAL,
    CONSTRAINT "StashSceneWatchHistory_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "fileSize" INTEGER,
    "bitrate" REAL,
    "resolution" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "frameRate" REAL,
    "codec" TEXT,
    "userRating" REAL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "watchedComplete" BOOLEAN NOT NULL DEFAULT false,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "avgWatchTime" REAL,
    "totalWatchTime" REAL NOT NULL DEFAULT 0.0,
    "popularityScore" REAL NOT NULL DEFAULT 0.0,
    "qualityScore" REAL,
    "trendingScore" REAL NOT NULL DEFAULT 0.0,
    "discoveryScore" REAL NOT NULL DEFAULT 0.0,
    "sceneDominantColors" TEXT,
    "sceneKeywords" TEXT,
    "contentFlags" TEXT,
    "aiGeneratedTags" TEXT,
    "moodScore" REAL,
    "actionIntensity" REAL,
    CONSTRAINT "StashScene_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StashScene" ("checksum", "code", "createdAt", "date", "details", "director", "duration", "fileModTime", "id", "lastPlayedAt", "lastSyncedAt", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "rating", "resumeTime", "studio", "studioId", "synopsis", "title", "updatedAt", "url") SELECT "checksum", "code", "createdAt", "date", "details", "director", "duration", "fileModTime", "id", "lastPlayedAt", "lastSyncedAt", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "rating", "resumeTime", "studio", "studioId", "synopsis", "title", "updatedAt", "url" FROM "StashScene";
DROP TABLE "StashScene";
ALTER TABLE "new_StashScene" RENAME TO "StashScene";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
