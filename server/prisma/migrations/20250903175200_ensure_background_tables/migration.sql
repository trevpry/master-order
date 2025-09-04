-- CreateTable
CREATE TABLE "BackgroundImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "networkPath" TEXT,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "downloadUrl" TEXT,
    "tags" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackgroundGallery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackgroundGalleryImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "galleryId" INTEGER NOT NULL,
    "imageId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackgroundGalleryImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "BackgroundGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BackgroundGalleryImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "BackgroundImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "icon" TEXT,
    "parentOrderId" INTEGER,
    "playlistRatingKey" TEXT,
    "customPlaylistId" INTEGER,
    "backgroundImageId" INTEGER,
    "backgroundGalleryId" INTEGER,
    CONSTRAINT "CustomOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_customPlaylistId_fkey" FOREIGN KEY ("customPlaylistId") REFERENCES "CustomPlaylist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_backgroundImageId_fkey" FOREIGN KEY ("backgroundImageId") REFERENCES "BackgroundImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_backgroundGalleryId_fkey" FOREIGN KEY ("backgroundGalleryId") REFERENCES "BackgroundGallery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrder" ("createdAt", "customPlaylistId", "description", "icon", "id", "isActive", "name", "parentOrderId", "playlistRatingKey", "updatedAt") SELECT "createdAt", "customPlaylistId", "description", "icon", "id", "isActive", "name", "parentOrderId", "playlistRatingKey", "updatedAt" FROM "CustomOrder";
DROP TABLE "CustomOrder";
ALTER TABLE "new_CustomOrder" RENAME TO "CustomOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BackgroundImage_filename_idx" ON "BackgroundImage"("filename");

-- CreateIndex
CREATE INDEX "BackgroundImage_createdAt_idx" ON "BackgroundImage"("createdAt");

-- CreateIndex
CREATE INDEX "BackgroundImage_isActive_idx" ON "BackgroundImage"("isActive");

-- CreateIndex
CREATE INDEX "BackgroundGallery_name_idx" ON "BackgroundGallery"("name");

-- CreateIndex
CREATE INDEX "BackgroundGallery_createdAt_idx" ON "BackgroundGallery"("createdAt");

-- CreateIndex
CREATE INDEX "BackgroundGallery_isActive_idx" ON "BackgroundGallery"("isActive");

-- CreateIndex
CREATE INDEX "BackgroundGalleryImage_galleryId_idx" ON "BackgroundGalleryImage"("galleryId");

-- CreateIndex
CREATE INDEX "BackgroundGalleryImage_imageId_idx" ON "BackgroundGalleryImage"("imageId");

-- CreateIndex
CREATE INDEX "BackgroundGalleryImage_order_idx" ON "BackgroundGalleryImage"("order");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundGalleryImage_galleryId_imageId_key" ON "BackgroundGalleryImage"("galleryId", "imageId");
