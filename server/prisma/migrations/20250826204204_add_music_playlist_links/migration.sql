-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "icon" TEXT,
    "parentOrderId" INTEGER,
    "playlistRatingKey" TEXT,
    "customPlaylistId" INTEGER,
    CONSTRAINT "CustomOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "CustomOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_playlistRatingKey_fkey" FOREIGN KEY ("playlistRatingKey") REFERENCES "PlexPlaylist" ("ratingKey") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomOrder_customPlaylistId_fkey" FOREIGN KEY ("customPlaylistId") REFERENCES "CustomPlaylist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomOrder" ("createdAt", "description", "icon", "id", "isActive", "name", "parentOrderId", "updatedAt") SELECT "createdAt", "description", "icon", "id", "isActive", "name", "parentOrderId", "updatedAt" FROM "CustomOrder";
DROP TABLE "CustomOrder";
ALTER TABLE "new_CustomOrder" RENAME TO "CustomOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
