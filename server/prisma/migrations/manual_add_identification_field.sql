-- Manual migration: Add identification field to StashScene table
-- This can be run on both SQLite and PostgreSQL

-- For SQLite and PostgreSQL
ALTER TABLE "StashScene" ADD COLUMN "identification" TEXT;

-- Optional: Set default value for existing records
-- UPDATE "StashScene" SET "identification" = 'Not Identified' WHERE "identification" IS NULL;
