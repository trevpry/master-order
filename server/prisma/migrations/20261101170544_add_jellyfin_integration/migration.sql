-- CreateTable
CREATE TABLE "MediaCollection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jellyfinId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortName" TEXT,
    "overview" TEXT,
    "thumb" TEXT,
    "childCount" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaCollectionItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "childCollectionId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MediaCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaCollectionItem_childCollectionId_fkey" FOREIGN KEY ("childCollectionId") REFERENCES "MediaCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlexSyncRunLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL DEFAULT 'plex',
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
INSERT INTO "new_PlexSyncRunLog" ("cleanupAlbums", "cleanupArtists", "cleanupComplexFields", "cleanupEpisodes", "cleanupMovies", "cleanupPlaylists", "cleanupSeasons", "cleanupShows", "cleanupTracks", "completedAt", "createdAt", "durationSeconds", "error", "id", "sections", "startedAt", "success", "summary", "totalArtists", "totalMovies", "totalShows", "trigger") SELECT "cleanupAlbums", "cleanupArtists", "cleanupComplexFields", "cleanupEpisodes", "cleanupMovies", "cleanupPlaylists", "cleanupSeasons", "cleanupShows", "cleanupTracks", "completedAt", "createdAt", "durationSeconds", "error", "id", "sections", "startedAt", "success", "summary", "totalArtists", "totalMovies", "totalShows", "trigger" FROM "PlexSyncRunLog";
DROP TABLE "PlexSyncRunLog";
ALTER TABLE "new_PlexSyncRunLog" RENAME TO "PlexSyncRunLog";
CREATE INDEX "PlexSyncRunLog_createdAt_idx" ON "PlexSyncRunLog"("createdAt");
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
    "ignoredCollections" TEXT,
    "jellyfinUrl" TEXT,
    "jellyfinApiKey" TEXT,
    "jellyfinUserId" TEXT,
    "jellyfinSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "christmasFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "plexSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "stashSyncInterval" INTEGER NOT NULL DEFAULT 24,
    "libraryProvider" TEXT NOT NULL DEFAULT 'jellyfin',
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
    "filenameParserSpaceSeparators" TEXT,
    "filenameParserPerformerSeparators" TEXT,
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
INSERT INTO "new_Settings" ("backgroundImageStoragePath", "bookAiPromptTemplate", "christmasFilterEnabled", "collectionName", "comicVineApiKey", "courseAiPromptTemplate", "createdAt", "customOrderPercent", "filenameParserPerformerSeparators", "filenameParserSpaceSeparators", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastStashWikiGenAt", "lastWikiIngestAt", "libraryProvider", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaChatExtractionModel", "ollamaDatingExtractionModel", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaNotesExtractionModel", "ollamaUrl", "ollamaWikiExtractionModel", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "radarrApiKey", "radarrSyncInterval", "radarrUrl", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "sharedEventDecisionPromptTemplate", "sonarrApiKey", "sonarrSyncInterval", "sonarrUrl", "stashApiKey", "stashSyncInterval", "stashUrl", "stashWikiAutoGenEnabled", "stashWikiAutoGenInterval", "stashWikiSchema", "timelineAiPromptTemplate", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "videoAiPromptTemplate", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema") SELECT "backgroundImageStoragePath", "bookAiPromptTemplate", "christmasFilterEnabled", "collectionName", "comicVineApiKey", "courseAiPromptTemplate", "createdAt", "customOrderPercent", "filenameParserPerformerSeparators", "filenameParserSpaceSeparators", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastStashWikiGenAt", "lastWikiIngestAt", "libraryProvider", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaChatExtractionModel", "ollamaDatingExtractionModel", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaNotesExtractionModel", "ollamaUrl", "ollamaWikiExtractionModel", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "radarrApiKey", "radarrSyncInterval", "radarrUrl", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "sharedEventDecisionPromptTemplate", "sonarrApiKey", "sonarrSyncInterval", "sonarrUrl", "stashApiKey", "stashSyncInterval", "stashUrl", "stashWikiAutoGenEnabled", "stashWikiAutoGenInterval", "stashWikiSchema", "timelineAiPromptTemplate", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "videoAiPromptTemplate", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MediaCollection_jellyfinId_key" ON "MediaCollection"("jellyfinId");

-- CreateIndex
CREATE INDEX "MediaCollection_name_idx" ON "MediaCollection"("name");

-- CreateIndex
CREATE INDEX "MediaCollectionItem_itemKey_idx" ON "MediaCollectionItem"("itemKey");

-- CreateIndex
CREATE INDEX "MediaCollectionItem_childCollectionId_idx" ON "MediaCollectionItem"("childCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaCollectionItem_collectionId_itemKey_key" ON "MediaCollectionItem"("collectionId", "itemKey");
