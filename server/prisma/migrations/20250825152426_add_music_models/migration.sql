-- CreateTable
CREATE TABLE "PlexArtist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "index" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "countries" TEXT,
    "genres" TEXT,
    "styles" TEXT,
    "collections" TEXT,
    "labels" TEXT,
    "rating" REAL,
    "viewCount" INTEGER,
    "sectionKey" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexArtist_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexAlbum" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "index" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "year" INTEGER,
    "studio" TEXT,
    "genres" TEXT,
    "styles" TEXT,
    "collections" TEXT,
    "labels" TEXT,
    "rating" REAL,
    "viewCount" INTEGER,
    "sectionKey" TEXT NOT NULL,
    "parentRatingKey" TEXT NOT NULL,
    "originallyAvailableAt" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexAlbum_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "index" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "duration" INTEGER,
    "year" INTEGER,
    "originalTitle" TEXT,
    "genres" TEXT,
    "rating" REAL,
    "viewCount" INTEGER,
    "skipCount" INTEGER,
    "sectionKey" TEXT NOT NULL,
    "parentRatingKey" TEXT NOT NULL,
    "grandparentRatingKey" TEXT NOT NULL,
    "originallyAvailableAt" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexTrack_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_grandparentRatingKey_fkey" FOREIGN KEY ("grandparentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexArtist_ratingKey_key" ON "PlexArtist"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexAlbum_ratingKey_key" ON "PlexAlbum"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexTrack_ratingKey_key" ON "PlexTrack"("ratingKey");
