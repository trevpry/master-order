/*
  Warnings:

  - You are about to drop the `StashPerformer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashPerformerTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashScene` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashScenePerformer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashSceneTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashStudio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StashTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `komgaBookId` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `komgaMetadata` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `komgaSeriesId` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `komgaSeriesUrl` on the `CustomOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `komgaUrl` on the `CustomOrderItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "StashStudio_name_key";

-- DropIndex
DROP INDEX "StashTag_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashPerformer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashPerformerTag";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashScene";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashScenePerformer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashSceneTag";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashStudio";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StashTag";
PRAGMA foreign_keys=on;

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
    "customTitle" TEXT,
    "bookTitle" TEXT,
    "bookAuthor" TEXT,
    "bookYear" INTEGER,
    "bookIsbn" TEXT,
    "bookPublisher" TEXT,
    "bookOpenLibraryId" TEXT,
    "bookCoverUrl" TEXT,
    "bookPageCount" INTEGER,
    "bookCurrentPage" INTEGER,
    "bookPercentRead" REAL,
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
    CONSTRAINT "CustomOrderItem_storyContainedInBookId_fkey" FOREIGN KEY ("storyContainedInBookId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_referencedCustomOrderId_fkey" FOREIGN KEY ("referencedCustomOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrderItem" ("artworkLastCached", "artworkMimeType", "bookAuthor", "bookCoverUrl", "bookCurrentPage", "bookIsbn", "bookOpenLibraryId", "bookPageCount", "bookPercentRead", "bookPublisher", "bookTitle", "bookYear", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl") SELECT "artworkLastCached", "artworkMimeType", "bookAuthor", "bookCoverUrl", "bookCurrentPage", "bookIsbn", "bookOpenLibraryId", "bookPageCount", "bookPercentRead", "bookPublisher", "bookTitle", "bookYear", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl" FROM "CustomOrderItem";
DROP TABLE "CustomOrderItem";
ALTER TABLE "new_CustomOrderItem" RENAME TO "CustomOrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
