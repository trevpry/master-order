/*
  Warnings:

  - You are about to drop the column `art` on the `PlexPlaylist` table. All the data in the column will be lost.
  - You are about to drop the column `index` on the `PlexPlaylistItem` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlexPlaylist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'playlist',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "smart" BOOLEAN NOT NULL DEFAULT false,
    "playlistType" TEXT,
    "thumb" TEXT,
    "composite" TEXT,
    "duration" INTEGER,
    "leafCount" INTEGER,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexPlaylist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexPlaylist" ("addedAt", "duration", "guid", "id", "key", "leafCount", "librarySectionID", "playlistType", "ratingKey", "smart", "summary", "thumb", "title", "titleSort", "type", "updatedAt") SELECT "addedAt", "duration", "guid", "id", "key", "leafCount", "librarySectionID", "playlistType", "ratingKey", "smart", "summary", "thumb", "title", "titleSort", "type", "updatedAt" FROM "PlexPlaylist";
DROP TABLE "PlexPlaylist";
ALTER TABLE "new_PlexPlaylist" RENAME TO "PlexPlaylist";
CREATE UNIQUE INDEX "PlexPlaylist_ratingKey_key" ON "PlexPlaylist"("ratingKey");
CREATE TABLE "new_PlexPlaylistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistRatingKey" TEXT NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "duration" INTEGER,
    "addedAt" DATETIME,
    CONSTRAINT "PlexPlaylistItem_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlexPlaylistItem" ("addedAt", "id", "playlistRatingKey", "ratingKey", "type") SELECT "addedAt", "id", "playlistRatingKey", "ratingKey", "type" FROM "PlexPlaylistItem";
DROP TABLE "PlexPlaylistItem";
ALTER TABLE "new_PlexPlaylistItem" RENAME TO "PlexPlaylistItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
