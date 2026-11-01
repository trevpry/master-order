/**
 * TVDB-derived episode/series status used for Up Next badges:
 * season finale, mid-season finale, series finale, final season and
 * series status (Ongoing / Upcoming / Completed / Canceled).
 *
 * TVDB only reports "Continuing", "Ended" or "Upcoming". An ended series is
 * treated as "Completed" when TVDB marks one of its episodes with
 * finaleType "series"; otherwise it was cut short and is "Canceled".
 */
const axios = require('axios');

const EPISODE_LIST_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_PAGES = 20;

function createTvdbEpisodeStatusService({ tvdb, prisma, http = axios } = {}) {
  const episodeListCache = new Map();

  async function fetchOfficialEpisodes(seriesId) {
    const cached = episodeListCache.get(seriesId);
    if (cached && Date.now() - cached.at < EPISODE_LIST_TTL_MS) return cached.episodes;

    let episodes = null;
    if (await tvdb.isTokenAvailable()) {
      try {
        episodes = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          const response = await http.get(`${tvdb.baseURL}/series/${seriesId}/episodes/official`, {
            params: { page },
            headers: { Authorization: `Bearer ${tvdb.bearerToken}`, Accept: 'application/json' },
            timeout: 10000
          });
          episodes.push(...(response.data?.data?.episodes || []));
          if (!response.data?.links?.next) break;
        }
      } catch (error) {
        console.warn(`TVDB official episode list failed for series ${seriesId}:`, error.response?.data?.message || error.message);
        episodes = null;
      }
    }

    if (!episodes) {
      // Offline/no token: fall back to whatever episodes the TVDB cache tables hold.
      episodes = await prisma.tvdbEpisode.findMany({
        where: { seriesTvdbId: String(seriesId) },
        select: { seasonNumber: true, number: true, finaleType: true }
      }).catch(() => []);
    }

    episodeListCache.set(seriesId, { episodes, at: Date.now() });
    return episodes;
  }

  function seriesStatusLabel(rawStatus, episodes) {
    switch (rawStatus) {
      case 'Continuing': return 'Ongoing';
      case 'Upcoming': return 'Upcoming';
      case 'Ended':
        if (!episodes.length) return 'Ended';
        return episodes.some(e => e.finaleType === 'series') ? 'Completed' : 'Canceled';
      default: return rawStatus || null;
    }
  }

  async function getEpisodeStatus(seriesTitle, seasonNumber, episodeNumber) {
    const season = Number(seasonNumber);
    const episodeNum = Number(episodeNumber);
    if (!seriesTitle || !Number.isFinite(season) || !Number.isFinite(episodeNum)) return null;

    const results = await tvdb.searchSeries(seriesTitle);
    const series = results?.[0];
    if (!series?.id) return null;
    const seriesId = String(series.id).replace('series-', '');

    const details = await tvdb.getSeriesDetails(seriesId);
    const rawStatus = details?.status?.name || series.status?.name || series.status || null;
    const ended = rawStatus === 'Ended';

    const episodes = (await fetchOfficialEpisodes(seriesId))
      .filter(e => Number(e.seasonNumber) > 0 && Number(e.number) > 0);

    const current = episodes.find(e => Number(e.seasonNumber) === season && Number(e.number) === episodeNum);
    const finaleType = current?.finaleType || null;
    const seasonEpisodes = episodes.filter(e => Number(e.seasonNumber) === season);
    const lastInSeason = seasonEpisodes.length ? Math.max(...seasonEpisodes.map(e => Number(e.number))) : null;
    const finalSeasonNumber = episodes.length ? Math.max(...episodes.map(e => Number(e.seasonNumber))) : null;

    const isLastListedInSeason = lastInSeason !== null && episodeNum === lastInSeason;
    // For running shows the newest season may still be partially announced, so only trust
    // "last listed episode" when a later season exists (or the show has ended).
    const seasonIsClosed = ended || (finalSeasonNumber !== null && season < finalSeasonNumber);
    const isFinalSeason = ended && finalSeasonNumber !== null && season === finalSeasonNumber;
    const isSeriesFinale = ended && (finaleType === 'series' || (isFinalSeason && isLastListedInSeason));
    const isSeasonFinale = !isSeriesFinale &&
      (finaleType === 'season' || finaleType === 'series' || (seasonIsClosed && isLastListedInSeason));
    const isMidSeasonFinale = !isSeriesFinale && !isSeasonFinale && finaleType === 'midseason';

    return {
      tvdbSeriesId: seriesId,
      tvdbSeriesStatus: rawStatus,
      seriesStatus: seriesStatusLabel(rawStatus, episodes),
      finaleType,
      isSeasonFinale,
      isMidSeasonFinale,
      isSeriesFinale,
      isFinalSeason
    };
  }

  return { getEpisodeStatus, fetchOfficialEpisodes, seriesStatusLabel };
}

let defaultService = null;
function getDefaultService() {
  if (!defaultService) {
    defaultService = createTvdbEpisodeStatusService({
      tvdb: require('../tvdbCachedService'),
      prisma: require('../prismaClient')
    });
  }
  return defaultService;
}

const JELLYFIN_ID = /^[0-9a-f]{32}$/i;

/**
 * Attach `tvdbStatus` to a TV episode Up Next payload (TV pick or custom order episode).
 */
async function applyTvdbEpisodeStatus(media, service = getDefaultService(), prisma = require('../prismaClient')) {
  if (!media || media.libraryProvider === 'arr') return media;
  if (media.type !== 'episode' && media.customOrderMediaType !== 'episode') return media;
  try {
    const isEpisodeRow = media.customOrderMediaType === 'episode' || !!media.grandparentRatingKey;
    const episodeKey = media.episodeRatingKey || (isEpisodeRow ? media.ratingKey : null) || media.plexKey;
    let seriesTitle = media.grandparentTitle || media.seriesTitle || (isEpisodeRow ? null : media.title);
    let season = media.currentSeason ?? media.parentIndex ?? media.seasonNumber;
    let episode = media.currentEpisode ?? media.episodeNumber ?? (isEpisodeRow ? media.index : null);

    if (episodeKey && JELLYFIN_ID.test(String(episodeKey))) {
      const row = await prisma.plexEpisode.findUnique({
        where: { ratingKey: String(episodeKey) },
        select: { showTitle: true, grandparentTitle: true, seasonIndex: true, index: true }
      });
      if (row) {
        seriesTitle = row.grandparentTitle || row.showTitle || seriesTitle;
        season = row.seasonIndex;
        episode = row.index;
      }
    }

    const status = await service.getEpisodeStatus(seriesTitle, season, episode);
    if (status) media.tvdbStatus = status;
  } catch (error) {
    console.warn('Failed to resolve TVDB episode status:', error.message);
  }
  return media;
}

module.exports = { createTvdbEpisodeStatusService, applyTvdbEpisodeStatus };
