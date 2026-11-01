const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };

const { createTvdbEpisodeStatusService, applyTvdbEpisodeStatus } = require('../services/tvdbEpisodeStatusService');

function ep(seasonNumber, number, finaleType = null) {
  return { seasonNumber, number, finaleType };
}

function makeService({ status, episodes }) {
  const tvdb = {
    baseURL: 'https://tvdb.test',
    bearerToken: 'token',
    isTokenAvailable: async () => true,
    searchSeries: async () => [{ id: 'series-100' }],
    getSeriesDetails: async () => ({ status: { name: status } })
  };
  const http = { get: async () => ({ data: { data: { episodes }, links: { next: null } } }) };
  return createTvdbEpisodeStatusService({ tvdb, prisma: {}, http });
}

const completedShow = [ep(0, 1), ep(1, 1), ep(1, 2, 'season'), ep(2, 1), ep(2, 2), ep(2, 3, 'series')];

test('series finale of a completed series', async () => {
  const s = await makeService({ status: 'Ended', episodes: completedShow }).getEpisodeStatus('Show', 2, 3);
  assert.equal(s.seriesStatus, 'Completed');
  assert.equal(s.isSeriesFinale, true);
  assert.equal(s.isSeasonFinale, false);
  assert.equal(s.isFinalSeason, true);
});

test('final season episode that is not the finale', async () => {
  const s = await makeService({ status: 'Ended', episodes: completedShow }).getEpisodeStatus('Show', 2, 1);
  assert.equal(s.isFinalSeason, true);
  assert.equal(s.isSeriesFinale, false);
  assert.equal(s.isSeasonFinale, false);
});

test('season finale from finaleType', async () => {
  const s = await makeService({ status: 'Ended', episodes: completedShow }).getEpisodeStatus('Show', 1, 2);
  assert.equal(s.isSeasonFinale, true);
  assert.equal(s.isFinalSeason, false);
});

test('ended series without a series finale is canceled; last episode is still the series finale', async () => {
  const episodes = [ep(1, 1), ep(1, 2), ep(2, 1), ep(2, 2)];
  const service = makeService({ status: 'Ended', episodes });
  const last = await service.getEpisodeStatus('Show', 2, 2);
  assert.equal(last.seriesStatus, 'Canceled');
  assert.equal(last.isSeriesFinale, true);
  const seasonOneLast = await service.getEpisodeStatus('Show', 1, 2);
  assert.equal(seasonOneLast.isSeasonFinale, true);
});

test('ongoing series: last listed episode of the current season is not assumed to be a finale', async () => {
  const episodes = [ep(1, 1), ep(1, 2), ep(2, 1), ep(2, 2), ep(2, 3, 'midseason')];
  const service = makeService({ status: 'Continuing', episodes });
  const current = await service.getEpisodeStatus('Show', 2, 2);
  assert.equal(current.seriesStatus, 'Ongoing');
  assert.equal(current.isSeasonFinale, false);
  assert.equal(current.isFinalSeason, false);
  assert.equal(current.isSeriesFinale, false);
  const earlierSeasonEnd = await service.getEpisodeStatus('Show', 1, 2);
  assert.equal(earlierSeasonEnd.isSeasonFinale, true);
  const mid = await service.getEpisodeStatus('Show', 2, 3);
  assert.equal(mid.isMidSeasonFinale, true);
});

test('applyTvdbEpisodeStatus uses the Jellyfin episode row for numbering and skips non-episodes', async () => {
  const calls = [];
  const service = { getEpisodeStatus: async (...args) => { calls.push(args); return { seriesStatus: 'Ongoing' }; } };
  const prisma = {
    plexEpisode: {
      findUnique: async () => ({ grandparentTitle: 'Family Guy', showTitle: 'Family Guy', seasonIndex: 1, index: 3 })
    }
  };
  const media = { type: 'episode', customOrderMediaType: 'episode', ratingKey: '446e77b42f9c4d774e2809685363b321' };
  await applyTvdbEpisodeStatus(media, service, prisma);
  assert.deepEqual(calls[0], ['Family Guy', 1, 3]);
  assert.equal(media.tvdbStatus.seriesStatus, 'Ongoing');

  const movie = { type: 'movie' };
  await applyTvdbEpisodeStatus(movie, service, prisma);
  assert.equal(movie.tvdbStatus, undefined);
  assert.equal(calls.length, 1);
});
