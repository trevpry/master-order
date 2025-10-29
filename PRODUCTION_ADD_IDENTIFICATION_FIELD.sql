-- Production PostgreSQL Migration: Add identification field to StashScene table
-- Run this on your production PostgreSQL database

-- Add the identification column
ALTER TABLE "StashScene" ADD COLUMN IF NOT EXISTS "identification" TEXT;

-- Optional: Set default value for existing records (uncomment if desired)
-- UPDATE "StashScene" SET "identification" = 'Not Identified' WHERE "identification" IS NULL;

-- Verify the column was added
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'StashScene' AND column_name = 'identification';
