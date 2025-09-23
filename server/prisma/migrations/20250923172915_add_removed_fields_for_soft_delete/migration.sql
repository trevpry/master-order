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
    CONSTRAINT "PlexAlbum_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexAlbum" ("addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "originallyAvailableAt", "parentRatingKey", "parentThumb", "ratingKey", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "year") SELECT "addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "originallyAvailableAt", "parentRatingKey", "parentThumb", "ratingKey", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "year" FROM "PlexAlbum";
DROP TABLE "PlexAlbum";
ALTER TABLE "new_PlexAlbum" RENAME TO "PlexAlbum";
CREATE UNIQUE INDEX "PlexAlbum_ratingKey_key" ON "PlexAlbum"("ratingKey");
CREATE TABLE "new_PlexArtist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'artist',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "index" INTEGER,
    "thumb" TEXT,
    "art" TEXT,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    "collections" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlexArtist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexArtist" ("addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "ratingKey", "summary", "thumb", "title", "titleSort", "type", "updatedAt") SELECT "addedAt", "art", "collections", "guid", "id", "index", "key", "librarySectionID", "ratingKey", "summary", "thumb", "title", "titleSort", "type", "updatedAt" FROM "PlexArtist";
DROP TABLE "PlexArtist";
ALTER TABLE "new_PlexArtist" RENAME TO "PlexArtist";
CREATE UNIQUE INDEX "PlexArtist_ratingKey_key" ON "PlexArtist"("ratingKey");
CREATE TABLE "new_PlexEpisode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "seasonIndex" INTEGER NOT NULL,
    "showTitle" TEXT NOT NULL,
    "seasonRatingKey" TEXT NOT NULL,
    "viewCount" INTEGER,
    "lastViewedAt" INTEGER,
    "addedAt" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "originallyAvailableAt" TEXT,
    "duration" INTEGER,
    "grandparentGuid" TEXT,
    "grandparentKey" TEXT,
    "grandparentRatingKey" TEXT,
    "grandparentThumb" TEXT,
    "grandparentTitle" TEXT,
    "guid" TEXT,
    "key" TEXT,
    "librarySectionID" INTEGER,
    "librarySectionKey" TEXT,
    "librarySectionTitle" TEXT,
    "parentGuid" TEXT,
    "parentIndex" INTEGER,
    "parentKey" TEXT,
    "parentRatingKey" TEXT,
    "parentThumb" TEXT,
    "parentTitle" TEXT,
    "skipCount" INTEGER,
    "titleSort" TEXT,
    "type" TEXT,
    "updatedAt_plex" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlexEpisode_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlexEpisode" ("addedAt", "createdAt", "duration", "grandparentGuid", "grandparentKey", "grandparentRatingKey", "grandparentThumb", "grandparentTitle", "guid", "id", "index", "key", "lastViewedAt", "librarySectionID", "librarySectionKey", "librarySectionTitle", "originallyAvailableAt", "parentGuid", "parentIndex", "parentKey", "parentRatingKey", "parentThumb", "parentTitle", "ratingKey", "seasonIndex", "seasonRatingKey", "showTitle", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "updatedAt_plex", "viewCount") SELECT "addedAt", "createdAt", "duration", "grandparentGuid", "grandparentKey", "grandparentRatingKey", "grandparentThumb", "grandparentTitle", "guid", "id", "index", "key", "lastViewedAt", "librarySectionID", "librarySectionKey", "librarySectionTitle", "originallyAvailableAt", "parentGuid", "parentIndex", "parentKey", "parentRatingKey", "parentThumb", "parentTitle", "ratingKey", "seasonIndex", "seasonRatingKey", "showTitle", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "updatedAt_plex", "viewCount" FROM "PlexEpisode";
DROP TABLE "PlexEpisode";
ALTER TABLE "new_PlexEpisode" RENAME TO "PlexEpisode";
CREATE UNIQUE INDEX "PlexEpisode_ratingKey_key" ON "PlexEpisode"("ratingKey");
CREATE TABLE "new_PlexMovie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "art" TEXT,
    "viewCount" INTEGER,
    "lastViewedAt" INTEGER,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "collections" TEXT,
    "sectionKey" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "originallyAvailableAt" TEXT,
    "audienceRating" REAL,
    "audienceRatingImage" TEXT,
    "chapterSource" TEXT,
    "contentRating" TEXT,
    "duration" INTEGER,
    "guid" TEXT,
    "key" TEXT,
    "librarySectionID" INTEGER,
    "librarySectionKey" TEXT,
    "librarySectionTitle" TEXT,
    "primaryExtraKey" TEXT,
    "rating" REAL,
    "ratingImage" TEXT,
    "skipCount" INTEGER,
    "slug" TEXT,
    "studio" TEXT,
    "tagline" TEXT,
    "titleSort" TEXT,
    "type" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlexMovie_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlexMovie" ("addedAt", "art", "audienceRating", "audienceRatingImage", "chapterSource", "collections", "contentRating", "createdAt", "duration", "guid", "id", "key", "lastSyncedAt", "lastViewedAt", "librarySectionID", "librarySectionKey", "librarySectionTitle", "originallyAvailableAt", "primaryExtraKey", "rating", "ratingImage", "ratingKey", "sectionKey", "skipCount", "slug", "studio", "summary", "tagline", "thumb", "title", "titleSort", "type", "updatedAt", "updatedAt_plex", "viewCount", "year") SELECT "addedAt", "art", "audienceRating", "audienceRatingImage", "chapterSource", "collections", "contentRating", "createdAt", "duration", "guid", "id", "key", "lastSyncedAt", "lastViewedAt", "librarySectionID", "librarySectionKey", "librarySectionTitle", "originallyAvailableAt", "primaryExtraKey", "rating", "ratingImage", "ratingKey", "sectionKey", "skipCount", "slug", "studio", "summary", "tagline", "thumb", "title", "titleSort", "type", "updatedAt", "updatedAt_plex", "viewCount", "year" FROM "PlexMovie";
DROP TABLE "PlexMovie";
ALTER TABLE "new_PlexMovie" RENAME TO "PlexMovie";
CREATE UNIQUE INDEX "PlexMovie_ratingKey_key" ON "PlexMovie"("ratingKey");
CREATE TABLE "new_PlexSeason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "showRatingKey" TEXT NOT NULL,
    "leafCount" INTEGER,
    "viewedLeafCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "addedAt" INTEGER,
    "guid" TEXT,
    "key" TEXT,
    "lastViewedAt" INTEGER,
    "librarySectionID" INTEGER,
    "librarySectionKey" TEXT,
    "librarySectionTitle" TEXT,
    "parentGuid" TEXT,
    "parentIndex" INTEGER,
    "parentKey" TEXT,
    "parentRatingKey" TEXT,
    "parentThumb" TEXT,
    "parentTitle" TEXT,
    "skipCount" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "type" TEXT,
    "updatedAt_plex" INTEGER,
    "viewCount" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlexSeason_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlexSeason" ("addedAt", "createdAt", "guid", "id", "index", "key", "lastViewedAt", "leafCount", "librarySectionID", "librarySectionKey", "librarySectionTitle", "parentGuid", "parentIndex", "parentKey", "parentRatingKey", "parentThumb", "parentTitle", "ratingKey", "showRatingKey", "skipCount", "summary", "thumb", "title", "type", "updatedAt", "updatedAt_plex", "viewCount", "viewedLeafCount") SELECT "addedAt", "createdAt", "guid", "id", "index", "key", "lastViewedAt", "leafCount", "librarySectionID", "librarySectionKey", "librarySectionTitle", "parentGuid", "parentIndex", "parentKey", "parentRatingKey", "parentThumb", "parentTitle", "ratingKey", "showRatingKey", "skipCount", "summary", "thumb", "title", "type", "updatedAt", "updatedAt_plex", "viewCount", "viewedLeafCount" FROM "PlexSeason";
DROP TABLE "PlexSeason";
ALTER TABLE "new_PlexSeason" RENAME TO "PlexSeason";
CREATE UNIQUE INDEX "PlexSeason_ratingKey_key" ON "PlexSeason"("ratingKey");
CREATE TABLE "new_PlexTVShow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "summary" TEXT,
    "thumb" TEXT,
    "art" TEXT,
    "leafCount" INTEGER,
    "viewedLeafCount" INTEGER,
    "addedAt" INTEGER,
    "updatedAt_plex" INTEGER,
    "collections" TEXT,
    "sectionKey" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "childCount" INTEGER,
    "guid" TEXT,
    "index" INTEGER,
    "key" TEXT,
    "lastViewedAt" INTEGER,
    "skipCount" INTEGER,
    "type" TEXT,
    "viewCount" INTEGER,
    CONSTRAINT "PlexTVShow_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlexTVShow" ("addedAt", "art", "childCount", "collections", "createdAt", "guid", "id", "index", "key", "lastSyncedAt", "lastViewedAt", "leafCount", "ratingKey", "sectionKey", "skipCount", "summary", "thumb", "title", "type", "updatedAt", "updatedAt_plex", "viewCount", "viewedLeafCount", "year") SELECT "addedAt", "art", "childCount", "collections", "createdAt", "guid", "id", "index", "key", "lastSyncedAt", "lastViewedAt", "leafCount", "ratingKey", "sectionKey", "skipCount", "summary", "thumb", "title", "type", "updatedAt", "updatedAt_plex", "viewCount", "viewedLeafCount", "year" FROM "PlexTVShow";
DROP TABLE "PlexTVShow";
ALTER TABLE "new_PlexTVShow" RENAME TO "PlexTVShow";
CREATE UNIQUE INDEX "PlexTVShow_ratingKey_key" ON "PlexTVShow"("ratingKey");
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
    CONSTRAINT "PlexTrack_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlexTrack" ("addedAt", "art", "audioChannels", "audioCodec", "bitrate", "container", "duration", "file", "grandparentRatingKey", "grandparentThumb", "guid", "id", "index", "key", "lastFmId", "lastViewedAt", "librarySectionID", "musicBrainzTrackId", "originalTitle", "parentRatingKey", "parentThumb", "plexMusicId", "rating", "ratingKey", "size", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "userRating", "viewCount") SELECT "addedAt", "art", "audioChannels", "audioCodec", "bitrate", "container", "duration", "file", "grandparentRatingKey", "grandparentThumb", "guid", "id", "index", "key", "lastFmId", "lastViewedAt", "librarySectionID", "musicBrainzTrackId", "originalTitle", "parentRatingKey", "parentThumb", "plexMusicId", "rating", "ratingKey", "size", "skipCount", "summary", "thumb", "title", "titleSort", "type", "updatedAt", "userRating", "viewCount" FROM "PlexTrack";
DROP TABLE "PlexTrack";
ALTER TABLE "new_PlexTrack" RENAME TO "PlexTrack";
CREATE UNIQUE INDEX "PlexTrack_ratingKey_key" ON "PlexTrack"("ratingKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
