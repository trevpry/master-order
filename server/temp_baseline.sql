-- CreateTable
CREATE TABLE "Settings" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EddieSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weatherApiKey" TEXT,
    "weatherLocation" TEXT,
    "weatherUnits" TEXT NOT NULL DEFAULT 'metric',
    "weatherEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerName" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "icon" TEXT,
    "parentOrderId" INTEGER,
    "playlistRatingKey" TEXT,
    "customPlaylistId" INTEGER,
    "backgroundGalleryId" INTEGER,
    CONSTRAINT "CustomOrder_backgroundGalleryId_fkey" FOREIGN KEY ("backgroundGalleryId") REFERENCES "BackgroundGallery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_customPlaylistId_fkey" FOREIGN KEY ("customPlaylistId") REFERENCES "CustomPlaylist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customOrderId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "plexKey" TEXT,
    "title" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "seriesTitle" TEXT,
    "comicSeries" TEXT,
    "comicYear" INTEGER,
    "comicIssue" TEXT,
    "comicVolume" TEXT,
    "comicPublisher" TEXT,
    "comicVineId" TEXT,
    "comicVineDetailsJson" TEXT,
    "comicVineSeriesId" INTEGER,
    "comicVineIssueId" INTEGER,
    "comicIssueName" TEXT,
    "comicDescription" TEXT,
    "comicCoverDate" TEXT,
    "comicStoreDate" TEXT,
    "comicCreators" TEXT,
    "comicCharacters" TEXT,
    "comicStoryArcs" TEXT,
    "comicPercentRead" REAL,
    "comicCurrentPage" INTEGER,
    "comicPageCount" INTEGER,
    "customTitle" TEXT,
    "storyTitle" TEXT,
    "storyAuthor" TEXT,
    "storyYear" INTEGER,
    "storyUrl" TEXT,
    "storyContainedInBookId" INTEGER,
    "storyCoverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "isFromTvdbOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "webTitle" TEXT,
    "webUrl" TEXT,
    "webDescription" TEXT,
    "tvdbId" TEXT,
    "tvdbYear" INTEGER,
    "tvdbOverview" TEXT,
    "tvdbGenres" TEXT,
    "tvdbDirector" TEXT,
    "tvdbStudio" TEXT,
    "tvdbArtworkUrl" TEXT,
    "referencedCustomOrderId" INTEGER,
    "komgaBookId" TEXT,
    "komgaMetadata" TEXT,
    "komgaSeriesId" TEXT,
    "komgaSeriesUrl" TEXT,
    "komgaUrl" TEXT,
    "bookId" INTEGER,
    "gameId" INTEGER,
    CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_referencedCustomOrderId_fkey" FOREIGN KEY ("referencedCustomOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_storyContainedInBookId_fkey" FOREIGN KEY ("storyContainedInBookId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "VideoGame" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexLibrarySection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "agent" TEXT,
    "allowSync" INTEGER,
    "art" TEXT,
    "composite" TEXT,
    "content" TEXT,
    "contentChangedAt" INTEGER,
    "createdAt_plex" INTEGER,
    "directory" TEXT,
    "filters" TEXT,
    "hidden" INTEGER,
    "language" TEXT,
    "refreshing" INTEGER,
    "scannedAt" INTEGER,
    "scanner" TEXT,
    "thumb" TEXT,
    "updatedAt_plex" INTEGER,
    "uuid" TEXT
);

-- CreateTable
CREATE TABLE "PlexTVShow" (
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
    "childCount" INTEGER,
    "guid" TEXT,
    "index" INTEGER,
    "key" TEXT,
    "lastViewedAt" INTEGER,
    "skipCount" INTEGER,
    "type" TEXT,
    "viewCount" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlexTVShow_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "PlexLibrarySection" ("sectionKey") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexSeason" (
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

-- CreateTable
CREATE TABLE "PlexEpisode" (
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

-- CreateTable
CREATE TABLE "PlexMovie" (
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

-- CreateTable
CREATE TABLE "TvdbSeries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tvdbId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "image" TEXT,
    "firstAired" TEXT,
    "lastAired" TEXT,
    "nextAired" TEXT,
    "status" TEXT,
    "overview" TEXT,
    "year" TEXT,
    "country" TEXT,
    "originalCountry" TEXT,
    "originalLanguage" TEXT,
    "averageRuntime" INTEGER,
    "score" REAL,
    "lastUpdated" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TvdbSeason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tvdbId" TEXT NOT NULL,
    "seriesTvdbId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "overview" TEXT,
    "year" INTEGER,
    "lastUpdated" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TvdbSeason_seriesTvdbId_fkey" FOREIGN KEY ("seriesTvdbId") REFERENCES "TvdbSeries" ("tvdbId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvdbEpisode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tvdbId" TEXT NOT NULL,
    "seasonTvdbId" TEXT NOT NULL,
    "seriesTvdbId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "image" TEXT,
    "aired" TEXT,
    "runtime" INTEGER,
    "finaleType" TEXT,
    "year" INTEGER,
    "lastUpdated" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TvdbEpisode_seasonTvdbId_fkey" FOREIGN KEY ("seasonTvdbId") REFERENCES "TvdbSeason" ("tvdbId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvdbArtwork" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tvdbId" TEXT NOT NULL,
    "seriesTvdbId" TEXT,
    "seasonTvdbId" TEXT,
    "image" TEXT NOT NULL,
    "thumbnail" TEXT,
    "language" TEXT,
    "type" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "score" REAL,
    "includesText" BOOLEAN,
    "lastUpdated" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TvdbArtwork_seasonTvdbId_fkey" FOREIGN KEY ("seasonTvdbId") REFERENCES "TvdbSeason" ("tvdbId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TvdbArtwork_seriesTvdbId_fkey" FOREIGN KEY ("seriesTvdbId") REFERENCES "TvdbSeries" ("tvdbId") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    CONSTRAINT "PlexDirector_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexDirector_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexGenre_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGenre_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexWriter_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexWriter_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexRole_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexRole_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexRating_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexRating_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexGuid_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexGuid_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexMedia_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexMedia_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexImage_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexImage_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "PlexUltraBlurColor_episodeRatingKey_fkey" FOREIGN KEY ("episodeRatingKey") REFERENCES "PlexEpisode" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_seasonRatingKey_fkey" FOREIGN KEY ("seasonRatingKey") REFERENCES "PlexSeason" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexUltraBlurColor_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexLabel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieRatingKey" TEXT,
    "showRatingKey" TEXT,
    "tag" TEXT NOT NULL,
    "filter" TEXT,
    "tagKey" TEXT,
    "thumb" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlexLabel_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexLabel_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaType" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'watch',
    "title" TEXT NOT NULL,
    "seriesTitle" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "plexKey" TEXT,
    "customOrderItemId" INTEGER,
    "bookId" INTEGER,
    "chapterId" INTEGER,
    "sectionId" INTEGER,
    "currentPage" INTEGER,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "totalWatchTime" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchLog_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WatchLog_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexArtist" (
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
    "musicBrainzId" TEXT,
    "musicBrainzCountry" TEXT,
    "musicBrainzBeginDate" TEXT,
    "musicBrainzEndDate" TEXT,
    "musicBrainzEnded" BOOLEAN,
    "musicBrainzAliases" TEXT,
    "musicBrainzLinks" TEXT,
    CONSTRAINT "PlexArtist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexAlbum" (
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
    "workId" INTEGER,
    CONSTRAINT "PlexAlbum_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexArtist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexAlbum_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexTrack" (
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
    CONSTRAINT "PlexTrack_parentRatingKey_fkey" FOREIGN KEY ("parentRatingKey") REFERENCES "PlexAlbum" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexTrack_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Work" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "composerKey" TEXT NOT NULL,
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
CREATE TABLE "StashScene" (
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

-- CreateTable
CREATE TABLE "StashSceneWatchHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneId" TEXT NOT NULL,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT,
    "progress" REAL,
    CONSTRAINT "StashSceneWatchHistory_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "duration" REAL,
    "date" TEXT,
    "rating" INTEGER,
    "director" TEXT,
    "synopsis" TEXT,
    "url" TEXT,
    "frontImage" TEXT,
    "backImage" TEXT,
    "studioId" TEXT,
    "tagIds" TEXT,
    "geviUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "StashGroup_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGroupScene" (
    "groupId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sceneIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "sceneId"),
    CONSTRAINT "StashGroupScene_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StashGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGroupScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGroupTag" (
    "groupId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "tagId"),
    CONSTRAINT "StashGroupTag_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StashGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGroupTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashClip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneId" TEXT NOT NULL,
    "clipIndex" INTEGER NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "duration" REAL NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "markerBased" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StashClip_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashClipTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clipId" INTEGER NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashClipTag_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "StashClip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashClipTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashClipPerformerTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clipId" INTEGER NOT NULL,
    "performerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashClipPerformerTag_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "StashClip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashClipPerformerTag_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashClipPerformerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashMarker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stashId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seconds" REAL NOT NULL,
    "primaryTag" TEXT,
    "primaryTagId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashMarker_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashPerformer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "disambiguation" TEXT,
    "alias" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "ignore_auto_tag" BOOLEAN NOT NULL DEFAULT false,
    "birthdate" TEXT,
    "death_date" TEXT,
    "ethnicity" TEXT,
    "ethnicityTagId" TEXT,
    "country" TEXT,
    "eye_color" TEXT,
    "hair_color" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "measurements" TEXT,
    "fake_tits" TEXT,
    "penis_length" TEXT,
    "circumcised" TEXT,
    "career_length" TEXT,
    "tattoos" TEXT,
    "piercings" TEXT,
    "image" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "url" TEXT,
    "urls" TEXT,
    "gender" TEXT,
    "details" TEXT,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashPerformer_ethnicityTagId_fkey" FOREIGN KEY ("ethnicityTagId") REFERENCES "StashTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashStudio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "image" TEXT,
    "geviUrl" TEXT,
    "scraperName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StashStudioAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashStudioAlias_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StashStudio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "ignoreAutoTag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StashTagAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashTagAlias_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashTagHierarchy" (
    "parentTagId" TEXT NOT NULL,
    "childTagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("parentTagId", "childTagId"),
    CONSTRAINT "StashTagHierarchy_parentTagId_fkey" FOREIGN KEY ("parentTagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashTagHierarchy_childTagId_fkey" FOREIGN KEY ("childTagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashScenePerformer" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sceneId", "performerId"),
    CONSTRAINT "StashScenePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashScenePerformerTag" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("sceneId", "performerId", "tagId"),
    CONSTRAINT "StashScenePerformerTag_sceneId_performerId_fkey" FOREIGN KEY ("sceneId", "performerId") REFERENCES "StashScenePerformer" ("sceneId", "performerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashSceneTag" (
    "sceneId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("sceneId", "tagId"),
    CONSTRAINT "StashSceneTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashSceneTag_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashPerformerTag" (
    "performerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("performerId", "tagId"),
    CONSTRAINT "StashPerformerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashPerformerTag_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "StashGalleryPerformer" (
    "galleryId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,

    PRIMARY KEY ("galleryId", "performerId"),
    CONSTRAINT "StashGalleryPerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGalleryPerformer_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashGalleryTag" (
    "galleryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("galleryId", "tagId"),
    CONSTRAINT "StashGalleryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGalleryTag_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "StashGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashImagePerformer" (
    "imageId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,

    PRIMARY KEY ("imageId", "performerId"),
    CONSTRAINT "StashImagePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashImagePerformer_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StashImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashImageTag" (
    "imageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("imageId", "tagId"),
    CONSTRAINT "StashImageTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashImageTag_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StashImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashDismissedDuplicateGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneIds" TEXT NOT NULL,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlexPlaylist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ratingKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guid" TEXT,
    "type" TEXT NOT NULL DEFAULT 'playlist',
    "title" TEXT NOT NULL,
    "titleSort" TEXT,
    "summary" TEXT,
    "smart" BOOLEAN NOT NULL DEFAULT false,
    "playlistType" TEXT,
    "thumb" TEXT,
    "composite" TEXT,
    "duration" INTEGER,
    "leafCount" INTEGER,
    "addedAt" DATETIME,
    "updatedAt" DATETIME,
    "librarySectionID" INTEGER,
    CONSTRAINT "PlexPlaylist_librarySectionID_fkey" FOREIGN KEY ("librarySectionID") REFERENCES "PlexLibrarySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlexPlaylistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistRatingKey" TEXT NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "duration" INTEGER,
    "addedAt" DATETIME,
    CONSTRAINT "PlexPlaylistItem_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomPlaylist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomPlaylistTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "duration" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomPlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "CustomPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatingApp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "appId" INTEGER NOT NULL,
    "guyName" TEXT NOT NULL,
    "age" INTEGER,
    "location" TEXT,
    "profileUrl" TEXT,
    "bio" TEXT,
    "photos" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "bodyType" TEXT,
    "bodyHair" TEXT,
    "ethnicity" TEXT,
    "hair" TEXT,
    "tribe" TEXT,
    "position" TEXT,
    "hivStatus" TEXT,
    "lastTested" TEXT,
    "lookingFor" TEXT,
    "relationshipStatus" TEXT,
    "sexPractices" TEXT,
    "verification" TEXT,
    "globalPosition" TEXT,
    "travelMode" BOOLEAN NOT NULL DEFAULT false,
    "privatePhotos" INTEGER NOT NULL DEFAULT 0,
    "woofCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "interests" TEXT,
    "theyAre" TEXT,
    "theyAreInto" TEXT,
    "pronouns" TEXT,
    "genderIdentity" TEXT,
    "openTo" TEXT,
    "sexualHealth" TEXT,
    "distance" TEXT,
    "firstContact" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContact" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "messagesExchanged" INTEGER NOT NULL DEFAULT 0,
    "responseRate" REAL NOT NULL DEFAULT 0.0,
    "avgResponseTime" INTEGER,
    "source" TEXT,
    "extractionConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connection_appId_fkey" FOREIGN KEY ("appId") REFERENCES "DatingApp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Date" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER,
    "guyName" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "duration" INTEGER,
    "cost" REAL,
    "rating" INTEGER,
    "chemistry" INTEGER,
    "conversation" INTEGER,
    "attraction" INTEGER,
    "notes" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "secondDate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Date_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER,
    "dateId" INTEGER,
    "guyName" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER,
    "satisfaction" INTEGER,
    "performance" INTEGER,
    "chemistry" INTEGER,
    "notes" TEXT,
    "protection" BOOLEAN NOT NULL DEFAULT false,
    "tested" BOOLEAN NOT NULL DEFAULT false,
    "testDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "Date" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Encounter_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "sender" TEXT NOT NULL,
    "confidence" REAL,
    "screenshotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "messagesExtracted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Screenshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'note',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "folderId" INTEGER,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "links" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteFolder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NoteFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NoteCrossLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromNoteId" INTEGER NOT NULL,
    "toNoteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteCrossLink_toNoteId_fkey" FOREIGN KEY ("toNoteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteCrossLink_fromNoteId_fkey" FOREIGN KEY ("fromNoteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'daily',
    "variables" TEXT NOT NULL DEFAULT '[]',
    "userId" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "noteId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "mood" TEXT,
    "weather" TEXT,
    "goals" TEXT NOT NULL DEFAULT '[]',
    "habits" TEXT NOT NULL DEFAULT '[]',
    "gratitude" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackgroundImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT,
    "path" TEXT NOT NULL,
    "url" TEXT,
    "size" INTEGER,
    "mimetype" TEXT,
    "galleryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "height" INTEGER,
    "width" INTEGER,
    CONSTRAINT "BackgroundImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "BackgroundGallery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackgroundGallery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#3B82F6',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6B7280',
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "projectId" INTEGER,
    "categoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "minutes" INTEGER,
    "taskId" INTEGER,
    "projectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'project',
    "targetValue" INTEGER,
    "currentValue" INTEGER DEFAULT 0,
    "unit" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "projectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dependentTaskId" INTEGER NOT NULL,
    "dependsOnTaskId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDependency_dependentTaskId_fkey" FOREIGN KEY ("dependentTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'place',
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "category" TEXT,
    "rating" REAL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "website" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "noteId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricalEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "details" TEXT,
    "category" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryVideo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "courseTitle" TEXT,
    "lectureNumber" INTEGER,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    "channelId" INTEGER,
    "assignLater" BOOLEAN NOT NULL DEFAULT false,
    "assignedByAI" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HistoryVideo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "HistoryChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "channelUrl" TEXT NOT NULL,
    "description" TEXT,
    "subscriberCount" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryBook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "publishYear" INTEGER,
    "description" TEXT,
    "coverUrl" TEXT,
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistoryBook_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bookId" INTEGER NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistoryChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "HistoryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryChapter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistorySection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "eventId" INTEGER,
    CONSTRAINT "HistorySection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "HistoryChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistorySection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER,
    "eventId" INTEGER NOT NULL,
    CONSTRAINT "ReadingList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "HistoryCourse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "instructor" TEXT,
    "thumbnail" TEXT,
    "description" TEXT,
    "guidebook" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryCourseVideo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "courseId" INTEGER NOT NULL,
    CONSTRAINT "HistoryCourseVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "HistoryCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_event_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_event_reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_video_watches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" INTEGER NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_video_watches_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "HistoryVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_book_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_book_reads_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "HistoryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_chapter_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_chapter_reads_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "HistoryChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_section_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_section_reads_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HistorySection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyWeatherSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tempMin" REAL,
    "tempMax" REAL,
    "tempAvg" REAL,
    "humidity" INTEGER,
    "precipitation" REAL,
    "windSpeed" REAL,
    "pressure" REAL,
    "cloudiness" INTEGER,
    "sunrise" TEXT,
    "sunset" TEXT,
    "weatherData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "publishYear" INTEGER,
    "description" TEXT,
    "coverUrl" TEXT,
    "pageCount" INTEGER,
    "openLibraryId" TEXT,
    "komgaBookId" TEXT,
    "komgaSeriesId" TEXT,
    "komgaUrl" TEXT,
    "komgaMetadata" TEXT,
    "isHistoryPlusBook" BOOLEAN NOT NULL DEFAULT false,
    "originalHistoryBookId" INTEGER,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BookChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "eventId" INTEGER,
    "originalHistoryChapterId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookChapter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapterId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "eventId" INTEGER,
    "originalHistorySectionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookSection_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "currentPage" INTEGER,
    "percentRead" REAL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCompletion_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChapterCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapterId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChapterCompletion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sectionId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionCompletion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BookSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoryBookLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryBookLink_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryBookLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "developer" TEXT,
    "publisher" TEXT,
    "releaseDate" DATETIME,
    "description" TEXT,
    "platforms" TEXT,
    "genres" TEXT,
    "rating" REAL,
    "metacriticRating" INTEGER,
    "rawgId" INTEGER,
    "rawgSlug" TEXT,
    "rawgUrl" TEXT,
    "coverUrl" TEXT,
    "artworkLastCached" DATETIME,
    "artworkMimeType" TEXT,
    "localArtworkPath" TEXT,
    "originalArtworkUrl" TEXT,
    "esrbRating" TEXT,
    "playtimeHours" INTEGER,
    "website" TEXT,
    "webvideoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "hoursPlayed" REAL,
    "percentComplete" REAL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameCompletion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "VideoGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexLibrarySection_sectionKey_key" ON "PlexLibrarySection"("sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexTVShow_ratingKey_key" ON "PlexTVShow"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexSeason_ratingKey_key" ON "PlexSeason"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexEpisode_ratingKey_key" ON "PlexEpisode"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexMovie_ratingKey_key" ON "PlexMovie"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbSeries_tvdbId_key" ON "TvdbSeries"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbSeason_tvdbId_key" ON "TvdbSeason"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbEpisode_tvdbId_key" ON "TvdbEpisode"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbArtwork_tvdbId_seriesTvdbId_seasonTvdbId_key" ON "TvdbArtwork"("tvdbId", "seriesTvdbId", "seasonTvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "PlexArtist_ratingKey_key" ON "PlexArtist"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexAlbum_ratingKey_key" ON "PlexAlbum"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlexTrack_ratingKey_key" ON "PlexTrack"("ratingKey");

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
CREATE UNIQUE INDEX "StashClip_sceneId_clipIndex_key" ON "StashClip"("sceneId", "clipIndex");

-- CreateIndex
CREATE UNIQUE INDEX "StashClipTag_clipId_tagId_key" ON "StashClipTag"("clipId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "StashClipPerformerTag_clipId_performerId_tagId_key" ON "StashClipPerformerTag"("clipId", "performerId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "StashMarker_stashId_key" ON "StashMarker"("stashId");

-- CreateIndex
CREATE UNIQUE INDEX "StashStudio_name_key" ON "StashStudio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StashStudioAlias_studioId_alias_key" ON "StashStudioAlias"("studioId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "StashTag_name_key" ON "StashTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StashTagAlias_tagId_alias_key" ON "StashTagAlias"("tagId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "StashDismissedDuplicateGroup_sceneIds_key" ON "StashDismissedDuplicateGroup"("sceneIds");

-- CreateIndex
CREATE UNIQUE INDEX "PlexPlaylist_ratingKey_key" ON "PlexPlaylist"("ratingKey");

-- CreateIndex
CREATE UNIQUE INDEX "DatingApp_name_key" ON "DatingApp"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_appId_guyName_key" ON "Connection"("appId", "guyName");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Note_type_idx" ON "Note"("type");

-- CreateIndex
CREATE INDEX "Note_folderId_idx" ON "Note"("folderId");

-- CreateIndex
CREATE INDEX "Note_isFavorite_idx" ON "Note"("isFavorite");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Note_updatedAt_idx" ON "Note"("updatedAt");

-- CreateIndex
CREATE INDEX "NoteFolder_userId_idx" ON "NoteFolder"("userId");

-- CreateIndex
CREATE INDEX "NoteFolder_parentId_idx" ON "NoteFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTag_name_key" ON "NoteTag"("name");

-- CreateIndex
CREATE INDEX "NoteTag_userId_idx" ON "NoteTag"("userId");

-- CreateIndex
CREATE INDEX "NoteTag_count_idx" ON "NoteTag"("count");

-- CreateIndex
CREATE INDEX "NoteCrossLink_fromNoteId_idx" ON "NoteCrossLink"("fromNoteId");

-- CreateIndex
CREATE INDEX "NoteCrossLink_toNoteId_idx" ON "NoteCrossLink"("toNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteCrossLink_fromNoteId_toNoteId_key" ON "NoteCrossLink"("fromNoteId", "toNoteId");

-- CreateIndex
CREATE INDEX "NoteTemplate_userId_idx" ON "NoteTemplate"("userId");

-- CreateIndex
CREATE INDEX "NoteTemplate_type_idx" ON "NoteTemplate"("type");

-- CreateIndex
CREATE INDEX "NoteTemplate_isDefault_idx" ON "NoteTemplate"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNote_date_key" ON "DailyNote"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNote_noteId_key" ON "DailyNote"("noteId");

-- CreateIndex
CREATE INDEX "DailyNote_userId_idx" ON "DailyNote"("userId");

-- CreateIndex
CREATE INDEX "DailyNote_date_idx" ON "DailyNote"("date");

-- CreateIndex
CREATE INDEX "BackgroundImage_galleryId_idx" ON "BackgroundImage"("galleryId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategory_name_key" ON "TaskCategory"("name");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_categoryId_idx" ON "Task"("categoryId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimeEntry_startTime_idx" ON "TimeEntry"("startTime");

-- CreateIndex
CREATE INDEX "Goal_projectId_idx" ON "Goal"("projectId");

-- CreateIndex
CREATE INDEX "Goal_type_idx" ON "Goal"("type");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE INDEX "TaskDependency_dependentTaskId_idx" ON "TaskDependency"("dependentTaskId");

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_dependentTaskId_dependsOnTaskId_key" ON "TaskDependency"("dependentTaskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "Location_userId_idx" ON "Location"("userId");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "Location_category_idx" ON "Location"("category");

-- CreateIndex
CREATE INDEX "Location_isFavorite_idx" ON "Location"("isFavorite");

-- CreateIndex
CREATE INDEX "Location_latitude_longitude_idx" ON "Location"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Location_city_idx" ON "Location"("city");

-- CreateIndex
CREATE INDEX "Location_country_idx" ON "Location"("country");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryVideo_url_key" ON "HistoryVideo"("url");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryChannel_channelUrl_key" ON "HistoryChannel"("channelUrl");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryChapter_bookId_chapterNumber_key" ON "HistoryChapter"("bookId", "chapterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HistorySection_chapterId_sectionNumber_key" ON "HistorySection"("chapterId", "sectionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCategory_name_key" ON "HistoryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCourse_url_key" ON "HistoryCourse"("url");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryCourseVideo_url_key" ON "HistoryCourseVideo"("url");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_reviews_eventId_key" ON "user_event_reviews"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "user_video_watches_videoId_key" ON "user_video_watches"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "user_book_reads_bookId_key" ON "user_book_reads"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_reads_chapterId_key" ON "user_chapter_reads"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_section_reads_sectionId_key" ON "user_section_reads"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWeatherSummary_date_key" ON "DailyWeatherSummary"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "Book_openLibraryId_key" ON "Book"("openLibraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_komgaBookId_key" ON "Book"("komgaBookId");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_openLibraryId_idx" ON "Book"("openLibraryId");

-- CreateIndex
CREATE INDEX "Book_isHistoryPlusBook_idx" ON "Book"("isHistoryPlusBook");

-- CreateIndex
CREATE INDEX "Book_originalHistoryBookId_idx" ON "Book"("originalHistoryBookId");

-- CreateIndex
CREATE INDEX "Book_komgaBookId_idx" ON "Book"("komgaBookId");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "BookChapter_bookId_idx" ON "BookChapter"("bookId");

-- CreateIndex
CREATE INDEX "BookChapter_eventId_idx" ON "BookChapter"("eventId");

-- CreateIndex
CREATE INDEX "BookChapter_originalHistoryChapterId_idx" ON "BookChapter"("originalHistoryChapterId");

-- CreateIndex
CREATE UNIQUE INDEX "BookChapter_bookId_chapterNumber_key" ON "BookChapter"("bookId", "chapterNumber");

-- CreateIndex
CREATE INDEX "BookSection_chapterId_idx" ON "BookSection"("chapterId");

-- CreateIndex
CREATE INDEX "BookSection_eventId_idx" ON "BookSection"("eventId");

-- CreateIndex
CREATE INDEX "BookSection_originalHistorySectionId_idx" ON "BookSection"("originalHistorySectionId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSection_chapterId_sectionNumber_key" ON "BookSection"("chapterId", "sectionNumber");

-- CreateIndex
CREATE INDEX "BookCompletion_bookId_idx" ON "BookCompletion"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCompletion_bookId_userId_key" ON "BookCompletion"("bookId", "userId");

-- CreateIndex
CREATE INDEX "ChapterCompletion_chapterId_idx" ON "ChapterCompletion"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCompletion_chapterId_userId_key" ON "ChapterCompletion"("chapterId", "userId");

-- CreateIndex
CREATE INDEX "SectionCompletion_sectionId_idx" ON "SectionCompletion"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCompletion_sectionId_userId_key" ON "SectionCompletion"("sectionId", "userId");

-- CreateIndex
CREATE INDEX "HistoryBookLink_bookId_idx" ON "HistoryBookLink"("bookId");

-- CreateIndex
CREATE INDEX "HistoryBookLink_eventId_idx" ON "HistoryBookLink"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryBookLink_bookId_eventId_key" ON "HistoryBookLink"("bookId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGame_rawgId_key" ON "VideoGame"("rawgId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGame_rawgSlug_key" ON "VideoGame"("rawgSlug");

-- CreateIndex
CREATE INDEX "VideoGame_rawgId_idx" ON "VideoGame"("rawgId");

-- CreateIndex
CREATE INDEX "VideoGame_rawgSlug_idx" ON "VideoGame"("rawgSlug");

-- CreateIndex
CREATE INDEX "VideoGame_title_idx" ON "VideoGame"("title");

-- CreateIndex
CREATE INDEX "VideoGame_platforms_idx" ON "VideoGame"("platforms");

-- CreateIndex
CREATE INDEX "VideoGame_genres_idx" ON "VideoGame"("genres");

-- CreateIndex
CREATE INDEX "GameCompletion_gameId_idx" ON "GameCompletion"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameCompletion_gameId_userId_key" ON "GameCompletion"("gameId", "userId");

