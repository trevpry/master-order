-- CreateTable
CREATE TABLE "HistoricalEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "details" TEXT,
    "category" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryVideo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "courseTitle" TEXT,
    "lectureNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    "channelId" INTEGER,
    "assignLater" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    CONSTRAINT "HistoryVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "HistoryChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HistoryVideo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "channelUrl" TEXT NOT NULL,
    "description" TEXT,
    "subscriberCount" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryBook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "publishYear" INTEGER,
    "description" TEXT,
    "coverUrl" TEXT,
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistoryBook_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bookId" INTEGER NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistoryChapter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "HistoryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistorySection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistorySection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistorySection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "HistoryChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER,
    "eventId" INTEGER NOT NULL,
    CONSTRAINT "ReadingList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "HistoryCourse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "instructor" TEXT,
    "thumbnail" TEXT,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryCourseVideo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "courseId" INTEGER NOT NULL,
    CONSTRAINT "HistoryCourseVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "HistoryCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_event_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_event_reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_video_watches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" INTEGER NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_video_watches_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "HistoryVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_book_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_book_reads_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "HistoryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_chapter_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_chapter_reads_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "HistoryChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_section_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_section_reads_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HistorySection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoryVideo_url_key" ON "HistoryVideo"("url");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryChannel_channelUrl_key" ON "HistoryChannel"("channelUrl");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryChapter_bookId_chapterNumber_key" ON "HistoryChapter"("bookId", "chapterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HistorySection_chapterId_sectionNumber_key" ON "HistorySection"("chapterId", "sectionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCategory_name_key" ON "HistoryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCourse_url_key" ON "HistoryCourse"("url");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCourseVideo_url_key" ON "HistoryCourseVideo"("url");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_reviews_eventId_key" ON "user_event_reviews"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "user_video_watches_videoId_key" ON "user_video_watches"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "user_book_reads_bookId_key" ON "user_book_reads"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_reads_chapterId_key" ON "user_chapter_reads"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_section_reads_sectionId_key" ON "user_section_reads"("sectionId");
