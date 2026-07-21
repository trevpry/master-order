const RadarrService = require('./radarrService');
const MediaProbeService = require('./mediaProbeService');
const prisma = require('../prismaClient');
const { mapRemotePathToLocal } = require('../utils/libraryPathMapper');

const mediaProbeService = new MediaProbeService();

/**
 * Mirrors PlexSyncService's shape (fullSync/testConnection) but populates
 * the Radarr-backed `Movie` table instead of Plex* tables.
 * See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 1).
 */
class RadarrSyncService {
  constructor() {
    this.radarrService = new RadarrService();
  }

  async testConnection() {
    return this.radarrService.testConnection();
  }

  /** Map a Radarr `movie` API object to a Movie row. */
  mapMovieToRow(radarrMovie) {
    const movieFile = radarrMovie.movieFile || null;
    const mediaInfo = movieFile?.mediaInfo || {};
    const remoteFilePath = movieFile?.path || null;
    const images = Array.isArray(radarrMovie.images) ? radarrMovie.images : [];

    const resolution = mediaInfo.resolution
      || (mediaInfo.width && mediaInfo.height ? `${mediaInfo.width}x${mediaInfo.height}` : null);

    return {
      radarrId: radarrMovie.id,
      tmdbId: radarrMovie.tmdbId ?? null,
      imdbId: radarrMovie.imdbId ?? null,
      title: radarrMovie.title,
      sortTitle: radarrMovie.sortTitle ?? null,
      year: radarrMovie.year ?? null,
      overview: radarrMovie.overview ?? null,
      runtime: radarrMovie.runtime ?? null,
      studio: radarrMovie.studio ?? null,
      genres: Array.isArray(radarrMovie.genres) ? JSON.stringify(radarrMovie.genres) : null,
      collectionTitle: radarrMovie.collection?.title ?? null,
      collectionTmdbId: radarrMovie.collection?.tmdbId ?? null,
      posterUrl: images.find((img) => img.coverType === 'poster')?.remoteUrl ?? null,
      fanartUrl: images.find((img) => img.coverType === 'fanart')?.remoteUrl ?? null,
      path: radarrMovie.path,
      relativePath: movieFile?.relativePath ?? null,
      filePath: remoteFilePath ? mapRemotePathToLocal(remoteFilePath) : null,
      fileSize: movieFile?.size != null ? BigInt(Math.trunc(movieFile.size)) : null,
      sceneName: movieFile?.sceneName ?? null,
      videoCodec: mediaInfo.videoCodec ?? null,
      audioCodec: mediaInfo.audioCodec ?? null,
      resolution,
      container: movieFile?.container ?? null,
      hasFile: !!radarrMovie.hasFile,
      monitored: !!radarrMovie.monitored,
      addedAt: radarrMovie.added ? new Date(radarrMovie.added) : null,
      radarrUpdatedAt: new Date(),
      removed: false,
      lastSyncedAt: new Date(),
    };
  }

  async fullSync(trigger = 'manual') {
    console.log('Starting full Radarr library sync...');
    const startTime = Date.now();
    const startedAt = new Date(startTime);

    try {
      const movies = await this.radarrService.getMovies();
      const totalItems = movies.length;

      let added = 0;
      let updated = 0;
      const seenRadarrIds = [];

      for (const radarrMovie of movies) {
        seenRadarrIds.push(radarrMovie.id);
        const data = this.mapMovieToRow(radarrMovie);

        const existing = await prisma.movie.findUnique({ where: { radarrId: radarrMovie.id } });
        await prisma.movie.upsert({
          where: { radarrId: radarrMovie.id },
          create: data,
          update: data,
        });

        if (existing) {
          updated += 1;
        } else {
          added += 1;
        }
      }

      // Soft-delete movies no longer present in Radarr
      const removedResult = await prisma.movie.updateMany({
        where: {
          removed: false,
          ...(seenRadarrIds.length ? { radarrId: { notIn: seenRadarrIds } } : {}),
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

      const summary = `Movies: ${totalItems} total, ${added} added, ${updated} updated, ${removedResult.count} removed`;
      console.log(`Radarr sync summary: ${summary}`);

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
      console.error('Radarr sync failed:', error);

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
        data: { provider: 'radarr', ...data },
      });
    } catch (logError) {
      console.warn('Failed to persist Radarr sync run log:', logError.message);
    }
  }
}

module.exports = RadarrSyncService;
