const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MusicPlaybackService = require('../services/musicPlaybackService');
const SonosPlaybackService = require('../services/sonosPlaybackService');

const setup = () => {
  let now = 10000;
  let poll;
  const recorded = [];
  const music = new MusicPlaybackService({}, { now: () => new Date(now) });
  music.recordPlay = async key => { recorded.push(key); };
  const sonos = new SonosPlaybackService(music, {
    now: () => now,
    setIntervalImpl: callback => { poll = callback; return 1; },
    clearIntervalImpl: () => {},
    readState: async () => ({ state: 'PLAYING', positionMs: 9500, durationMs: 10000 })
  });
  sonos.start({ uuid: 'office', name: 'Office' }, { ratingKey: 'track', title: 'Sonos track', duration: 10000 });
  return { music, sonos, recorded, poll: () => poll(), advance: () => { now += 5000; } };
};

test('Sonos playback appears in shared monitoring without a browser heartbeat', async () => {
  const { music, poll } = setup();
  assert.equal(music.getCurrentPlayback().source, 'sonos');
  assert.equal(music.getCurrentPlayback().appName, 'Office');
  await poll();
  assert.equal(music.getCurrentPlayback().isPlaying, true);
});

test('Sonos completion counts once and clears live state', async () => {
  const { music, sonos, recorded, poll, advance } = setup();
  await poll();
  advance();
  await Promise.all([sonos.observe('office', { state: 'STOPPED' }), sonos.observe('office', { state: 'STOPPED' })]);
  assert.deepEqual(recorded, ['track']);
  assert.equal(music.getCurrentPlayback(), null);
});

test('Sonos pause and early stop do not count completed plays', async () => {
  const { music, sonos, recorded, advance } = setup();
  await sonos.control('office', 'pause');
  assert.equal(music.getCurrentPlayback().isPlaying, false);
  advance();
  await sonos.control('office', 'stop');
  assert.deepEqual(recorded, []);
  assert.equal(music.getCurrentPlayback(), null);
});

test('parses namespaced Sonos transport XML and converts positions to milliseconds', async () => {
  const transport = '<s:Envelope xmlns:s="urn:soap"><s:Body><u:GetTransportInfoResponse xmlns:u="urn:sonos"><CurrentTransportState>PLAYING</CurrentTransportState></u:GetTransportInfoResponse></s:Body></s:Envelope>';
  const position = '<s:Envelope xmlns:s="urn:soap"><s:Body><u:GetPositionInfoResponse xmlns:u="urn:sonos"><TrackURI>https://example.com/audio?a=1&amp;b=2</TrackURI><TrackDuration>00:03:20</TrackDuration><RelTime>00:02:59</RelTime></u:GetPositionInfoResponse></s:Body></s:Envelope>';
  const state = await SonosPlaybackService.parseState(transport, position);
  assert.equal(state.state, 'PLAYING');
  assert.equal(state.durationMs, 200000);
  assert.equal(state.positionMs, 179000);
  assert.equal(state.trackUri, 'https://example.com/audio?a=1&b=2');
});

test('a delayed completion cannot clear a new track on the same speaker', async () => {
  const { music, sonos, poll, advance } = setup();
  let resolveRecording;
  music.recordPlay = () => new Promise(resolve => { resolveRecording = resolve; });
  await poll();
  advance();
  const completion = sonos.observe('office', { state: 'STOPPED' });
  sonos.start({ uuid: 'office', name: 'Office' }, { ratingKey: 'next', title: 'Next track' });
  resolveRecording();
  await completion;
  assert.equal(music.getCurrentPlayback().ratingKey, 'next');
});

test('Sonos play endpoint publishes a speaker track to the actual monitoring endpoint', async () => {
  const music = new MusicPlaybackService({});
  const handlers = new Map();
  const router = new Proxy({}, { get: () => (route, ...callbacks) => handlers.set(route, callbacks.at(-1)) });
  const device = { uuid: 'office', name: 'Office', avTransportControl: 'https://speaker.example/control' };
  const prisma = new Proxy({ settings: { findFirst: async () => null } }, {
    get: (target, name) => target[name] || { findFirst: async () => null, findMany: async () => [] }
  });
  const context = vm.createContext({
    require: name => {
      if (name === 'express') return { Router: () => router };
      if (name === 'node-fetch') return async () => ({ ok: true, text: async () => '<response/>' });
      if (name === 'node-ssdp') return { Client: class {} };
      if (name === 'os') return { networkInterfaces: () => ({}) };
      if (name === '../prismaClient') return prisma;
      if (name === '../services/musicPlaybackService') return { getInstance: () => music };
      if (name === '../services/sonosPlaybackService') return class extends SonosPlaybackService {
        constructor(playback, options) { super(playback, { ...options, setIntervalImpl: () => 1, clearIntervalImpl: () => {} }); }
      };
      if (name === '../utils/responses') return { asyncHandler: handler => handler };
      if (name === '../plexPlayerService') return class {
        constructor() { this.client = { query: async () => ({ MediaContainer: {} }) }; }
        async initializeClient() {}
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module: { exports: {} }, global: {}, URL, device,
    console: { log: () => {}, error: () => {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../routes/sonos.js'), 'utf8'), context);
  vm.runInContext('deviceCache = [device]', context);
  let response;
  const res = { status: () => res, json: data => { response = data; } };
  await handlers.get('/play')({ body: { deviceId: 'office', streamUrl: 'https://audio.example/track.flac', metadata: { title: 'Speaker track', artist: 'Artist', album: 'Album' } } }, res);
  assert.equal(response.success, true);
  vm.runInContext(`(function () { ${fs.readFileSync(path.join(__dirname, '../routes/monitoring.js'), 'utf8')} })();`, context);
  await handlers.get('/')({}, res);
  assert.equal(response.webMusic.title, 'Speaker track');
  assert.equal(response.webMusic.source, 'sonos');
  assert.equal(response.webMusic.appName, 'Office');
  assert.equal(response.webMusic.isPlaying, true);
});