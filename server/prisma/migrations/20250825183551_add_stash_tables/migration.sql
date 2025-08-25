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
    "code" TEXT,
    "director" TEXT,
    "synopsis" TEXT,
    CONSTRAINT "StashScene_studio_fkey" FOREIGN KEY ("studio") REFERENCES "StashStudio" ("name") ON DELETE SET NULL ON UPDATE CASCADE
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
    "ethnicity" TEXT,
    "country" TEXT,
    "eye_color" TEXT,
    "height" TEXT,
    "measurements" TEXT,
    "fake_tits" TEXT,
    "career_length" TEXT,
    "tattoos" TEXT,
    "piercings" TEXT,
    "image" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StashStudio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StashTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StashScenePerformer" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,

    PRIMARY KEY ("sceneId", "performerId"),
    CONSTRAINT "StashScenePerformer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashSceneTag" (
    "sceneId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("sceneId", "tagId"),
    CONSTRAINT "StashSceneTag_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashSceneTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StashPerformerTag" (
    "performerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("performerId", "tagId"),
    CONSTRAINT "StashPerformerTag_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashPerformerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StashStudio_name_key" ON "StashStudio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StashTag_name_key" ON "StashTag"("name");
