-- CreateTable
CREATE TABLE "DatingApp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "appId" INTEGER NOT NULL,
    "guyName" TEXT NOT NULL,
    "age" INTEGER,
    "location" TEXT,
    "profileUrl" TEXT,
    "bio" TEXT,
    "photos" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "bodyType" TEXT,
    "bodyHair" TEXT,
    "ethnicity" TEXT,
    "hair" TEXT,
    "tribe" TEXT,
    "position" TEXT,
    "hivStatus" TEXT,
    "lastTested" TEXT,
    "lookingFor" TEXT,
    "relationshipStatus" TEXT,
    "sexPractices" TEXT,
    "verification" TEXT,
    "globalPosition" TEXT,
    "travelMode" BOOLEAN NOT NULL DEFAULT false,
    "privatePhotos" INTEGER NOT NULL DEFAULT 0,
    "woofCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "interests" TEXT,
    "theyAre" TEXT,
    "theyAreInto" TEXT,
    "pronouns" TEXT,
    "genderIdentity" TEXT,
    "openTo" TEXT,
    "sexualHealth" TEXT,
    "distance" TEXT,
    "firstContact" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContact" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "messagesExchanged" INTEGER NOT NULL DEFAULT 0,
    "responseRate" REAL NOT NULL DEFAULT 0.0,
    "avgResponseTime" INTEGER,
    "source" TEXT,
    "extractionConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connection_appId_fkey" FOREIGN KEY ("appId") REFERENCES "DatingApp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Date" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER,
    "guyName" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "duration" INTEGER,
    "cost" REAL,
    "rating" INTEGER,
    "chemistry" INTEGER,
    "conversation" INTEGER,
    "attraction" INTEGER,
    "notes" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "secondDate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Date_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER,
    "dateId" INTEGER,
    "guyName" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER,
    "satisfaction" INTEGER,
    "performance" INTEGER,
    "chemistry" INTEGER,
    "notes" TEXT,
    "protection" BOOLEAN NOT NULL DEFAULT false,
    "tested" BOOLEAN NOT NULL DEFAULT false,
    "testDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Encounter_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "Date" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "sender" TEXT NOT NULL,
    "confidence" REAL,
    "screenshotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "messagesExtracted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Screenshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DatingApp_name_key" ON "DatingApp"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_appId_guyName_key" ON "Connection"("appId", "guyName");
