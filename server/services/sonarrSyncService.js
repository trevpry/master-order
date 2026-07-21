const SonarrService = require('./sonarrService');
const MediaProbeService = require('./mediaProbeService');
const prisma = require('../prismaClient');
const { mapRemotePathToLocal } = require('../utils/libraryPathMapper');

const mediaProbeService = new MediaProbeService();

/**
 * Mirrors PlexSyncService's shape (fullSync/testConnection) but populates
 * the Sonarr-backed `Show`/`Season`/`Episode` tables instead of Plex* tables.
 * See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 1).
 */
class SonarrSyncService {
  constructor() {
    this.sonarrService = new SonarrService();
  }

  async testConnection() {
    return this.sonarrService.testConnection();
  }

  mapShowToRow(sonarrSeries) {
    const images = Array.isArray(sonarrSeries.images) ? sonarrSeries.images : [];

    return {
      sonarrId: sonarrSeries.id,
      tvdbId: sonarrSeries.tvdbId ?? null,
      imdbId: sonarrSeries.imdbId ?? null,
      title: sonarrSeries.title,
      sortTitle: sonarrSeries.sortTitle ?? null,
      year: sonarrSeries.year ?? null,
      overview: sonarrSeries.overview ?? null,
      network: sonarrSeries.network ?? null,
      genres: Array.isArray(sonarrSeries.genres) ? JSON.stringify(sonarrSeries.genres) : null,
      status: sonarrSeries.status ?? null,
      posterUrl: images.find((img) => img.coverType === 'poster')?.remoteUrl ?? null,
      fanartUrl: images.find((img) => img.coverType === 'fanart')?.remoteUrl ?? null,
      path: sonarrSeries.path,
      monitored: !!sonarrSeries.monitored,
      addedAt: sonarrSeries.added ? new Date(sonarrSeries.added) : null,
      sonarrUpdatedAt: new Date(),
      removed: false,
      lastSyncedAt: new Date(),
    };
  }

  mapEpisodeToRow(sonarrEpisode, episodeFilesById, seasonId) {
    const episodeFile = sonarrEpisode.episodeFileId ? episodeFilesById.get(sonarrEpisode.episodeFileId) : null;
    const mediaInfo = episodeFile?.mediaInfo || {};
    const remoteFilePath = episodeFile?.path || null;

    const resolution = mediaInfo.resolution
      || (mediaInfo.width && mediaInfo.height ? `${mediaInfo.width}x${mediaInfo.height}` : null);

    return {
      sonarrEpisodeId: sonarrEpisode.id,
      seasonId,
      episodeNumber: sonarrEpisode.episodeNumber,
      title: sonarrEpisode.title ?? null,
      overview: sonarrEpisode.overview ?? null,
      airDate: sonarrEpisode.airDateUtc ? new Date(sonarrEpisode.airDateUtc) : null,
      runtime: sonarrEpisode.runtime ?? null,
      path: episodeFile?.path ?? null,
      relativePath: episodeFile?.relativePath ?? null,
      filePath: remoteFilePath ? mapRemotePathToLocal(remoteFilePath) : null,
      fileSize: episodeFile?.size != null ? BigInt(Math.trunc(episodeFile.size)) : null,
      videoCodec: mediaInfo.videoCodec ?? null,
      audioCodec: mediaInfo.audioCodec ?? null,
      resolution,
      container: episodeFile?.container ?? null,
      hasFile: !!sonarrEpisode.hasFile,
      monitored: !!sonarrEpisode.monitored,
      removed: false,
      lastSyncedAt: new Date(),
    };
  }

  /** Sync a single series' seasons + episodes. Returns { added, updated }. */
  async syncSeasonsAndEpisodes(showId, sonarrSeries) {
    let added = 0;
    let updated = 0;

    const seasonIdByNumber = new Map();
    for (const seasonSummary of sonarrSeries.seasons || []) {
      const seasonRow = {
        showId,
        seasonNumber: seasonSummary.seasonNumber,
        monitored: !!seasonSummary.monitored,
        removed: false,
      };

      const season = await prisma.season.upsert({
        where: { showId_seasonNumber: { showId, seasonNumber: seasonSummary.seasonNumber } },
        create: seasonRow,
        update: seasonRow,
      });
      seasonIdByNumber.set(season.seasonNumber, season.id);
    }

    const [episodes, episodeFiles] = await Promise.all([
      this.sonarrService.getEpisodes(sonarrSeries.id),
      this.sonarrService.getEpisodeFiles(sonarrSeries.id),
    ]);

    const episodeFilesById = new Map((episodeFiles || []).map((file) => [file.id, file]));
    const seenSonarrEpisodeIds = [];

    for (const sonarrEpisode of episodes || []) {
      let seasonId = seasonIdByNumber.get(sonarrEpisode.seasonNumber);
      if (!seasonId) {
        // Season wasn't in the series' seasons[] summary (rare) - create it on the fly
        const seasonRow = { showId, seasonNumber: sonarrEpisode.seasonNumber, monitored: true, removed: false };
        const season = await prisma.season.upsert({
          where: { showId_seasonNumber: { showId, seasonNumber: sonarrEpisode.seasonNumber } },
          create: seasonRow,
          update: seasonRow,
        });
        seasonId = season.id;
        seasonIdByNumber.set(sonarrEpisode.seasonNumber, seasonId);
      }

      seenSonarrEpisodeIds.push(sonarrEpisode.id);
      const data = this.mapEpisodeToRow(sonarrEpisode, episodeFilesById, seasonId);

      const existing = await prisma.episode.findUnique({ where: { sonarrEpisodeId: sonarrEpisode.id } });
      await prisma.episode.upsert({
        where: { sonarrEpisodeId: sonarrEpisode.id },
        create: data,
        update: data,
      });

      if (existing) {
        updated += 1;
      } else {
        added += 1;
      }
    }

    // Soft-delete episodes no longer present in Sonarr for this series
    if (seenSonarrEpisodeIds.length) {
      await prisma.episode.updateMany({
        where: {
          seasonId: { in: Array.from(seasonIdByNumber.values()) },
          sonarrEpisodeId: { notIn: seenSonarrEpisodeIds },
          removed: false,
        },
        data: { removed: true },
      });
    }

    return { added, updated };
  }

  async fullSync(trigger = 'manual') {
    console.log('Starting full Sonarr library sync...');
    const startTime = Date.now();
    const startedAt = new Date(startTime);

    try {
      const seriesList = await this.sonarrService.getSeries();
      const totalItems = seriesList.length;

      let added = 0;
      let updated = 0;
      const seenSonarrIds = [];

      for (const sonarrSeries of seriesList) {
        seenSonarrIds.push(sonarrSeries.id);
        const data = this.mapShowToRow(sonarrSeries);

        const existingShow = await prisma.show.findUnique({ where: { sonarrId: sonarrSeries.id } });
        const show = await prisma.show.upsert({
          where: { sonarrId: sonarrSeries.id },
          create: data,
          update: data,
        });

        if (existingShow) {
          updated += 1;
        } else {
          added += 1;
        }

        try {
          await this.syncSeasonsAndEpisodes(show.id, sonarrSeries);
        } catch (seriesError) {
          console.warn(`Failed to sync seasons/episodes for series "${sonarrSeries.title}":`, seriesError.message);
        }
      }

      // Soft-delete shows no longer present in Sonarr
      const removedResult = await prisma.show.updateMany({
        where: {
          removed: false,
          ...(seenSonarrIds.length ? { sonarrId: { notIn: seenSonarrIds } } : {}),
        },
        data: { removed: true },
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const result = {
        success: true,
        totalItems,
        added,
        updated,
        removed: removedResult.count,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      };

      const summary = `Shows: ${totalItems} total, ${added} added, ${updated} updated, ${removedResult.count} removed`;
      console.log(`Sonarr sync summary: ${summary}`);

      await this.writeRunLog({
        startedAt,
        completedAt: new Date(endTime),
        durationSeconds: duration,
        trigger,
        success: true,
        totalItems,
        added,
        updated,
        removed: removedResult.count,
        summary,
      });

      // Probe newly-discovered files for technical metadata (Phase 2). Fire-and-forget
      // so a large backfill doesn't block the sync response; already-probed rows are skipped.
      mediaProbeService.probeAllUnprobed().catch((probeError) => {
        console.warn('Post-sync media probe run failed:', probeError.message);
      });

      return result;
    } catch (error) {
      console.error('Sonarr sync failed:', error);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      await this.writeRunLog({
        startedAt,
        completedAt: new Date(endTime),
        durationSeconds: duration,
        trigger,
        success: false,
        summary: 'Sync failed before completion',
        error: error.message,
      });

      throw error;
    }
  }

  async writeRunLog(data) {
    try {
      await prisma.librarySyncRunLog.create({
        data: { provider: 'sonarr', ...data },
      });
    } catch (logError) {
      console.warn('Failed to persist Sonarr sync run log:', logError.message);
    }
  }
}

module.exports = SonarrSyncService;
