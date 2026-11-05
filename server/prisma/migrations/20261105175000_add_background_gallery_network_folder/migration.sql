ALTER TABLE "BackgroundGallery" ADD COLUMN "networkFolderPath" TEXT;
ALTER TABLE "BackgroundImage" ADD COLUMN "sourcePath" TEXT;
CREATE UNIQUE INDEX "BackgroundImage_galleryId_sourcePath_key" ON "BackgroundImage"("galleryId", "sourcePath");
