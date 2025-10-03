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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashTag" (
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
INSERT INTO "new_StashTag" ("createdAt", "description", "id", "image", "lastSyncedAt", "name", "updatedAt") SELECT "createdAt", "description", "id", "image", "lastSyncedAt", "name", "updatedAt" FROM "StashTag";
DROP TABLE "StashTag";
ALTER TABLE "new_StashTag" RENAME TO "StashTag";
CREATE UNIQUE INDEX "StashTag_name_key" ON "StashTag"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StashTagAlias_tagId_alias_key" ON "StashTagAlias"("tagId", "alias");
