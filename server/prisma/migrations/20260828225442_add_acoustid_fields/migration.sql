/*
  Warnings:

  - A unique constraint covering the columns `[acoustidId]` on the table `PlexTrack` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PlexAlbum" ADD COLUMN "acoustidFingerprint" TEXT;
ALTER TABLE "PlexAlbum" ADD COLUMN "acoustidId" TEXT;

-- AlterTable
ALTER TABLE "PlexTrack" ADD COLUMN "acoustidFingerprint" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "acoustidId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlexTrack_acoustidId_key" ON "PlexTrack"("acoustidId");
