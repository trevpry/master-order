-- CreateTable
CREATE TABLE "AlbumArtwork" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "albumKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "source" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlbumArtwork_albumKey_fkey" FOREIGN KEY ("albumKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AlbumArtwork_albumKey_type_key" ON "AlbumArtwork"("albumKey", "type");
