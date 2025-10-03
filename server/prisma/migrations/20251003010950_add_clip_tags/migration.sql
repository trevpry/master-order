-- CreateTable
CREATE TABLE "StashClipTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clipId" INTEGER NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashClipTag_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "StashClip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashClipTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StashClipTag_clipId_tagId_key" ON "StashClipTag"("clipId", "tagId");
