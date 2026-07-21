-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "audioChannels" INTEGER;
ALTER TABLE "Episode" ADD COLUMN "audioLanguage" TEXT;
ALTER TABLE "Episode" ADD COLUMN "audioTracksJson" TEXT;
ALTER TABLE "Episode" ADD COLUMN "durationSeconds" REAL;
ALTER TABLE "Episode" ADD COLUMN "frameRate" REAL;
ALTER TABLE "Episode" ADD COLUMN "probeError" TEXT;
ALTER TABLE "Episode" ADD COLUMN "probedAt" DATETIME;
ALTER TABLE "Episode" ADD COLUMN "subtitleTracksJson" TEXT;
ALTER TABLE "Episode" ADD COLUMN "videoHeight" INTEGER;
ALTER TABLE "Episode" ADD COLUMN "videoWidth" INTEGER;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "audioChannels" INTEGER;
ALTER TABLE "Movie" ADD COLUMN "audioLanguage" TEXT;
ALTER TABLE "Movie" ADD COLUMN "audioTracksJson" TEXT;
ALTER TABLE "Movie" ADD COLUMN "durationSeconds" REAL;
ALTER TABLE "Movie" ADD COLUMN "frameRate" REAL;
ALTER TABLE "Movie" ADD COLUMN "probeError" TEXT;
ALTER TABLE "Movie" ADD COLUMN "probedAt" DATETIME;
ALTER TABLE "Movie" ADD COLUMN "subtitleTracksJson" TEXT;
ALTER TABLE "Movie" ADD COLUMN "videoHeight" INTEGER;
ALTER TABLE "Movie" ADD COLUMN "videoWidth" INTEGER;
