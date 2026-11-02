const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const FIRST = 'a'.repeat(32);
const SECOND = 'b'.repeat(32);
const SHOW = 'c'.repeat(32);
let settings;
let queries;
let movies;
const db = {
  settings: { findUnique: async () => settings },
  plexMovie: { findMany: async ({ where }) => {
    queries.push(where);
    return movies.filter(movie => !movie.removed &&
      (!where.ratingKey || where.ratingKey.in.includes(movie.ratingKey)) &&
      (!where.collections || movie.collections?.includes(where.collections.contains)));
  } },
  plexTVShow: {
    findMany: async () => [{ ratingKey: SHOW, title: 'Series', collections: '["Mixed"]' }]
  },
  plexSeason: { findMany: async () => [{
    index: 1, title: 'Season One', episodes: [{
      ratingKey: 'd'.repeat(32), index: 1, title: 'Episode', viewCount: 0,
      originallyAvailableAt: '2020-01-01'
    }]
  }] },
  mediaCollection: { findMany: async () => [{
    id: 1, name: 'Mixed', items: [
      { itemKey: FIRST, itemType: 'movie' }, { itemKey: SHOW, itemType: 'show' }
    ]
  }] },
  customOrderItem: { findFirst: async () => null, findMany: async () => [] }
};
db.Settings = db.settings;
const stubs = {
  'prismaClient.js': db,
  'getNextCustomOrder.js': {},
  'services/libraryUpNextService.js': {},
  'services/historyPlusService.js': class {},
  'tvdbCachedService.js': {},
  'utils/seasonArtwork.js': { applySeasonArtwork: async () => {}, applyBackgroundArtwork: async result => result },
  'services/tvdbEpisodeStatusService.js': { applyTvdbEpisodeStatus: async () => {} },
  'services/movieCreditScenesService.js': { applyMovieCreditScenes: async () => {} },
  'utils/collectionArtwork.js': { applyCollectionArtwork: async () => {} }
};
for (const [name, exports] of Object.entries(stubs)) {
  const filename = path.join(__dirname, '..', name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const getNextMovie = require('../getNextMovie');
const { resolveUpNext } = require('../services/upNextService');

test.beforeEach(() => {
  settings = { tvGeneralPercent: 0, moviesGeneralPercent: 100, partiallyWatchedCollectionPercent: 0 };
  queries = [];
  movies = [
    { ratingKey: FIRST, title: 'First Library Movie', sectionKey: 'library-one', collections: '["Mixed"]', viewCount: 0, originallyAvailableAt: '2000-01-01' },
    { ratingKey: SECOND, title: 'Second Library Movie', sectionKey: 'library-two', collections: null, viewCount: 0 }
  ];
});

async function withRandom(value, action) {
  const original = Math.random;
  Math.random = () => value;
  try { return await action(); } finally { Math.random = original; }
}

test('movie seed in a mixed TV/movie collection is eligible alongside movies without collections', async () => {
  const result = await withRandom(0.1, () => getNextMovie());
  assert.equal(result.ratingKey, FIRST);
  assert.equal(result.type, 'movie');
  assert.equal(result.orderType, 'MOVIES_GENERAL');
  assert.ok(queries.every(query => query.sectionKey === undefined));
});

test('movie weighting reaches a movie in the second library through shared Android/web Up Next', async () => {
  movies[0].viewCount = 1;
  const result = await withRandom(0.9, () => resolveUpNext({}));
  assert.equal(result.ratingKey, SECOND);
  assert.equal(result.type, 'movie');
  assert.equal(result.sectionKey, 'library-two');
  assert.ok(queries.some(query => query.removed === false && query.sectionKey === undefined));
});

test('100 percent movie weighting selects outside Now Watching even when that collection has movies', async () => {
  settings.collectionName = 'Now Watching';
  movies[0].collections = '["Now Watching"]';
  const result = await withRandom(0.9, () => resolveUpNext({}));
  assert.equal(result.ratingKey, SECOND);
  assert.equal(result.type, 'movie');
  assert.equal(result.sectionKey, 'library-two');
  const initialQuery = queries[0];
  assert.deepEqual(initialQuery, { removed: false });
});

test('watched movies in Now Watching do not hide unplayed movies in other libraries', async () => {
  settings.collectionName = 'Now Watching';
  movies[0].collections = '["Now Watching"]';
  movies[0].viewCount = 1;
  const result = await withRandom(0.9, () => resolveUpNext({}));
  assert.equal(result.ratingKey, SECOND);
  assert.equal(result.type, 'movie');
  assert.deepEqual(queries[0], { removed: false });
});

test('positive fractional movie weights select movies without falling into a zero-weight order type', async () => {
  settings.tvGeneralPercent = 0.25;
  settings.moviesGeneralPercent = 0.75;
  movies[0].viewCount = 1;
  const result = await withRandom(0.5, () => resolveUpNext({}));
  assert.equal(result.ratingKey, SECOND);
  assert.equal(result.type, 'movie');
});

test('every unwatched movie stays in the seed pool even at 100 percent partially watched collection priority', async () => {
  settings.partiallyWatchedCollectionPercent = 100;
  movies.push({
    ratingKey: 'e'.repeat(32), title: 'Watched Collection Movie',
    sectionKey: 'library-one', collections: '["Mixed"]', viewCount: 1
  });
  for (const [random, expected] of [[0.1, FIRST], [0.9, SECOND]]) {
    const result = await withRandom(random, () => getNextMovie());
    assert.equal(result.ratingKey, expected);
    assert.equal(result.type, 'movie');
  }
});

test('collection chronology follows selection of an unwatched movie rather than choosing a collection first', async () => {
  settings.partiallyWatchedCollectionPercent = 100;
  movies[0].originallyAvailableAt = '2025-01-01';
  const collectionPick = await withRandom(0.1, () => getNextMovie());
  assert.equal(collectionPick.type, 'episode');
  assert.equal(collectionPick.episodeRatingKey, 'd'.repeat(32));
  const standalonePick = await withRandom(0.9, () => getNextMovie());
  assert.equal(standalonePick.ratingKey, SECOND);
  assert.equal(standalonePick.type, 'movie');
});

test('fully watched movie libraries return no content instead of using watched movies as seeds', async () => {
  movies.forEach(movie => { movie.viewCount = 1; });
  const result = await withRandom(0.9, () => getNextMovie());
  assert.equal(result.ratingKey, undefined);
  assert.match(result.message, /No unwatched movies/);
});
