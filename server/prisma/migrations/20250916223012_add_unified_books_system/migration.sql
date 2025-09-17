-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "publishYear" INTEGER,
    "description" TEXT,
    "coverUrl" TEXT,
    "pageCount" INTEGER,
    "openLibraryId" TEXT,
    "komgaBookId" TEXT,
    "komgaSeriesId" TEXT,
    "komgaUrl" TEXT,
    "komgaMetadata" TEXT,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BookChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapterId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookSection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "currentPage" INTEGER,
    "percentRead" REAL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCompletion_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChapterCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapterId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChapterCompletion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionCompletion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BookSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryBookLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryBookLink_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryBookLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
INSERT INTO "new_CustomOrderItem" ("artworkLastCached", "artworkMimeType", "bookAuthor", "bookCoverUrl", "bookCurrentPage", "bookIsbn", "bookOpenLibraryId", "bookPageCount", "bookPercentRead", "bookPublisher", "bookTitle", "bookYear", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl") SELECT "artworkLastCached", "artworkMimeType", "bookAuthor", "bookCoverUrl", "bookCurrentPage", "bookIsbn", "bookOpenLibraryId", "bookPageCount", "bookPercentRead", "bookPublisher", "bookTitle", "bookYear", "comicCharacters", "comicCoverDate", "comicCreators", "comicDescription", "comicIssue", "comicIssueName", "comicPublisher", "comicSeries", "comicStoreDate", "comicStoryArcs", "comicVineDetailsJson", "comicVineId", "comicVineIssueId", "comicVineSeriesId", "comicVolume", "comicYear", "createdAt", "customOrderId", "customTitle", "episodeNumber", "id", "isFromTvdbOnly", "isWatched", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaSeriesUrl", "komgaUrl", "localArtworkPath", "mediaType", "originalArtworkUrl", "plexKey", "referencedCustomOrderId", "seasonNumber", "seriesTitle", "sortOrder", "storyAuthor", "storyContainedInBookId", "storyCoverUrl", "storyTitle", "storyUrl", "storyYear", "title", "tvdbArtworkUrl", "tvdbDirector", "tvdbGenres", "tvdbId", "tvdbOverview", "tvdbStudio", "tvdbYear", "updatedAt", "webDescription", "webTitle", "webUrl" FROM "CustomOrderItem";
DROP TABLE "CustomOrderItem";
ALTER TABLE "new_CustomOrderItem" RENAME TO "CustomOrderItem";
CREATE TABLE "new_WatchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaType" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'watch',
    "title" TEXT NOT NULL,
    "seriesTitle" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "plexKey" TEXT,
    "customOrderItemId" INTEGER,
    "bookId" INTEGER,
    "chapterId" INTEGER,
    "sectionId" INTEGER,
    "currentPage" INTEGER,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "totalWatchTime" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchLog_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WatchLog_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WatchLog" ("activityType", "createdAt", "customOrderItemId", "duration", "endTime", "episodeNumber", "id", "isCompleted", "isPaused", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "startTime", "title", "totalWatchTime", "updatedAt") SELECT "activityType", "createdAt", "customOrderItemId", "duration", "endTime", "episodeNumber", "id", "isCompleted", "isPaused", "mediaType", "plexKey", "seasonNumber", "seriesTitle", "startTime", "title", "totalWatchTime", "updatedAt" FROM "WatchLog";
DROP TABLE "WatchLog";
ALTER TABLE "new_WatchLog" RENAME TO "WatchLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "Book_openLibraryId_key" ON "Book"("openLibraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_komgaBookId_key" ON "Book"("komgaBookId");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_openLibraryId_idx" ON "Book"("openLibraryId");

-- CreateIndex
CREATE INDEX "Book_komgaBookId_idx" ON "Book"("komgaBookId");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "BookChapter_bookId_idx" ON "BookChapter"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookChapter_bookId_chapterNumber_key" ON "BookChapter"("bookId", "chapterNumber");

-- CreateIndex
CREATE INDEX "BookSection_chapterId_idx" ON "BookSection"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSection_chapterId_sectionNumber_key" ON "BookSection"("chapterId", "sectionNumber");

-- CreateIndex
CREATE INDEX "BookCompletion_bookId_idx" ON "BookCompletion"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCompletion_bookId_userId_key" ON "BookCompletion"("bookId", "userId");

-- CreateIndex
CREATE INDEX "ChapterCompletion_chapterId_idx" ON "ChapterCompletion"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCompletion_chapterId_userId_key" ON "ChapterCompletion"("chapterId", "userId");

-- CreateIndex
CREATE INDEX "SectionCompletion_sectionId_idx" ON "SectionCompletion"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCompletion_sectionId_userId_key" ON "SectionCompletion"("sectionId", "userId");

-- CreateIndex
CREATE INDEX "HistoryBookLink_bookId_idx" ON "HistoryBookLink"("bookId");

-- CreateIndex
CREATE INDEX "HistoryBookLink_eventId_idx" ON "HistoryBookLink"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryBookLink_bookId_eventId_key" ON "HistoryBookLink"("bookId", "eventId");
