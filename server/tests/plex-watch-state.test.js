const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quietConsole = { log() {}, warn() {}, error() {} };
const plain = value => JSON.parse(JSON.stringify(value));

function loadModule(filename, dependencies, globals = {}) {
  const context = vm.createContext({
    require: name => {
      if (Object.prototype.hasOwnProperty.call(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} },
    console: quietConsole,
    ...globals
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), context);
  return context.module.exports;
}

function syncService(prisma = {}, reconciliations = []) {
  const PlexSyncService = loadModule('plexSyncService.js', {
    dotenv: { config() {} },
    'node-fetch': async () => { throw new Error('Unexpected Plex request'); },
    './prismaClient': prisma,
    './getNextCustomOrder': {
      reconcileCustomOrderWatchStateFromPlex: async (...args) => reconciliations.push(args)
    },
    './utils/plexDeletedEntities': {}
  }, { process: { env: {} } });
  return new PlexSyncService();
}

test('only a positive Plex viewCount proves watched status, never playback timestamps', () => {
  const service = syncService();
  for (const viewCount of [undefined, null, 0, '0', -1, 'invalid']) {
    assert.equal(service.isPlexWatched(viewCount, 1700000000), false);
  }
  for (const viewCount of [1, '1', 2]) {
    assert.equal(service.isPlexWatched(viewCount), true);
  }
});

for (const mediaType of ['episode', 'movie']) {
  for (const refresh of [true, false]) {
    for (const viewCount of [undefined, 0, '1']) {
      test(`${mediaType} ${refresh ? 'metadata' : 'watch-only'} sync with viewCount=${viewCount} requires completion`, async () => {
        const reconciliations = [];
        const writes = [];
        const item = {
          ratingKey: '123', title: 'Title', updatedAt: 100,
          lastViewedAt: 1700000000, viewOffset: 60000, viewCount
        };
        const model = mediaType === 'episode' ? 'plexEpisode' : 'plexMovie';
        const prisma = {
          [model]: {
            findMany: async () => [{
              ratingKey: '123', updatedAt_plex: refresh ? 99 : 100,
              viewCount: null, lastViewedAt: null
            }],
            upsert: async args => { writes.push(args.update); return args.update; },
            update: async args => { writes.push(args.data); return args.data; }
          }
        };
        const service = syncService(prisma, reconciliations);
        service.makeRequest = async () => ({ MediaContainer: { Metadata: [item] } });
        service.fetchDetailedMetadataBatch = async () => new Map([['123', item]]);
        service.clearComplexFields = async () => {};
        service.syncComplexFields = async () => {};
        if (mediaType === 'episode') {
          await service.syncEpisodes('season', 'show', 'Series');
        } else {
          await service.syncMovies('section');
        }
        assert.deepEqual(reconciliations, [['123', mediaType, viewCount === '1']]);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].lastViewedAt, 1700000000);
        assert.equal(writes[0].viewCount, viewCount === '1' ? 1 : refresh && viewCount === 0 ? null : viewCount ?? null);
      });
    }
  }
}

for (const mediaType of ['episode', 'movie']) {
  for (const viewCount of [null, 0, 1]) {
    test(`${mediaType} metadata healing with viewCount=${viewCount} only marks completed items watched`, async () => {
      const writes = [];
      let itemQueries = 0;
      const prisma = {
        customOrderItem: {
          findMany: async () => ++itemQueries === 1 ? [{
            id: 1, mediaType, seriesTitle: 'Series', seasonNumber: 1,
            episodeNumber: 2, title: 'Title'
          }] : [],
          update: async args => writes.push(plain(args))
        },
        [mediaType === 'episode' ? 'plexEpisode' : 'plexMovie']: {
          findFirst: async () => ({ ratingKey: '123', viewCount, lastViewedAt: 1700000000 })
        }
      };
      assert.equal(await syncService(prisma).reconcileAllCustomOrderWatchStates(), 1);
      assert.deepEqual(writes, [{
        where: { id: 1 },
        data: { plexKey: '123', ...(viewCount > 0 ? { isWatched: true } : {}) }
      }]);
    });
  }
}

test('bulk reconciliation excludes started movies and episodes and marks all completed matches', async () => {
  const items = [
    { id: 1, mediaType: 'episode', plexKey: 'episode-started' },
    { id: 2, mediaType: 'episode', plexKey: 'episode-watched' },
    { id: 3, mediaType: 'movie', plexKey: 'movie-started' },
    { id: 4, mediaType: 'movie', plexKey: 'movie-watched' },
    { id: 5, mediaType: 'movie', plexKey: 'movie-watched' }
  ];
  const writes = [];
  let itemQueries = 0;
  const prisma = {
    customOrderItem: {
      findMany: async () => ++itemQueries === 1 ? [] : items,
      updateMany: async args => writes.push(plain(args))
    }
  };
  for (const mediaType of ['episode', 'movie']) {
    prisma[mediaType === 'episode' ? 'plexEpisode' : 'plexMovie'] = {
      findMany: async ({ where }) => {
        assert.deepEqual(plain(where), {
          ratingKey: { in: items.filter(item => item.mediaType === mediaType).map(item => item.plexKey) },
          viewCount: { gt: 0 }
        });
        return [{ ratingKey: `${mediaType}-watched` }];
      }
    };
  }
  assert.equal(await syncService(prisma).reconcileAllCustomOrderWatchStates(), 3);
  assert.deepEqual(writes, [{ where: { id: { in: [2, 4, 5] } }, data: { isWatched: true } }]);
});

function webhookHandler(item, calls) {
  const handlers = new Map();
  const record = name => async (...args) => calls.push({ name, args });
  const router = { post: (route, ...callbacks) => handlers.set(route, callbacks.at(-1)) };
  loadModule(path.join('routes', 'webhooks.js'), {
    express: { Router: () => router },
    multer: () => ({ single: () => () => {} }),
    http: { request: () => { throw new Error('Network disabled in test'); } },
    '../watchLogService': class { logWatched = record('log'); },
    '../plexDatabaseService': class {
      async getItemMetadata() { return { duration: 2700000 }; }
      async getMovieByRatingKey() { return { duration: 7200000 }; }
      markEpisodeAsWatched = record('plex-episode');
      markMovieAsWatched = record('plex-movie');
    },
    '../getNextCustomOrder': {
      markCustomOrderItemAsWatched: record('mark'),
      reconcileCustomOrderWatchStateFromPlex: record('reconcile')
    },
    '../prismaClient': { customOrderItem: { findFirst: async () => item } },
    '../databaseUtils': { getSettings: async () => ({ selectedPlexUser: 'Viewer' }) }
  }, { Buffer });
  return handlers.get('/');
}

for (const mediaType of ['episode', 'movie']) {
  for (const event of ['media.play', 'media.resume', 'media.pause', 'media.stop', 'media.scrobble']) {
    test(`${mediaType} webhook ${event} ${event === 'media.scrobble' ? 'marks watched' : 'does not mark watched'}`, async () => {
      const calls = [];
      const item = {
        id: 1, plexKey: '123', mediaType, title: 'Title', isWatched: false,
        seriesTitle: 'Series', seasonNumber: 1, episodeNumber: 2, customOrder: { name: 'Order' }
      };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        send(body) { this.body = body; }
      };
      await webhookHandler(item, calls)({
        headers: {},
        body: { payload: JSON.stringify({
          event, Account: { title: 'Viewer' },
          Metadata: { ratingKey: '123', type: mediaType, lastViewedAt: 1700000000, viewOffset: 60000 }
        }) }
      }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, 'OK');
      if (event === 'media.scrobble') {
        assert.deepEqual(calls.map(call => call.name), ['mark', 'reconcile', 'log', `plex-${mediaType}`]);
        assert.deepEqual(calls[0].args, [1]);
        assert.deepEqual(calls[1].args, ['123', mediaType, true]);
        assert.equal(calls[2].args[0].isCompleted, true);
      } else {
        assert.deepEqual(calls, []);
      }
    });
  }
}
