import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPlayRecorder, reportPlaybackState } from './playTracking.js';

test('records completed tracks once, but counts a replay separately', async () => {
  const requests = [];
  const recorder = createPlayRecorder({ apiBaseUrl: '', fetchImpl: async url => { requests.push(url); return { ok: true }; } });
  await recorder.complete();
  recorder.start({ ratingKey: 'track-1' });
  await Promise.all([recorder.complete(), recorder.complete()]);
  assert.equal(requests.length, 1);
  recorder.start({ ratingKey: 'track-1' });
  await recorder.complete();
  assert.equal(requests.length, 2);
});

test('records the completed track even when the next track starts during the request', async () => {
  const requests = [];
  const recorder = createPlayRecorder({ apiBaseUrl: '', fetchImpl: async url => { requests.push(url); return { ok: true }; } });
  recorder.start({ ratingKey: 'first' });
  const completion = recorder.complete();
  recorder.start({ ratingKey: 'second' });
  await completion;
  assert.equal(requests[0], '/api/music/track/first/scrobble');
});

test('failed play recording can be retried', async () => {
  let attempts = 0;
  const recorder = createPlayRecorder({ apiBaseUrl: '', fetchImpl: async () => ({ ok: ++attempts > 1 }) });
  recorder.start({ ratingKey: 'track' });
  await assert.rejects(recorder.complete(), /Failed to record/);
  await recorder.complete();
  assert.equal(attempts, 2);
});

test('reports the active track and clears the same web playback session', async () => {
  const bodies = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, '/api/music/playback-state');
    bodies.push(JSON.parse(options.body));
    return { ok: true };
  };
  const options = { apiBaseUrl: '', sessionId: 'web-session', fetchImpl };
  await reportPlaybackState({ ...options, track: { ratingKey: 'radio-track', title: 'Radio track' }, isPlaying: true });
  await reportPlaybackState({ ...options, track: null, isPlaying: false });
  assert.equal(bodies[0].track.ratingKey, 'radio-track');
  assert.equal(bodies[0].isPlaying, true);
  assert.equal(bodies[1].track, null);
  assert.equal(bodies[0].sessionId, bodies[1].sessionId);
});

test('normalizes database track metadata for individual-track dashboard reports', async () => {
  await reportPlaybackState({
    apiBaseUrl: '', sessionId: 'track-session', isPlaying: true,
    track: { ratingKey: 'track', title: 'Track', album: { title: 'Album', thumb: '/cover', artist: { title: 'Composer' } } },
    fetchImpl: async (url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.track.album, 'Album');
      assert.equal(payload.track.artist, 'Composer');
      assert.equal(payload.track.parentThumb, '/cover');
      return { ok: true };
    }
  });
});

test('individual-track completion uses the shared recorder and has only one ended subscription', async () => {
  const source = fs.readFileSync(new URL('../../modules/media/pages/music/index.jsx', import.meta.url), 'utf8');
  assert.ok(!source.includes("audio.addEventListener('ended', handleEnded)"));
  assert.ok(source.includes('onEnded={handleEnded}'));
  let recorded = 0;
  const recorder = createPlayRecorder({ apiBaseUrl: '', fetchImpl: async () => { recorded++; return { ok: true }; } });
  recorder.start({ ratingKey: 'individual-track' });
  const context = vm.createContext({
    setIsPlaying: () => {}, setCurrentTime: () => {},
    playRecorderRef: { current: recorder }, trackQueue: [], queueIndex: 0,
    console: { error: () => {} }
  });
  const start = source.indexOf('const handleEnded = async () =>');
  const end = source.indexOf('// Audio player event handlers', start);
  vm.runInContext(source.slice(start, end), context);
  await vm.runInContext('handleEnded()', context);
  await vm.runInContext('handleEnded()', context);
  assert.equal(recorded, 1);
});