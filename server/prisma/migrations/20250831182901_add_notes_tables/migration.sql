-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'note',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "folderId" INTEGER,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "links" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteFolder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NoteFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NoteCrossLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromNoteId" INTEGER NOT NULL,
    "toNoteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteCrossLink_fromNoteId_fkey" FOREIGN KEY ("fromNoteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteCrossLink_toNoteId_fkey" FOREIGN KEY ("toNoteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Note_type_idx" ON "Note"("type");

-- CreateIndex
CREATE INDEX "Note_folderId_idx" ON "Note"("folderId");

-- CreateIndex
CREATE INDEX "Note_isFavorite_idx" ON "Note"("isFavorite");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Note_updatedAt_idx" ON "Note"("updatedAt");

-- CreateIndex
CREATE INDEX "NoteFolder_userId_idx" ON "NoteFolder"("userId");

-- CreateIndex
CREATE INDEX "NoteFolder_parentId_idx" ON "NoteFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTag_name_key" ON "NoteTag"("name");

-- CreateIndex
CREATE INDEX "NoteTag_userId_idx" ON "NoteTag"("userId");

-- CreateIndex
CREATE INDEX "NoteTag_count_idx" ON "NoteTag"("count");

-- CreateIndex
CREATE INDEX "NoteCrossLink_fromNoteId_idx" ON "NoteCrossLink"("fromNoteId");

-- CreateIndex
CREATE INDEX "NoteCrossLink_toNoteId_idx" ON "NoteCrossLink"("toNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteCrossLink_fromNoteId_toNoteId_key" ON "NoteCrossLink"("fromNoteId", "toNoteId");
