const prisma = require('../prismaClient');
const { normalizeTitleForExactMatch } = require('../utils/titleMatching');

function toNormalized(value) {
  return normalizeTitleForExactMatch(value || '');
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

class CustomOrderArrBackfillService {
  async backfill(options = {}) {
    const {
      dryRun = true,
      customOrderId = null,
      limit = 1000,
      includeAlreadyLinked = false,
    } = options;

    const where = {
      mediaType: { in: ['movie', 'episode'] },
      ...(customOrderId ? { customOrderId: parseInt(customOrderId, 10) } : {}),
      ...(includeAlreadyLinked
        ? {}
        : {
            OR: [
              { sourceProvider: null },
              { sourceProvider: 'plex' },
              { movieId: null },
              { episodeId: null },
            ],
          }),
    };

    const items = await prisma.customOrderItem.findMany({
      where,
      take: Math.max(1, Math.min(limit, 10000)),
      orderBy: [{ customOrderId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        customOrderId: true,
        mediaType: true,
        title: true,
        seriesTitle: true,
        seasonNumber: true,
        episodeNumber: true,
        tvdbYear: true,
        movieId: true,
        episodeId: true,
        sourceProvider: true,
      },
    });

    const movieCandidates = await prisma.movie.findMany({
      where: { removed: false },
      select: {
        id: true,
        title: true,
        year: true,
      },
    });

    const episodeCandidates = await prisma.episode.findMany({
      where: { removed: false },
      include: {
        season: {
          include: {
            show: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const movieByNormalizedTitle = new Map();
    for (const movie of movieCandidates) {
      const key = toNormalized(movie.title);
      if (!movieByNormalizedTitle.has(key)) {
        movieByNormalizedTitle.set(key, []);
      }
      movieByNormalizedTitle.get(key).push(movie);
    }

    const episodeBySeriesSeasonEpisode = new Map();
    for (const episode of episodeCandidates) {
      const seriesTitle = episode.season?.show?.title || '';
      const key = `${toNormalized(seriesTitle)}::${episode.season?.seasonNumber ?? ''}::${episode.episodeNumber ?? ''}`;
      if (!episodeBySeriesSeasonEpisode.has(key)) {
        episodeBySeriesSeasonEpisode.set(key, []);
      }
      episodeBySeriesSeasonEpisode.get(key).push(episode);
    }

    const stats = {
      scanned: items.length,
      matchedMovies: 0,
      matchedEpisodes: 0,
      updated: 0,
      ambiguous: 0,
      unresolved: 0,
      skippedAlreadyLinked: 0,
      dryRun,
    };

    const preview = [];

    for (const item of items) {
      if (
        !includeAlreadyLinked &&
        item.sourceProvider === 'arr' &&
        ((item.mediaType === 'movie' && item.movieId) || (item.mediaType === 'episode' && item.episodeId))
      ) {
        stats.skippedAlreadyLinked += 1;
        continue;
      }

      if (item.mediaType === 'movie') {
        const titleKey = toNormalized(item.title);
        const candidates = movieByNormalizedTitle.get(titleKey) || [];

        let chosen = null;
        if (candidates.length === 1) {
          chosen = candidates[0];
        } else if (candidates.length > 1) {
          const year = parseIntOrNull(item.tvdbYear);
          if (year != null) {
            const exactYear = candidates.filter((movie) => movie.year === year);
            if (exactYear.length === 1) {
              chosen = exactYear[0];
            } else if (exactYear.length > 1) {
              stats.ambiguous += 1;
              preview.push({
                customOrderItemId: item.id,
                mediaType: 'movie',
                title: item.title,
                reason: 'multiple_year_matches',
                candidateIds: exactYear.map((movie) => movie.id),
              });
              continue;
            }
          }

          if (!chosen) {
            stats.ambiguous += 1;
            preview.push({
              customOrderItemId: item.id,
              mediaType: 'movie',
              title: item.title,
              reason: 'multiple_title_matches',
              candidateIds: candidates.map((movie) => movie.id),
            });
            continue;
          }
        }

        if (!chosen) {
          stats.unresolved += 1;
          preview.push({
            customOrderItemId: item.id,
            mediaType: 'movie',
            title: item.title,
            reason: 'no_match',
          });
          continue;
        }

        stats.matchedMovies += 1;
        preview.push({
          customOrderItemId: item.id,
          mediaType: 'movie',
          title: item.title,
          matchedMovieId: chosen.id,
        });

        if (!dryRun) {
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: {
              sourceProvider: 'arr',
              movieId: chosen.id,
              episodeId: null,
            },
          });
          stats.updated += 1;
        }

        continue;
      }

      const seasonNumber = parseIntOrNull(item.seasonNumber);
      const episodeNumber = parseIntOrNull(item.episodeNumber);
      const seriesKey = toNormalized(item.seriesTitle || item.title);

      if (seasonNumber == null || episodeNumber == null || !seriesKey) {
        stats.unresolved += 1;
        preview.push({
          customOrderItemId: item.id,
          mediaType: 'episode',
          title: item.title,
          reason: 'missing_series_or_numbering',
        });
        continue;
      }

      const lookupKey = `${seriesKey}::${seasonNumber}::${episodeNumber}`;
      const candidates = episodeBySeriesSeasonEpisode.get(lookupKey) || [];

      if (candidates.length === 0) {
        stats.unresolved += 1;
        preview.push({
          customOrderItemId: item.id,
          mediaType: 'episode',
          title: item.title,
          seriesTitle: item.seriesTitle,
          seasonNumber,
          episodeNumber,
          reason: 'no_match',
        });
        continue;
      }

      if (candidates.length > 1) {
        stats.ambiguous += 1;
        preview.push({
          customOrderItemId: item.id,
          mediaType: 'episode',
          title: item.title,
          seriesTitle: item.seriesTitle,
          seasonNumber,
          episodeNumber,
          reason: 'multiple_matches',
          candidateIds: candidates.map((episode) => episode.id),
        });
        continue;
      }

      const chosen = candidates[0];
      stats.matchedEpisodes += 1;
      preview.push({
        customOrderItemId: item.id,
        mediaType: 'episode',
        title: item.title,
        seriesTitle: item.seriesTitle,
        seasonNumber,
        episodeNumber,
        matchedEpisodeId: chosen.id,
      });

      if (!dryRun) {
        await prisma.customOrderItem.update({
          where: { id: item.id },
          data: {
            sourceProvider: 'arr',
            episodeId: chosen.id,
            movieId: null,
          },
        });
        stats.updated += 1;
      }
    }

    return {
      stats,
      preview: preview.slice(0, 200),
    };
  }
}

module.exports = CustomOrderArrBackfillService;
