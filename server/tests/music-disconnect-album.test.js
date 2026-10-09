const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quietConsole = { log() {}, warn() {}, error() {} };
const plain = value => JSON.parse(JSON.stringify(value));
const source = filename => fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');

function databaseService(prisma) {
  const context = vm.createContext({
    require: name => {
      assert.equal(name, './prismaClient');
      return prisma;
    },
    module: { exports: {} },
    process: { env: {} },
    console: quietConsole
  });
  vm.runInContext(source('plexDatabaseService.js'), context);
  return new context.module.exports();
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function routeHandlers(plexDb, prisma = {}) {
  const handlers = new Map();
  const context = vm.createContext({
    router: {
      get: (route, handler) => handlers.set(route, handler),
      post: (route, handler) => handlers.set(route, handler)
    },
    asyncHandler: handler => handler,
    sendBadRequest: (res, error) => res.status(400).json({ error }),
    plexDb, prisma,
    albumArtwork: { attachArtworkInfo: async () => {} },
    console: quietConsole
  });
  const routes = source(path.join('routes', 'music.js'));
  vm.runInContext(routes.slice(routes.indexOf('// Music Artists - Single Artist'),
    routes.indexOf('// Delete an artist after')), context);
  vm.runInContext(routes.slice(routes.indexOf('// Get tracks by album'),
    routes.indexOf('// Get random tracks - All sections')), context);
  return handlers;
}

test('track artist albums include primary and all linked artists without duplicate albums or artist queries', async () => {
  const queries = [];
  const shared = { ratingKey: 'shared', title: 'Shared Album', year: 2024 };
  const primary = { ratingKey: 'primary-album', title: 'Primary Album', year: 2020 };
  const credited = { ratingKey: 'credited-album', title: 'Credited Album', year: 2023 };
  const service = databaseService({
    plexTrack: {
      findUnique: async args => {
        assert.deepEqual(plain(args), {
          where: { ratingKey: 'track' },
          include: { trackArtists: { select: { artistKey: true } } }
        });
        return {
          grandparentRatingKey: 'primary', removed: false,
          trackArtists: [{ artistKey: 'primary' }, { artistKey: 'credited' }, { artistKey: 'credited' }]
        };
      }
    },
    plexAlbum: {
      findMany: async args => {
        const query = plain(args);
        queries.push(query);
        const key = query.where.OR[0].parentRatingKey;
        assert.equal(query.where.removed, false);
        assert.deepEqual(query.where.OR[1], { albumArtists: { some: { artistKey: key } } });
        return key === 'primary' ? [primary, shared] : [shared, credited];
      }
    }
  });
  const res = response();
  await routeHandlers(service).get('/tracks/:ratingKey/artist-albums')({ params: { ratingKey: 'track' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(plain(res.body), [shared, credited, primary]);
  assert.equal(queries.length, 2);
});

test('track artist album recommendations do not default to every album when artist credits are absent', async () => {
  const service = databaseService({
    plexTrack: { findUnique: async () => ({ grandparentRatingKey: null, trackArtists: [], removed: false }) },
    plexAlbum: { findMany: async () => assert.fail('No artist keys must not query the album library') }
  });
  const res = response();
  await routeHandlers(service).get('/tracks/:ratingKey/artist-albums')({ params: { ratingKey: 'track' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(plain(res.body), []);
});

test('track artist albums support credited artists without a primary artist and reject missing or removed tracks', async () => {
  const album = { ratingKey: 'album', title: 'Album' };
  for (const track of [null, { removed: true }, {
    grandparentRatingKey: null, trackArtists: [{ artistKey: 'credited' }], removed: false
  }]) {
    const service = databaseService({
      plexTrack: { findUnique: async () => track },
      plexAlbum: { findMany: async () => [album] }
    });
    const res = response();
    await routeHandlers(service).get('/tracks/:ratingKey/artist-albums')({ params: { ratingKey: 'track' } }, res);
    assert.equal(res.statusCode, !track || track.removed ? 404 : 200);
    if (res.statusCode === 200) assert.deepEqual(plain(res.body), [album]);
    else assert.equal(res.body.error, 'Track not found');
  }
});

test('track artist album query failures propagate rather than returning an empty success', async () => {
  const service = databaseService({
    plexTrack: { findUnique: async () => ({
      grandparentRatingKey: 'artist', trackArtists: [], removed: false
    }) },
    plexAlbum: { findMany: async () => { throw new Error('Album lookup failed'); } }
  });
  await assert.rejects(service.getAlbumsForTrackArtists('track'), /Album lookup failed/);
});

test('disconnect endpoint removes only the album relation and preserves all track metadata', async () => {
  let track = {
    ratingKey: 'track', parentRatingKey: 'album', grandparentRatingKey: 'artist',
    title: 'Track', userTitle: 'Edited Title', userComposer: 'Composer',
    duration: 120000, index: 2, discNumber: 1, parentThumb: '/art',
    file: 'track.flac', viewCount: 3, workId: 7,
    musicBrainzTrackId: 'recording', metadataPreferences: '{"title":"user"}',
    trackArtists: [{ artistKey: 'performer', artistTypeId: 1 }],
    workPartTracks: [{ workPartId: 8 }]
  };
  const original = structuredClone(track);
  const writes = [];
  const service = databaseService({
    plexTrack: {
      findUnique: async ({ where }) => {
        assert.equal(where.ratingKey, 'track');
        return track;
      },
      update: async args => {
        writes.push(plain(args));
        track = { ...track, ...args.data };
        return track;
      }
    }
  });
  const handler = routeHandlers(service).get('/tracks/:ratingKey/disconnect-album');
  const res = response();
  await handler({ params: { ratingKey: 'track' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(track, { ...original, parentRatingKey: null });
  assert.deepEqual(writes, [{ where: { ratingKey: 'track' }, data: { parentRatingKey: null } }]);
  // Repeating the operation is harmless and does not delete the track.
  await handler({ params: { ratingKey: 'track' } }, response());
  assert.deepEqual(track, { ...original, parentRatingKey: null });
});

test('disconnect endpoint returns 404 for a missing track without a write', async () => {
  const service = databaseService({
    plexTrack: {
      findUnique: async () => null,
      update: async () => assert.fail('Must not write a missing track')
    }
  });
  const res = response();
  await routeHandlers(service).get('/tracks/:ratingKey/disconnect-album')(
    { params: { ratingKey: 'missing' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'Track not found');
});

test('disconnect failures propagate to route error handling', async () => {
  const failure = new Error('Database unavailable');
  const service = databaseService({
    plexTrack: {
      findUnique: async () => ({ ratingKey: 'track' }),
      update: async () => { throw failure; }
    }
  });
  await assert.rejects(routeHandlers(service).get('/tracks/:ratingKey/disconnect-album')(
    { params: { ratingKey: 'track' } }, response()), error => error === failure);
});

test('disconnected tracks leave album listings but remain in artist listings and artist details', async () => {
  const track = {
    ratingKey: 'track', grandparentRatingKey: 'artist', parentRatingKey: null,
    title: 'Track', removed: false, work: { id: 7, title: 'Work' }
  };
  const queries = [];
  const service = databaseService({
    plexTrack: {
      findMany: async query => {
        queries.push(plain(query));
        return Object.entries(query.where).every(([key, value]) => track[key] === value) ? [track] : [];
      }
    }
  });
  assert.deepEqual(await service.getTracksByAlbum('album'), []);
  assert.deepEqual(await service.getTracksByArtist('artist'), [track]);
  const prisma = {
    albumArtist: { findMany: async () => [] },
    trackArtist: { findMany: async () => [] },
    work: { findMany: async () => [] },
    plexTrack: { aggregate: async () => ({ _sum: { viewCount: 3 } }) }
  };
  service.getArtistByRatingKey = async () => ({ ratingKey: 'artist', title: 'Artist' });
  const res = response();
  await routeHandlers(service, prisma).get('/artists/:ratingKey')(
    { params: { ratingKey: 'artist' } }, res);
  assert.deepEqual(res.body.tracksWithoutAlbum, [track]);
  assert.deepEqual(queries[2].where, {
    grandparentRatingKey: 'artist', parentRatingKey: null, removed: false
  });
  assert.deepEqual(queries[2].include, { work: true });
});

test('Plex music sync does not reconnect or overwrite an existing disconnected track', async () => {
  const context = vm.createContext({
    require: name => {
      if (name === 'dotenv') return { config() {} };
      if (name === 'node-fetch') return async () => assert.fail('Unexpected network request');
      if (name === './prismaClient') return {
        plexLibrarySection: { findUnique: async () => ({ id: 1 }) },
        plexTrack: {
          findMany: async () => [{ ratingKey: 'track' }],
          createMany: async () => assert.fail('Must not recreate existing tracks'),
          update: async () => assert.fail('Must not reconnect existing tracks'),
          upsert: async () => assert.fail('Must not overwrite existing tracks')
        }
      };
      if (name === './getNextCustomOrder' || name === './utils/plexDeletedEntities') return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
    process: { env: {} }, module: { exports: {} }, console: quietConsole
  });
  vm.runInContext(source('plexSyncService.js'), context);
  const service = new context.module.exports();
  service.makeRequest = async () => ({
    MediaContainer: { Metadata: [{ ratingKey: 'track', parentRatingKey: 'album', title: 'Plex title' }] }
  });
  await service.syncTracks('section', 'album');
});

test('returning to artist details refreshes the same selected artist after disconnecting a track', async () => {
  const pageSource = fs.readFileSync(path.join(__dirname,
    '..', '..', 'client', 'src', 'modules', 'media', 'pages', 'music', 'index.jsx'), 'utf8');
  const refreshedArtist = { ratingKey: 'artist', tracksWithoutAlbum: [{ ratingKey: 'track' }] };
  let selectedArtist;
  const calls = [];
  const context = vm.createContext({
    artistRatingKey: 'artist', albumRatingKey: null, activeView: 'artist',
    selectedArtist: { ratingKey: 'artist', tracksWithoutAlbum: [] }, selectedAlbum: null,
    config: { apiBaseUrl: 'http://local' },
    fetch: async url => {
      calls.push(url);
      return { ok: true, json: async () => url.includes('/artists/') ? refreshedArtist : [] };
    },
    setSelectedArtist: artist => { selectedArtist = artist; },
    setAlbums() {}, setTracks() {}, setSelectedAlbum() {},
    setError: error => assert.fail(error), console: quietConsole
  });
  vm.runInContext(pageSource.slice(pageSource.indexOf('const loadDataFromUrl = async () => {'),
    pageSource.indexOf('    loadDataFromUrl();')) + '\nthis.load = loadDataFromUrl;', context);
  await context.load();
  assert.equal(selectedArtist, refreshedArtist);
  assert.ok(calls.includes('http://local/api/music/artists/artist'));
});

test('adding a disconnected track to another artist album changes only its album key', async () => {
  const track = {
    ratingKey: 'track', parentRatingKey: null, grandparentRatingKey: 'original-artist',
    title: 'Track', userTitle: 'Edited', index: 9, discNumber: 2,
    duration: 123000, viewCount: 4, musicBrainzTrackId: 'recording',
    workId: 3, trackArtists: [{ artistKey: 'performer' }], workPartTracks: [{ workPartId: 2 }]
  };
  const album = { ratingKey: 'target', parentRatingKey: 'different-artist' };
  const writes = [];
  const service = databaseService({
    plexTrack: {
      findUnique: async () => track,
      update: async args => {
        writes.push(plain(args));
        return { ...track, ...args.data, album };
      }
    },
    plexAlbum: { findUnique: async () => album }
  });
  const res = response();
  await routeHandlers(service).get('/tracks/:ratingKey/album')(
    { params: { ratingKey: 'track' }, body: { albumRatingKey: 'target' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.track, { ...track, parentRatingKey: 'target', album });
  assert.deepEqual(writes, [{
    where: { ratingKey: 'track', parentRatingKey: null },
    data: { parentRatingKey: 'target' },
    include: { album: { include: { artist: true } } }
  }]);
});

for (const [name, body, track, album, status] of [
  ['missing album key', {}, {}, {}, 400],
  ['empty album key', { albumRatingKey: ' ' }, {}, {}, 400],
  ['non-string album key', { albumRatingKey: 1 }, {}, {}, 400],
  ['missing track', { albumRatingKey: 'target' }, null, {}, 404],
  ['removed track', { albumRatingKey: 'target' }, { removed: true }, {}, 404],
  ['connected track', { albumRatingKey: 'target' }, { parentRatingKey: 'existing' }, {}, 409],
  ['missing album', { albumRatingKey: 'target' }, { parentRatingKey: null }, null, 404],
  ['removed album', { albumRatingKey: 'target' }, { parentRatingKey: null }, { removed: true }, 404]
]) {
  test(`adding a track rejects ${name} without changing metadata`, async () => {
    const service = {
      getTrackByRatingKey: async () => track,
      getAlbumByRatingKey: async () => album,
      addTrackToAlbum: async () => assert.fail('Invalid request must not write')
    };
    const res = response();
    await routeHandlers(service).get('/tracks/:ratingKey/album')(
      { params: { ratingKey: 'track' }, body }, res);
    assert.equal(res.statusCode, status);
    assert.ok(res.body.error);
  });
}

test('concurrent album assignment returns a conflict and unexpected failures propagate', async () => {
  for (const code of ['P2025', 'P1001']) {
    const failure = Object.assign(new Error('Update failed'), { code });
    const service = {
      getTrackByRatingKey: async () => ({ ratingKey: 'track', parentRatingKey: null }),
      getAlbumByRatingKey: async () => ({ ratingKey: 'album' }),
      addTrackToAlbum: async () => { throw failure; }
    };
    const res = response();
    const operation = routeHandlers(service).get('/tracks/:ratingKey/album')(
      { params: { ratingKey: 'track' }, body: { albumRatingKey: 'album' } }, res);
    if (code === 'P2025') {
      await operation;
      assert.equal(res.statusCode, 409);
      assert.match(res.body.error, /Refresh/);
    } else {
      await assert.rejects(operation, error => error === failure);
    }
  }
});
