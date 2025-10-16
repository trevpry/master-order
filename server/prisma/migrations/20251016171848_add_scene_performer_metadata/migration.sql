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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashScenePerformer" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "characterName" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "costume" TEXT,
    "performance" TEXT,
    "customData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sceneId", "performerId"),
    CONSTRAINT "StashScenePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StashScenePerformer" ("performerId", "sceneId") SELECT "performerId", "sceneId" FROM "StashScenePerformer";
DROP TABLE "StashScenePerformer";
ALTER TABLE "new_StashScenePerformer" RENAME TO "StashScenePerformer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StashClipPerformerTag_clipId_performerId_tagId_key" ON "StashClipPerformerTag"("clipId", "performerId", "tagId");
