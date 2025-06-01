-- CreateTable
CREATE TABLE "PlexLibrarySection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlexTVShow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "art" TEXT,
    "leafCount" INTEGER,
    "viewedLeafCount" INTEGER,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "collections" TEXT,
    "sectionKey" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexTVShow_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexSeason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "showRatingKey" TEXT NOT NULL,
    "leafCount" INTEGER,
    "viewedLeafCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexSeason_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexEpisode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "seasonIndex" INTEGER NOT NULL,
    "showTitle" TEXT NOT NULL,
    "seasonRatingKey" TEXT NOT NULL,
    "viewCount" INTEGER,
    "lastViewedAt" INTEGER,
    "addedAt" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexEpisode_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexMovie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "art" TEXT,
    "viewCount" INTEGER,
    "lastViewedAt" INTEGER,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "collections" TEXT,
    "sectionKey" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexMovie_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexLibrarySection_sectionKey_key" ON "PlexLibrarySection"("sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexTVShow_ratingKey_key" ON "PlexTVShow"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexSeason_ratingKey_key" ON "PlexSeason"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexEpisode_ratingKey_key" ON "PlexEpisode"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexMovie_ratingKey_key" ON "PlexMovie"("ratingKey");
