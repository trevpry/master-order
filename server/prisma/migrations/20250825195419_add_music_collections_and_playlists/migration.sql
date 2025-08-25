-- AlterTable
ALTER TABLE "PlexAlbum" ADD COLUMN "collections" TEXT;

-- AlterTable
ALTER TABLE "PlexArtist" ADD COLUMN "collections" TEXT;

-- CreateTable
CREATE TABLE "PlexPlaylist" (
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
    "art" TEXT,
    "duration" INTEGER,
    "leafCount" INTEGER,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexPlaylist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexPlaylistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistRatingKey" TEXT NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlexPlaylistItem_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlexPlaylistItem_ratingKey_fkey" FOREIGN KEY ("ratingKey") REFERENCES "PlexTrack" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlexPlaylistItem_ratingKey_fkey" FOREIGN KEY ("ratingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexPlaylist_ratingKey_key" ON "PlexPlaylist"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexPlaylistItem_playlistRatingKey_ratingKey_key" ON "PlexPlaylistItem"("playlistRatingKey", "ratingKey");
