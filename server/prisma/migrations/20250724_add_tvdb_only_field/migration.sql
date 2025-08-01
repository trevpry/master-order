-- AddTvdbOnlyField
-- Add field to track TVDB-only items that don't exist in Plex yet

ALTER TABLE "CustomOrderItem" ADD COLUMN "isFromTvdbOnly" BOOLEAN NOT NULL DEFAULT false;
