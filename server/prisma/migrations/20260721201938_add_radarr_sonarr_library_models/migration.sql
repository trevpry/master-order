-- CreateTable
CREATE TABLE "Movie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "radarrId" INTEGER NOT NULL,
    "tmdbId" INTEGER,
    "imdbId" TEXT,
    "title" TEXT NOT NULL,
    "sortTitle" TEXT,
    "year" INTEGER,
    "overview" TEXT,
    "runtime" INTEGER,
    "studio" TEXT,
    "genres" TEXT,
    "collectionTitle" TEXT,
    "collectionTmdbId" INTEGER,
    "posterUrl" TEXT,
    "fanartUrl" TEXT,
    "localArtworkPath" TEXT,
    "path" TEXT NOT NULL,
    "relativePath" TEXT,
    "filePath" TEXT,
    "fileSize" BIGINT,
    "sceneName" TEXT,
    "videoCodec" TEXT,
    "audioCodec" TEXT,
    "resolution" TEXT,
    "container" TEXT,
    "hasFile" BOOLEAN NOT NULL DEFAULT false,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" DATETIME,
    "radarrUpdatedAt" DATETIME,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Show" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sonarrId" INTEGER NOT NULL,
    "tvdbId" INTEGER,
    "imdbId" TEXT,
    "title" TEXT NOT NULL,
    "sortTitle" TEXT,
    "year" INTEGER,
    "overview" TEXT,
    "network" TEXT,
    "genres" TEXT,
    "status" TEXT,
    "posterUrl" TEXT,
    "fanartUrl" TEXT,
    "localArtworkPath" TEXT,
    "path" TEXT NOT NULL,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" DATETIME,
    "sonarrUpdatedAt" DATETIME,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "showId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "posterUrl" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Season_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sonarrEpisodeId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT,
    "overview" TEXT,
    "airDate" DATETIME,
    "runtime" INTEGER,
    "path" TEXT,
    "relativePath" TEXT,
    "filePath" TEXT,
    "fileSize" BIGINT,
    "videoCodec" TEXT,
    "audioCodec" TEXT,
    "resolution" TEXT,
    "container" TEXT,
    "hasFile" BOOLEAN NOT NULL DEFAULT false,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibrarySyncRunLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "durationSeconds" REAL NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionName" TEXT,
    "tvdbToken" TEXT,
    "tvdbTokenExpiry" DATETIME,
    "comicVineApiKey" TEXT,
    "plexToken" TEXT,
    "plexUrl" TEXT,
    "tvdbApiKey" TEXT,
    "tvdbBearerToken" TEXT,
    "selectedPlayer" TEXT,
    "selectedPlexUser" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "tvGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "moviesGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "customOrderPercent" INTEGER NOT NULL DEFAULT 0,
    "historyPlusPercent" INTEGER NOT NULL DEFAULT 0,
    "partiallyWatchedCollectionPercent" INTEGER NOT NULL DEFAULT 75,
    "ignoredMovieCollections" TEXT,
    "ignoredTVCollections" TEXT,
    "christmasFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "plexSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "stashSyncInterval" INTEGER NOT NULL DEFAULT 24,
    "libraryProvider" TEXT NOT NULL DEFAULT 'plex',
    "radarrUrl" TEXT,
    "radarrApiKey" TEXT,
    "radarrSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "sonarrUrl" TEXT,
    "sonarrApiKey" TEXT,
    "sonarrSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "komgaUrl" TEXT,
    "komgaApiKey" TEXT,
    "stashUrl" TEXT,
    "stashApiKey" TEXT,
    "rawgApiKey" TEXT,
    "geminiApiKey" TEXT,
    "backgroundImageStoragePath" TEXT,
    "listScrapeInterval" INTEGER NOT NULL DEFAULT 6,
    "mediaTypeLimiters" TEXT,
    "preferNewRelease" INTEGER NOT NULL DEFAULT 0,
    "preferLongUnwatched" INTEGER NOT NULL DEFAULT 0,
    "ollamaUrl" TEXT,
    "ollamaDefaultModel" TEXT,
    "ollamaEmbeddingModel" TEXT,
    "ollamaWikiExtractionModel" TEXT,
    "ollamaChatExtractionModel" TEXT,
    "ollamaNotesExtractionModel" TEXT,
    "ollamaDatingExtractionModel" TEXT,
    "wikiContextEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiAutoIngestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiAutoIngestInterval" INTEGER NOT NULL DEFAULT 60,
    "wikiChatExtractionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiSchema" TEXT,
    "lastWikiIngestAt" DATETIME,
    "stashWikiAutoGenEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stashWikiAutoGenInterval" INTEGER NOT NULL DEFAULT 120,
    "stashWikiSchema" TEXT,
    "courseAiPromptTemplate" TEXT,
    "timelineAiPromptTemplate" TEXT,
    "videoAiPromptTemplate" TEXT,
    "bookAiPromptTemplate" TEXT,
    "sharedEventDecisionPromptTemplate" TEXT,
    "lastStashWikiGenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("backgroundImageStoragePath", "bookAiPromptTemplate", "christmasFilterEnabled", "collectionName", "comicVineApiKey", "courseAiPromptTemplate", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastStashWikiGenAt", "lastWikiIngestAt", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaChatExtractionModel", "ollamaDatingExtractionModel", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaNotesExtractionModel", "ollamaUrl", "ollamaWikiExtractionModel", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "sharedEventDecisionPromptTemplate", "stashApiKey", "stashSyncInterval", "stashUrl", "stashWikiAutoGenEnabled", "stashWikiAutoGenInterval", "stashWikiSchema", "timelineAiPromptTemplate", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "videoAiPromptTemplate", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema") SELECT "backgroundImageStoragePath", "bookAiPromptTemplate", "christmasFilterEnabled", "collectionName", "comicVineApiKey", "courseAiPromptTemplate", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastStashWikiGenAt", "lastWikiIngestAt", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaChatExtractionModel", "ollamaDatingExtractionModel", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaNotesExtractionModel", "ollamaUrl", "ollamaWikiExtractionModel", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "sharedEventDecisionPromptTemplate", "stashApiKey", "stashSyncInterval", "stashUrl", "stashWikiAutoGenEnabled", "stashWikiAutoGenInterval", "stashWikiSchema", "timelineAiPromptTemplate", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "videoAiPromptTemplate", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_radarrId_key" ON "Movie"("radarrId");

-- CreateIndex
CREATE INDEX "Movie_tmdbId_idx" ON "Movie"("tmdbId");

-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Show_sonarrId_key" ON "Show"("sonarrId");

-- CreateIndex
CREATE INDEX "Show_tvdbId_idx" ON "Show"("tvdbId");

-- CreateIndex
CREATE INDEX "Show_title_idx" ON "Show"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Season_showId_seasonNumber_key" ON "Season"("showId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_sonarrEpisodeId_key" ON "Episode"("sonarrEpisodeId");

-- CreateIndex
CREATE INDEX "Episode_seasonId_episodeNumber_idx" ON "Episode"("seasonId", "episodeNumber");

-- CreateIndex
CREATE INDEX "LibrarySyncRunLog_createdAt_idx" ON "LibrarySyncRunLog"("createdAt");

-- CreateIndex
CREATE INDEX "LibrarySyncRunLog_provider_idx" ON "LibrarySyncRunLog"("provider");
