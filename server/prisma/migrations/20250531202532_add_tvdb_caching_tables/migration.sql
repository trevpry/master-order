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
    CONSTRAINT "TvdbArtwork_seriesTvdbId_fkey" FOREIGN KEY ("seriesTvdbId") REFERENCES "TvdbSeries" ("tvdbId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TvdbArtwork_seasonTvdbId_fkey" FOREIGN KEY ("seasonTvdbId") REFERENCES "TvdbSeason" ("tvdbId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TvdbSeries_tvdbId_key" ON "TvdbSeries"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbSeason_tvdbId_key" ON "TvdbSeason"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbEpisode_tvdbId_key" ON "TvdbEpisode"("tvdbId");

-- CreateIndex
CREATE UNIQUE INDEX "TvdbArtwork_tvdbId_key" ON "TvdbArtwork"("tvdbId");
