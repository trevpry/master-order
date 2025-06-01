-- AlterTable
ALTER TABLE "PlexEpisode" ADD COLUMN "duration" INTEGER;
ALTER TABLE "PlexEpisode" ADD COLUMN "grandparentGuid" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "grandparentKey" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "grandparentRatingKey" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "grandparentThumb" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "grandparentTitle" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "guid" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "key" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "librarySectionID" INTEGER;
ALTER TABLE "PlexEpisode" ADD COLUMN "librarySectionKey" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "librarySectionTitle" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentGuid" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentIndex" INTEGER;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentKey" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentRatingKey" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentThumb" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "parentTitle" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "skipCount" INTEGER;
ALTER TABLE "PlexEpisode" ADD COLUMN "titleSort" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "type" TEXT;
ALTER TABLE "PlexEpisode" ADD COLUMN "updatedAt_plex" INTEGER;

-- AlterTable
ALTER TABLE "PlexLibrarySection" ADD COLUMN "agent" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "allowSync" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "art" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "composite" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "content" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "contentChangedAt" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "createdAt_plex" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "directory" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "filters" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "hidden" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "language" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "refreshing" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "scannedAt" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "scanner" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "thumb" TEXT;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "updatedAt_plex" INTEGER;
ALTER TABLE "PlexLibrarySection" ADD COLUMN "uuid" TEXT;

-- AlterTable
ALTER TABLE "PlexMovie" ADD COLUMN "audienceRating" REAL;
ALTER TABLE "PlexMovie" ADD COLUMN "audienceRatingImage" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "chapterSource" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "contentRating" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "duration" INTEGER;
ALTER TABLE "PlexMovie" ADD COLUMN "guid" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "key" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "librarySectionID" INTEGER;
ALTER TABLE "PlexMovie" ADD COLUMN "librarySectionKey" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "librarySectionTitle" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "primaryExtraKey" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "rating" REAL;
ALTER TABLE "PlexMovie" ADD COLUMN "ratingImage" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "skipCount" INTEGER;
ALTER TABLE "PlexMovie" ADD COLUMN "slug" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "studio" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "tagline" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "titleSort" TEXT;
ALTER TABLE "PlexMovie" ADD COLUMN "type" TEXT;

-- AlterTable
ALTER TABLE "PlexSeason" ADD COLUMN "addedAt" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "guid" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "key" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "lastViewedAt" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "librarySectionID" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "librarySectionKey" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "librarySectionTitle" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "parentGuid" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "parentIndex" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "parentKey" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "parentRatingKey" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "parentThumb" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "parentTitle" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "skipCount" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "summary" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "thumb" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "type" TEXT;
ALTER TABLE "PlexSeason" ADD COLUMN "updatedAt_plex" INTEGER;
ALTER TABLE "PlexSeason" ADD COLUMN "viewCount" INTEGER;

-- AlterTable
ALTER TABLE "PlexTVShow" ADD COLUMN "childCount" INTEGER;
ALTER TABLE "PlexTVShow" ADD COLUMN "guid" TEXT;
ALTER TABLE "PlexTVShow" ADD COLUMN "index" INTEGER;
ALTER TABLE "PlexTVShow" ADD COLUMN "key" TEXT;
ALTER TABLE "PlexTVShow" ADD COLUMN "lastViewedAt" INTEGER;
ALTER TABLE "PlexTVShow" ADD COLUMN "skipCount" INTEGER;
ALTER TABLE "PlexTVShow" ADD COLUMN "type" TEXT;
ALTER TABLE "PlexTVShow" ADD COLUMN "viewCount" INTEGER;

-- CreateTable
CREATE TABLE "PlexDirector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexDirector_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexDirector_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexGenre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "showRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexGenre_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGenre_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexProducer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexProducer_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexWriter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexWriter_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexWriter_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "role" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexRole_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexRole_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexCountry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexCountry_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexRating" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "image" TEXT,
    "value" REAL,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexRating_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexRating_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexGuid" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "showRatingKey" TEXT,
    "seasonRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "id_value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexGuid_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexMedia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "id_value" TEXT,
    "duration" INTEGER,
    "bitrate" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" REAL,
    "audioChannels" INTEGER,
    "audioCodec" TEXT,
    "videoCodec" TEXT,
    "videoResolution" TEXT,
    "container" TEXT,
    "videoFrameRate" TEXT,
    "optimizedForStreaming" BOOLEAN,
    "selected" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexMedia_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexMedia_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "showRatingKey" TEXT,
    "seasonRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "alt" TEXT,
    "type" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexImage_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexUltraBlurColor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "showRatingKey" TEXT,
    "seasonRatingKey" TEXT,
    "episodeRatingKey" TEXT,
    "topLeft" TEXT,
    "topRight" TEXT,
    "bottomLeft" TEXT,
    "bottomRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexUltraBlurColor_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);
