-- CreateTable
CREATE TABLE "VideoGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "developer" TEXT,
    "publisher" TEXT,
    "releaseDate" DATETIME,
    "description" TEXT,
    "platforms" TEXT,
    "genres" TEXT,
    "rating" REAL,
    "metacriticRating" INTEGER,
    "rawgId" INTEGER,
    "rawgSlug" TEXT,
    "rawgUrl" TEXT,
    "coverUrl" TEXT,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "esrbRating" TEXT,
    "playtimeHours" INTEGER,
    "website" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "hoursPlayed" REAL,
    "percentComplete" REAL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameCompletion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "VideoGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customOrderId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "plexKey" TEXT,
    "title" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "seriesTitle" TEXT,
    "comicSeries" TEXT,
    "comicYear" INTEGER,
    "comicIssue" TEXT,
    "comicVolume" TEXT,
    "comicPublisher" TEXT,
    "comicVineId" TEXT,
    "comicVineDetailsJson" TEXT,
    "comicVineSeriesId" INTEGER,
    "comicVineIssueId" INTEGER,
    "comicIssueName" TEXT,
    "comicDescription" TEXT,
    "comicCoverDate" TEXT,
    "comicStoreDate" TEXT,
    "comicCreators" TEXT,
    "comicCharacters" TEXT,
    "comicStoryArcs" TEXT,
    "comicPercentRead" REAL,
    "comicCurrentPage" INTEGER,
    "comicPageCount" INTEGER,
    "customTitle" TEXT,
    "storyTitle" TEXT,
    "storyAuthor" TEXT,
    "storyYear" INTEGER,
    "storyUrl" TEXT,
    "storyContainedInBookId" INTEGER,
    "storyCoverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "isFromTvdbOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "webTitle" TEXT,
    "webUrl" TEXT,
    "webDescription" TEXT,
    "tvdbId" TEXT,
    "tvdbYear" INTEGER,
    "tvdbOverview" TEXT,
    "tvdbGenres" TEXT,
    "tvdbDirector" TEXT,
    "tvdbStudio" TEXT,
    "tvdbArtworkUrl" TEXT,
    "referencedCustomOrderId" INTEGER,
    "komgaBookId" TEXT,
    "komgaMetadata" TEXT,
    "komgaSeriesId" TEXT,
    "komgaSeriesUrl" TEXT,
    "komgaUrl" TEXT,
    "bookId" INTEGER,
    "gameId" INTEGER,
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_referencedCustomOrderId_fkey" FOREIGN KEY ("referencedCustomOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_storyContainedInBookId_fkey" FOREIGN KEY ("storyContainedInBookId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "VideoGame" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrderItem" ("artworkLastCached", "artworkMimeType", "bookId", "comicCharacters", "comicCoverDate", "comicCreators", "comicCurrentPage", "comicDescription", "comicIssue", "comicIssueName", "comicPageCount", "comicPercentRead", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl") SELECT "artworkLastCached", "artworkMimeType", "bookId", "comicCharacters", "comicCoverDate", "comicCreators", "comicCurrentPage", "comicDescription", "comicIssue", "comicIssueName", "comicPageCount", "comicPercentRead", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl" FROM "CustomOrderItem";
DROP TABLE "CustomOrderItem";
ALTER TABLE "new_CustomOrderItem" RENAME TO "CustomOrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VideoGame_rawgId_key" ON "VideoGame"("rawgId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGame_rawgSlug_key" ON "VideoGame"("rawgSlug");

-- CreateIndex
CREATE INDEX "VideoGame_rawgId_idx" ON "VideoGame"("rawgId");

-- CreateIndex
CREATE INDEX "VideoGame_rawgSlug_idx" ON "VideoGame"("rawgSlug");

-- CreateIndex
CREATE INDEX "VideoGame_title_idx" ON "VideoGame"("title");

-- CreateIndex
CREATE INDEX "VideoGame_platforms_idx" ON "VideoGame"("platforms");

-- CreateIndex
CREATE INDEX "VideoGame_genres_idx" ON "VideoGame"("genres");

-- CreateIndex
CREATE INDEX "GameCompletion_gameId_idx" ON "GameCompletion"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameCompletion_gameId_userId_key" ON "GameCompletion"("gameId", "userId");
