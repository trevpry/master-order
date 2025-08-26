-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "timezone" TEXT DEFAULT 'UTC',
    "tvGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "moviesGeneralPercent" INTEGER NOT NULL DEFAULT 50,
    "customOrderPercent" INTEGER NOT NULL DEFAULT 0,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "moviesGeneralPercent", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt") SELECT "christmasFilterEnabled", "collectionName", "comicVineApiKey", "createdAt", "customOrderPercent", "id", "ignoredMovieCollections", "ignoredTVCollections", "komgaApiKey", "komgaUrl", "moviesGeneralPercent", "partiallyWatchedCollectionPercent", "plexSyncInterval", "plexToken", "plexUrl", "selectedPlayer", "selectedPlexUser", "stashApiKey", "stashUrl", "timezone", "tvGeneralPercent", "tvdbApiKey", "tvdbBearerToken", "tvdbToken", "tvdbTokenExpiry", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
