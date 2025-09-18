-- AlterTable
ALTER TABLE "BookChapter" ADD COLUMN "originalHistoryChapterId" INTEGER;

-- AlterTable
ALTER TABLE "BookSection" ADD COLUMN "originalHistorySectionId" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
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
    "isHistoryPlusBook" BOOLEAN NOT NULL DEFAULT false,
    "originalHistoryBookId" INTEGER,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Book" ("artworkLastCached", "artworkMimeType", "author", "coverUrl", "createdAt", "description", "id", "isbn", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaUrl", "localArtworkPath", "openLibraryId", "originalArtworkUrl", "pageCount", "publishYear", "publisher", "title", "updatedAt") SELECT "artworkLastCached", "artworkMimeType", "author", "coverUrl", "createdAt", "description", "id", "isbn", "komgaBookId", "komgaMetadata", "komgaSeriesId", "komgaUrl", "localArtworkPath", "openLibraryId", "originalArtworkUrl", "pageCount", "publishYear", "publisher", "title", "updatedAt" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");
CREATE UNIQUE INDEX "Book_openLibraryId_key" ON "Book"("openLibraryId");
CREATE UNIQUE INDEX "Book_komgaBookId_key" ON "Book"("komgaBookId");
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");
CREATE INDEX "Book_openLibraryId_idx" ON "Book"("openLibraryId");
CREATE INDEX "Book_isHistoryPlusBook_idx" ON "Book"("isHistoryPlusBook");
CREATE INDEX "Book_originalHistoryBookId_idx" ON "Book"("originalHistoryBookId");
CREATE INDEX "Book_komgaBookId_idx" ON "Book"("komgaBookId");
CREATE INDEX "Book_title_idx" ON "Book"("title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BookChapter_originalHistoryChapterId_idx" ON "BookChapter"("originalHistoryChapterId");

-- CreateIndex
CREATE INDEX "BookSection_originalHistorySectionId_idx" ON "BookSection"("originalHistorySectionId");
