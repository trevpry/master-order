/*
  Warnings:

  - You are about to drop the column `bookAuthor` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookCoverUrl` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookCurrentPage` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookIsbn` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookOpenLibraryId` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookPageCount` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookPercentRead` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookPublisher` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookTitle` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bookYear` on the `CustomOrderItem` table. All the data in the column will be lost.

*/
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
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_referencedCustomOrderId_fkey" FOREIGN KEY ("referencedCustomOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_storyContainedInBookId_fkey" FOREIGN KEY ("storyContainedInBookId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrderItem" ("artworkLastCached", "artworkMimeType", "bookId", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl") SELECT "artworkLastCached", "artworkMimeType", "bookId", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl" FROM "CustomOrderItem";
DROP TABLE "CustomOrderItem";
ALTER TABLE "new_CustomOrderItem" RENAME TO "CustomOrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
