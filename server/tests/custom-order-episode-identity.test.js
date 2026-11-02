const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quietConsole = { log() {}, warn() {}, error() {} };
const episodeId = '912a8776c6c842d47f21c82eef05560b';

function selector({ season = 1, episode = 2, failArtwork = false, type = 'episode' } = {}) {
  const artworkCalls = [];
  let nextUnwatchedCalls = 0;
  const metadata = {
    ratingKey: episodeId, title: 'Theseus', type, seasonIndex: season, index: episode,
    grandparentTitle: 'VisionQuest', grandparentRatingKey: 'series-id',
    parentTitle: `Season ${season}`, season: { leafCount: 6 }
  };
  const dependencies = {
    './prismaClient': {
      customOrderItem: { findMany: async () => [] },
      customOrder: { findMany: async () => [{
        id: 8, name: 'MCU', subOrders: [],
        items: [{ id: 3003, mediaType: type, title: 'Theseus', plexKey: episodeId }]
      }] }
    },
    './tvdbCachedService': {
      getCurrentSeasonArtwork: async (...args) => {
        artworkCalls.push(args);
        if (failArtwork) throw new Error('TVDB unavailable');
        return { url: 'https://artwork.test/season.jpg' };
      }
    },
    './comicVineService': {},
    './openLibraryService': {},
    './plexDatabaseService': class {
      async getItemMetadata(key) {
        assert.equal(key, episodeId);
        return { ...metadata };
      }
      async getNextUnwatchedEpisode() {
        nextUnwatchedCalls++;
        return { seasonNumber: 1, episodeNumber: 3, title: 'Different episode', ratingKey: 'other-id' };
      }
    },
    './artworkCacheService': class {},
    './subOrderService': {}
  };
  const context = vm.createContext({
    require: name => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module: { exports: {} },
    console: quietConsole
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../getNextCustomOrder.js'), 'utf8'), context);
  return {
    select: context.module.exports.getNextCustomOrder,
    artworkCalls,
    nextUnwatchedCalls: () => nextUnwatchedCalls
  };
}

function formatAndroid(media) {
  const context = vm.createContext({
    require: name => {
      if (name === 'express') return {};
      if (name === '../../services/upNextService') return {};
      if (name === './utilities/androidHelpers') return { getAndroidArtworkUrl: () => '' };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} },
    console: quietConsole
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/android/contentDiscovery.js'), 'utf8'), context);
  return context.formatAndroidResponse(media, 'http://backend.test');
}

for (const [season, episode] of [[1, 2], [1, 1], [0, 0]]) {
  test(`custom-order S${season}E${episode} keeps the selected identity through Android formatting`, async () => {
    const fixture = selector({ season, episode });
    const media = await fixture.select();
    assert.equal(media.ratingKey, episodeId);
    assert.equal(media.episodeRatingKey, episodeId);
    assert.equal(media.currentSeason, season);
    assert.equal(media.currentEpisode, episode);
    assert.equal(media.episodeTitle, 'Theseus');
    assert.equal(media.nextEpisodeTitle, 'Theseus');
    assert.equal(media.totalEpisodesInSeason, 6);
    assert.equal(fixture.nextUnwatchedCalls(), 0);
    assert.deepEqual(fixture.artworkCalls, [['VisionQuest', season, episode]]);

    const android = formatAndroid(media);
    assert.equal(android.type, 'PLAY_CUSTOM_ORDER_ITEM');
    assert.equal(android.data.ratingKey, episodeId);
    assert.equal(android.data.episodeRatingKey, episodeId);
    assert.equal(android.data.seasonNumber, season);
    assert.equal(android.data.episodeNumber, episode);
    assert.equal(android.data.episodeTitle, 'Theseus');
    assert.equal(android.data.seriesTitle, 'VisionQuest');
    assert.equal(android.data.customOrderItemId, 3003);
  });
}

test('TVDB failure cannot change the selected episode identity', async () => {
  const fixture = selector({ failArtwork: true });
  const media = await fixture.select();
  assert.equal(media.ratingKey, episodeId);
  assert.equal(media.episodeRatingKey, episodeId);
  assert.equal(media.currentEpisode, 2);
  assert.equal(media.currentSeason, 1);
  assert.equal(media.nextEpisodeTitle, 'Theseus');
  assert.equal(fixture.nextUnwatchedCalls(), 0);
});

test('movie custom orders remain ID-based and do not request episode artwork', async () => {
  const fixture = selector({ type: 'movie' });
  const media = await fixture.select();
  const android = formatAndroid(media);
  assert.equal(android.data.ratingKey, episodeId);
  assert.equal(android.data.type, 'movie');
  assert.equal(android.data.episodeRatingKey, undefined);
  assert.equal(fixture.artworkCalls.length, 0);
  assert.equal(fixture.nextUnwatchedCalls(), 0);
});
