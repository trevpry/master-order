-- AlterTable
ALTER TABLE "PlexTrack" ADD COLUMN "audioChannels" INTEGER;
ALTER TABLE "PlexTrack" ADD COLUMN "audioCodec" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "bitrate" INTEGER;
ALTER TABLE "PlexTrack" ADD COLUMN "container" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "file" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "lastFmId" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "lastViewedAt" DATETIME;
ALTER TABLE "PlexTrack" ADD COLUMN "musicBrainzTrackId" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "originalTitle" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "plexMusicId" TEXT;
ALTER TABLE "PlexTrack" ADD COLUMN "rating" REAL;
ALTER TABLE "PlexTrack" ADD COLUMN "size" INTEGER;
ALTER TABLE "PlexTrack" ADD COLUMN "skipCount" INTEGER;
ALTER TABLE "PlexTrack" ADD COLUMN "userRating" REAL;
ALTER TABLE "PlexTrack" ADD COLUMN "viewCount" INTEGER;
