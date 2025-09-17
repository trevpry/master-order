-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "BookChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookChapter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookChapter" ("bookId", "chapterNumber", "createdAt", "description", "id", "pageEnd", "pageStart", "title", "updatedAt") SELECT "bookId", "chapterNumber", "createdAt", "description", "id", "pageEnd", "pageStart", "title", "updatedAt" FROM "BookChapter";
DROP TABLE "BookChapter";
ALTER TABLE "new_BookChapter" RENAME TO "BookChapter";
CREATE INDEX "BookChapter_bookId_idx" ON "BookChapter"("bookId");
CREATE INDEX "BookChapter_eventId_idx" ON "BookChapter"("eventId");
CREATE UNIQUE INDEX "BookChapter_bookId_chapterNumber_key" ON "BookChapter"("bookId", "chapterNumber");
CREATE TABLE "new_BookSection" (
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
    "eventId" INTEGER,
    CONSTRAINT "BookSection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookSection" ("chapterId", "content", "createdAt", "description", "id", "pageEnd", "pageStart", "sectionNumber", "title", "updatedAt") SELECT "chapterId", "content", "createdAt", "description", "id", "pageEnd", "pageStart", "sectionNumber", "title", "updatedAt" FROM "BookSection";
DROP TABLE "BookSection";
ALTER TABLE "new_BookSection" RENAME TO "BookSection";
CREATE INDEX "BookSection_chapterId_idx" ON "BookSection"("chapterId");
CREATE INDEX "BookSection_eventId_idx" ON "BookSection"("eventId");
CREATE UNIQUE INDEX "BookSection_chapterId_sectionNumber_key" ON "BookSection"("chapterId", "sectionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
