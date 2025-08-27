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

-- CreateIndex
CREATE UNIQUE INDEX "StashMarker_stashId_key" ON "StashMarker"("stashId");
