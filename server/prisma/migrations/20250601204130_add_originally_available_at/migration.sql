-- AlterTable
ALTER TABLE "PlexEpisode" ADD COLUMN "originallyAvailableAt" TEXT;

-- AlterTable
ALTER TABLE "PlexMovie" ADD COLUMN "originallyAvailableAt" TEXT;

-- RedefineIndex
DROP INDEX "TvdbArtwork_unique_context";
CREATE UNIQUE INDEX "TvdbArtwork_tvdbId_seriesTvdbId_seasonTvdbId_key" ON "TvdbArtwork"("tvdbId", "seriesTvdbId", "seasonTvdbId");
