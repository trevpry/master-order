-- Fix TVDB artwork contamination by changing unique constraint
-- The issue: tvdbId alone is not globally unique across different series
-- Solution: Use composite unique constraint that includes series/season context

-- Step 1: Drop the existing problematic unique index
DROP INDEX "TvdbArtwork_tvdbId_key";

-- Step 2: Create a new composite unique constraint that prevents contamination
-- This ensures artwork is unique within the context of a specific series/season combination
CREATE UNIQUE INDEX "TvdbArtwork_unique_context" ON "TvdbArtwork"("tvdbId", "seriesTvdbId", "seasonTvdbId");

-- Step 3: Clean up any existing contaminated records
-- Delete duplicate artwork records where the same tvdbId appears with different series
-- Keep only the most recently synced record for each unique combination
DELETE FROM "TvdbArtwork" 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM "TvdbArtwork" 
  GROUP BY "tvdbId", "seriesTvdbId", "seasonTvdbId"
);
