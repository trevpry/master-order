-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'daily',
    "variables" TEXT NOT NULL DEFAULT '[]',
    "userId" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "noteId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "mood" TEXT,
    "weather" TEXT,
    "goals" TEXT NOT NULL DEFAULT '[]',
    "habits" TEXT NOT NULL DEFAULT '[]',
    "gratitude" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NoteTemplate_userId_idx" ON "NoteTemplate"("userId");

-- CreateIndex
CREATE INDEX "NoteTemplate_type_idx" ON "NoteTemplate"("type");

-- CreateIndex
CREATE INDEX "NoteTemplate_isDefault_idx" ON "NoteTemplate"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNote_date_key" ON "DailyNote"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNote_noteId_key" ON "DailyNote"("noteId");

-- CreateIndex
CREATE INDEX "DailyNote_userId_idx" ON "DailyNote"("userId");

-- CreateIndex
CREATE INDEX "DailyNote_date_idx" ON "DailyNote"("date");
