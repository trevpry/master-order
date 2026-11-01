const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let seed = null;
let movieSelections = 0;
const stubs = {
  'getNextEpisode.js': async () => seed,
  'getNextMovie.js': async () => {
    movieSelections++;
    return { type: 'movie', ratingKey: 'random-movie', orderType: 'MOVIES_GENERAL' };
  },
  'getNextCustomOrder.js': {},
  'services/historyPlusService.js': class {},
  'utils/seasonArtwork.js': { applySeasonArtwork: async () => {}, applyBackgroundArtwork: async result => result },
  'services/tvdbEpisodeStatusService.js': { applyTvdbEpisodeStatus: async () => {} },
  'utils/collectionArtwork.js': { applyCollectionArtwork: async () => {} }
};
for (const [name, exports] of Object.entries(stubs)) {
  const filename = path.join(__dirname, '..', name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const { resolveUpNext } = require('../services/upNextService');

test('shared Android/web Up Next keeps a chronology-selected movie rather than rerolling movie selection', async () => {
  seed = { type: 'movie', ratingKey: 'b'.repeat(32), orderType: 'MOVIES_GENERAL' };
  movieSelections = 0;
  assert.equal(await resolveUpNext({}), seed);
  assert.equal(movieSelections, 0);
});

test('weighted movie-order placeholder still selects a movie normally', async () => {
  seed = { orderType: 'MOVIES_GENERAL' };
  movieSelections = 0;
  assert.equal((await resolveUpNext({})).ratingKey, 'random-movie');
  assert.equal(movieSelections, 1);
});
