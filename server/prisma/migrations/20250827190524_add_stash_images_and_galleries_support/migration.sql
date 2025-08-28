-- CreateTable
CREATE TABLE "StashGallery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "code" TEXT,
    "date" TEXT,
    "details" TEXT,
    "photographer" TEXT,
    "url" TEXT,
    "rating" INTEGER,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "studio" TEXT,
    "studioId" TEXT,
    "path" TEXT,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashGallery_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "galleryId" TEXT,
    "title" TEXT,
    "code" TEXT,
    "date" TEXT,
    "details" TEXT,
    "photographer" TEXT,
    "url" TEXT,
    "rating" INTEGER,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "studio" TEXT,
    "studioId" TEXT,
    "path" TEXT,
    "checksum" TEXT,
    "fileModTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashImage_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGalleryPerformer" (
    "galleryId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,

    PRIMARY KEY ("galleryId", "performerId"),
    CONSTRAINT "StashGalleryPerformer_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGalleryPerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGalleryTag" (
    "galleryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("galleryId", "tagId"),
    CONSTRAINT "StashGalleryTag_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGalleryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashImagePerformer" (
    "imageId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,

    PRIMARY KEY ("imageId", "performerId"),
    CONSTRAINT "StashImagePerformer_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StashImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashImagePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashImageTag" (
    "imageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("imageId", "tagId"),
    CONSTRAINT "StashImageTag_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StashImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashImageTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
