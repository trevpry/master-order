-- CreateTable
CREATE TABLE "PlexDeletedEntity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "title" TEXT,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexDeletedEntity_entityType_ratingKey_key" ON "PlexDeletedEntity"("entityType", "ratingKey");
