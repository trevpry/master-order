const prisma = require('../prismaClient');

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

  if (movies.length === 0) {
    return { message: 'No movies found in library', orderType: 'MOVIES_GENERAL' };
  }

  const completedIds = await getCompletedMovieIds();
  const unwatched = movies.filter((movie) => !completedIds.has(movie.id));
  const pool = unwatched.length > 0 ? unwatched : movies;
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
  };
}

async function getNextEpisodeFromLibrary() {
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

  const completedEpisodeIds = await getCompletedEpisodeIds();

  const candidates = [];
  for (const show of shows) {
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
    for (const show of shows) {
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
  };
}

module.exports = {
  getNextMovieFromLibrary,
  getNextEpisodeFromLibrary,
};
