-- CreateTable
CREATE TABLE "EddieSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weatherApiKey" TEXT,
    "weatherLocation" TEXT,
    "weatherUnits" TEXT NOT NULL DEFAULT 'metric',
    "weatherEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
