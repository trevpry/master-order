const prisma = require('../prismaClient');
const settingsService = require('../settingsService');

/**
 * "Up Next" selection for the Radarr/Sonarr-backed library, used when
 * Settings.libraryProvider === 'arr'. This is a deliberately simpler
 * MVP compared to the full Plex-based getNextMovie/getNextEpisode logic
 * (no Christmas filter, no partially-watched-collection weighting, no
 * ignored-collections support yet) - see
 * SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 4) for the documented
 * scope and follow-up work.
 *
 * Response shape intentionally mirrors the fields getNextMovie.js/
 * getNextEpisode.js already return (title, summary, thumb, art, duration
 * in ms, orderType, etc.) so existing Up Next / Android formatting code
 * keeps working without changes.
 */

function getAppBaseUrl() {
  const port = process.env.PORT || 3001;
  const externalIp = process.env.EXTERNAL_IP;
  if (process.env.NODE_ENV !== 'production') {
    return `http://localhost:${port}`;
  }
  return externalIp ? `http://${externalIp}:${port}` : `http://localhost:${port}`;
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function parseJsonArraySetting(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch (error) {
    return [];
  }
}

async function getArrMovieSelectionSettings() {
  try {
    const settings = await settingsService.getSettings();
    return {
      partiallyWatchedCollectionPercent: Number.isFinite(settings?.partiallyWatchedCollectionPercent)
        ? settings.partiallyWatchedCollectionPercent
        : 75,
      ignoredMovieCollections: parseJsonArraySetting(settings?.ignoredMovieCollections),
    };
  } catch (error) {
    return {
      partiallyWatchedCollectionPercent: 75,
      ignoredMovieCollections: [],
    };
  }
}

async function getArrTvSelectionSettings() {
  try {
    const settings = await settingsService.getSettings();
    return {
      collectionName: settings?.collectionName ? String(settings.collectionName).trim() : '',
      ignoredTVCollections: parseJsonArraySetting(settings?.ignoredTVCollections),
    };
  } catch (error) {
    return {
      collectionName: '',
      ignoredTVCollections: [],
    };
  }
}

function normalizeCollectionName(value) {
  return (value || '').trim().toLowerCase();
}

function parseShowCollections(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry.length > 0);
  } catch (error) {
    return [];
  }
}

async function getCompletedMovieIds() {
  const rows = await prisma.watchProgress.findMany({
    where: { mediaType: 'movie', completed: true },
    select: { movieId: true },
  });
  return new Set(rows.map((row) => row.movieId));
}

async function getCompletedEpisodeIds() {
  const rows = await prisma.watchProgress.findMany({
    where: { mediaType: 'episode', completed: true },
    select: { episodeId: true },
  });
  return new Set(rows.map((row) => row.episodeId));
}

async function getNextMovieFromLibrary() {
  const movies = await prisma.movie.findMany({ where: { removed: false, hasFile: true } });
  const { partiallyWatchedCollectionPercent, ignoredMovieCollections } = await getArrMovieSelectionSettings();

  if (movies.length === 0) {
    return { message: 'No movies found in library', orderType: 'MOVIES_GENERAL' };
  }

  const ignoredSet = new Set(ignoredMovieCollections.map(normalizeCollectionName));
  const filteredMovies = ignoredSet.size > 0
    ? movies.filter((movie) => !ignoredSet.has(normalizeCollectionName(movie.collectionTitle)))
    : movies;

  const selectionMovies = filteredMovies.length > 0 ? filteredMovies : movies;

  const completedIds = await getCompletedMovieIds();
  const unwatched = selectionMovies.filter((movie) => !completedIds.has(movie.id));
  let pool = unwatched.length > 0 ? unwatched : selectionMovies;

  if (unwatched.length > 0) {
    const collectionBuckets = new Map();

    for (const movie of selectionMovies) {
      const collectionName = (movie.collectionTitle || '').trim();
      if (!collectionName) {
        continue;
      }

      if (!collectionBuckets.has(collectionName)) {
        collectionBuckets.set(collectionName, { watched: [], unwatched: [] });
      }

      const bucket = collectionBuckets.get(collectionName);
      if (completedIds.has(movie.id)) {
        bucket.watched.push(movie);
      } else {
        bucket.unwatched.push(movie);
      }
    }

    const partiallyWatchedCollections = new Set(
      [...collectionBuckets.entries()]
        .filter(([, value]) => value.watched.length > 0 && value.unwatched.length > 0)
        .map(([name]) => name)
    );

    const partiallyWatchedCollectionMovies = unwatched.filter((movie) =>
      movie.collectionTitle && partiallyWatchedCollections.has(movie.collectionTitle)
    );
    const otherUnwatchedMovies = unwatched.filter((movie) =>
      !movie.collectionTitle || !partiallyWatchedCollections.has(movie.collectionTitle)
    );

    if (partiallyWatchedCollectionMovies.length > 0) {
      const shouldUsePartial = Math.random() * 100 < partiallyWatchedCollectionPercent;
      if (shouldUsePartial) {
        pool = partiallyWatchedCollectionMovies;
      } else if (otherUnwatchedMovies.length > 0) {
        pool = otherUnwatchedMovies;
      }
    }
  }

  const movie = pickRandom(pool);

  const durationMs = Math.round(((movie.durationSeconds ?? (movie.runtime ? movie.runtime * 60 : 0)) || 0) * 1000);

  return {
    id: movie.id,
    ratingKey: `movie-${movie.id}`,
    libraryProvider: 'arr',
    title: movie.title,
    year: movie.year,
    summary: movie.overview || '',
    studio: movie.studio || 'Unknown Studio',
    duration: durationMs,
    rating: 0,
    thumb: movie.posterUrl || null,
    art: movie.fanartUrl || null,
    localArtworkPath: movie.localArtworkPath || null,
    streamUrl: `${getAppBaseUrl()}/api/stream/movie/${movie.id}/direct`,
    type: 'movie',
    orderType: 'MOVIES_GENERAL',
    otherCollections: movie.collectionTitle ? [movie.collectionTitle] : [],
  };
}

async function getNextEpisodeFromLibrary() {
  const { collectionName, ignoredTVCollections } = await getArrTvSelectionSettings();

  const shows = await prisma.show.findMany({
    where: { removed: false },
    include: {
      seasons: {
        where: { removed: false },
        include: {
          episodes: { where: { removed: false, hasFile: true }, orderBy: { episodeNumber: 'asc' } },
        },
        orderBy: { seasonNumber: 'asc' },
      },
    },
  });

  const ignoredSet = new Set(ignoredTVCollections.map(normalizeCollectionName));
  const normalizedSelectedCollection = normalizeCollectionName(collectionName);

  const filteredShows = shows.filter((show) => {
    const showCollections = parseShowCollections(show.collections);

    if (ignoredSet.size > 0) {
      const hasIgnoredCollection = showCollections.some((collection) => ignoredSet.has(normalizeCollectionName(collection)));
      if (hasIgnoredCollection) {
        return false;
      }
    }

    if (normalizedSelectedCollection) {
      return showCollections.some((collection) => normalizeCollectionName(collection) === normalizedSelectedCollection);
    }

    return true;
  });

  const sourceShows = filteredShows.length > 0 ? filteredShows : shows;

  const completedEpisodeIds = await getCompletedEpisodeIds();

  const candidates = [];
  for (const show of sourceShows) {
    for (const season of show.seasons) {
      const nextEpisode = season.episodes.find((episode) => !completedEpisodeIds.has(episode.id));
      if (nextEpisode) {
        candidates.push({ show, season, episode: nextEpisode });
        break; // earliest unwatched season for this show
      }
    }
  }

  let selection;
  if (candidates.length > 0) {
    selection = pickRandom(candidates);
  } else {
    // Everything's been watched - recycle by picking any show/season/episode with a file.
    const rewatchCandidates = [];
    for (const show of sourceShows) {
      for (const season of show.seasons) {
        if (season.episodes.length > 0) {
          rewatchCandidates.push({ show, season, episode: season.episodes[0] });
        }
      }
    }
    if (rewatchCandidates.length === 0) {
      return { message: 'No episodes found in library', orderType: 'TV_GENERAL' };
    }
    selection = pickRandom(rewatchCandidates);
  }

  const { show, season, episode } = selection;
  const totalEpisodeCount = show.seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  const watchedEpisodeCount = show.seasons.reduce(
    (sum, s) => sum + s.episodes.filter((e) => completedEpisodeIds.has(e.id)).length,
    0,
  );
  const durationMs = Math.round(((episode.durationSeconds ?? (episode.runtime ? episode.runtime * 60 : 0)) || 0) * 1000);

  return {
    id: show.id,
    ratingKey: `show-${show.id}`,
    libraryProvider: 'arr',
    title: show.title,
    summary: show.overview || '',
    episodeRatingKey: `episode-${episode.id}`,
    episodeId: episode.id,
    episodeTitle: episode.title,
    episodeSummary: episode.overview || '',
    seasonNumber: season.seasonNumber,
    episodeNumber: episode.episodeNumber,
    currentSeason: season.seasonNumber,
    currentEpisode: episode.episodeNumber,
    nextEpisodeTitle: episode.title,
    leafCount: totalEpisodeCount,
    viewedLeafCount: watchedEpisodeCount,
    duration: durationMs,
    thumb: show.posterUrl || null,
    art: show.fanartUrl || null,
    localArtworkPath: show.localArtworkPath || null,
    streamUrl: `${getAppBaseUrl()}/api/stream/episode/${episode.id}/direct`,
    type: 'episode',
    orderType: 'TV_GENERAL',
    otherCollections: parseShowCollections(show.collections),
  };
}

module.exports = {
  getNextMovieFromLibrary,
  getNextEpisodeFromLibrary,
};
