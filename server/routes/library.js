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

// GET /api/library/movies - movie browser data (movies -> collections -> file/watch status)
router.get('/movies', asyncHandler(async (req, res) => {
  const searchQuery = (req.query.q || '').toString().trim().toLowerCase();
  const collectionFilter = (req.query.collection || '').toString().trim().toLowerCase();

  const movies = await prisma.movie.findMany({
    where: { removed: false },
    orderBy: { title: 'asc' },
  });

  const mappedMovies = movies.map((movie) => ({
    id: movie.id,
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
    return true;
  });

  const allCollections = Array.from(new Set(mappedMovies.flatMap((movie) => movie.collections))).sort();

  res.json({
    filters: { q: searchQuery, collection: collectionFilter },
    totalMovies: filteredMovies.length,
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

  const mappedShows = shows.map((show) => {
    const mappedSeasons = show.seasons.map((season) => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      monitored: season.monitored,
      totalEpisodeCount: season.episodes.length,
      episodesWithFile: season.episodes.filter((episode) => episode.hasFile).length,
      episodes: season.episodes.map((episode) => ({
        id: episode.id,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        airDate: episode.airDate,
        hasFile: episode.hasFile,
        monitored: episode.monitored,
        durationSeconds: episode.durationSeconds,
        probed: !!episode.probedAt,
      })),
    }));

    return {
      id: show.id,
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
      totalEpisodeCount: mappedSeasons.reduce((sum, season) => sum + season.totalEpisodeCount, 0),
      episodesWithFile: mappedSeasons.reduce((sum, season) => sum + season.episodesWithFile, 0),
      seasons: mappedSeasons,
    };
  });

  const filteredShows = searchQuery
    ? mappedShows.filter((show) => show.title.toLowerCase().includes(searchQuery)
      || (show.year && String(show.year).includes(searchQuery)))
    : mappedShows;

  res.json({
    filters: { q: searchQuery },
    totalShows: filteredShows.length,
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
