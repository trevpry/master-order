-- CreateTable
CREATE TABLE "ClipTaggingWorkflowColumnName" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "column" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipTaggingWorkflowColumnName_column_key" ON "ClipTaggingWorkflowColumnName"("column");
