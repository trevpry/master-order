-- CreateTable
CREATE TABLE "AlbumArtist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "albumKey" TEXT NOT NULL,
    "artistKey" TEXT NOT NULL,
    "artistTypeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlbumArtist_albumKey_fkey" FOREIGN KEY ("albumKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumArtist_artistKey_fkey" FOREIGN KEY ("artistKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumArtist_artistTypeId_fkey" FOREIGN KEY ("artistTypeId") REFERENCES "ArtistType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AlbumArtist_albumKey_artistKey_artistTypeId_key" ON "AlbumArtist"("albumKey", "artistKey", "artistTypeId");
