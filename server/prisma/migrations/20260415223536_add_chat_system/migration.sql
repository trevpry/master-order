/*
  Warnings:

  - You are about to alter the column `fileSize` on the `StashScene` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- AlterTable
ALTER TABLE "Connection" ADD COLUMN "phoneNumber" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "platform" TEXT;

-- AlterTable
ALTER TABLE "PlexArtist" ADD COLUMN "identificationConfidence" REAL;
ALTER TABLE "PlexArtist" ADD COLUMN "identificationStatus" TEXT DEFAULT 'unidentified';
ALTER TABLE "PlexArtist" ADD COLUMN "lastIdentificationAttempt" DATETIME;
ALTER TABLE "PlexArtist" ADD COLUMN "metadataPreferences" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzAliases" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzBeginDate" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzCountry" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzEndDate" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzEnded" BOOLEAN;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzId" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "musicBrainzLinks" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "userBiography" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "userCountry" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "userSortName" TEXT;
ALTER TABLE "PlexArtist" ADD COLUMN "userTitle" TEXT;

-- AlterTable
ALTER TABLE "StashClip" ADD COLUMN "rating" INTEGER;

-- AlterTable
ALTER TABLE "StashPerformer" ADD COLUMN "urls" TEXT;

-- CreateTable
CREATE TABLE "Work" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "composerKey" TEXT NOT NULL,
    "userTitle" TEXT,
    "userCatalogNumber" TEXT,
    "userOpusNumber" TEXT,
    "userNickname" TEXT,
    "musicBrainzWorkId" TEXT,
    "metadataPreferences" TEXT,
    "identificationStatus" TEXT DEFAULT 'unidentified',
    "identificationConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Work_composerKey_fkey" FOREIGN KEY ("composerKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkPart_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPartTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workPartId" INTEGER NOT NULL,
    "trackKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPartTrack_workPartId_fkey" FOREIGN KEY ("workPartId") REFERENCES "WorkPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPartTrack_trackKey_fkey" FOREIGN KEY ("trackKey") REFERENCES "PlexTrack" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "parentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ArtistType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistTypeAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artistKey" TEXT NOT NULL,
    "artistTypeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtistTypeAssignment_artistKey_fkey" FOREIGN KEY ("artistKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistTypeAssignment_artistTypeId_fkey" FOREIGN KEY ("artistTypeId") REFERENCES "ArtistType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPartArtistType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workPartId" INTEGER NOT NULL,
    "artistTypeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPartArtistType_workPartId_fkey" FOREIGN KEY ("workPartId") REFERENCES "WorkPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPartArtistType_artistTypeId_fkey" FOREIGN KEY ("artistTypeId") REFERENCES "ArtistType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackArtist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackKey" TEXT NOT NULL,
    "artistKey" TEXT NOT NULL,
    "artistTypeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackArtist_trackKey_fkey" FOREIGN KEY ("trackKey") REFERENCES "PlexTrack" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackArtist_artistKey_fkey" FOREIGN KEY ("artistKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackArtist_artistTypeId_fkey" FOREIGN KEY ("artistTypeId") REFERENCES "ArtistType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentificationCandidate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "musicBrainzId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "releaseDate" DATETIME,
    "confidence" REAL NOT NULL,
    "metadata" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MusicBrainzMetadataCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "musicBrainzId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "lastFetched" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserMetadataOverride" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetadataPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StashDismissedDuplicateGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneIds" TEXT NOT NULL,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConnectionPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isProfile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectionPhoto_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListScrapeConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "customOrderId" INTEGER,
    "url" TEXT NOT NULL,
    "parserType" TEXT NOT NULL DEFAULT 'css-selectors',
    "parserConfig" TEXT,
    "itemSelector" TEXT,
    "titleSelector" TEXT,
    "mediaTypeSelector" TEXT,
    "urlSelector" TEXT,
    "imageSelector" TEXT,
    "yearSelector" TEXT,
    "defaultMediaType" TEXT NOT NULL DEFAULT 'movie',
    "useJavaScript" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedAll" BOOLEAN NOT NULL DEFAULT false,
    "headImportCount" INTEGER,
    "tailImportCount" INTEGER,
    "lastCheckedAt" DATETIME,
    "lastItemCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListScrapeConfig_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListScrapedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listScrapeConfigId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "itemUrl" TEXT,
    "itemYear" TEXT,
    "mediaType" TEXT,
    "fingerprint" TEXT NOT NULL,
    "customOrderItemId" INTEGER,
    "wasSkipped" BOOLEAN NOT NULL DEFAULT false,
    "notInPlex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListScrapedItem_listScrapeConfigId_fkey" FOREIGN KEY ("listScrapeConfigId") REFERENCES "ListScrapeConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListScrapedItem_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "model" TEXT NOT NULL DEFAULT 'llama3',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlexAlbum" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentRatingKey" TEXT,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'album',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "year" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "parentThumb" TEXT,
    "originallyAvailableAt" DATETIME,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    "collections" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "musicBrainzId" TEXT,
    "musicBrainzReleaseDate" TEXT,
    "musicBrainzCountry" TEXT,
    "musicBrainzStatus" TEXT,
    "musicBrainzPackaging" TEXT,
    "musicBrainzLabel" TEXT,
    "musicBrainzBarcode" TEXT,
    "musicBrainzAsin" TEXT,
    "albumArtist" TEXT,
    "workId" INTEGER,
    "userTitle" TEXT,
    "userReleaseDate" DATETIME,
    "userLabel" TEXT,
    "metadataPreferences" TEXT,
    "identificationStatus" TEXT DEFAULT 'unidentified',
    "identificationConfidence" REAL,
    "lastIdentificationAttempt" DATETIME,
    CONSTRAINT "PlexAlbum_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexAlbum" ("addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "originallyAvailableAt", "parentRatingKey", "parentThumb", "ratingKey", "removed", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "year") SELECT "addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "originallyAvailableAt", "parentRatingKey", "parentThumb", "ratingKey", "removed", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "year" FROM "PlexAlbum";
DROP TABLE "PlexAlbum";
ALTER TABLE "new_PlexAlbum" RENAME TO "PlexAlbum";
CREATE UNIQUE INDEX "PlexAlbum_ratingKey_key" ON "PlexAlbum"("ratingKey");
CREATE TABLE "new_PlexTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentRatingKey" TEXT,
    "grandparentRatingKey" TEXT,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'track',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "duration" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "parentThumb" TEXT,
    "grandparentThumb" TEXT,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    "audioChannels" INTEGER,
    "audioCodec" TEXT,
    "bitrate" INTEGER,
    "container" TEXT,
    "file" TEXT,
    "lastFmId" TEXT,
    "lastViewedAt" DATETIME,
    "musicBrainzTrackId" TEXT,
    "originalTitle" TEXT,
    "plexMusicId" TEXT,
    "rating" REAL,
    "size" INTEGER,
    "skipCount" INTEGER,
    "userRating" REAL,
    "viewCount" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "workId" INTEGER,
    "userTitle" TEXT,
    "userComposer" TEXT,
    "metadataPreferences" TEXT,
    "identificationStatus" TEXT DEFAULT 'unidentified',
    "identificationConfidence" REAL,
    "lastIdentificationAttempt" DATETIME,
    CONSTRAINT "PlexTrack_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexTrack" ("addedAt", "art", "audioChannels", "audioCodec", "bitrate", "container", "duration", "file", "grandparentRatingKey", "grandparentThumb", "guid", "id", "index", "key", "lastFmId", "lastViewedAt", "librarySectionID", "musicBrainzTrackId", "originalTitle", "parentRatingKey", "parentThumb", "plexMusicId", "rating", "ratingKey", "removed", "size", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "userRating", "viewCount") SELECT "addedAt", "art", "audioChannels", "audioCodec", "bitrate", "container", "duration", "file", "grandparentRatingKey", "grandparentThumb", "guid", "id", "index", "key", "lastFmId", "lastViewedAt", "librarySectionID", "musicBrainzTrackId", "originalTitle", "parentRatingKey", "parentThumb", "plexMusicId", "rating", "ratingKey", "removed", "size", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "userRating", "viewCount" FROM "PlexTrack";
DROP TABLE "PlexTrack";
ALTER TABLE "new_PlexTrack" RENAME TO "PlexTrack";
CREATE UNIQUE INDEX "PlexTrack_ratingKey_key" ON "PlexTrack"("ratingKey");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionName" TEXT,
    "tvdbToken" TEXT,
    "tvdbTokenExpiry" DATETIME,
    "comicVineApiKey" TEXT,
    "plexToken" TEXT,
    "plexUrl" TEXT,
    "tvdbApiKey" TEXT,
    "tvdbBearerToken" TEXT,
    "selectedPlayer" TEXT,
    "selectedPlexUser" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "tvGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "moviesGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "customOrderPercent" INTEGER NOT NULL DEFAULT 0,
    "historyPlusPercent" INTEGER NOT NULL DEFAULT 0,
    "partiallyWatchedCollectionPercent" INTEGER NOT NULL DEFAULT 75,
    "ignoredMovieCollections" TEXT,
    "ignoredTVCollections" TEXT,
    "christmasFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "plexSyncInterval" INTEGER NOT NULL DEFAULT 12,
    "stashSyncInterval" INTEGER NOT NULL DEFAULT 24,
    "komgaUrl" TEXT,
    "komgaApiKey" TEXT,
    "stashUrl" TEXT,
    "stashApiKey" TEXT,
    "rawgApiKey" TEXT,
    "geminiApiKey" TEXT,
    "listScrapeInterval" INTEGER NOT NULL DEFAULT 6,
    "mediaTypeLimiters" TEXT,
    "preferNewRelease" INTEGER NOT NULL DEFAULT 0,
    "preferLongUnwatched" INTEGER NOT NULL DEFAULT 0,
    "ollamaUrl" TEXT,
    "ollamaDefaultModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "moviesGeneralPercent", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt") SELECT "christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "geminiApiKey", "historyPlusPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "moviesGeneralPercent", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "rawgApiKey", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashSyncInterval", "stashUrl", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_StashImage" (
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
    "tagged" BOOLEAN NOT NULL DEFAULT false,
    "studio" TEXT,
    "studioId" TEXT,
    "path" TEXT,
    "checksum" TEXT,
    "fileModTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashImage_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StashImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StashImage" ("checksum", "code", "createdAt", "date", "details", "fileModTime", "galleryId", "id", "lastSyncedAt", "organized", "path", "photographer", "rating", "studio", "studioId", "title", "updatedAt", "url") SELECT "checksum", "code", "createdAt", "date", "details", "fileModTime", "galleryId", "id", "lastSyncedAt", "organized", "path", "photographer", "rating", "studio", "studioId", "title", "updatedAt", "url" FROM "StashImage";
DROP TABLE "StashImage";
ALTER TABLE "new_StashImage" RENAME TO "StashImage";
CREATE TABLE "new_StashScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "url" TEXT,
    "date" TEXT,
    "rating" INTEGER,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "osHash" TEXT,
    "checksum" TEXT,
    "phash" TEXT,
    "oCounter" INTEGER,
    "path" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileModTime" DATETIME,
    "studio" TEXT,
    "studioId" TEXT,
    "code" TEXT,
    "director" TEXT,
    "synopsis" TEXT,
    "lastPlayedAt" DATETIME,
    "resumeTime" REAL,
    "playDuration" REAL,
    "playCount" INTEGER,
    "duration" REAL,
    "fileSize" BIGINT,
    "bitrate" REAL,
    "resolution" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "frameRate" REAL,
    "codec" TEXT,
    "videoCodec" TEXT,
    "audioCodec" TEXT,
    "userRating" REAL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "watchedComplete" BOOLEAN NOT NULL DEFAULT false,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "avgWatchTime" REAL,
    "totalWatchTime" REAL NOT NULL DEFAULT 0.0,
    "popularityScore" REAL NOT NULL DEFAULT 0.0,
    "qualityScore" REAL,
    "trendingScore" REAL NOT NULL DEFAULT 0.0,
    "discoveryScore" REAL NOT NULL DEFAULT 0.0,
    "sceneDominantColors" TEXT,
    "sceneKeywords" TEXT,
    "contentFlags" TEXT,
    "aiGeneratedTags" TEXT,
    "moodScore" REAL,
    "actionIntensity" REAL,
    "geviUrl" TEXT,
    "episodeUrls" TEXT,
    "identification" TEXT,
    CONSTRAINT "StashScene_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StashScene" ("actionIntensity", "aiGeneratedTags", "avgWatchTime", "bitrate", "checksum", "code", "codec", "contentFlags", "createdAt", "date", "details", "director", "discoveryScore", "duration", "favorite", "fileModTime", "fileSize", "frameRate", "geviUrl", "height", "id", "lastPlayedAt", "lastSyncedAt", "moodScore", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "popularityScore", "qualityScore", "rating", "resolution", "resumeTime", "sceneDominantColors", "sceneKeywords", "skipCount", "studio", "studioId", "synopsis", "title", "totalWatchTime", "trendingScore", "updatedAt", "url", "userRating", "watchedComplete", "width") SELECT "actionIntensity", "aiGeneratedTags", "avgWatchTime", "bitrate", "checksum", "code", "codec", "contentFlags", "createdAt", "date", "details", "director", "discoveryScore", "duration", "favorite", "fileModTime", "fileSize", "frameRate", "geviUrl", "height", "id", "lastPlayedAt", "lastSyncedAt", "moodScore", "oCounter", "organized", "osHash", "path", "phash", "playCount", "playDuration", "popularityScore", "qualityScore", "rating", "resolution", "resumeTime", "sceneDominantColors", "sceneKeywords", "skipCount", "studio", "studioId", "synopsis", "title", "totalWatchTime", "trendingScore", "updatedAt", "url", "userRating", "watchedComplete", "width" FROM "StashScene";
DROP TABLE "StashScene";
ALTER TABLE "new_StashScene" RENAME TO "StashScene";
CREATE TABLE "new_StashTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "ignoreAutoTag" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "includeInClipTagging" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StashTag" ("createdAt", "description", "favorite", "id", "ignoreAutoTag", "image", "lastSyncedAt", "name", "updatedAt") SELECT "createdAt", "description", "favorite", "id", "ignoreAutoTag", "image", "lastSyncedAt", "name", "updatedAt" FROM "StashTag";
DROP TABLE "StashTag";
ALTER TABLE "new_StashTag" RENAME TO "StashTag";
CREATE UNIQUE INDEX "StashTag_name_key" ON "StashTag"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkPartTrack_workPartId_trackKey_key" ON "WorkPartTrack"("workPartId", "trackKey");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistType_name_key" ON "ArtistType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistTypeAssignment_artistKey_artistTypeId_key" ON "ArtistTypeAssignment"("artistKey", "artistTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPartArtistType_workPartId_artistTypeId_key" ON "WorkPartArtistType"("workPartId", "artistTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackArtist_trackKey_artistKey_artistTypeId_key" ON "TrackArtist"("trackKey", "artistKey", "artistTypeId");

-- CreateIndex
CREATE INDEX "IdentificationCandidate_entityType_entityKey_status_idx" ON "IdentificationCandidate"("entityType", "entityKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MusicBrainzMetadataCache_musicBrainzId_key" ON "MusicBrainzMetadataCache"("musicBrainzId");

-- CreateIndex
CREATE INDEX "MusicBrainzMetadataCache_musicBrainzId_idx" ON "MusicBrainzMetadataCache"("musicBrainzId");

-- CreateIndex
CREATE INDEX "MusicBrainzMetadataCache_expiresAt_idx" ON "MusicBrainzMetadataCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMetadataOverride_entityType_entityKey_field_key" ON "UserMetadataOverride"("entityType", "entityKey", "field");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataPreference_entityType_entityKey_field_key" ON "MetadataPreference"("entityType", "entityKey", "field");

-- CreateIndex
CREATE UNIQUE INDEX "StashDismissedDuplicateGroup_sceneIds_key" ON "StashDismissedDuplicateGroup"("sceneIds");

-- CreateIndex
CREATE UNIQUE INDEX "ListScrapeConfig_customOrderId_key" ON "ListScrapeConfig"("customOrderId");

-- CreateIndex
CREATE INDEX "ListScrapedItem_listScrapeConfigId_idx" ON "ListScrapedItem"("listScrapeConfigId");

-- CreateIndex
CREATE INDEX "ListScrapedItem_customOrderItemId_idx" ON "ListScrapedItem"("customOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ListScrapedItem_listScrapeConfigId_fingerprint_key" ON "ListScrapedItem"("listScrapeConfigId", "fingerprint");

-- CreateIndex
CREATE INDEX "ChatConversation_updatedAt_idx" ON "ChatConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
