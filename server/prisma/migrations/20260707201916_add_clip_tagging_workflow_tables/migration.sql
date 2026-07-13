-- CreateTable
CREATE TABLE "ClipTaggingWorkflowNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagId" TEXT NOT NULL,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClipTaggingWorkflowNode_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClipTaggingWorkflowConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceTagId" TEXT NOT NULL,
    "targetTagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipTaggingWorkflowNode_tagId_key" ON "ClipTaggingWorkflowNode"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ClipTaggingWorkflowConnection_sourceTagId_targetTagId_key" ON "ClipTaggingWorkflowConnection"("sourceTagId", "targetTagId");
