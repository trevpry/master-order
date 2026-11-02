/**
 * Group scene splitting.
 *
 * Splits a full-movie scene in a Stash group into one file per scene, using the scene lengths listed on the
 * movie's AEBN page, then:
 *   1. cuts each segment with ffmpeg next to the original (stream copy for MP4-friendly sources; AVI/WMV and
 *      other non-MP4 codecs are converted to H.264/AAC MP4),
 *   2. has Stash scan the new files,
 *   3. applies per-scene metadata from AEBN + GEVI (title, performers, tags, studio, date, details, cover, URLs,
 *      group + scene number) to the new Stash scenes and syncs them locally (incl. GEVI action codes),
 *   4. optionally unlinks or deletes the original.
 *
 * File access: Stash reports its own container paths (e.g. /data/P_Video2/...). STASH_PATH_MAP translates them to
 * paths this server can read/write ("/data=/stash-library", several pairs separated by ";").
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { mapRemotePathToLocalDetailed } = require('../utils/libraryPathMapper');
const { SCENE_SYNC_FIELDS, upsertSceneFromStash } = require('./stashSceneLocalSync');
const { refreshGroupPerformers } = require('./stashGroupPerformerService');

// Containers/codecs that can be stream-copied into MP4 as-is
const COPY_CONTAINERS = new Set(['mp4', 'm4v', 'mov', 'mkv']);
const COPY_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265']);
const COPY_AUDIO_CODECS = new Set(['aac', 'mp3', '']);
// Leftover after the last listed scene that is treated as credits and folded into the last scene
const TRAILING_CREDITS_SECONDS = 180;

class SplitError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function parseStashPathMap(value = process.env.STASH_PATH_MAP) {
  return String(value || '')
    .split(/[;\n]/)
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf('=');
      return idx > 0 ? { stashPath: pair.slice(0, idx).trim(), localPath: pair.slice(idx + 1).trim() } : null;
    })
    .filter(m => m && m.stashPath && m.localPath)
    .sort((a, b) => b.stashPath.length - a.stashPath.length);
}

/** Translate a path reported by Stash to a path on this server. */
function stashPathToLocal(stashPath, mappings = parseStashPathMap()) {
  if (!stashPath) return null;
  const normalized = stashPath.replace(/\\/g, '/');
  for (const { stashPath: prefix, localPath } of mappings) {
    const p = prefix.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized === p || normalized.startsWith(`${p}/`)) {
      const rest = normalized.slice(p.length).replace(/^\//, '');
      return rest ? path.join(localPath, ...rest.split('/')) : localPath;
    }
  }
  const detailed = mapRemotePathToLocalDetailed(stashPath);
  return detailed.localPath;
}

const fileExtension = (file) => String(file?.basename || file?.path || '').split('.').pop().toLowerCase();

/** Decide whether a source needs converting to H.264/AAC MP4 (vs. a lossless stream copy). */
function transcodeReason(file) {
  const ext = fileExtension(file);
  const video = String(file?.video_codec || '').toLowerCase();
  const audio = String(file?.audio_codec || '').toLowerCase();
  if (!COPY_CONTAINERS.has(ext)) return `${ext.toUpperCase() || 'Unknown'} file will be converted to MP4`;
  if (!COPY_VIDEO_CODECS.has(video)) return `${video || 'unknown'} video will be converted to H.264`;
  if (!COPY_AUDIO_CODECS.has(audio)) return `${audio} audio will be converted to AAC`;
  return null;
}

/**
 * Cut points from the AEBN scene lengths: back to back from `offset`. A short leftover after the last scene
 * (credits) is folded into the last scene; ends are clamped to the file length.
 */
function buildSegments(aebnScenes, fileDuration, offset = 0) {
  const warnings = [];
  const scenes = (aebnScenes || []).filter(s => s.durationSeconds > 0);
  let cursor = Math.max(0, Number(offset) || 0);
  const segments = scenes.map(scene => {
    const start = cursor;
    cursor += scene.durationSeconds;
    return { number: scene.sceneNumber, start, end: cursor, listedDuration: scene.durationSeconds };
  });

  if (segments.length > 0 && fileDuration > 0) {
    const last = segments[segments.length - 1];
    const leftover = fileDuration - last.end;
    if (leftover > 0 && leftover <= TRAILING_CREDITS_SECONDS) {
      last.end = fileDuration;
    } else if (leftover > TRAILING_CREDITS_SECONDS) {
      warnings.push(`The file runs ${Math.round(leftover)}s past the listed scenes; check the cut points.`);
    } else if (leftover < -5) {
      warnings.push(`The listed scenes are ${Math.round(-leftover)}s longer than the file; check the cut points.`);
    }
    for (const seg of segments) {
      seg.end = Math.min(seg.end, fileDuration);
      seg.start = Math.min(seg.start, fileDuration);
    }
  }

  return { segments: segments.map(s => ({ ...s, start: round(s.start), end: round(s.end) })), warnings };
}

const round = (n) => Math.round(n * 1000) / 1000;

function validateSegments(segments, fileDuration) {
  if (!Array.isArray(segments) || segments.length === 0) throw new SplitError('No segments to split');
  const numbers = new Set();
  let previousEnd = -Infinity;
  const sorted = [...segments].sort((a, b) => Number(a.start) - Number(b.start));
  for (const seg of sorted) {
    const start = Number(seg.start);
    const end = Number(seg.end);
    const number = Number(seg.number);
    if (!Number.isInteger(number) || number < 1) throw new SplitError('Each segment needs a scene number');
    if (numbers.has(number)) throw new SplitError(`Scene number ${number} is used twice`);
    numbers.add(number);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 1) {
      throw new SplitError(`Scene ${number} has an invalid start/end`);
    }
    if (fileDuration > 0 && end > fileDuration + 1) {
      throw new SplitError(`Scene ${number} ends after the end of the file`);
    }
    if (start < previousEnd - 0.5) throw new SplitError(`Scene ${number} overlaps the previous scene`);
    previousEnd = end;
  }
  return sorted;
}

const sanitizeFileName = (name) => String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();

function outputFileName(sourceBasename, number) {
  const stem = sanitizeFileName(String(sourceBasename).replace(/\.[^.]+$/, '')) || 'scene';
  return `${stem} - Scene ${String(number).padStart(2, '0')}.mp4`;
}

function buildFfmpegArgs({ input, output, start, end, transcode, hevc = false, preset = process.env.SPLIT_X264_PRESET || 'veryfast', crf = process.env.SPLIT_X264_CRF || '20' }) {
  const args = ['-hide_banner', '-nostdin', '-y', '-ss', String(start), '-i', input, '-t', String(round(end - start))];
  if (transcode) {
    args.push(
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', String(preset), '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a', 'aac', '-b:a', '160k'
    );
  } else {
    args.push('-map', '0:v:0', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero');
    if (hevc) args.push('-tag:v', 'hvc1');
  }
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', output);
  return args;
}

const isGenericSceneTitle = (title) => !title || /^scene\s*\d+$/i.test(String(title).trim());
const normalizeName = (name) => String(name || '').toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

/** Combine AEBN + GEVI scene performers (GEVI adds action codes); dedupes by normalized name. */
function mergeScenePerformers(aebnPerformers = [], geviPerformers = []) {
  const merged = new Map();
  for (const p of [...geviPerformers, ...aebnPerformers]) {
    const name = typeof p === 'string' ? p : p?.name;
    const key = normalizeName(name);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) merged.set(key, { name, actionCode: p?.actionCode || null, url: p?.url || null });
    else if (!existing.actionCode && p?.actionCode) existing.actionCode = p.actionCode;
  }
  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// Stash helpers
// ---------------------------------------------------------------------------

const GROUP_QUERY = `query SplitGroup($id: ID!) { findGroup(id: $id) { id name date urls studio { id name } } }`;
const SCENE_QUERY = `query SplitScene($id: ID!) {
  findScene(id: $id) {
    id title date details
    studio { id name }
    groups { group { id } scene_index }
    files { id path basename duration video_codec audio_codec format size width height }
    paths { stream vtt sprite screenshot }
  }
}`;

/** Browser-playable URLs for the split timeline: direct stream, transcoded HLS (AVI/WMV etc.) and sprite VTT. */
function sceneMediaUrls(paths) {
  if (!paths?.stream) return null;
  let hlsUrl = null;
  try {
    const url = new URL(paths.stream);
    url.pathname = `${url.pathname.replace(/\/$/, '')}.m3u8`;
    url.searchParams.set('resolution', 'STANDARD');
    hlsUrl = url.toString();
  } catch {
    hlsUrl = null;
  }
  return {
    directUrl: paths.stream,
    hlsUrl,
    vttUrl: paths.vtt || null,
    screenshotUrl: paths.screenshot || null
  };
}

async function loadStashGroupAndScene(graphql, groupId, sceneId) {
  const [groupData, sceneData] = await Promise.all([
    graphql(GROUP_QUERY, { id: groupId }),
    graphql(SCENE_QUERY, { id: sceneId })
  ]);
  const group = groupData?.findGroup;
  const scene = sceneData?.findScene;
  if (!group) throw new SplitError('Group not found in Stash', 404);
  if (!scene) throw new SplitError('Scene not found in Stash', 404);
  if (!(scene.groups || []).some(g => String(g.group?.id) === String(groupId))) {
    throw new SplitError('That scene is not in this group');
  }
  const file = scene.files?.[0];
  if (!file?.path) throw new SplitError('The scene has no file to split');
  return { group, scene, file };
}

async function checkFileAccess(localPath, fsImpl = fs) {
  const result = { localPath, readable: false, writable: false, error: null };
  try {
    await fsImpl.promises.access(localPath, fs.constants.R_OK);
    result.readable = true;
    await fsImpl.promises.access(path.dirname(localPath), fs.constants.W_OK);
    result.writable = true;
  } catch (error) {
    result.error = result.readable
      ? `The folder ${path.dirname(localPath)} is not writable by the server`
      : `The server can't read ${localPath}. Mount the Stash library and set STASH_PATH_MAP (e.g. /data=/stash-library).`;
  }
  return result;
}

async function waitForStashJob(graphql, jobId, { intervalMs = 2000, timeoutMs = 60 * 60 * 1000, onProgress } = {}) {
  const started = Date.now();
  for (;;) {
    const data = await graphql(`query SplitJob($id: ID!) { findJob(input: { id: $id }) { id status progress error } }`, { id: jobId });
    const job = data?.findJob;
    if (!job || job.status === 'FINISHED') return;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') {
      throw new Error(`Stash job ${jobId} ${job.status.toLowerCase()}${job.error ? `: ${job.error}` : ''}`);
    }
    if (onProgress && typeof job.progress === 'number') onProgress(job.progress);
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for Stash job ${jobId}`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

async function findSceneByPath(graphql, stashPath) {
  const data = await graphql(
    `query SplitFind($f: SceneFilterType) { findScenes(scene_filter: $f, filter: { per_page: 5 }) { scenes { id files { path } } } }`,
    { f: { path: { value: stashPath, modifier: 'EQUALS' } } }
  );
  const scenes = data?.findScenes?.scenes || [];
  return scenes.find(s => (s.files || []).some(f => f.path === stashPath)) || scenes[0] || null;
}

// ---------------------------------------------------------------------------
// Plan (preview)
// ---------------------------------------------------------------------------

/**
 * Build the split plan for a group scene: cut points from AEBN scene lengths plus per-scene metadata from
 * AEBN and GEVI, matched against the local performers/tags/studios.
 */
async function buildSplitPlan(deps, { groupId, sceneId, aebnUrl: aebnOverride, geviUrl: geviOverride, offset = 0 }) {
  const { prisma, graphql, geviScraper, scrapeAebn } = deps;
  if (!graphql) throw new SplitError('Stash is not configured', 503);

  const { group, scene, file } = await loadStashGroupAndScene(graphql, groupId, sceneId);
  const localGroup = await prisma.stashGroup.findUnique({ where: { id: String(groupId) }, select: { url: true, geviUrl: true } });
  const warnings = [];

  const knownUrls = [aebnOverride, geviOverride, ...(group.urls || []), localGroup?.url, localGroup?.geviUrl].filter(Boolean);
  let aebnUrl = aebnOverride || knownUrls.find(u => /aebn\.(com|net)/i.test(u)) || null;
  const geviUrl = geviOverride || knownUrls.find(u => /gayeroticvideoindex\.com/i.test(u)) || null;

  let gevi = null;
  if (geviUrl) {
    try {
      gevi = await geviScraper.movieFromUrl(geviUrl);
      if (!gevi) warnings.push('GEVI page could not be scraped; using AEBN metadata only.');
    } catch (error) {
      warnings.push(`GEVI scrape failed (${error.message}); using AEBN metadata only.`);
    }
    if (!aebnUrl) aebnUrl = (gevi?.externalUrls || []).find(u => /aebn\.(com|net)/i.test(u)) || null;
  }

  if (!aebnUrl) {
    throw new SplitError('No AEBN URL found for this group. Scrape the group from AEBN first or enter the AEBN movie URL.', 400, 'NO_AEBN_URL');
  }

  const aebnResult = await scrapeAebn(aebnUrl);
  const aebn = aebnResult?.success ? aebnResult.scraped : null;
  if (!aebn) throw new SplitError(`AEBN scrape failed: ${aebnResult?.error || 'no data'}`, 502, 'AEBN_FAILED');
  const aebnScenes = (aebn.allScenes || []).filter(s => s.durationSeconds > 0);
  if (aebnScenes.length < 2) {
    throw new SplitError('AEBN did not list scene lengths for at least two scenes, so the movie cannot be split.', 400, 'NO_SCENE_LENGTHS');
  }
  if (aebnScenes.length < (aebn.allScenes || []).length) {
    warnings.push(`${aebn.allScenes.length - aebnScenes.length} AEBN scene(s) have no length and were left out.`);
  }

  const fileDuration = Number(file.duration) || 0;
  const { segments, warnings: cutWarnings } = buildSegments(aebnScenes, fileDuration, offset);
  warnings.push(...cutWarnings);

  // Merge per-scene performers and resolve names/tags/studio against the local library in one pass each
  const geviByNumber = new Map((gevi?.scenes || []).map(s => [s.sceneNumber, s]));
  const aebnByNumber = new Map(aebnScenes.map(s => [s.sceneNumber, s]));
  const performersByNumber = new Map(segments.map(seg => [seg.number,
    mergeScenePerformers(aebnByNumber.get(seg.number)?.performers, geviByNumber.get(seg.number)?.performers)]));

  const allPerformers = mergeScenePerformers([...performersByNumber.values()].flat());
  const performerMatches = allPerformers.length > 0
    ? await geviScraper.matchPerformers(allPerformers.map(p => ({ name: p.name, url: p.url })), prisma)
    : { matched: [] };
  const performerByName = new Map(performerMatches.matched.map(m => [normalizeName(m.originalName), m]));

  const allTagNames = [...new Set(aebnScenes.flatMap(s => (s.tags || []).map(t => t.name || t)).filter(Boolean))];
  const tagMatches = allTagNames.length > 0 ? await geviScraper.matchTags(allTagNames, prisma) : { matched: [] };
  const tagByName = new Map(tagMatches.matched.map(t => [normalizeName(t.originalName), t]));

  let studio = group.studio || scene.studio || null;
  if (!studio && aebn.studio) {
    const matched = await geviScraper.matchStudio(aebn.studio, prisma);
    if (matched) studio = { id: matched.id, name: matched.name };
  }

  const planSegments = segments.map(seg => {
    const aebnScene = aebnByNumber.get(seg.number) || {};
    const geviScene = geviByNumber.get(seg.number) || {};
    const performers = [];
    const unmatchedPerformers = [];
    for (const p of performersByNumber.get(seg.number)) {
      const match = performerByName.get(normalizeName(p.name));
      if (match && !performers.some(x => x.id === match.id)) {
        performers.push({ id: match.id, name: match.name, scrapedName: p.name, actionCode: p.actionCode || null });
      } else if (!match) {
        unmatchedPerformers.push(p.name);
      }
    }
    const tags = [];
    const unmatchedTags = [];
    for (const t of aebnScene.tags || []) {
      const name = t.name || t;
      const match = tagByName.get(normalizeName(name));
      if (match && !tags.some(x => x.id === match.id)) tags.push({ id: match.id, name: match.name });
      else if (!match) unmatchedTags.push(name);
    }
    return {
      ...seg,
      title: isGenericSceneTitle(aebnScene.title) ? `${group.name} - Scene ${seg.number}` : aebnScene.title,
      quality: aebnScene.quality || null,
      details: geviScene.details || aebnScene.details || null,
      date: group.date || scene.date || null,
      image: aebnScene.image || null,
      urls: [...new Set([geviScene.episodeUrl, aebnUrl].filter(Boolean))],
      performers,
      unmatchedPerformers,
      tags,
      unmatchedTags
    };
  });

  const localPath = stashPathToLocal(file.path);
  return {
    group: { id: String(group.id), name: group.name },
    source: {
      id: String(scene.id),
      title: scene.title,
      path: file.path,
      basename: file.basename,
      duration: fileDuration,
      size: file.size,
      format: file.format,
      videoCodec: file.video_codec,
      audioCodec: file.audio_codec,
      width: file.width,
      height: file.height,
      media: sceneMediaUrls(scene.paths)
    },
    aebnUrl,
    geviUrl,
    studio,
    transcodeReason: transcodeReason(file),
    ffmpegAvailable: Boolean(deps.ffmpegPath),
    fileAccess: await checkFileAccess(localPath, deps.fs || fs),
    warnings,
    segments: planSegments
  };
}

// ---------------------------------------------------------------------------
// Job execution
// ---------------------------------------------------------------------------

const jobs = new Map();
let queue = Promise.resolve();

function publicJob(job) {
  if (!job) return null;
  const { child, cancelRequested, context, ...rest } = job;
  return { ...rest, cancelRequested: Boolean(cancelRequested) };
}

function runFfmpeg(ffmpegPath, args, { onProgress, job } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    if (job) job.child = child;
    let stderr = '';
    let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (m && onProgress) onProgress(Number(m[1]) / 1e6);
      }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
    child.on('error', reject);
    child.on('close', code => {
      if (job) job.child = null;
      if (code === 0) resolve();
      else reject(new Error(job?.cancelRequested ? 'Cancelled' : `ffmpeg exited with code ${code}: ${stderr.trim().split(/\r?\n/).slice(-3).join(' | ')}`));
    });
  });
}

async function uniqueOutputPath(dir, fileName, fsImpl) {
  let candidate = path.join(dir, fileName);
  let n = 2;
  while (fsImpl.existsSync(candidate) || fsImpl.existsSync(`${candidate}.part`)) {
    candidate = path.join(dir, fileName.replace(/\.mp4$/, ` (${n}).mp4`));
    n++;
  }
  return candidate;
}

/**
 * Validate and queue a split. Returns the job (poll getJob for progress).
 * body: { sceneId, segments: [{ number, start, end, title, details, date, image, urls, performers: [{id, actionCode}], tags: [{id}] }],
 *         studioId, originalAction: 'unlink' | 'keep' | 'delete', forceTranscode }
 */
async function startSplitJob(deps, groupId, body) {
  const { graphql } = deps;
  if (!graphql) throw new SplitError('Stash is not configured', 503);
  if (!deps.ffmpegPath) throw new SplitError('ffmpeg is not installed on the server', 503);

  const sceneId = String(body?.sceneId || '');
  if (!sceneId) throw new SplitError('sceneId is required');
  const originalAction = ['keep', 'unlink', 'delete'].includes(body?.originalAction) ? body.originalAction : 'unlink';

  for (const job of jobs.values()) {
    if (job.sceneId === sceneId && ['queued', 'running'].includes(job.status)) {
      throw new SplitError('This scene is already being split', 409);
    }
  }

  const { group, scene, file } = await loadStashGroupAndScene(graphql, String(groupId), sceneId);
  const segments = validateSegments(body.segments, Number(file.duration) || 0);
  const localSource = stashPathToLocal(file.path);
  const access = await checkFileAccess(localSource, deps.fs || fs);
  if (!access.readable || !access.writable) throw new SplitError(access.error, 400, 'NO_FILE_ACCESS');

  const reason = transcodeReason(file);
  const transcode = Boolean(reason) || Boolean(body.forceTranscode);
  const job = {
    id: crypto.randomUUID(),
    groupId: String(group.id),
    groupName: group.name,
    sceneId,
    originalAction,
    transcode,
    transcodeReason: reason || (body.forceTranscode ? 'Re-encoding for frame-accurate cuts' : null),
    status: 'queued',
    step: 'Waiting',
    progress: 0,
    error: null,
    log: [],
    createdAt: new Date().toISOString(),
    finishedAt: null,
    segments: segments.map(seg => ({
      number: Number(seg.number),
      start: Number(seg.start),
      end: Number(seg.end),
      title: String(seg.title || `${group.name} - Scene ${seg.number}`).trim(),
      details: seg.details || null,
      date: seg.date || null,
      image: seg.image || null,
      urls: Array.isArray(seg.urls) ? seg.urls.filter(Boolean) : [],
      performers: (seg.performers || []).filter(p => p?.id).map(p => ({ id: String(p.id), name: p.name || null, actionCode: p.actionCode || null })),
      tagIds: (seg.tags || []).map(t => String(t.id || t)).filter(Boolean),
      status: 'pending',
      outputPath: null,
      stashPath: null,
      newSceneId: null,
      error: null
    }))
  };
  job.context = { file, scene, studioId: body.studioId ? String(body.studioId) : (group.studio?.id || scene.studio?.id || null), localSource };
  jobs.set(job.id, job);
  trimJobs();

  queue = queue.then(() => executeSplitJob(deps, job)).catch(() => {});
  return job;
}

function trimJobs(max = 20) {
  const finished = [...jobs.values()].filter(j => !['queued', 'running'].includes(j.status));
  while (jobs.size > max && finished.length > 0) jobs.delete(finished.shift().id);
}

const log = (job, message) => {
  job.log.push(`${new Date().toISOString().slice(11, 19)} ${message}`);
  console.log(`✂️ [Split ${job.id.slice(0, 8)}] ${message}`);
};

async function executeSplitJob(deps, job) {
  const { prisma, graphql, ffmpegPath } = deps;
  const fsImpl = deps.fs || fs;
  const { file, localSource } = job.context;
  const created = [];
  const totalCut = job.segments.reduce((sum, s) => sum + (s.end - s.start), 0) || 1;
  let cutDone = 0;
  let cutting = true;

  job.status = 'running';
  try {
    // 1. Cut
    let sourceStat = null;
    try { sourceStat = await fsImpl.promises.stat(localSource); } catch { /* ownership copy is best effort */ }
    const dir = path.dirname(localSource);

    for (const seg of job.segments) {
      if (job.cancelRequested) throw new Error('Cancelled');
      job.step = `${job.transcode ? 'Converting' : 'Cutting'} scene ${seg.number}`;
      seg.status = 'cutting';
      const finalPath = await uniqueOutputPath(dir, outputFileName(file.basename, seg.number), fsImpl);
      const partPath = `${finalPath}.part`;
      created.push(partPath);
      log(job, `${job.step}: ${formatClock(seg.start)}–${formatClock(seg.end)} → ${path.basename(finalPath)}`);

      await runFfmpeg(ffmpegPath, buildFfmpegArgs({
        input: localSource,
        output: partPath,
        start: seg.start,
        end: seg.end,
        transcode: job.transcode,
        hevc: /hevc|h265/i.test(file.video_codec || '')
      }), {
        job,
        onProgress: seconds => {
          const len = seg.end - seg.start;
          job.progress = Math.min(80, Math.round(((cutDone + Math.min(seconds, len)) / totalCut) * 80));
        }
      });

      await fsImpl.promises.rename(partPath, finalPath);
      created[created.length - 1] = finalPath;
      if (sourceStat && process.platform !== 'win32') {
        await fsImpl.promises.chown(finalPath, sourceStat.uid, sourceStat.gid).catch(() => {});
      }
      cutDone += seg.end - seg.start;
      seg.outputPath = finalPath;
      seg.stashPath = path.posix.join(path.posix.dirname(file.path.replace(/\\/g, '/')), path.basename(finalPath));
      seg.status = 'cut';
    }
    job.progress = 80;
    cutting = false;

    // 2. Scan the new files into Stash
    job.step = 'Scanning new files in Stash';
    log(job, job.step);
    const scan = await graphql(
      `mutation SplitScan($input: ScanMetadataInput!) { metadataScan(input: $input) }`,
      { input: { paths: job.segments.map(s => s.stashPath), scanGenerateCovers: true, scanGeneratePhashes: true } }
    );
    await waitForStashJob(graphql, scan?.metadataScan, {
      intervalMs: deps.pollIntervalMs,
      onProgress: p => { job.progress = 80 + Math.round(p * 10); }
    });
    job.progress = 90;

    // 3. Apply metadata
    job.step = 'Applying metadata';
    const newSceneIds = [];
    for (const seg of job.segments) {
      try {
        const found = await findSceneByPath(graphql, seg.stashPath);
        if (!found) throw new Error('Stash did not create a scene for the new file');
        seg.newSceneId = String(found.id);
        await applySegmentMetadata(deps, job, seg);
        newSceneIds.push(seg.newSceneId);
        seg.status = 'done';
        log(job, `Scene ${seg.number} → Stash scene ${seg.newSceneId}`);
      } catch (error) {
        seg.status = 'failed';
        seg.error = error.message;
        log(job, `Scene ${seg.number} metadata failed: ${error.message}`);
      }
    }

    if (newSceneIds.length > 0) {
      graphql(
        `mutation SplitGenerate($input: GenerateMetadataInput!) { metadataGenerate(input: $input) }`,
        { input: { sceneIDs: newSceneIds, previews: true, sprites: true } }
      ).catch(error => log(job, `Preview generation could not be queued: ${error.message}`));
    }

    // 4. Original scene
    const allDone = job.segments.every(s => s.status === 'done');
    if (job.originalAction !== 'keep' && !allDone) {
      log(job, 'Original scene left untouched because not every new scene was set up');
    } else if (job.originalAction === 'unlink') {
      job.step = 'Removing original from group';
      const groups = (job.context.scene.groups || [])
        .filter(g => String(g.group?.id) !== job.groupId)
        .map(g => ({ group_id: g.group.id, scene_index: g.scene_index }));
      await graphql(`mutation SplitUnlink($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
        { input: { id: job.sceneId, groups } });
      await prisma.stashGroupScene.deleteMany({ where: { groupId: job.groupId, sceneId: job.sceneId } });
      log(job, 'Original scene removed from the group');
    } else if (job.originalAction === 'delete') {
      job.step = 'Deleting original';
      await graphql(`mutation SplitDelete($input: SceneDestroyInput!) { sceneDestroy(input: $input) }`,
        { input: { id: job.sceneId, delete_file: true, delete_generated: true } });
      await prisma.stashScene.deleteMany({ where: { id: job.sceneId } });
      log(job, 'Original scene and file deleted');
    }

    await refreshGroupPerformers(prisma, [job.groupId]).catch(() => {});
    job.progress = 100;
    job.status = allDone ? 'completed' : 'completed_with_errors';
    job.step = allDone ? 'Done' : 'Done (some scenes need attention)';
  } catch (error) {
    job.status = job.cancelRequested ? 'cancelled' : 'failed';
    job.error = error.message;
    job.step = job.cancelRequested ? 'Cancelled' : 'Failed';
    log(job, `${job.step}: ${error.message}`);
    // Files only reach Stash once cutting is finished, so a cutting failure removes everything this job wrote
    if (cutting) {
      for (const filePath of created) await fsImpl.promises.unlink(filePath).catch(() => {});
      job.segments.forEach(s => { if (s.status !== 'pending') s.status = 'removed'; });
    }
  } finally {
    job.finishedAt = new Date().toISOString();
    delete job.context;
  }
}

async function applySegmentMetadata(deps, job, seg) {
  const { prisma, graphql, actionCodeService } = deps;
  const input = {
    id: seg.newSceneId,
    title: seg.title,
    details: seg.details || null,
    date: seg.date || null,
    urls: seg.urls,
    studio_id: job.context.studioId,
    performer_ids: [...new Set(seg.performers.map(p => p.id))],
    tag_ids: [...new Set(seg.tagIds)],
    groups: [{ group_id: job.groupId, scene_index: seg.number }]
  };
  await graphql(`mutation SplitApply($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`, { input });

  if (seg.image) {
    try {
      await graphql(`mutation SplitCover($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
        { input: { id: seg.newSceneId, cover_image: seg.image } });
    } catch (error) {
      log(job, `Scene ${seg.number}: cover image not applied (${error.message})`);
    }
  }

  const data = await graphql(`query SplitSync($id: ID!) { findScene(id: $id) { ${SCENE_SYNC_FIELDS} } }`, { id: seg.newSceneId });
  if (data?.findScene) await upsertSceneFromStash(prisma, data.findScene);
  await prisma.stashGroupScene.upsert({
    where: { groupId_sceneId: { groupId: job.groupId, sceneId: seg.newSceneId } },
    update: { sceneIndex: seg.number },
    create: { groupId: job.groupId, sceneId: seg.newSceneId, sceneIndex: seg.number }
  });

  const withCodes = seg.performers.filter(p => p.actionCode);
  if (withCodes.length > 0 && actionCodeService) {
    await actionCodeService.applyActionCodeTagsForPerformers(seg.newSceneId, withCodes, prisma);
  }
}

function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function getJob(jobId) {
  return publicJob(jobs.get(jobId));
}

function listJobs(groupId = null) {
  return [...jobs.values()]
    .filter(j => !groupId || j.groupId === String(groupId))
    .map(publicJob)
    .reverse();
}

function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) throw new SplitError('Job not found', 404);
  if (!['queued', 'running'].includes(job.status)) throw new SplitError('Job is not running');
  if (job.step && !/^(Cutting|Converting|Waiting)/.test(job.step)) {
    throw new SplitError('The files are already in Stash; the job can no longer be cancelled');
  }
  job.cancelRequested = true;
  if (job.child) job.child.kill('SIGKILL');
  return publicJob(job);
}

module.exports = {
  SplitError,
  parseStashPathMap,
  stashPathToLocal,
  transcodeReason,
  sceneMediaUrls,
  buildSegments,
  validateSegments,
  outputFileName,
  buildFfmpegArgs,
  mergeScenePerformers,
  buildSplitPlan,
  startSplitJob,
  executeSplitJob,
  runFfmpeg,
  getJob,
  listJobs,
  cancelJob
};
