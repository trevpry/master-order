-- CreateTable
CREATE TABLE "StashGroupPerformer" (
    "groupId" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "performerId"),
    CONSTRAINT "StashGroupPerformer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StashGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StashGroupPerformer_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "StashPerformer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StashGroupPerformer_performerId_idx" ON "StashGroupPerformer"("performerId");
