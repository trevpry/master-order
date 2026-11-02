const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const split = require('../services/groupSceneSplitService');

test('buildSegments lays AEBN lengths back to back and folds short credits into the last scene', () => {
  const scenes = [
    { sceneNumber: 1, durationSeconds: 600 },
    { sceneNumber: 2, durationSeconds: 900 },
    { sceneNumber: 3, durationSeconds: 0 }, // no length listed -> skipped
    { sceneNumber: 4, durationSeconds: 500 }
  ];
  const { segments, warnings } = split.buildSegments(scenes, 2060);
  assert.deepStrictEqual(segments.map(s => [s.number, s.start, s.end]), [[1, 0, 600], [2, 600, 1500], [4, 1500, 2060]]);
  assert.deepStrictEqual(warnings, []);

  const long = split.buildSegments(scenes, 3000);
  assert.strictEqual(long.segments[2].end, 2000);
  assert.match(long.warnings[0], /runs 1000s past/);

  const short = split.buildSegments(scenes, 1800, 10);
  assert.strictEqual(short.segments[0].start, 10);
  assert.strictEqual(short.segments[2].end, 1800);
  assert.match(short.warnings[0], /longer than the file/);
});

test('validateSegments rejects overlaps, duplicates and out-of-range cuts', () => {
  assert.throws(() => split.validateSegments([], 100), /No segments/);
  assert.throws(() => split.validateSegments([{ number: 1, start: 0, end: 50 }, { number: 1, start: 50, end: 90 }], 100), /used twice/);
  assert.throws(() => split.validateSegments([{ number: 1, start: 0, end: 60 }, { number: 2, start: 50, end: 90 }], 100), /overlaps/);
  assert.throws(() => split.validateSegments([{ number: 1, start: 0, end: 150 }], 100), /ends after/);
  const ok = split.validateSegments([{ number: 2, start: 50, end: 100 }, { number: 1, start: 0, end: 50 }], 100);
  assert.deepStrictEqual(ok.map(s => s.number), [1, 2]);
});

test('transcodeReason converts AVI/WMV and non-MP4 codecs, copies H.264/AAC MP4', () => {
  assert.strictEqual(split.transcodeReason({ basename: 'a.mp4', video_codec: 'h264', audio_codec: 'aac' }), null);
  assert.strictEqual(split.transcodeReason({ basename: 'a.mkv', video_codec: 'hevc', audio_codec: 'mp3' }), null);
  assert.match(split.transcodeReason({ basename: 'a.avi', video_codec: 'mpeg4', audio_codec: 'mp3' }), /AVI/);
  assert.match(split.transcodeReason({ basename: 'a.wmv', video_codec: 'wmv2', audio_codec: 'wmav2' }), /WMV/);
  assert.match(split.transcodeReason({ basename: 'a.mp4', video_codec: 'mpeg4', audio_codec: 'aac' }), /H\.264/);
});

test('stash paths map to local paths and output names are stable', () => {
  const mappings = split.parseStashPathMap('/data=/stash-library; /data/Other=/other');
  assert.strictEqual(split.stashPathToLocal('/data/Other/x.mp4', mappings), path.join('/other', 'x.mp4'));
  assert.strictEqual(split.stashPathToLocal('/data/P_Video2/BRDC/a b.wmv', mappings), path.join('/stash-library', 'P_Video2', 'BRDC', 'a b.wmv'));
  assert.strictEqual(split.outputFileName('My: Movie.wmv', 3), 'My Movie - Scene 03.mp4');
});

test('mergeScenePerformers keeps GEVI action codes and dedupes names', () => {
  const merged = split.mergeScenePerformers(
    [{ name: 'Billie Ramos' }, { name: 'Diego Starr' }],
    [{ name: 'billie ramos', actionCode: 'T' }]
  );
  assert.deepStrictEqual(merged.map(p => [p.name, p.actionCode]), [['billie ramos', 'T'], ['Diego Starr', null]]);
});

let ffmpegPath = null;
try { ffmpegPath = require('../config/ffmpegConfig').ffmpegPath; } catch { ffmpegPath = null; }
const ffprobePath = (() => { try { return require('../config/ffmpegConfig').ffprobePath; } catch { return null; } })();

function probe(file) {
  const out = execFileSync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type', '-of', 'json', file]).toString();
  const json = JSON.parse(out);
  return {
    duration: Number(json.format.duration),
    video: json.streams.find(s => s.codec_type === 'video')?.codec_name,
    audio: json.streams.find(s => s.codec_type === 'audio')?.codec_name
  };
}

function fakeStash(stashPath, file) {
  const calls = [];
  const created = new Map();
  let nextId = 900;
  const graphql = async (query, variables) => {
    const op = query.match(/(?:query|mutation)\s+(\w+)/)[1];
    calls.push({ op, variables });
    switch (op) {
      case 'SplitGroup': return { findGroup: { id: '7', name: 'Test Movie', date: '2020-01-01', urls: [], studio: { id: 's1', name: 'Studio' } } };
      case 'SplitScene': return { findScene: { id: '55', title: 'Full movie', groups: [{ group: { id: '7' }, scene_index: 1 }, { group: { id: '8' }, scene_index: 4 }], files: [{ ...file, path: stashPath }] } };
      case 'SplitScan': variables.input.paths.forEach(p => created.set(p, String(nextId++))); return { metadataScan: 'job1' };
      case 'SplitJob': return { findJob: { id: 'job1', status: 'FINISHED', progress: 1 } };
      case 'SplitFind': return { findScenes: { scenes: [{ id: created.get(variables.f.path.value), files: [{ path: variables.f.path.value }] }] } };
      case 'SplitSync': return { findScene: null };
      default: return {};
    }
  };
  return { graphql, calls };
}

function fakePrisma() {
  const groupLinks = [];
  const deleted = [];
  return {
    groupLinks,
    deleted,
    stashGroupScene: {
      upsert: async ({ create }) => groupLinks.push(create),
      deleteMany: async ({ where }) => deleted.push(where)
    },
    stashScene: { deleteMany: async () => {} }
  };
}

async function waitForJob(id) {
  for (let i = 0; i < 600; i++) {
    const job = split.getJob(id);
    if (!['queued', 'running'].includes(job.status)) return job;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('job timed out');
}

for (const variant of [
  { ext: 'mp4', args: ['-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac'], file: { video_codec: 'h264', audio_codec: 'aac' }, transcode: false },
  { ext: 'avi', args: ['-c:v', 'mpeg4', '-c:a', 'libmp3lame'], file: { video_codec: 'mpeg4', audio_codec: 'mp3' }, transcode: true }
]) {
  test(`split job cuts a ${variant.ext.toUpperCase()} movie into MP4 scenes and applies metadata`, { skip: !ffmpegPath || !ffprobePath, timeout: 120000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));
    const prevMap = process.env.STASH_PATH_MAP;
    process.env.STASH_PATH_MAP = `/data=${root}`;
    try {
      fs.mkdirSync(path.join(root, 'movies'));
      const source = path.join(root, 'movies', `Full Movie.${variant.ext}`);
      execFileSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=12:size=320x240:rate=25',
        '-f', 'lavfi', '-i', 'sine=duration=12', '-g', '25', ...variant.args, '-shortest', source]);

      const stashPath = `/data/movies/Full Movie.${variant.ext}`;
      const file = { id: 'f1', basename: path.basename(source), duration: 12, ...variant.file };
      const { graphql, calls } = fakeStash(stashPath, file);
      const prisma = fakePrisma();

      const job = await split.startSplitJob({ prisma, graphql, ffmpegPath, pollIntervalMs: 10 }, '7', {
        sceneId: '55',
        originalAction: 'unlink',
        segments: [
          { number: 1, start: 0, end: 5, title: 'First', performers: [{ id: 'p1', actionCode: 'T' }], tags: [{ id: 't1' }], urls: ['https://aebn.example/1'] },
          { number: 2, start: 5, end: 12, title: 'Second', performers: [{ id: 'p2' }], tags: [] }
        ]
      });
      assert.strictEqual(job.transcode, variant.transcode);

      const done = await waitForJob(job.id);
      assert.strictEqual(done.status, 'completed', done.error || done.log.join('\n'));

      const outputs = ['Full Movie - Scene 01.mp4', 'Full Movie - Scene 02.mp4'].map(n => path.join(root, 'movies', n));
      const probes = outputs.map(probe);
      assert.strictEqual(probes[0].video, 'h264');
      assert.strictEqual(probes[0].audio, 'aac');
      assert.ok(Math.abs(probes[0].duration - 5) < 1.2, `scene 1 duration ${probes[0].duration}`);
      assert.ok(Math.abs(probes[1].duration - 7) < 1.2, `scene 2 duration ${probes[1].duration}`);
      assert.deepStrictEqual(fs.readdirSync(path.join(root, 'movies')).filter(n => n.endsWith('.part')), []);

      const scan = calls.find(c => c.op === 'SplitScan');
      assert.deepStrictEqual(scan.variables.input.paths, ['/data/movies/Full Movie - Scene 01.mp4', '/data/movies/Full Movie - Scene 02.mp4']);
      const applied = calls.filter(c => c.op === 'SplitApply').map(c => c.variables.input);
      assert.deepStrictEqual(applied[0], {
        id: '900', title: 'First', details: null, date: null, urls: ['https://aebn.example/1'], studio_id: 's1',
        performer_ids: ['p1'], tag_ids: ['t1'], groups: [{ group_id: '7', scene_index: 1 }]
      });
      assert.deepStrictEqual(applied[1].groups, [{ group_id: '7', scene_index: 2 }]);
      assert.deepStrictEqual(prisma.groupLinks.map(l => [l.sceneId, l.sceneIndex]), [['900', 1], ['901', 2]]);

      const unlink = calls.find(c => c.op === 'SplitUnlink');
      assert.deepStrictEqual(unlink.variables.input, { id: '55', groups: [{ group_id: '8', scene_index: 4 }] });
      assert.ok(calls.some(c => c.op === 'SplitGenerate'));
    } finally {
      if (prevMap === undefined) delete process.env.STASH_PATH_MAP; else process.env.STASH_PATH_MAP = prevMap;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('a failed cut removes the files the job wrote and leaves Stash untouched', { skip: !ffmpegPath, timeout: 60000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-fail-'));
  const prevMap = process.env.STASH_PATH_MAP;
  process.env.STASH_PATH_MAP = `/data=${root}`;
  try {
    const source = path.join(root, 'broken.mp4');
    fs.writeFileSync(source, 'not a video');
    const { graphql, calls } = fakeStash('/data/broken.mp4', { id: 'f', basename: 'broken.mp4', duration: 20, video_codec: 'h264', audio_codec: 'aac' });
    const job = await split.startSplitJob({ prisma: fakePrisma(), graphql, ffmpegPath, pollIntervalMs: 10 }, '7', {
      sceneId: '55',
      segments: [{ number: 1, start: 0, end: 10 }, { number: 2, start: 10, end: 20 }]
    });
    const done = await waitForJob(job.id);
    assert.strictEqual(done.status, 'failed');
    assert.deepStrictEqual(fs.readdirSync(root), ['broken.mp4']);
    assert.ok(!calls.some(c => c.op === 'SplitScan'));
  } finally {
    if (prevMap === undefined) delete process.env.STASH_PATH_MAP; else process.env.STASH_PATH_MAP = prevMap;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
