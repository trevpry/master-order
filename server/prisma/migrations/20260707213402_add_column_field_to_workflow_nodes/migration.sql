-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClipTaggingWorkflowNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagId" TEXT NOT NULL,
    "column" INTEGER NOT NULL DEFAULT 0,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClipTaggingWorkflowNode_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StashTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClipTaggingWorkflowNode" ("createdAt", "id", "positionX", "positionY", "tagId", "updatedAt") SELECT "createdAt", "id", "positionX", "positionY", "tagId", "updatedAt" FROM "ClipTaggingWorkflowNode";
DROP TABLE "ClipTaggingWorkflowNode";
ALTER TABLE "new_ClipTaggingWorkflowNode" RENAME TO "ClipTaggingWorkflowNode";
CREATE UNIQUE INDEX "ClipTaggingWorkflowNode_tagId_key" ON "ClipTaggingWorkflowNode"("tagId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
