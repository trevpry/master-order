/*
  Warnings:

  - You are about to drop the column `collections` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `genres` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `labels` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `sectionKey` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `studio` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `styles` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt_plex` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `PlexAlbum` table. All the data in the column will be lost.
  - You are about to alter the column `addedAt` on the `PlexAlbum` table. The data in that column could be lost. The data in that column will be cast from `Int` to `DateTime`.
  - You are about to alter the column `originallyAvailableAt` on the `PlexAlbum` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.
  - You are about to drop the column `collections` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `countries` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `genres` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `labels` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `sectionKey` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `styles` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt_plex` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `PlexArtist` table. All the data in the column will be lost.
  - You are about to alter the column `addedAt` on the `PlexArtist` table. The data in that column could be lost. The data in that column will be cast from `Int` to `DateTime`.
  - You are about to drop the column `createdAt` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `genres` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `originalTitle` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `originallyAvailableAt` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `sectionKey` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `skipCount` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt_plex` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `PlexTrack` table. All the data in the column will be lost.
  - You are about to alter the column `addedAt` on the `PlexTrack` table. The data in that column could be lost. The data in that column will be cast from `Int` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlexAlbum" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentRatingKey" TEXT,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'album',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "year" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "parentThumb" TEXT,
    "originallyAvailableAt" DATETIME,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexAlbum_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexAlbum" ("addedAt", "art", "guid", "id", "index", "key", "originallyAvailableAt", "parentRatingKey", "ratingKey", "summary", "thumb", "title", "updatedAt", "year") SELECT "addedAt", "art", "guid", "id", "index", "key", "originallyAvailableAt", "parentRatingKey", "ratingKey", "summary", "thumb", "title", "updatedAt", "year" FROM "PlexAlbum";
DROP TABLE "PlexAlbum";
ALTER TABLE "new_PlexAlbum" RENAME TO "PlexAlbum";
CREATE UNIQUE INDEX "PlexAlbum_ratingKey_key" ON "PlexAlbum"("ratingKey");
CREATE TABLE "new_PlexArtist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'artist',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexArtist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexArtist" ("addedAt", "art", "guid", "id", "index", "key", "ratingKey", "summary", "thumb", "title", "updatedAt") SELECT "addedAt", "art", "guid", "id", "index", "key", "ratingKey", "summary", "thumb", "title", "updatedAt" FROM "PlexArtist";
DROP TABLE "PlexArtist";
ALTER TABLE "new_PlexArtist" RENAME TO "PlexArtist";
CREATE UNIQUE INDEX "PlexArtist_ratingKey_key" ON "PlexArtist"("ratingKey");
CREATE TABLE "new_PlexTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentRatingKey" TEXT,
    "grandparentRatingKey" TEXT,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'track',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "duration" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "parentThumb" TEXT,
    "grandparentThumb" TEXT,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexTrack_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexTrack" ("addedAt", "art", "duration", "grandparentRatingKey", "guid", "id", "index", "key", "parentRatingKey", "ratingKey", "summary", "thumb", "title", "updatedAt") SELECT "addedAt", "art", "duration", "grandparentRatingKey", "guid", "id", "index", "key", "parentRatingKey", "ratingKey", "summary", "thumb", "title", "updatedAt" FROM "PlexTrack";
DROP TABLE "PlexTrack";
ALTER TABLE "new_PlexTrack" RENAME TO "PlexTrack";
CREATE UNIQUE INDEX "PlexTrack_ratingKey_key" ON "PlexTrack"("ratingKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
