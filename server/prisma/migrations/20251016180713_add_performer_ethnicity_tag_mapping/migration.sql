-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StashPerformer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "disambiguation" TEXT,
    "alias" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "ignore_auto_tag" BOOLEAN NOT NULL DEFAULT false,
    "birthdate" TEXT,
    "death_date" TEXT,
    "ethnicity" TEXT,
    "ethnicityTagId" TEXT,
    "country" TEXT,
    "eye_color" TEXT,
    "hair_color" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "measurements" TEXT,
    "fake_tits" TEXT,
    "career_length" TEXT,
    "tattoos" TEXT,
    "piercings" TEXT,
    "image" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "url" TEXT,
    "gender" TEXT,
    "details" TEXT,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StashPerformer_ethnicityTagId_fkey" FOREIGN KEY ("ethnicityTagId") REFERENCES "StashTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StashPerformer" ("alias", "birthdate", "career_length", "country", "createdAt", "death_date", "details", "disambiguation", "ethnicity", "eye_color", "fake_tits", "favorite", "gender", "hair_color", "height", "id", "ignore_auto_tag", "image", "instagram", "lastSyncedAt", "measurements", "name", "piercings", "rating", "tattoos", "twitter", "updatedAt", "url", "weight") SELECT "alias", "birthdate", "career_length", "country", "createdAt", "death_date", "details", "disambiguation", "ethnicity", "eye_color", "fake_tits", "favorite", "gender", "hair_color", "height", "id", "ignore_auto_tag", "image", "instagram", "lastSyncedAt", "measurements", "name", "piercings", "rating", "tattoos", "twitter", "updatedAt", "url", "weight" FROM "StashPerformer";
DROP TABLE "StashPerformer";
ALTER TABLE "new_StashPerformer" RENAME TO "StashPerformer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
