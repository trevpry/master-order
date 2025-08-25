-- AlterTable
ALTER TABLE "StashScene" ADD COLUMN "lastPlayedAt" DATETIME;
ALTER TABLE "StashScene" ADD COLUMN "playCount" INTEGER;
ALTER TABLE "StashScene" ADD COLUMN "playDuration" REAL;
ALTER TABLE "StashScene" ADD COLUMN "resumeTime" REAL;
