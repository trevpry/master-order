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

test('sceneMediaUrls derives browser preview URLs from Stash scene paths', () => {
  const media = split.sceneMediaUrls({
    stream: 'http://stash:9999/scene/7978/stream',
    vtt: 'http://stash:9999/scene/abc_thumbs.vtt',
    screenshot: 'http://stash:9999/scene/7978/screenshot?t=1'
  });
  assert.strictEqual(media.directUrl, 'http://stash:9999/scene/7978/stream');
  assert.strictEqual(media.hlsUrl, 'http://stash:9999/scene/7978/stream.m3u8?resolution=STANDARD');
  assert.strictEqual(media.vttUrl, 'http://stash:9999/scene/abc_thumbs.vtt');
  assert.strictEqual(split.sceneMediaUrls(null), null);
  assert.strictEqual(split.sceneMediaUrls({ stream: null }), null);
});

test('planEncoding keeps source quality characteristics', () => {
  const copy = split.planEncoding({ transcode: false, media: { video: { codec: 'hevc' } } });
  assert.deepStrictEqual([copy.mode, copy.hevc], ['copy', true]);

  const tenBitHevc = split.summarizeSourceMedia({
    streams: [
      { codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, pix_fmt: 'yuv420p10le' },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, bit_rate: '256000' },
      { codec_type: 'audio', codec_name: 'ac3', channels: 6, bit_rate: '448000' }
    ],
    format: { bit_rate: '9000000' }
  });
  const hevcPlan = split.planEncoding({ transcode: true, media: tenBitHevc, encoders: new Set(['libx264', 'libx265']), env: {} });
  assert.deepStrictEqual([hevcPlan.video.encoder, hevcPlan.video.pixFmt, hevcPlan.video.tag, hevcPlan.video.evenScale], ['libx265', 'yuv420p10le', 'hvc1', false]);
  assert.deepStrictEqual(hevcPlan.audio, [{ copy: true, codec: 'aac' }, { copy: false, codec: 'ac3', bitrate: '560k' }]);

  const args = split.buildFfmpegArgs({ input: 'in', output: 'out', start: 0, end: 10, transcode: true, plan: hevcPlan });
  assert.ok(args.join(' ').includes('-c:a:0 copy -c:a:1 aac -b:a:1 560k'));
  assert.ok(!args.includes('-vf'));

  const noX265 = split.planEncoding({ transcode: true, media: tenBitHevc, encoders: new Set(['libx264']), env: {} });
  assert.deepStrictEqual([noX265.video.encoder, noX265.video.pixFmt], ['libx264', 'yuv420p']);

  const wmv = split.summarizeSourceMedia(null, { video_codec: 'wmv3', audio_codec: 'wmav2', width: 641, height: 480 });
  const wmvPlan = split.planEncoding({ transcode: true, media: wmv, env: {} });
  assert.deepStrictEqual([wmvPlan.video.encoder, wmvPlan.video.crf, wmvPlan.video.preset, wmvPlan.video.evenScale], ['libx264', '16', 'medium', true]);
  assert.strictEqual(wmvPlan.audio[0].bitrate, '192k');
  assert.strictEqual(split.aacBitrate({ channels: 1, bitRate: 32000 }), '128k');
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
  const out = execFileSync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type,width,height,bit_rate', '-of', 'json', file]).toString();
  const json = JSON.parse(out);
  const video = json.streams.find(s => s.codec_type === 'video');
  const audio = json.streams.find(s => s.codec_type === 'audio');
  return {
    duration: Number(json.format.duration),
    video: video?.codec_name,
    width: video?.width,
    height: video?.height,
    audio: audio?.codec_name,
    audioBitRate: Number(audio?.bit_rate) || null
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
  { ext: 'mp4', args: ['-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac'], file: { video_codec: 'h264', audio_codec: 'aac' }, transcode: false, audio: 'aac' },
  // MP3 audio is copied untouched even though the MPEG-4 ASP video is converted
  { ext: 'avi', args: ['-c:v', 'mpeg4', '-c:a', 'libmp3lame'], file: { video_codec: 'mpeg4', audio_codec: 'mp3' }, transcode: true, audio: 'mp3' },
  { ext: 'wmv', args: ['-c:v', 'wmv2', '-c:a', 'wmav2', '-b:a', '64k'], file: { video_codec: 'wmv2', audio_codec: 'wmav2' }, transcode: true, audio: 'aac' }
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

      const job = await split.startSplitJob({ prisma, graphql, ffmpegPath, ffprobePath, pollIntervalMs: 10 }, '7', {
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
      assert.strictEqual(probes[0].audio, variant.audio);
      assert.deepStrictEqual([probes[0].width, probes[0].height], [320, 240]);
      if (variant.ext === 'wmv') assert.match(done.encoding, /H\.264 CRF 16 \(medium\); wmav2 → AAC \d{3}k/);
      if (variant.ext === 'avi') assert.match(done.encoding, /mp3 copied/);
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

test('blackScanRanges merges overlapping windows and clamps to the file', () => {
  assert.deepStrictEqual(split.blackScanRanges([100, 150, 400, 'x'], 30, 420), [[70, 180], [370, 420]]);
  assert.deepStrictEqual(split.blackScanRanges([10], 30, 0), [[0, 40]]);
  assert.deepStrictEqual(split.blackScanRanges(null, 30, 100), []);
});

test('parseBlackdetect offsets ffmpeg times and closes a trailing black run', () => {
  const stderr = [
    '[blackdetect @ 0x1] black_start:2.5 black_end:4 black_duration:1.5',
    'frame=  10 fps=0.0',
    '[blackdetect @ 0x1] black_start:58.2'
  ].join('\n');
  assert.deepStrictEqual(split.parseBlackdetect(stderr, 100, 160), [{ start: 102.5, end: 104 }, { start: 158.2, end: 160 }]);
  assert.deepStrictEqual(
    split.mergeBlackIntervals([{ start: 10, end: 12 }, { start: 1, end: 2 }, { start: 12.1, end: 13 }]),
    [{ start: 1, end: 2, duration: 1 }, { start: 10, end: 13, duration: 3 }]
  );
});

test('ffmpeg blackdetect finds the black gap between scenes', { skip: !ffmpegPath, timeout: 60000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackdetect-'));
  try {
    const input = path.join(dir, 'gap.mp4');
    execFileSync(ffmpegPath, [
      '-v', 'error', '-y',
      '-filter_complex', 'testsrc=s=320x240:r=25:d=4[a];color=c=black:s=320x240:r=25:d=1.5[b];testsrc=s=320x240:r=25:d=3[c];[a][b][c]concat=n=3:v=1:a=0[v]',
      '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input
    ]);
    const { spawnSync } = require('child_process');
    const result = spawnSync(ffmpegPath, split.buildBlackdetectArgs(input, 2, 6), { encoding: 'utf8' });
    const intervals = split.parseBlackdetect(result.stderr, 2, 8);
    assert.strictEqual(intervals.length, 1, result.stderr.slice(-500));
    assert.ok(Math.abs(intervals[0].start - 4) < 0.25, `start ${intervals[0].start}`);
    assert.ok(Math.abs(intervals[0].end - 5.5) < 0.25, `end ${intervals[0].end}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('startBlackScan scans around cuts in the background and reports black runs', { skip: !ffmpegPath, timeout: 60000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackscan-'));
  const previousMap = process.env.STASH_PATH_MAP;
  try {
    const input = path.join(dir, 'movie.mp4');
    execFileSync(ffmpegPath, [
      '-v', 'error', '-y',
      '-filter_complex', 'testsrc=s=320x240:r=25:d=6[a];color=c=black:s=320x240:r=25:d=1[b];testsrc=s=320x240:r=25:d=5[c];[a][b][c]concat=n=3:v=1:a=0[v]',
      '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input
    ]);
    process.env.STASH_PATH_MAP = `/stash=${dir}`;
    const graphql = async (query) => {
      const op = query.match(/(?:query|mutation)\s+(\w+)/)[1];
      if (op === 'SplitGroup') return { findGroup: { id: '7', name: 'Movie', urls: [] } };
      if (op === 'SplitScene') return { findScene: { id: '55', title: 'Full', groups: [{ group: { id: '7' } }], files: [{ id: 'f', path: '/stash/movie.mp4', basename: 'movie.mp4', duration: 12 }] } };
      throw new Error(`unexpected ${op}`);
    };
    const started = await split.startBlackScan({ graphql, ffmpegPath }, '7', { sceneId: '55', cuts: [6], window: 2 });
    assert.strictEqual(started.window, 5, 'window is clamped to at least 5s');
    assert.deepStrictEqual(started.ranges, [[1, 11]]);
    let scan = started;
    for (let i = 0; i < 450 && scan.status === 'running'; i++) {
      await new Promise(r => setTimeout(r, 100));
      scan = split.getBlackScan(started.id);
    }
    assert.strictEqual(scan.status, 'completed', scan.error || '');
    assert.strictEqual(scan.intervals.length, 1);
    assert.ok(Math.abs(scan.intervals[0].start - 6) < 0.25 && Math.abs(scan.intervals[0].end - 7) < 0.25, JSON.stringify(scan.intervals));
    await assert.rejects(split.startBlackScan({ graphql, ffmpegPath }, '7', { sceneId: '55', cuts: [] }), /Nothing to scan/);
  } finally {
    if (previousMap === undefined) delete process.env.STASH_PATH_MAP; else process.env.STASH_PATH_MAP = previousMap;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('BlackFrameStore merges partial scans, persists to disk and drops results for a replaced file', async () => {
  const { BlackFrameStore, mergeRecord } = require('../services/stashBlackFrameStore');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackstore-'));
  try {
    const file = { path: '/data/a.mp4', size: 100, duration: 600 };
    const store = new BlackFrameStore(path.join(dir, 'nested', 'black.json'));
    await store.save('5', file, { ranges: [[0, 100]], intervals: [{ start: 50, end: 51 }] });
    let record = await store.save('5', file, { ranges: [[90, 600]], intervals: [{ start: 300, end: 302 }] });
    assert.deepStrictEqual(record.ranges, [[0, 600]]);
    assert.strictEqual(record.fullScan, true);
    assert.deepStrictEqual(record.intervals.map(i => [i.start, i.end]), [[50, 51], [300, 302]]);

    const reloaded = new BlackFrameStore(path.join(dir, 'nested', 'black.json'));
    assert.strictEqual((await reloaded.get('5', file)).intervals.length, 2);
    assert.strictEqual(await reloaded.get('5', { ...file, size: 999 }), null, 'a different file invalidates the record');
    assert.deepStrictEqual(Object.keys(await reloaded.getMany(['5', '6'])), ['5']);

    // A rescan of a range replaces the old intervals inside it
    const merged = mergeRecord({ ranges: [[0, 100]], intervals: [{ start: 10, end: 11 }, { start: 80, end: 81 }] }, { ranges: [[50, 100]], intervals: [], duration: 100 });
    assert.deepStrictEqual(merged.intervals.map(i => i.start), [10]);
    assert.strictEqual(merged.fullScan, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manualSegments covers the whole clip and keeps its performers and tags', () => {
  const [seg] = split.manualSegments(
    { name: 'Movie', date: '2020-01-01' },
    { details: 'd', performers: [{ id: 1, name: 'A' }], tags: [{ id: 2, name: 'T' }] },
    { duration: 125.5 }
  );
  assert.deepStrictEqual([seg.number, seg.start, seg.end, seg.title, seg.date], [1, 0, 125.5, 'Movie - Scene 1', '2020-01-01']);
  assert.deepStrictEqual(seg.performers, [{ id: '1', name: 'A', scrapedName: 'A', actionCode: null }]);
  assert.deepStrictEqual(seg.tags, [{ id: '2', name: 'T' }]);
});

test('clips in a group are scanned one at a time and full-scan results are stored per clip', { skip: !ffmpegPath, timeout: 90000 }, async () => {
  const { BlackFrameStore } = require('../services/stashBlackFrameStore');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groupblack-'));
  const previousMap = process.env.STASH_PATH_MAP;
  try {
    for (const name of ['one.mp4', 'two.mp4']) {
      execFileSync(ffmpegPath, [
        '-v', 'error', '-y',
        '-filter_complex', 'testsrc=s=160x120:r=25:d=3[a];color=c=black:s=160x120:r=25:d=1[b];testsrc=s=160x120:r=25:d=2[c];[a][b][c]concat=n=3:v=1:a=0[v]',
        '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, name)
      ]);
    }
    process.env.STASH_PATH_MAP = `/stash=${dir}`;
    const names = { 1: 'one.mp4', 2: 'two.mp4' };
    const graphql = async (query, variables) => {
      const op = query.match(/(?:query|mutation)\s+(\w+)/)[1];
      if (op === 'SplitGroup') return { findGroup: { id: '9', name: 'Movie', urls: [] } };
      if (op === 'SplitScene') {
        const name = names[variables.id];
        return { findScene: { id: variables.id, title: name, groups: [{ group: { id: '9' } }], files: [{ path: `/stash/${name}`, basename: name, duration: 6, size: 1 }] } };
      }
      throw new Error(`unexpected ${op}`);
    };
    const blackFrameStore = new BlackFrameStore(path.join(dir, 'black.json'));
    const deps = { graphql, ffmpegPath, blackFrameStore };
    const finish = async (id) => {
      let scan = split.getBlackScan(id);
      for (let i = 0; i < 600 && (scan.status === 'running' || (scan.status === 'completed' && !scan.stored)); i++) {
        await new Promise(r => setTimeout(r, 100));
        scan = split.getBlackScan(id);
      }
      return scan;
    };

    const first = await split.startBlackScan(deps, '9', { sceneId: '1', fullScan: true });
    assert.strictEqual((await split.getGroupBlackFrames(deps, '9', [])).activeScan.sceneId, '1');
    await assert.rejects(split.startBlackScan(deps, '9', { sceneId: '2', fullScan: true }), (e) => e.code === 'SCAN_BUSY' && e.status === 409);
    assert.strictEqual((await finish(first.id)).status, 'completed');

    let state = await split.getGroupBlackFrames(deps, '9', ['1', '2']);
    assert.strictEqual(state.activeScan, null);
    assert.deepStrictEqual(Object.keys(state.results), ['1']);
    assert.strictEqual(state.results['1'].fullScan, true);
    assert.strictEqual(state.results['1'].blackRuns, 1);

    const second = await split.startBlackScan(deps, '9', { sceneId: '2', fullScan: true });
    assert.strictEqual((await finish(second.id)).status, 'completed');
    state = await split.getGroupBlackFrames(deps, '9', ['1', '2']);
    assert.deepStrictEqual(Object.keys(state.results).sort(), ['1', '2']);
    await blackFrameStore.writeChain;
  } finally {
    if (previousMap === undefined) delete process.env.STASH_PATH_MAP; else process.env.STASH_PATH_MAP = previousMap;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});