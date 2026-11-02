const test = require('node:test');
const assert = require('node:assert');
const {
  applyMovieCreditScenes,
  createMovieCreditScenesService,
  creditScenesFromTags
} = require('../services/movieCreditScenesService');

const MOVIE_KEY = '0123456789abcdef0123456789abcdef';
const creditTag = name => ({ tag: 3805, tagName: 'Credit Scenes', name });

function makeService({ guids = [], responses = {} } = {}) {
  const calls = [];
  const http = {
    get: async (url, options) => {
      calls.push({ url, params: options.params });
      const path = url.replace('https://tvdb.test', '');
      if (!(path in responses)) throw new Error(`unexpected ${path}`);
      return { data: { data: responses[path] } };
    }
  };
  const tvdb = { baseURL: 'https://tvdb.test', bearerToken: 'token', isTokenAvailable: async () => true };
  const prisma = { plexGuid: { findMany: async () => guids.map(id_value => ({ id_value })) } };
  return { service: createMovieCreditScenesService({ tvdb, prisma, http }), calls };
}

test('creditScenesFromTags reads the TVDB Credit Scenes tag', () => {
  assert.strictEqual(creditScenesFromTags([{ tagName: 'Sub-Genre', name: 'Superhero' }, creditTag('Yes')]), true);
  assert.strictEqual(creditScenesFromTags([creditTag('No')]), false);
  assert.strictEqual(creditScenesFromTags([{ tagName: 'Sub-Genre', name: 'Yes' }]), null);
  assert.strictEqual(creditScenesFromTags(undefined), null);
});

test('uses the tvdb guid directly and caches the result', async () => {
  const { service, calls } = makeService({
    guids: ['imdb://tt0371746', 'tvdb://108'],
    responses: { '/movies/108/extended': { tagOptions: [creditTag('Yes')] } }
  });
  const first = await service.getCreditScenes({ ratingKey: MOVIE_KEY, title: 'Iron Man', year: 2008 });
  const second = await service.getCreditScenes({ ratingKey: MOVIE_KEY, title: 'Iron Man', year: 2008 });
  assert.deepStrictEqual(first, { tvdbMovieId: '108', hasCreditScenes: true });
  assert.deepStrictEqual(second, first);
  assert.strictEqual(calls.length, 1);
});

test('falls back to remote id lookup, then title search', async () => {
  const viaImdb = makeService({
    guids: ['imdb://tt1'],
    responses: {
      '/search/remoteid/tt1': [{ movie: { id: 55 } }],
      '/movies/55/extended': { tagOptions: [creditTag('No')] }
    }
  });
  assert.deepStrictEqual(await viaImdb.service.getCreditScenes({ ratingKey: MOVIE_KEY, title: 'X' }),
    { tvdbMovieId: '55', hasCreditScenes: false });

  const viaTitle = makeService({
    responses: {
      '/search': [{ name: 'Thor', year: '2017', tvdb_id: '1' }, { name: 'Thor', year: '2011', tvdb_id: '2' }],
      '/movies/2/extended': { tagOptions: [] }
    }
  });
  assert.deepStrictEqual(await viaTitle.service.getCreditScenes({ title: 'Thor', year: 2011 }),
    { tvdbMovieId: '2', hasCreditScenes: null });
});

test('applyMovieCreditScenes only touches movies', async () => {
  const service = { getCreditScenes: async ({ ratingKey }) => ({ hasCreditScenes: ratingKey === MOVIE_KEY }) };
  const movie = await applyMovieCreditScenes({ type: 'movie', plexKey: MOVIE_KEY, title: 'A' }, service);
  assert.strictEqual(movie.hasCreditScenes, true);
  const orderMovie = await applyMovieCreditScenes({ orderType: 'CUSTOM_ORDER', customOrderMediaType: 'movie', ratingKey: 'abc', title: 'B' }, service);
  assert.strictEqual(orderMovie.hasCreditScenes, false);
  const episode = await applyMovieCreditScenes({ type: 'episode', title: 'C' }, service);
  assert.ok(!('hasCreditScenes' in episode));
});
