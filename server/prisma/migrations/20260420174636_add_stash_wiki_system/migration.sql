-- CreateTable
CREATE TABLE "StashWikiPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "tagId" TEXT,
    "relatedTagIds" TEXT NOT NULL DEFAULT '[]',
    "inboundLinks" TEXT NOT NULL DEFAULT '[]',
    "outboundLinks" TEXT NOT NULL DEFAULT '[]',
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StashWikiLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'tag',
    "sourceId" TEXT,
    "affectedPages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "StashWikiPage_slug_key" ON "StashWikiPage"("slug");

-- CreateIndex
CREATE INDEX "StashWikiPage_tagId_idx" ON "StashWikiPage"("tagId");

-- CreateIndex
CREATE INDEX "StashWikiPage_updatedAt_idx" ON "StashWikiPage"("updatedAt");

-- CreateIndex
CREATE INDEX "StashWikiLog_action_idx" ON "StashWikiLog"("action");

-- CreateIndex
CREATE INDEX "StashWikiLog_sourceType_idx" ON "StashWikiLog"("sourceType");

-- CreateIndex
CREATE INDEX "StashWikiLog_createdAt_idx" ON "StashWikiLog"("createdAt");
