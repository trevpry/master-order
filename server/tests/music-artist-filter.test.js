const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const prismaPath = require.resolve('../prismaClient');
const cachedPrisma = require.cache[prismaPath];
let PlexDatabaseService;
try {
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };
  PlexDatabaseService = require('../plexDatabaseService');
} finally {
  if (cachedPrisma) require.cache[prismaPath] = cachedPrisma;
  else delete require.cache[prismaPath];
}
const { splitArtistNameAndType } = require('../utils/artistNameMatch');

const createService = () => {
  const queries = [];
  const service = Object.create(PlexDatabaseService.prototype);
  service.isPostgreSQL = false;
  service.prisma = {
    plexArtist: {
      findMany: async query => { queries.push(query); return []; },
      count: async query => { queries.push(query); return 0; }
    }
  };
  return { service, queries };
};

test('artist list and count queries apply the selected type before pagination', async () => {
  const { service, queries } = createService();
  await service.getAllArtists(20, 20, 'A', 7);
  await service.getArtistsCount('A', 7);
  assert.deepEqual(queries[0].where.artistTypes, { some: { artistTypeId: 7 } });
  assert.deepEqual(queries[1].where, queries[0].where);
  assert.equal(queries[0].take, 20);
  assert.equal(queries[0].skip, 20);
  assert.ok(queries[0].where.AND.length > 0);
});

test('section artist list and count queries retain type and section constraints', async () => {
  const { service, queries } = createService();
  await service.getArtistsBySection('6', 20, 0, 'A', 7);
  await service.getArtistsBySectionCount('6', 'A', 7);
  assert.deepEqual(queries[0].where.artistTypes, { some: { artistTypeId: 7 } });
  assert.deepEqual(queries[0].where.librarySection, { sectionKey: '6' });
  assert.deepEqual(queries[1].where, queries[0].where);
});

test('artist searches and accent fallback both retain the type filter', async () => {
  const { service, queries } = createService();
  await service.searchArtists('Antonio Mazzoni', 'A', 7);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.deepEqual(query.where.artistTypes, { some: { artistTypeId: 7 } });
    assert.ok(query.where.AND.length > 0);
  }
});

test('section search and count queries apply identical type and search conditions', async () => {
  const { service, queries } = createService();
  await service.searchArtistsBySection('6', 'Antonio', 20, 0, 'A', 7);
  await service.searchArtistsBySectionCount('6', 'Antonio', 'A', 7);
  assert.deepEqual(queries[0].where.artistTypes, { some: { artistTypeId: 7 } });
  assert.deepEqual(queries[1].where, queries[0].where);
});

test('All Artist Types leaves the list unconstrained by type', async () => {
  const { service, queries } = createService();
  await service.getAllArtists(20, 0);
  await service.getArtistsCount();
  assert.ok(queries.every(query => !query.where.artistTypes));
});

const createArtistRoutes = () => {
  const handlers = new Map();
  const calls = [];
  const plexDb = {};
  for (const name of ['getAllArtists', 'getArtistsCount', 'getArtistsBySection', 'getArtistsBySectionCount', 'searchArtists', 'searchArtistsBySection', 'searchArtistsBySectionCount']) {
    plexDb[name] = async (...args) => {
      calls.push({ name, args });
      return name.endsWith('Count') ? 1 : [{ ratingKey: 'composer', title: 'Antonio' }];
    };
  }
  const source = fs.readFileSync(path.join(__dirname, '../routes/music.js'), 'utf8');
  const context = vm.createContext({
    router: { get: (route, handler) => handlers.set(route, handler) },
    asyncHandler: handler => handler,
    sendBadRequest: (res, message) => res.status(400).json({ error: message }),
    plexDb,
    prisma: {
      plexTrack: { aggregate: async () => ({ _sum: { viewCount: 0 } }) },
      artistTypeAssignment: { findMany: async () => [{ artistKey: 'composer' }] }
    },
    splitArtistNameAndType,
    console: { log: () => {} }
  });
  vm.runInContext(source.slice(source.indexOf('// Music Artists - All'), source.indexOf('// Music Artists - Single Artist')), context);
  return { handlers, calls };
};

for (const sectionKey of [undefined, '6']) {
  for (const search of [undefined, 'Antonio']) {
    test(`${sectionKey ? 'section' : 'all-library'} ${search ? 'search' : 'list'} endpoint forwards the selected type`, async () => {
      const { handlers, calls } = createArtistRoutes();
      const route = sectionKey ? '/artists/section/:sectionKey' : '/artists';
      let result;
      await handlers.get(route)({ query: { artistTypeId: '7', search, page: '2', limit: '20', letter: 'A' }, params: { sectionKey } }, { json: data => { result = data; } });
      assert.ok(calls.length > 0);
      assert.ok(calls.every(call => call.args.at(-1) === 7));
      assert.equal((result.artists || result)[0].ratingKey, 'composer');
      if (!search || sectionKey) assert.equal(result.totalArtists, 1);
    });
  }
}

test('artist endpoints reject invalid type IDs without querying the database', async () => {
  for (const route of ['/artists', '/artists/section/:sectionKey']) {
    const { handlers, calls } = createArtistRoutes();
    let result;
    let status;
    const response = { status: code => { status = code; return response; }, json: data => { result = data; } };
    await handlers.get(route)({ query: { artistTypeId: 'invalid' }, params: { sectionKey: '6' } }, response);
    assert.equal(status, 400);
    assert.match(result.error, /valid artist type ID/);
    assert.equal(calls.length, 0);
  }
});