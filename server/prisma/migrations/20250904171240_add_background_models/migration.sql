/*
  Warnings:

  - You are about to drop the `BackgroundGalleryImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `isActive` on the `BackgroundGallery` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `downloadUrl` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `networkPath` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `BackgroundImage` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundGalleryId` on the `CustomOrder` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundImageId` on the `CustomOrder` table. All the data in the column will be lost.
  - Added the required column `path` to the `BackgroundImage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BackgroundGalleryImage_galleryId_imageId_key";

-- DropIndex
DROP INDEX "BackgroundGalleryImage_order_idx";

-- DropIndex
DROP INDEX "BackgroundGalleryImage_imageId_idx";

-- DropIndex
DROP INDEX "BackgroundGalleryImage_galleryId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BackgroundGalleryImage";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BackgroundGallery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BackgroundGallery" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "BackgroundGallery";
DROP TABLE "BackgroundGallery";
ALTER TABLE "new_BackgroundGallery" RENAME TO "BackgroundGallery";
CREATE TABLE "new_BackgroundImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT,
    "path" TEXT NOT NULL,
    "url" TEXT,
    "size" INTEGER,
    "mimetype" TEXT,
    "galleryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BackgroundImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "BackgroundGallery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BackgroundImage" ("createdAt", "filename", "id", "originalName", "updatedAt") SELECT "createdAt", "filename", "id", "originalName", "updatedAt" FROM "BackgroundImage";
DROP TABLE "BackgroundImage";
ALTER TABLE "new_BackgroundImage" RENAME TO "BackgroundImage";
CREATE INDEX "BackgroundImage_galleryId_idx" ON "BackgroundImage"("galleryId");
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
    CONSTRAINT "CustomOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_customPlaylistId_fkey" FOREIGN KEY ("customPlaylistId") REFERENCES "CustomPlaylist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrder" ("createdAt", "customPlaylistId", "description", "icon", "id", "isActive", "name", "parentOrderId", "playlistRatingKey", "updatedAt") SELECT "createdAt", "customPlaylistId", "description", "icon", "id", "isActive", "name", "parentOrderId", "playlistRatingKey", "updatedAt" FROM "CustomOrder";
DROP TABLE "CustomOrder";
ALTER TABLE "new_CustomOrder" RENAME TO "CustomOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
