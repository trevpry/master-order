const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };
const { selectCollectionUpNext } = require('../services/collectionUpNextService');

const SHOW = 'a'.repeat(32);
const MOVIE = 'b'.repeat(32);
const EPISODE = 'c'.repeat(32);
const SIBLING = 'd'.repeat(32);

function fixture() {
  const state = {
    settings: { collectionName: 'Up Next' },
    collections: [
      { id: 1, name: 'Franchise', items: [{ itemType: 'show', itemKey: SHOW }, { itemType: 'collection', childCollectionId: 2 }] },
      { id: 2, name: 'Nested', items: [{ itemType: 'movie', itemKey: MOVIE }] },
      { id: 3, name: 'Up Next', items: [{ itemType: 'show', itemKey: SHOW }, { itemType: 'movie', itemKey: SIBLING }] }
    ],
    movies: [
      { ratingKey: MOVIE, title: 'Movie', originallyAvailableAt: '2005-01-01', viewCount: 0 },
      { ratingKey: SIBLING, title: 'Unrelated', originallyAvailableAt: '1900-01-01', viewCount: 0 }
    ],
    shows: [{ ratingKey: SHOW, title: 'Series', originallyAvailableAt: '1990-01-01', leafCount: 2, viewedLeafCount: 2 }],
    seasons: [{
      showRatingKey: SHOW, index: 1, title: 'Season One',
      episodes: [
        { ratingKey: 'watched', title: 'Watched', index: 1, originallyAvailableAt: '1990-01-01', viewCount: 1 },
        { ratingKey: EPISODE, title: 'Next Episode', index: 2, originallyAvailableAt: '2010-01-01', viewCount: 0, duration: 42000 }
      ]
    }],
    customItems: []
  };
  const mediaRows = rows => async ({ where }) => rows().filter(row =>
    where.ratingKey.in.includes(row.ratingKey) && !row.removed);
  const db = {
    settings: { findUnique: async () => state.settings },
    mediaCollection: { findMany: async () => state.collections.filter(collection => !collection.removed) },
    plexMovie: { findMany: mediaRows(() => state.movies) },
    plexTVShow: { findMany: mediaRows(() => state.shows) },
    customOrderItem: { findMany: async () => state.customItems },
    plexSeason: { findMany: async ({ where }) => state.seasons
      .filter(season => season.showRatingKey === where.showRatingKey && !season.removed)
      .map(season => ({ ...season, episodes: season.episodes.filter(episode => !episode.removed) })) }
  };
  return { state, db };
}

test('TV seed chooses the earlier movie in a nested collection, not the series premiere or unrelated settings members', async () => {
  const { db } = fixture();
  const result = await selectCollectionUpNext({ ratingKey: SHOW, type: 'episode' }, db);
  assert.equal(result.ratingKey, MOVIE);
  assert.equal(result.type, 'movie');
  assert.equal(result.orderType, 'MOVIES_GENERAL');
  assert.equal(result.episodeRatingKey, undefined);
});

test('movie seed traverses ancestor and sibling nested collections and uses episode row state despite stale show counters', async () => {
  const { state, db } = fixture();
  state.movies[0].originallyAvailableAt = '2015-01-01';
  state.collections[0].items = [{ itemType: 'collection', childCollectionId: 2 }, { itemType: 'collection', childCollectionId: 4 }];
  state.collections.push({ id: 4, name: 'TV Branch', items: [{ itemType: 'show', itemKey: SHOW }] });
  const result = await selectCollectionUpNext({ ratingKey: MOVIE, type: 'movie' }, db);
  assert.equal(result.type, 'episode');
  assert.equal(result.ratingKey, SHOW);
  assert.equal(result.episodeRatingKey, EPISODE);
  assert.equal(result.currentSeason, 1);
  assert.equal(result.currentEpisode, 2);
  assert.equal(result.episodeTitle, 'Next Episode');
  assert.equal(result.duration, 42000);
  assert.equal(result.orderType, 'TV_GENERAL');
});

test('watched movies and removed episodes are skipped and completion advances across media types', async () => {
  const { state, db } = fixture();
  state.seasons[0].episodes.unshift({ ratingKey: 'removed', index: 0, originallyAvailableAt: '1900-01-01', removed: true });
  state.movies[0].viewCount = 1;
  const result = await selectCollectionUpNext({ ratingKey: MOVIE }, db);
  assert.equal(result.episodeRatingKey, EPISODE);
});

test('collection cycles, duplicate membership and nesting deeper than ten levels terminate and include descendants', async () => {
  const { state, db } = fixture();
  state.collections = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1, name: `Level ${i}`, items: [{ itemType: 'collection', childCollectionId: i === 14 ? 1 : i + 2 }]
  }));
  state.collections[0].items.push({ itemType: 'show', itemKey: SHOW });
  state.collections[14].items.push({ itemType: 'movie', itemKey: MOVIE });
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).ratingKey, MOVIE);
});

test('ignored nested collections are pruned and active custom-order items are not chosen', async () => {
  const { state, db } = fixture();
  state.settings.ignoredCollections = JSON.stringify(['nested']);
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).episodeRatingKey, EPISODE);
  state.settings.ignoredCollections = null;
  state.customItems = [{ plexKey: MOVIE, mediaType: 'movie' }];
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).episodeRatingKey, EPISODE);
});

test('locked partially watched collection searches its descendants without expanding unrelated ancestors', async () => {
  const { state, db } = fixture();
  state.collections.push({ id: 4, name: 'Parent', items: [{ itemType: 'collection', childCollectionId: 1 }, { itemType: 'movie', itemKey: SIBLING }] });
  const result = await selectCollectionUpNext({ ratingKey: SHOW, selectedCollectionName: 'Franchise' }, db);
  assert.equal(result.ratingKey, MOVIE);
});

test('missing dates sort last, year-only dates use calendar years, and ties are deterministic', async () => {
  const { state, db } = fixture();
  state.movies[0].originallyAvailableAt = null;
  state.movies[0].year = 2005;
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).ratingKey, MOVIE);
  state.movies[0].year = null;
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).episodeRatingKey, EPISODE);
  state.seasons[0].episodes[1].originallyAvailableAt = null;
  assert.equal((await selectCollectionUpNext({ ratingKey: SHOW }, db)).ratingKey, MOVIE);
});

test('fully played collections return no-content instead of replaying the seed', async () => {
  const { state, db } = fixture();
  state.movies[0].viewCount = 1;
  state.seasons[0].episodes[1].viewCount = 1;
  assert.match((await selectCollectionUpNext({ ratingKey: SHOW }, db)).message, /No unplayed/);
});

test('items without franchise collections and non-Jellyfin providers retain their selection', async () => {
  const { state, db } = fixture();
  state.collections = [];
  const seed = { ratingKey: SHOW, type: 'episode' };
  assert.equal(await selectCollectionUpNext(seed, db), seed);
  assert.equal(await selectCollectionUpNext({ ...seed, libraryProvider: 'arr' }, null).then(result => result.libraryProvider), 'arr');
});

test('database errors propagate rather than returning a successful random selection', async () => {
  const { db } = fixture();
  db.mediaCollection.findMany = async () => { throw new Error('database unavailable'); };
  await assert.rejects(selectCollectionUpNext({ ratingKey: SHOW }, db), /database unavailable/);
});

test('real TV entry point keeps a nested-collection movie even with TV weight at 100 percent', async () => {
  const { state, db } = fixture();
  state.settings.tvGeneralPercent = 100;
  state.settings.moviesGeneralPercent = 0;
  state.settings.preferNewRelease = 0;
  state.settings.preferLongUnwatched = 0;
  state.shows[0].leafCount = 2;
  state.shows[0].viewedLeafCount = 1;
  const byKeys = db.plexTVShow.findMany;
  db.plexTVShow.findMany = async args => args.where?.ratingKey ? byKeys(args) : state.shows;
  db.plexTVShow.findUnique = async () => state.shows[0];
  db.customOrderItem.findFirst = async () => null;
  db.Settings = db.settings;
  Object.assign(require.cache[prismaPath].exports, db);
  const stubs = {
    'tvdbCachedService.js': { getCurrentSeasonArtwork: async () => null },
    'services/historyPlusService.js': class {},
    'services/libraryUpNextService.js': {}
  };
  for (const [name, exports] of Object.entries(stubs)) {
    const filename = path.join(__dirname, '..', name);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let getNextEpisode;
  try {
    getNextEpisode = require('../getNextEpisode');
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
  const result = await getNextEpisode();
  assert.equal(result.ratingKey, MOVIE);
  assert.equal(result.type, 'movie');
  assert.equal(result.orderType, 'MOVIES_GENERAL');
});
