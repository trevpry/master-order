const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quietConsole = { log() {}, warn() {}, error() {} };

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function coreHandler(result) {
  const handlers = new Map();
  const source = fs.readFileSync(path.join(__dirname, '../routes/plex.js'), 'utf8');
  const context = vm.createContext({
    router: { post: (route, handler) => handlers.set(route, handler) },
    asyncHandler: handler => handler,
    plexPlayerService: { playMedia: async () => result },
    prisma: { settings: { findFirst: async () => ({ selectedPlayer: 'shield' }) } },
    sendSuccess: (res, data) => res.json({ success: true, data }),
    sendServerError: (res, error) => res.status(500).json({ error }),
    sendBadRequest: (res, error) => res.status(400).json({ error }),
    console: quietConsole
  });
  vm.runInContext(source.slice(source.indexOf('// POST /api/plex/play -'),
    source.indexOf('// POST /api/plex/play-with-retry')), context);
  return handlers.get('/play');
}

test('Plex play rejects failed service results instead of wrapping them in HTTP 200', async () => {
  const res = responseRecorder();
  await coreHandler({ success: false, error: 'Player shield not found' })(
    { body: { ratingKey: '123' } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Player shield not found');
});

test('Plex play preserves the success envelope and player name', async () => {
  const result = { success: true, player: 'Shield' };
  const res = responseRecorder();
  await coreHandler(result)({ body: { ratingKey: '123' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data, result);
});

function androidHandlers(playResult, status = 200) {
  const handlers = new Map();
  const metadata = {
    MediaContainer: {
      Directory: [{ $: { type: 'show', title: 'Series', ratingKey: '100' } }],
      Video: [{ $: { type: 'movie', title: 'Movie', ratingKey: '123' } }]
    }
  };
  const episodes = {
    MediaContainer: {
      Video: [{ $: { ratingKey: '456', title: 'Episode', parentIndex: '1', index: '2' } }]
    }
  };
  const context = vm.createContext({
    require: name => {
      if (name === 'express') return { Router: () => ({
        post: (route, handler) => handlers.set(route, handler)
      }) };
      if (name === 'node-fetch') return async url => {
        if (url.endsWith('/api/plex/play')) {
          return { ok: status >= 200 && status < 300, status, json: async () => playResult };
        }
        return { ok: true, text: async () => url.includes('allLeaves') ? 'episodes' : 'search' };
      };
      if (name === './utilities/androidHelpers') return {
        getAndroidApiBaseUrl: () => 'http://backend',
        createAndroidErrorResponse: (type, error, message) => ({ type, data: { error, message } })
      };
      if (name === '../../services/musicPlaybackService') return { getInstance: () => ({}) };
      if (name === '../../prismaClient') return {
        settings: { findFirst: async () => ({ plexUrl: 'http://plex', plexToken: 'test-token' }) }
      };
      if (name === 'xml2js') return {
        Parser: class { async parseStringPromise(text) { return text === 'episodes' ? episodes : metadata; } }
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} },
    console: quietConsole
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/android/playbackControl.js'), 'utf8'), context);
  context.module.exports();
  return handlers;
}

for (const [route, body, successType] of [
  ['/play-plex', { ratingKey: '123', title: 'Movie' }, 'PLAY_SUCCESS'],
  ['/play-episode', { movieTitle: 'Movie' }, 'PLAY_MOVIE_SUCCESS'],
  ['/play-episode', { seriesTitle: 'Series', seasonNumber: 1, episodeNumber: 2 }, 'PLAY_EPISODE_SUCCESS']
]) {
  test(`Android ${successType} reads the player from the nested success envelope`, async () => {
    const res = responseRecorder();
    const handlers = androidHandlers({ success: true, data: { success: true, player: 'Shield' } });
    await handlers.get(route)({ body }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.type, successType);
    assert.equal(res.body.data.player, 'Shield');
  });

  test(`Android ${successType} rejects nested playback failures despite HTTP 200`, async () => {
    const res = responseRecorder();
    const handlers = androidHandlers({ success: true, data: { success: false, error: 'Player shield not found' } });
    await handlers.get(route)({ body }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.type, 'PLAY_ERROR');
    assert.equal(res.body.data.success, false);
    assert.equal(res.body.data.error, 'Player shield not found');
  });

  test(`Android ${successType} preserves non-200 errors`, async () => {
    const res = responseRecorder();
    const handlers = androidHandlers({ error: 'Player shield not found' }, 500);
    await handlers.get(route)({ body }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.data.success, false);
    assert.equal(res.body.data.error, 'Player shield not found');
  });
}
