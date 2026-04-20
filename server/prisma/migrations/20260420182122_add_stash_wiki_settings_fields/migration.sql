-- CreateTable
CREATE TABLE "StashPerformerWikiPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "performerId" TEXT,
    "relatedPerformerIds" TEXT NOT NULL DEFAULT '[]',
    "inboundLinks" TEXT NOT NULL DEFAULT '[]',
    "outboundLinks" TEXT NOT NULL DEFAULT '[]',
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StashPerformerWikiLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'performer',
    "sourceId" TEXT,
    "affectedPages" TEXT NOT NULL DEFAULT '[]',
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
    "komgaUrl" TEXT,
    "komgaApiKey" TEXT,
    "stashUrl" TEXT,
    "stashApiKey" TEXT,
    "rawgApiKey" TEXT,
    "geminiApiKey" TEXT,
    "listScrapeInterval" INTEGER NOT NULL DEFAULT 6,
    "mediaTypeLimiters" TEXT,
    "preferNewRelease" INTEGER NOT NULL DEFAULT 0,
    "preferLongUnwatched" INTEGER NOT NULL DEFAULT 0,
    "ollamaUrl" TEXT,
    "ollamaDefaultModel" TEXT,
    "ollamaEmbeddingModel" TEXT,
    "wikiContextEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiAutoIngestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiAutoIngestInterval" INTEGER NOT NULL DEFAULT 60,
    "wikiChatExtractionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wikiSchema" TEXT,
    "lastWikiIngestAt" DATETIME,
    "stashWikiAutoGenEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stashWikiAutoGenInterval" INTEGER NOT NULL DEFAULT 120,
    "stashWikiSchema" TEXT,
    "lastStashWikiGenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastWikiIngestAt", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaUrl", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema") SELECT "christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "lastWikiIngestAt", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaUrl", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt", "wikiAutoIngestEnabled", "wikiAutoIngestInterval", "wikiChatExtractionEnabled", "wikiContextEnabled", "wikiSchema" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StashPerformerWikiPage_slug_key" ON "StashPerformerWikiPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StashPerformerWikiPage_performerId_key" ON "StashPerformerWikiPage"("performerId");

-- CreateIndex
CREATE INDEX "StashPerformerWikiPage_performerId_idx" ON "StashPerformerWikiPage"("performerId");

-- CreateIndex
CREATE INDEX "StashPerformerWikiPage_updatedAt_idx" ON "StashPerformerWikiPage"("updatedAt");

-- CreateIndex
CREATE INDEX "StashPerformerWikiLog_action_idx" ON "StashPerformerWikiLog"("action");

-- CreateIndex
CREATE INDEX "StashPerformerWikiLog_sourceType_idx" ON "StashPerformerWikiLog"("sourceType");

-- CreateIndex
CREATE INDEX "StashPerformerWikiLog_createdAt_idx" ON "StashPerformerWikiLog"("createdAt");
