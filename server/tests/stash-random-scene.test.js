const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { selectRandomUnwatchedScene } = require('../services/stashRandomSceneService');

test('selection hydrates one row rather than the full library and keeps the unwatched filter identical', async () => {
  const calls = [];
  const scene = { id: 'selected', title: 'Scene', performers: [] };
  const include = { performers: { include: { performer: true } } };
  const prisma = { stashScene: {
    count: async args => { calls.push(args); return 26000; },
    findMany: async args => { calls.push(args); return [scene]; }
  } };
  const result = await selectRandomUnwatchedScene(prisma, include);
  assert.equal(result.scene, scene);
  assert.equal(result.totalUnwatched, 26000);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].where, calls[1].where);
  assert.deepEqual(calls[0].where.AND[0].OR, [{ playCount: 0 }, { playCount: null }]);
  assert.equal(calls[0].where.AND[1].NOT.tags.some.tag.name, '__Watched');
  assert.equal(calls[1].take, 1);
  assert.ok(calls[1].skip >= 0 && calls[1].skip < 26000);
  assert.equal(calls[1].include, include);
});

test('every offset is selectable including both ends of the pool', async () => {
  const original = Math.random;
  try {
    for (const [random, expected] of [[0, 0], [0.5, 5], [0.999999, 9]]) {
      Math.random = () => random;
      const prisma = { stashScene: {
        count: async () => 10,
        findMany: async args => [{ id: String(args.skip) }]
      } };
      assert.equal((await selectRandomUnwatchedScene(prisma)).scene.id, String(expected));
    }
  } finally { Math.random = original; }
});

test('an empty library does not issue a metadata query', async () => {
  const prisma = { stashScene: {
    count: async () => 0,
    findMany: async () => { assert.fail('No metadata query for an empty pool'); }
  } };
  assert.deepEqual(await selectRandomUnwatchedScene(prisma), { scene: null, totalUnwatched: 0 });
});

test('concurrent removal retries once using a fresh count and errors explicitly if still unstable', async () => {
  let counts = 0;
  let reads = 0;
  const prisma = { stashScene: {
    count: async () => { counts++; return 10; },
    findMany: async () => ++reads === 1 ? [] : [{ id: 'scene' }]
  } };
  assert.equal((await selectRandomUnwatchedScene(prisma)).scene.id, 'scene');
  assert.equal(counts, 2);
  prisma.stashScene.findMany = async () => [];
  await assert.rejects(selectRandomUnwatchedScene(prisma), /changed during selection/);
});

test('database errors are not masked as empty or successful selection', async () => {
  await assert.rejects(selectRandomUnwatchedScene({
    stashScene: { count: async () => { throw new Error('database unavailable'); } }
  }), /database unavailable/);
});

test('Android returns 404 for an empty pool and 500 for database failure', async () => {
  const createRoutes = require('../routes/android/stashIntegration');
  for (const failure of [false, true]) {
    const prisma = { stashScene: {
      count: async () => {
        if (failure) throw new Error('database unavailable');
        return 0;
      }
    } };
    const router = createRoutes(prisma);
    const handler = router.stack.find(layer => layer.route?.path === '/stash/scene/next').route.stack[0].handle;
    let status;
    let body;
    const res = {
      status: code => { status = code; return res; },
      json: value => { body = value; }
    };
    await handler({}, res);
    assert.equal(status, failure ? 500 : 404);
    assert.ok(body);
    assert.equal(body.type === 'PLAY_SCENE', false);
  }
});

test('Android selection does not wait for Stash artwork or a delegated HTTP request', async () => {
  const path = require('node:path');
  const fetchPath = require.resolve('node-fetch');
  const originalFetch = require.cache[fetchPath];
  require.cache[fetchPath] = {
    id: fetchPath, filename: fetchPath, loaded: true,
    exports: () => { assert.fail('Random selection must not make any HTTP requests'); }
  };
  const routePath = path.join(__dirname, '..', 'routes', 'android', 'stashIntegration.js');
  delete require.cache[routePath];
  try {
    let selectedRows = 0;
    const prisma = {
      stashScene: {
        count: async () => 26000,
        findMany: async args => {
          selectedRows += args.take;
          return [{
            id: '123', title: '', path: '/videos/example.mp4', duration: 120, rating: 4,
            performers: [{ performer: { name: 'Performer' } }],
            studioObject: { name: 'Studio' }
          }];
        }
      },
      settings: { findFirst: async () => ({ stashUrl: 'http://stash.test/' }) }
    };
    const router = require(routePath)(prisma);
    const handler = router.stack.find(layer => layer.route?.path === '/stash/scene/next').route.stack[0].handle;
    let body;
    const res = { status: code => { assert.fail(`Unexpected HTTP ${code}`); }, json: value => { body = value; } };
    const started = performance.now();
    await handler({}, res);
    assert.ok(performance.now() - started < 1000, 'No remote network waits should occur during selection');
    assert.equal(selectedRows, 1);
    assert.equal(body.type, 'PLAY_SCENE');
    assert.equal(body.data.sceneId, '123');
    assert.equal(body.data.title, 'example');
    assert.equal(body.data.performers, 'Performer');
    assert.equal(body.data.studio, 'Studio');
    assert.equal(body.data.totalUnwatched, 26000);
    assert.equal(body.data.url, 'http://stash.test/scene/123/stream');
    assert.ok(body.data.artwork.screenshot.endsWith('/api/stash/image-proxy/scene/123/screenshot'));
  } finally {
    delete require.cache[routePath];
    if (originalFetch) require.cache[fetchPath] = originalFetch;
    else delete require.cache[fetchPath];
  }
});
