-- CreateTable
CREATE TABLE "WikiPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'concept',
    "category" TEXT NOT NULL DEFAULT 'general',
    "inboundLinks" TEXT NOT NULL DEFAULT '[]',
    "outboundLinks" TEXT NOT NULL DEFAULT '[]',
    "sourceNoteIds" TEXT NOT NULL DEFAULT '[]',
    "sourceChatIds" TEXT NOT NULL DEFAULT '[]',
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WikiLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'note',
    "sourceId" INTEGER,
    "affectedPages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "embedding" TEXT,
    "wikiExtracted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("content", "conversationId", "createdAt", "embedding", "id", "model", "role") SELECT "content", "conversationId", "createdAt", "embedding", "id", "model", "role" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX "ChatMessage_wikiExtracted_idx" ON "ChatMessage"("wikiExtracted");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaUrl", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt") SELECT "christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "listScrapeInterval", "mediaTypeLimiters", "moviesGeneralPercent", "ollamaDefaultModel", "ollamaEmbeddingModel", "ollamaUrl", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "preferLongUnwatched", "preferNewRelease", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_slug_key" ON "WikiPage"("slug");

-- CreateIndex
CREATE INDEX "WikiPage_type_idx" ON "WikiPage"("type");

-- CreateIndex
CREATE INDEX "WikiPage_category_idx" ON "WikiPage"("category");

-- CreateIndex
CREATE INDEX "WikiPage_updatedAt_idx" ON "WikiPage"("updatedAt");

-- CreateIndex
CREATE INDEX "WikiLog_action_idx" ON "WikiLog"("action");

-- CreateIndex
CREATE INDEX "WikiLog_sourceType_idx" ON "WikiLog"("sourceType");

-- CreateIndex
CREATE INDEX "WikiLog_createdAt_idx" ON "WikiLog"("createdAt");
