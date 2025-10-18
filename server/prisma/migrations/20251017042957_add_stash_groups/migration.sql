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
