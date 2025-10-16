/*
  Warnings:

  - You are about to drop the column `characterName` on the `StashScenePerformer` table. All the data in the column will be lost.
  - You are about to drop the column `costume` on the `StashScenePerformer` table. All the data in the column will be lost.
  - You are about to drop the column `customData` on the `StashScenePerformer` table. All the data in the column will be lost.
  - You are about to drop the column `performance` on the `StashScenePerformer` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `StashScenePerformer` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StashScenePerformerTag" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("sceneId", "performerId", "tagId"),
    CONSTRAINT "StashScenePerformerTag_sceneId_performerId_fkey" FOREIGN KEY ("sceneId", "performerId") REFERENCES "StashScenePerformer" ("sceneId", "performerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashScenePerformer" (
    "sceneId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sceneId", "performerId"),
    CONSTRAINT "StashScenePerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashScenePerformer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StashScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StashScenePerformer" ("createdAt", "notes", "performerId", "sceneId", "updatedAt") SELECT "createdAt", "notes", "performerId", "sceneId", "updatedAt" FROM "StashScenePerformer";
DROP TABLE "StashScenePerformer";
ALTER TABLE "new_StashScenePerformer" RENAME TO "StashScenePerformer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
