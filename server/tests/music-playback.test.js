const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MusicPlaybackService = require('../services/musicPlaybackService');

for (const settings of [null, { plexUrl: 'https://plex.example', plexToken: 'test' }]) {
  test(`records completed plays even when Plex is ${settings ? 'unreachable' : 'unconfigured'}`, async () => {
    let update;
    const prisma = {
      plexTrack: {
        findUnique: async () => ({ ratingKey: 'track', viewCount: null }),
        update: async args => { update = args; return { viewCount: 1, lastViewedAt: args.data.lastViewedAt }; }
      },
      settings: { findFirst: async () => settings }
    };
    const service = new MusicPlaybackService(prisma, { fetchImpl: async () => { throw new Error('offline'); } });
    const result = await service.recordPlay('track');
    assert.equal(update.data.viewCount, 1);
    assert.ok(update.data.lastViewedAt instanceof Date);
    assert.equal(result.viewCount, 1);
    assert.equal(result.plexUpdated, false);
  });
}

test('uses atomic increments for existing play counts and propagates database failures', async () => {
  const prisma = { plexTrack: {
    findUnique: async () => ({ viewCount: 4 }),
    update: async args => { assert.deepEqual(args.data.viewCount, { increment: 1 }); throw new Error('database unavailable'); }
  } };
  const service = new MusicPlaybackService(prisma);
  await assert.rejects(service.recordPlay('track'), /database unavailable/);
});

test('live state selects an active session, expires stale reports, and clears only its own session', () => {
  let now = new Date('2026-10-06T12:00:00Z');
  const service = new MusicPlaybackService({}, { now: () => now });
  service.updatePlayback('active', { title: 'Radio track', ratingKey: 'track' }, true);
  service.updatePlayback('paused', { title: 'Paused track' }, false);
  assert.equal(service.getCurrentPlayback().ratingKey, 'track');
  service.updatePlayback('paused', null, false);
  assert.equal(service.getCurrentPlayback().title, 'Radio track');
  now = new Date(now.getTime() + 45001);
  assert.equal(service.getCurrentPlayback(), null);
  assert.throws(() => service.updatePlayback('', { title: 'track' }, true), /session ID/);
  assert.throws(() => service.updatePlayback('session', {}, true), /track title/);
});

test('active playback lists streams, client reports, and Android devices together', async () => {
  let now = new Date('2026-10-06T12:00:00Z');
  const service = new MusicPlaybackService({}, { now: () => now });
  service.recordStream('browser-b', { ratingKey: '7', title: 'Streamed', grandparentTitle: 'Artist', duration: 120000 }, { appName: 'Web browser' });
  service.updatePlayback('browser-a', { title: 'Reported', ratingKey: '8' }, true);
  await service.updateAndroidPlayback({ deviceId: 'phone', title: 'Phone track', positionMs: 0, durationMs: 200000 });
  assert.deepEqual(service.getActivePlayback().map(state => state.sessionId).sort(), ['android:phone', 'browser-a', 'browser-b']);
  service.updatePlayback('browser-b', { title: 'Streamed', ratingKey: '7' }, false);
  service.recordStream('browser-b', { ratingKey: '7', title: 'Streamed', duration: 120000 });
  assert.equal(service.getActivePlayback().find(state => state.sessionId === 'browser-b').isPlaying, false);
  now = new Date(now.getTime() + 60000);
  service.recordStream('browser-c', { ratingKey: '9', title: 'Long', duration: 300000 });
  now = new Date(now.getTime() + 120000);
  assert.deepEqual(service.getActivePlayback().map(state => state.sessionId).sort(), ['android:phone', 'browser-c']);
  await service.stopAndroidPlayback({ deviceId: 'phone' });
  assert.deepEqual(service.getActivePlayback().map(state => state.sessionId), ['browser-c']);
});

const createAndroidService = () => {
  const recorded = [];
  const service = new MusicPlaybackService({ plexTrack: { findMany: async () => [] } });
  service.recordPlay = async ratingKey => { recorded.push(ratingKey); };
  return { service, recorded };
};

test('Android completion and duplicate progress reports count a play once, and replay counts again', async () => {
  const { service, recorded } = createAndroidService();
  const payload = { ratingKey: 'android-track', title: 'Track', durationMs: 10000 };
  await service.updateAndroidPlayback({ ...payload, positionMs: 5000 });
  await service.updateAndroidPlayback({ ...payload, positionMs: 10000 });
  await service.updateAndroidPlayback({ ...payload, positionMs: 10000, completed: true });
  assert.deepEqual(recorded, ['android-track']);
  await service.updateAndroidPlayback({ ...payload, positionMs: 0 });
  await service.updateAndroidPlayback({ ...payload, positionMs: 10000 });
  assert.deepEqual(recorded, ['android-track', 'android-track']);
});

test('Android track changes and stop count nearly finished tracks but not early skips or pauses', async () => {
  const { service, recorded } = createAndroidService();
  await service.updateAndroidPlayback({ ratingKey: 'nearly-finished', title: 'First', positionMs: 9500, durationMs: 10000 });
  await service.updateAndroidPlayback({ ratingKey: 'skipped', title: 'Second', positionMs: 100, durationMs: 10000 });
  await service.updateAndroidPlayback({ ratingKey: 'skipped', title: 'Second', positionMs: 200, durationMs: 10000, isPlaying: false });
  await service.stopAndroidPlayback();
  assert.deepEqual(recorded, ['nearly-finished']);
});

test('Android metadata-only completion requires a unique library match', async () => {
  const { service, recorded } = createAndroidService();
  service.prisma.plexTrack.findMany = async () => [{ ratingKey: 'matched-track' }];
  const state = await service.updateAndroidPlayback({ title: 'Track', artist: 'Artist', album: 'Album', completed: true });
  assert.equal(state.ratingKey, 'matched-track');
  await service.updateAndroidPlayback({ title: 'Track', artist: 'Artist', album: 'Album', ratingKey: 'matched-track', completed: true });
  service.prisma.plexTrack.findMany = async () => [{ ratingKey: 'one' }, { ratingKey: 'two' }];
  await service.updateAndroidPlayback({ title: 'Ambiguous', completed: true });
  assert.deepEqual(recorded, ['matched-track']);
});

test('Android explicit playback IDs deduplicate retries and keep devices separate', async () => {
  const { service, recorded } = createAndroidService();
  const payload = { title: 'Track', ratingKey: 'track', completed: true, playbackId: 'play-1', deviceId: 'device-1' };
  await Promise.all([service.updateAndroidPlayback(payload), service.updateAndroidPlayback(payload)]);
  await service.updateAndroidPlayback({ ...payload, playbackId: 'play-2' });
  await service.updateAndroidPlayback({ ...payload, deviceId: 'device-2' });
  assert.equal(recorded.length, 3);
});

test('radio live reports and completed plays are both visible through monitoring', async () => {
  const track = { ratingKey: 'radio-track', title: 'Radio track', viewCount: 0, album: { title: 'Album', artist: { title: 'Artist' } } };
  const prisma = new Proxy({
    settings: { findFirst: async () => null },
    plexTrack: {
      findUnique: async () => track,
      update: async ({ data }) => {
        track.viewCount += data.viewCount.increment;
        track.lastViewedAt = data.lastViewedAt;
        return track;
      },
      findFirst: async ({ where }) => {
        assert.deepEqual(JSON.parse(JSON.stringify(where.lastViewedAt)), { not: null });
        return track.lastViewedAt ? track : null;
      }
    }
  }, { get: (target, name) => target[name] || { findFirst: async () => null, findMany: async () => [] } });
  const service = new MusicPlaybackService(prisma);
  const handlers = new Map();
  const router = { post: (route, handler) => handlers.set(route, handler), get: (route, handler) => handlers.set(route, handler) };
  const context = vm.createContext({
    router,
    musicPlaybackService: service,
    asyncHandler: handler => handler,
    sendSuccess: (res, data) => res.json({ success: true, data }),
    require: name => {
      if (name === 'express') return { Router: () => router };
      if (name === '../utils/responses') return { asyncHandler: handler => handler };
      if (name === '../prismaClient') return prisma;
      if (name === '../services/musicPlaybackService') return { getInstance: () => service };
      if (name === '../plexPlayerService') return class {
        constructor() { this.client = { query: async () => ({ MediaContainer: {} }) }; }
        async initializeClient() {}
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} },
    global: {},
    console: { log: () => {}, warn: () => {}, error: () => {} }
  });
  const musicSource = fs.readFileSync(path.join(__dirname, '../routes/music.js'), 'utf8');
  vm.runInContext(musicSource.slice(musicSource.indexOf('// Mark track as played'), musicSource.indexOf('// Music streaming endpoint')), context);
  let response;
  const res = { json: data => { response = data; } };
  await handlers.get('/playback-state')({ body: { sessionId: 'radio-session', track: { ratingKey: track.ratingKey, title: track.title }, isPlaying: true } }, res);
  await handlers.get('/track/:ratingKey/scrobble')({ params: { ratingKey: track.ratingKey } }, res);
  assert.equal(response.data.viewCount, 1);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/monitoring.js'), 'utf8'), context);
  await handlers.get('/')({}, res);
  assert.equal(response.webMusic.ratingKey, 'radio-track');
  assert.equal(response.webMusic.isPlaying, true);
  assert.equal(response.lastMusicTrack.ratingKey, 'radio-track');
  assert.ok(response.lastMusicTrack.lastViewedAt);
});

test('Android music HTTP routes report live state, record a play once, and clear playback', async () => {
  const { service, recorded } = createAndroidService();
  service.prisma.plexTrack.findUnique = async () => ({ title: 'Android track' });
  const handlers = new Map();
  const router = new Proxy({}, { get: () => (route, ...callbacks) => handlers.set(route, callbacks.at(-1)) });
  const androidGlobal = {};
  const context = vm.createContext({
    require: name => {
      if (name === 'express') return { Router: () => router };
      if (name === 'node-fetch') return async () => ({ ok: true });
      if (name === '../../services/musicPlaybackService') return { getInstance: () => service };
      if (name === './utilities/androidHelpers') return {
        createAndroidResponse: (type, data) => ({ type, data }),
        createAndroidErrorResponse: (type, error) => ({ type, data: { error } })
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} }, global: androidGlobal,
    console: { log: () => {}, error: () => {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/android/playbackControl.js'), 'utf8'), context);
  context.module.exports();
  let response;
  const res = { status: () => res, json: data => { response = data; } };
  await handlers.get('/music/state')({ body: { title: 'Android track', ratingKey: 'track', positionMs: 500, durationMs: 10000 } }, res);
  assert.equal(androidGlobal.androidMusicState.isPlaying, true);
  assert.equal(recorded.length, 0);
  const body = { ratingKey: 'track', playbackId: 'play-1', deviceId: 'android-default' };
  await handlers.get('/music/played')({ body }, res);
  await handlers.get('/music/played')({ body }, res);
  assert.equal(response.type, 'MUSIC_PLAY_RECORDED');
  assert.equal(response.data.tracked, true);
  assert.deepEqual(recorded, ['track']);
  await handlers.get('/music/stop')({ body: {} }, res);
  assert.equal(androidGlobal.androidMusicState.title, null);
  assert.deepEqual(recorded, ['track']);
});

for (const file of ['readingSession.js', 'historyPlusReadingSession.js']) {
  test(`Android ${file} uses shared music tracking for start and stop`, async () => {
    const { service, recorded } = createAndroidService();
    const source = fs.readFileSync(path.join(__dirname, '../routes/android', file), 'utf8');
    const start = source.indexOf('async function normalizeAndroidMusicPayload');
    const end = source.indexOf('function create', start);
    const androidGlobal = {};
    const context = vm.createContext({ musicPlaybackService: service, global: androidGlobal });
    vm.runInContext(source.slice(start, end), context);
    androidGlobal.androidMusicState = await context.normalizeAndroidMusicPayload({ title: 'Track', ratingKey: 'track', positionMs: 9500, durationMs: 10000 });
    await context.clearAndroidMusicState();
    assert.deepEqual(recorded, ['track']);
    assert.equal(androidGlobal.androidMusicState.title, null);
  });
}