/**
 * TVDB "Credit Scenes" movie tag (tagOptions entry with tagName "Credit Scenes",
 * name "Yes" / "No") used for the Up Next credit-scenes badge.
 */
const axios = require('axios');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const JELLYFIN_ID = /^[0-9a-f]{32}$/i;

/** true = "Yes", false = "No", null = not tagged on TVDB. */
function creditScenesFromTags(tagOptions) {
  const tag = (tagOptions || []).find(t => String(t?.tagName || '').trim().toLowerCase() === 'credit scenes');
  if (!tag) return null;
  const value = String(tag.name || '').trim().toLowerCase();
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

function createMovieCreditScenesService({ tvdb, prisma, http = axios } = {}) {
  const cache = new Map();

  const headers = () => ({ Authorization: `Bearer ${tvdb.bearerToken}`, Accept: 'application/json' });

  async function tvdbGet(path, params) {
    const response = await http.get(`${tvdb.baseURL}${path}`, { params, headers: headers(), timeout: 10000 });
    return response.data?.data;
  }

  async function movieGuids(ratingKey) {
    if (!ratingKey || !JELLYFIN_ID.test(String(ratingKey))) return [];
    const rows = await prisma.plexGuid.findMany({
      where: { movieRatingKey: String(ratingKey) },
      select: { id_value: true }
    }).catch(() => []);
    return rows.map(r => r.id_value);
  }

  async function resolveTvdbMovieId({ ratingKey, title, year }) {
    const guids = await movieGuids(ratingKey);
    const direct = guids.find(g => g.startsWith('tvdb://'));
    if (direct) return direct.slice('tvdb://'.length);

    for (const prefix of ['imdb://', 'tmdb://']) {
      const guid = guids.find(g => g.startsWith(prefix));
      if (!guid) continue;
      const matches = await tvdbGet(`/search/remoteid/${encodeURIComponent(guid.slice(prefix.length))}`).catch(() => null);
      const movie = (matches || []).map(m => m.movie).find(m => m?.id);
      if (movie) return String(movie.id);
    }

    if (!title) return null;
    const results = await tvdbGet('/search', { query: title, type: 'movie', ...(year ? { year } : {}) }).catch(() => null);
    const normalized = String(title).trim().toLowerCase();
    const match = (results || []).find(r => String(r.name || '').trim().toLowerCase() === normalized &&
      (!year || !r.year || Number(r.year) === Number(year))) ||
      (results || []).find(r => String(r.name || '').trim().toLowerCase() === normalized);
    return match ? String(match.tvdb_id || match.id).replace('movie-', '') : null;
  }

  async function getCreditScenes(movie) {
    const key = movie.ratingKey || `${movie.title}|${movie.year || ''}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
    if (!(await tvdb.isTokenAvailable())) return null;

    const tvdbMovieId = await resolveTvdbMovieId(movie);
    let value = null;
    if (tvdbMovieId) {
      const details = await tvdbGet(`/movies/${tvdbMovieId}/extended`, { short: true });
      value = { tvdbMovieId, hasCreditScenes: creditScenesFromTags(details?.tagOptions) };
    }
    cache.set(key, { value, at: Date.now() });
    return value;
  }

  return { getCreditScenes, resolveTvdbMovieId };
}

let defaultService = null;
function getDefaultService() {
  if (!defaultService) {
    defaultService = createMovieCreditScenesService({
      tvdb: require('../tvdbService'),
      prisma: require('../prismaClient')
    });
  }
  return defaultService;
}

/** Attach `hasCreditScenes` (true/false/null) to a movie Up Next payload. */
async function applyMovieCreditScenes(media, service = getDefaultService()) {
  if (!media) return media;
  const isMovie = media.type === 'movie' || media.customOrderMediaType === 'movie' || media.orderType === 'MOVIES_GENERAL';
  if (!isMovie) return media;
  try {
    const ratingKey = [media.plexKey, media.ratingKey].find(k => k && JELLYFIN_ID.test(String(k))) || null;
    const result = await service.getCreditScenes({ ratingKey, title: media.title, year: media.year });
    media.hasCreditScenes = result?.hasCreditScenes ?? null;
  } catch (error) {
    console.warn('Failed to resolve TVDB credit scenes:', error.response?.data?.message || error.message);
  }
  return media;
}

module.exports = { applyMovieCreditScenes, createMovieCreditScenesService, creditScenesFromTags };
