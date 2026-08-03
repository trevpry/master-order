const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');

/**
 * Radarr/Sonarr-backed library browsing API. Modeled on the existing
 * /api/plex/movie-browser and /api/plex/tv-browser endpoints so the
 * response shape stays familiar, but reads from the Movie/Show/Season/
 * Episode tables instead of Plex*. See
 * SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 4).
 */

function parseCollections(collectionTitle) {
  return collectionTitle ? [collectionTitle] : [];
}

function parseJsonArray(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim() !== '') : [];
  } catch (_error) {
    return [];
  }
}

function getPlayStatusFromProgress(progress) {
  if (!progress) {
    return 'unwatched';
  }

  if (progress.completed) {
    return 'watched';
  }

  if ((progress.positionSeconds || 0) > 0) {
    return 'in-progress';
  }

  return 'unwatched';
}

function computeAggregateStatus(statuses) {
  if (!statuses || statuses.length === 0) {
    return 'unwatched';
  }

  const watchedCount = statuses.filter((status) => status === 'watched').length;
  const inProgressCount = statuses.filter((status) => status === 'in-progress').length;

  if (watchedCount === statuses.length) {
    return 'watched';
  }

  if (watchedCount > 0 || inProgressCount > 0) {
    return 'in-progress';
  }

  return 'unwatched';
}

// GET /api/library/movies - movie browser data (movies -> collections -> file/watch status)
router.get('/movies', asyncHandler(async (req, res) => {
  const searchQuery = (req.query.q || '').toString().trim().toLowerCase();
  const collectionFilter = (req.query.collection || '').toString().trim().toLowerCase();
  const statusFilter = (req.query.status || 'all').toString().trim().toLowerCase();

  const movies = await prisma.movie.findMany({
    where: { removed: false },
    orderBy: { title: 'asc' },
  });

  const movieProgress = await prisma.watchProgress.findMany({
    where: {
      mediaType: 'movie',
      movieId: { in: movies.map((movie) => movie.id) }
    },
    select: {
      movieId: true,
      positionSeconds: true,
      completed: true,
    }
  });
  const progressByMovieId = new Map(movieProgress.map((progress) => [progress.movieId, progress]));

  const mappedMovies = movies.map((movie) => ({
    id: movie.id,
    ratingKey: `movie-${movie.id}`,
    radarrId: movie.radarrId,
    title: movie.title,
    year: movie.year,
    overview: movie.overview,
    runtime: movie.runtime,
    studio: movie.studio,
    collections: parseCollections(movie.collectionTitle),
    posterUrl: movie.posterUrl,
    fanartUrl: movie.fanartUrl,
    localArtworkPath: movie.localArtworkPath,
    hasFile: movie.hasFile,
    monitored: movie.monitored,
    resolution: movie.resolution,
    videoCodec: movie.videoCodec,
    audioCodec: movie.audioCodec,
    durationSeconds: movie.durationSeconds,
    probed: !!movie.probedAt,
    originallyAvailableAt: null,
    sectionTitle: 'ARR Library',
    viewCount: progressByMovieId.get(movie.id)?.completed ? 1 : 0,
    lastViewedAt: null,
    playStatus: getPlayStatusFromProgress(progressByMovieId.get(movie.id)),
    libraryProvider: 'arr',
    mediaId: movie.id,
    streamUrl: movie.hasFile ? `${req.protocol}://${req.get('host')}/api/stream/movie/${movie.id}/direct` : null,
  }));

  const filteredMovies = mappedMovies.filter((movie) => {
    if (searchQuery) {
      const matches = movie.title.toLowerCase().includes(searchQuery)
        || (movie.year && String(movie.year).includes(searchQuery));
      if (!matches) return false;
    }
    if (collectionFilter) {
      const hasCollection = movie.collections.some((name) => name.toLowerCase() === collectionFilter);
      if (!hasCollection) return false;
    }

    if (statusFilter !== 'all' && movie.playStatus !== statusFilter) {
      return false;
    }

    return true;
  });

  const allCollections = Array.from(new Set(mappedMovies.flatMap((movie) => movie.collections))).sort();
  const watchedMovies = filteredMovies.filter((movie) => movie.playStatus === 'watched').length;
  const unwatchedMovies = filteredMovies.filter((movie) => movie.playStatus === 'unwatched').length;

  res.json({
    filters: { q: searchQuery, collection: collectionFilter, status: statusFilter },
    totalMovies: filteredMovies.length,
    watchedMovies,
    unwatchedMovies,
    withFile: filteredMovies.filter((movie) => movie.hasFile).length,
    allCollections,
    movies: filteredMovies,
  });
}));

// GET /api/library/movies/:id - full movie detail
router.get('/movies/:id', asyncHandler(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid movie id' });

  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie || movie.removed) return res.status(404).json({ error: 'Movie not found' });

  res.json(movie);
}));

// GET /api/library/tv - hierarchical TV browser data (shows -> seasons -> episodes)
router.get('/tv', asyncHandler(async (req, res) => {
  const searchQuery = (req.query.q || '').toString().trim().toLowerCase();
  const collectionFilter = (req.query.collection || '').toString().trim().toLowerCase();
  const statusFilter = (req.query.status || 'all').toString().trim().toLowerCase();

  const shows = await prisma.show.findMany({
    where: { removed: false },
    include: {
      seasons: {
        where: { removed: false },
        include: {
          episodes: { where: { removed: false }, orderBy: { episodeNumber: 'asc' } },
        },
        orderBy: { seasonNumber: 'asc' },
      },
    },
    orderBy: { title: 'asc' },
  });

  const episodeIds = shows.flatMap((show) => show.seasons.flatMap((season) => season.episodes.map((episode) => episode.id)));
  const episodeProgressRows = episodeIds.length > 0
    ? await prisma.watchProgress.findMany({
        where: {
          mediaType: 'episode',
          episodeId: { in: episodeIds }
        },
        select: {
          episodeId: true,
          positionSeconds: true,
          completed: true,
        }
      })
    : [];
  const progressByEpisodeId = new Map(episodeProgressRows.map((progress) => [progress.episodeId, progress]));

  const mappedShows = shows.map((show) => {
    const collections = parseJsonArray(show.collections);
    const mappedSeasons = show.seasons.map((season) => {
      const mappedEpisodes = season.episodes.map((episode) => ({
        id: episode.id,
        ratingKey: `episode-${episode.id}`,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        airDate: episode.airDate,
        originallyAvailableAt: episode.airDate,
        hasFile: episode.hasFile,
        monitored: episode.monitored,
        durationSeconds: episode.durationSeconds,
        probed: !!episode.probedAt,
        playStatus: getPlayStatusFromProgress(progressByEpisodeId.get(episode.id)),
        libraryProvider: 'arr',
        mediaId: episode.id,
        streamUrl: episode.hasFile ? `${req.protocol}://${req.get('host')}/api/stream/episode/${episode.id}/direct` : null,
      }));

      const episodeStatuses = mappedEpisodes.map((episode) => episode.playStatus);
      const watchedEpisodeCount = mappedEpisodes.filter((episode) => episode.playStatus === 'watched').length;

      return {
        id: season.id,
        ratingKey: `season-${season.id}`,
        title: `Season ${season.seasonNumber}`,
        seasonNumber: season.seasonNumber,
        monitored: season.monitored,
        totalEpisodeCount: mappedEpisodes.length,
        watchedEpisodeCount,
        episodesWithFile: mappedEpisodes.filter((episode) => episode.hasFile).length,
        playStatus: computeAggregateStatus(episodeStatuses),
        episodes: mappedEpisodes,
      };
    });

    const allEpisodeStatuses = mappedSeasons.flatMap((season) => season.episodes.map((episode) => episode.playStatus));
    const watchedEpisodeCount = mappedSeasons.reduce((sum, season) => sum + season.watchedEpisodeCount, 0);
    const totalEpisodeCount = mappedSeasons.reduce((sum, season) => sum + season.totalEpisodeCount, 0);

    return {
      id: show.id,
      ratingKey: `show-${show.id}`,
      sonarrId: show.sonarrId,
      title: show.title,
      year: show.year,
      overview: show.overview,
      network: show.network,
      status: show.status,
      posterUrl: show.posterUrl,
      fanartUrl: show.fanartUrl,
      localArtworkPath: show.localArtworkPath,
      monitored: show.monitored,
      collections,
      sectionTitle: 'ARR Library',
      leafCount: totalEpisodeCount,
      viewedLeafCount: watchedEpisodeCount,
      playStatus: computeAggregateStatus(allEpisodeStatuses),
      totalEpisodeCount,
      episodesWithFile: mappedSeasons.reduce((sum, season) => sum + season.episodesWithFile, 0),
      seasons: mappedSeasons,
    };
  });

  const filteredShows = mappedShows.filter((show) => {
    if (searchQuery) {
      const seasonMatch = show.seasons.some((season) => season.title.toLowerCase().includes(searchQuery));
      const episodeMatch = show.seasons.some((season) => season.episodes.some((episode) => (episode.title || '').toLowerCase().includes(searchQuery)));
      const showMatches = show.title.toLowerCase().includes(searchQuery)
        || (show.year && String(show.year).includes(searchQuery))
        || seasonMatch
        || episodeMatch;
      if (!showMatches) {
        return false;
      }
    }

    if (collectionFilter) {
      const hasCollection = show.collections.some((name) => name.toLowerCase() === collectionFilter);
      if (!hasCollection) {
        return false;
      }
    }

    if (statusFilter !== 'all' && show.playStatus !== statusFilter) {
      return false;
    }

    return true;
  });

  const allCollections = Array.from(new Set(mappedShows.flatMap((show) => show.collections))).sort((a, b) => a.localeCompare(b));

  res.json({
    filters: { q: searchQuery, collection: collectionFilter, status: statusFilter },
    totalShows: filteredShows.length,
    allCollections,
    shows: filteredShows,
  });
}));

// GET /api/library/tv/:id - full show detail (with seasons, no episodes)
router.get('/tv/:id', asyncHandler(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid show id' });

  const show = await prisma.show.findUnique({
    where: { id },
    include: { seasons: { where: { removed: false }, orderBy: { seasonNumber: 'asc' } } },
  });
  if (!show || show.removed) return res.status(404).json({ error: 'Show not found' });

  res.json(show);
}));

// GET /api/library/tv/:id/seasons/:seasonNumber - episodes for a single season
router.get('/tv/:id/seasons/:seasonNumber', asyncHandler(async (req, res) => {
  const showId = Number.parseInt(req.params.id, 10);
  const seasonNumber = Number.parseInt(req.params.seasonNumber, 10);
  if (!Number.isFinite(showId) || !Number.isFinite(seasonNumber)) {
    return res.status(400).json({ error: 'Invalid show id or season number' });
  }

  const season = await prisma.season.findUnique({
    where: { showId_seasonNumber: { showId, seasonNumber } },
    include: { episodes: { where: { removed: false }, orderBy: { episodeNumber: 'asc' } } },
  });
  if (!season || season.removed) return res.status(404).json({ error: 'Season not found' });

  res.json(season);
}));

module.exports = router;
