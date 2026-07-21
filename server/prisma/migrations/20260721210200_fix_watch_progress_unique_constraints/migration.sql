/*
  Warnings:

  - A unique constraint covering the columns `[movieId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[episodeId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WatchProgress_mediaType_movieId_episodeId_key";

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_movieId_key" ON "WatchProgress"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_episodeId_key" ON "WatchProgress"("episodeId");
