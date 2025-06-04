-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customOrderId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "plexKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "seriesTitle" TEXT,
    "comicSeries" TEXT,
    "comicYear" INTEGER,
    "comicIssue" TEXT,
    "comicVolume" TEXT,
    "bookTitle" TEXT,
    "bookAuthor" TEXT,
    "bookYear" INTEGER,
    "bookIsbn" TEXT,
    "bookPublisher" TEXT,
    "bookOpenLibraryId" TEXT,
    "bookCoverUrl" TEXT,
    "storyTitle" TEXT,
    "storyAuthor" TEXT,
    "storyYear" INTEGER,
    "storyUrl" TEXT,
    "storyContainedInBookId" INTEGER,
    "storyCoverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_storyContainedInBookId_fkey" FOREIGN KEY ("storyContainedInBookId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrderItem" ("bookAuthor", "bookCoverUrl", "bookIsbn", "bookOpenLibraryId", "bookPublisher", "bookTitle", "bookYear", "comicIssue", "comicSeries", "comicVolume", "comicYear", "createdAt", "customOrderId", "episodeNumber", "id", "isWatched", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "sortOrder", "title", "updatedAt") SELECT "bookAuthor", "bookCoverUrl", "bookIsbn", "bookOpenLibraryId", "bookPublisher", "bookTitle", "bookYear", "comicIssue", "comicSeries", "comicVolume", "comicYear", "createdAt", "customOrderId", "episodeNumber", "id", "isWatched", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "sortOrder", "title", "updatedAt" FROM "CustomOrderItem";
DROP TABLE "CustomOrderItem";
ALTER TABLE "new_CustomOrderItem" RENAME TO "CustomOrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
