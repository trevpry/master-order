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
    CONSTRAINT "PlexLabel_movieRatingKey_fkey" FOREIGN KEY ("movieRatingKey") REFERENCES "PlexMovie" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlexLabel_showRatingKey_fkey" FOREIGN KEY ("showRatingKey") REFERENCES "PlexTVShow" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE
);
