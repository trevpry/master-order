/**
 * Group scene splitting.
 *
 * Splits a full-movie scene in a Stash group into one file per scene, using the scene lengths listed on the
 * movie's AEBN page, then:
 *   1. cuts each segment with ffmpeg next to the original (lossless stream copy for MP4-friendly sources; AVI/WMV
 *      and other non-MP4 codecs are converted to MP4 at near-source quality — see planEncoding),
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

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Source stream details from ffprobe JSON (falls back to what Stash reports about the file). */
function summarizeSourceMedia(probeJson, file = {}) {
  const streams = Array.isArray(probeJson?.streams) ? probeJson.streams : null;
  if (!streams) {
    return {
      probed: false,
      video: { codec: String(file.video_codec || '').toLowerCase(), width: toNumber(file.width), height: toNumber(file.height), pixFmt: null, bitDepth: null, bitRate: null },
      audio: file.audio_codec ? [{ codec: String(file.audio_codec).toLowerCase(), bitRate: null, channels: null, sampleRate: null }] : [],
      bitRate: toNumber(file.bit_rate)
    };
  }
  const video = streams.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const pixFmt = video?.pix_fmt || null;
  const depthFromFormat = pixFmt ? /(\d{2})(?:le|be)$/.exec(pixFmt) : null;
  return {
    probed: true,
    video: video ? {
      codec: String(video.codec_name || '').toLowerCase(),
      width: toNumber(video.width),
      height: toNumber(video.height),
      pixFmt,
      bitDepth: toNumber(video.bits_per_raw_sample) || (depthFromFormat ? Number(depthFromFormat[1]) : (pixFmt ? 8 : null)),
      bitRate: toNumber(video.bit_rate)
    } : null,
    audio: streams.filter(s => s.codec_type === 'audio').map(s => ({
      codec: String(s.codec_name || '').toLowerCase(),
      bitRate: toNumber(s.bit_rate),
      channels: toNumber(s.channels),
      sampleRate: toNumber(s.sample_rate)
    })),
    bitRate: toNumber(probeJson?.format?.bit_rate)
  };
}

/** AAC bitrate for a re-encoded audio track: at least the source's bitrate (+25% for the lossy→lossy hop). */
function aacBitrate(track = {}) {
  const channels = track.channels || 2;
  const floor = channels <= 1 ? 128000 : channels <= 2 ? 192000 : 384000;
  const target = Math.max(floor, Math.round((track.bitRate || 0) * 1.25));
  return `${Math.round(Math.min(target, 640000) / 1000)}k`;
}

/**
 * How each cut is encoded. Stream copy is lossless. When a conversion is needed the source's codec family, bit
 * depth, resolution, frame timing, every audio track and their channel layouts are kept; MP4-compatible audio is
 * copied untouched and everything else becomes high-bitrate AAC.
 */
function planEncoding({ transcode, media = {}, encoders = new Set(), env = process.env } = {}) {
  const videoCodec = String(media.video?.codec || '').toLowerCase();
  const isHevc = /hevc|h265/.test(videoCodec);
  if (!transcode) {
    return { mode: 'copy', hevc: isHevc, summary: 'Lossless stream copy (no re-encoding)' };
  }

  const tenBit = (media.video?.bitDepth || 8) > 8;
  const useX265 = isHevc && encoders.has('libx265');
  const video = useX265
    ? { encoder: 'libx265', crf: String(env.SPLIT_X265_CRF || '18'), preset: String(env.SPLIT_X265_PRESET || env.SPLIT_X264_PRESET || 'medium'), pixFmt: tenBit ? 'yuv420p10le' : 'yuv420p', tag: 'hvc1' }
    : { encoder: 'libx264', crf: String(env.SPLIT_X264_CRF || '16'), preset: String(env.SPLIT_X264_PRESET || 'medium'), pixFmt: 'yuv420p' };
  const { width, height } = media.video || {};
  video.evenScale = !width || !height || width % 2 !== 0 || height % 2 !== 0;

  const tracks = Array.isArray(media.audio) ? media.audio : [];
  const audio = tracks.length > 0
    ? tracks.map(track => (track.codec && COPY_AUDIO_CODECS.has(track.codec) ? { copy: true, codec: track.codec } : { copy: false, codec: track.codec || null, bitrate: aacBitrate(track) }))
    : null;

  const audioSummary = !audio
    ? 'AAC 192k'
    : audio.map(a => (a.copy ? `${a.codec} copied` : `${a.codec || 'audio'} → AAC ${a.bitrate}`)).join(', ');
  const videoSummary = `${useX265 ? 'HEVC' : 'H.264'} CRF ${video.crf} (${video.preset})${tenBit && useX265 ? ' 10-bit' : ''}`;
  return { mode: 'transcode', hevc: useX265, video, audio, summary: `${videoSummary}; ${audioSummary}` };
}

/**
 * ffmpeg arguments for one cut (start/end) or, when start is null, the whole file. keyframeSeconds forces an IDR
 * frame every N seconds so later stream-copy cuts of the output land within N seconds of the requested time.
 */
function buildFfmpegArgs({ input, output, start, end, transcode, hevc = false, plan = null, keyframeSeconds = null }) {
  const encoding = plan || planEncoding({ transcode, media: { video: { codec: hevc ? 'hevc' : '' }, audio: [] } });
  const args = start === null || start === undefined
    ? ['-hide_banner', '-nostdin', '-y', '-i', input]
    : ['-hide_banner', '-nostdin', '-y', '-ss', String(start), '-i', input, '-t', String(round(end - start))];
  if (encoding.mode === 'transcode') {
    const { video, audio } = encoding;
    args.push('-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0', '-map_chapters', '-1');
    args.push('-c:v', video.encoder, '-preset', video.preset, '-crf', video.crf, '-pix_fmt', video.pixFmt);
    if (keyframeSeconds) args.push('-force_key_frames', `expr:gte(t,n_forced*${keyframeSeconds})`, '-forced-idr', '1');
    if (video.encoder === 'libx265') args.push('-x265-params', 'log-level=error');
    if (video.tag) args.push('-tag:v', video.tag);
    if (video.evenScale) args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos');
    if (!audio) {
      args.push('-c:a', 'aac', '-b:a', '192k');
    } else {
      audio.forEach((track, index) => {
        if (track.copy) args.push(`-c:a:${index}`, 'copy');
        else args.push(`-c:a:${index}`, 'aac', `-b:a:${index}`, track.bitrate);
      });
    }
  } else {
    args.push('-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0', '-map_chapters', '-1', '-c', 'copy', '-avoid_negative_ts', 'make_zero');
    if (encoding.hevc) args.push('-tag:v', 'hvc1');
  }
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', output);
  return args;
}

function runCapture(binary, args) {
  return new Promise((resolve) => {
    let stdout = '';
    let child;
    try {
      child = spawn(binary, args, { windowsHide: true });
    } catch {
      resolve(null);
      return;
    }
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', () => {});
    child.on('error', () => resolve(null));
    child.on('close', code => resolve(code === 0 ? stdout : null));
  });
}

async function probeSourceMedia(ffprobePath, input, file) {
  if (!ffprobePath) return summarizeSourceMedia(null, file);
  const out = await runCapture(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input]);
  try {
    return summarizeSourceMedia(out ? JSON.parse(out) : null, file);
  } catch {
    return summarizeSourceMedia(null, file);
  }
}

const encoderCache = new Map();
async function availableEncoders(ffmpegPath) {
  if (!encoderCache.has(ffmpegPath)) {
    encoderCache.set(ffmpegPath, runCapture(ffmpegPath, ['-hide_banner', '-encoders']).then(out => {
      const names = new Set();
      String(out || '').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*[VAS][\w.]{5}\s+(\S+)/);
        if (m) names.add(m[1]);
      });
      return names;
    }));
  }
  return encoderCache.get(ffmpegPath);
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
    performers { id name }
    tags { id name }
    groups { group { id } scene_index }
    files { id path basename duration video_codec audio_codec format size width height bit_rate }
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
    warnings.push('No AEBN URL found for this group, so there are no scene lengths to start from. Insert cut lines yourself (black-frame scans help), or enter the AEBN movie URL and click Rebuild.');
    return finishPlan(deps, { group, scene, file, aebnUrl: null, geviUrl, warnings, mode: 'manual', segments: manualSegments(group, scene, file) });
  }

  const aebnResult = await scrapeAebn(aebnUrl);
  const aebn = aebnResult?.success ? aebnResult.scraped : null;
  if (!aebn) {
    warnings.push(`AEBN scrape failed (${aebnResult?.error || 'no data'}). Insert cut lines yourself or try Rebuild.`);
    return finishPlan(deps, { group, scene, file, aebnUrl, geviUrl, warnings, mode: 'manual', segments: manualSegments(group, scene, file) });
  }
  const aebnScenes = (aebn.allScenes || []).filter(s => s.durationSeconds > 0);
  if (aebnScenes.length < 2) {
    warnings.push('AEBN does not list scene lengths for this movie. Insert cut lines yourself (black-frame scans help).');
    return finishPlan(deps, { group, scene, file, aebnUrl, geviUrl, warnings, mode: 'manual', segments: manualSegments(group, scene, file) });
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

  return finishPlan(deps, { group, scene, file, aebnUrl, geviUrl, warnings, mode: 'aebn', segments: planSegments, studio });
}

/** One segment covering the whole file, carrying the clip's own performers/tags, for clips without AEBN scene lengths. */
function manualSegments(group, scene, file) {
  return [{
    number: 1,
    start: 0,
    end: round(Number(file.duration) || 0),
    listedDuration: null,
    title: `${group.name} - Scene 1`,
    quality: null,
    details: scene.details || null,
    date: group.date || scene.date || null,
    image: null,
    urls: [],
    performers: (scene.performers || []).map(p => ({ id: String(p.id), name: p.name, scrapedName: p.name, actionCode: null })),
    unmatchedPerformers: [],
    tags: (scene.tags || []).map(t => ({ id: String(t.id), name: t.name })),
    unmatchedTags: []
  }];
}

async function finishPlan(deps, { group, scene, file, aebnUrl, geviUrl, warnings, mode, segments, studio = null }) {
  const localPath = stashPathToLocal(file.path);
  let blackFrames = null;
  if (deps.blackFrameStore) {
    try {
      const record = await deps.blackFrameStore.get(String(scene.id), file);
      if (record) blackFrames = { intervals: record.intervals, ranges: record.ranges, fullScan: record.fullScan, scannedAt: record.scannedAt };
    } catch {
      blackFrames = null;
    }
  }
  const reason = transcodeReason(file);
  const fileAccess = await checkFileAccess(localPath, deps.fs || fs);
  let conversion = null;
  if (reason) {
    conversion = fileAccess.readable
      ? await conversionStatus(deps, { groupId: String(group.id), sceneId: String(scene.id), file, localSource: localPath })
      : { needed: true, status: 'none', progress: 0 };
  }
  return {
    group: { id: String(group.id), name: group.name },
    mode,
    source: {
      id: String(scene.id),
      title: scene.title,
      path: file.path,
      basename: file.basename,
      duration: Number(file.duration) || 0,
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
    studio: studio || group.studio || scene.studio || null,
    transcodeReason: reason,
    conversion,
    ffmpegAvailable: Boolean(deps.ffmpegPath),
    fileAccess,
    blackFrames,
    warnings,
    segments
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
  // Incompatible sources are converted to MP4 once as a whole, then split from the converted file by stream copy
  const convertFirst = Boolean(reason);
  const transcode = !convertFirst && Boolean(body.forceTranscode);
  const job = {
    id: crypto.randomUUID(),
    groupId: String(group.id),
    groupName: group.name,
    sceneId,
    originalAction,
    transcode,
    convertFirst,
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

    let cutSource = localSource;
    let cutBase = 0;
    let plan;
    if (job.convertFirst) {
      const conv = await ensureConversion(deps, { groupId: job.groupId, sceneId: job.sceneId, file, localSource });
      if (conv.status === 'ready') {
        log(job, `Using the already converted MP4 (${conv.encoding || 'converted earlier'})`);
      } else {
        job.step = 'Converting full scene to MP4';
        job.awaitingConversion = true;
        log(job, `${job.step} (${job.transcodeReason}) before splitting`);
        const ticker = setInterval(() => { job.progress = Math.round((conv.progress || 0) * 0.6); }, 500);
        try {
          await conv.promise;
        } finally {
          clearInterval(ticker);
          job.awaitingConversion = false;
        }
        if (job.cancelRequested) throw new Error('Cancelled');
        if (conv.status !== 'ready') throw new Error(`Conversion failed: ${conv.error || conv.status}`);
        log(job, `Converted: ${conv.encoding}`);
      }
      cutSource = conv.convertedPath;
      cutBase = 60;
      job.progress = cutBase;
      plan = planEncoding({ transcode: false, media: { video: { codec: conv.hevc ? 'hevc' : 'h264' } } });
      job.encoding = `${conv.encoding ? `Converted once: ${conv.encoding}` : 'Converted once'}; scenes cut by lossless stream copy`;
      log(job, `Encoding: ${job.encoding}`);
    } else {
      const [media, encoders] = await Promise.all([
        probeSourceMedia(deps.ffprobePath, localSource, file),
        job.transcode ? availableEncoders(ffmpegPath) : Promise.resolve(new Set())
      ]);
      plan = planEncoding({ transcode: job.transcode, media, encoders });
      job.encoding = plan.summary;
      log(job, `Encoding: ${plan.summary}${media.probed ? '' : ' (source not probed; using Stash file info)'}`);
    }

    for (const seg of job.segments) {
      if (job.cancelRequested) throw new Error('Cancelled');
      job.step = `${job.transcode ? 'Converting' : 'Cutting'} scene ${seg.number}`;
      seg.status = 'cutting';
      const finalPath = await uniqueOutputPath(dir, outputFileName(file.basename, seg.number), fsImpl);
      const partPath = `${finalPath}.part`;
      created.push(partPath);
      log(job, `${job.step}: ${formatClock(seg.start)}–${formatClock(seg.end)} → ${path.basename(finalPath)}`);

      await runFfmpeg(ffmpegPath, buildFfmpegArgs({
        input: cutSource,
        output: partPath,
        start: seg.start,
        end: seg.end,
        transcode: job.transcode,
        plan
      }), {
        job,
        onProgress: seconds => {
          const len = seg.end - seg.start;
          job.progress = Math.min(80, cutBase + Math.round(((cutDone + Math.min(seconds, len)) / totalCut) * (80 - cutBase)));
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
    if (job.convertFirst) {
      await discardConversion(deps, job.sceneId);
      log(job, 'Removed the temporary converted MP4');
    }

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

// ---------------------------------------------------------------------------
// Whole-scene conversion: sources MP4 can't hold (WMV, AVI, ...) are converted once, at near-source quality and
// with a keyframe every second, into a temporary MP4 next to the original. The preview plays that file and the
// split cuts it by stream copy, so the scenes aren't each re-encoded from the original or from a transcoded stream.
// ---------------------------------------------------------------------------

const CONVERT_KEYFRAME_SECONDS = 1;
const CONVERTED_SUFFIX = '.mo-converted.tmp';
const conversions = new Map();
let conversionQueue = Promise.resolve();

function convertedPathFor(localSource) {
  const stem = path.basename(localSource).replace(/\.[^.]+$/, '');
  return path.join(path.dirname(localSource), `${stem}${CONVERTED_SUFFIX}`);
}

function publicConversion(conv) {
  if (!conv) return null;
  return {
    needed: true,
    sceneId: conv.sceneId,
    groupId: conv.groupId,
    status: conv.status,
    progress: conv.progress,
    error: conv.error || null,
    encoding: conv.encoding || null,
    startedAt: conv.startedAt || null,
    finishedAt: conv.finishedAt || null
  };
}

async function probeConverted(ffprobePath, filePath) {
  if (!ffprobePath) return null;
  const out = await runCapture(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', filePath]);
  try {
    const json = out ? JSON.parse(out) : null;
    if (!json) return null;
    const video = (json.streams || []).find(s => s.codec_type === 'video');
    return { duration: Number(json.format?.duration) || 0, videoCodec: String(video?.codec_name || '').toLowerCase() };
  } catch {
    return null;
  }
}

/** A finished conversion left on disk (e.g. before a server restart) is reused when it's newer than and as long as the source. */
async function adoptConvertedFile(deps, { groupId, sceneId, file, localSource }) {
  const fsImpl = deps.fs || fs;
  const convertedPath = convertedPathFor(localSource);
  try {
    const [converted, source] = await Promise.all([fsImpl.promises.stat(convertedPath), fsImpl.promises.stat(localSource)]);
    if (converted.mtimeMs < source.mtimeMs) return null;
  } catch {
    return null;
  }
  const info = await probeConverted(deps.ffprobePath, convertedPath);
  const duration = Number(file.duration) || 0;
  if (!info || !(info.duration > 0) || (duration > 0 && Math.abs(info.duration - duration) > 2)) return null;
  const conv = {
    sceneId, groupId, localSource, convertedPath,
    status: 'ready', progress: 100, error: null, encoding: null,
    hevc: /hevc|h265/.test(info.videoCodec),
    startedAt: null, finishedAt: null, promise: Promise.resolve()
  };
  conversions.set(sceneId, conv);
  return conv;
}

function liveConversion(deps, sceneId, localSource) {
  const conv = conversions.get(sceneId);
  if (!conv || conv.localSource !== localSource) return null;
  if (['queued', 'running'].includes(conv.status)) return conv;
  if (conv.status === 'ready' && (deps.fs || fs).existsSync(conv.convertedPath)) return conv;
  return null;
}

async function conversionStatus(deps, { groupId, sceneId, file, localSource }) {
  const conv = liveConversion(deps, sceneId, localSource) || await adoptConvertedFile(deps, { groupId, sceneId, file, localSource });
  if (conv) return publicConversion(conv);
  const last = conversions.get(sceneId);
  if (last && last.localSource === localSource) return publicConversion(last);
  return { needed: true, sceneId, groupId, status: 'none', progress: 0, error: null, encoding: null };
}

async function runConversion(deps, conv, file) {
  const fsImpl = deps.fs || fs;
  const partPath = `${conv.convertedPath}.part`;
  if (conv.cancelRequested) {
    conv.status = 'cancelled';
    conv.finishedAt = new Date().toISOString();
    return conv;
  }
  conv.status = 'running';
  conv.startedAt = new Date().toISOString();
  const duration = Number(file.duration) || 0;
  try {
    const [media, encoders] = await Promise.all([
      probeSourceMedia(deps.ffprobePath, conv.localSource, file),
      availableEncoders(deps.ffmpegPath)
    ]);
    const plan = planEncoding({ transcode: true, media, encoders });
    conv.encoding = plan.summary;
    conv.hevc = plan.hevc;
    console.log(`🔄 Converting scene ${conv.sceneId} to MP4 before splitting: ${plan.summary}`);
    await runFfmpeg(deps.ffmpegPath, buildFfmpegArgs({
      input: conv.localSource,
      output: partPath,
      start: null,
      transcode: true,
      plan,
      keyframeSeconds: CONVERT_KEYFRAME_SECONDS
    }), {
      job: conv,
      onProgress: seconds => { conv.progress = duration > 0 ? Math.min(99, Math.round((seconds / duration) * 100)) : 0; }
    });
    if (conv.cancelRequested) throw new Error('Cancelled');
    await fsImpl.promises.rename(partPath, conv.convertedPath);
    conv.status = 'ready';
    conv.progress = 100;
    console.log(`🔄 Scene ${conv.sceneId} converted → ${path.basename(conv.convertedPath)}`);
  } catch (error) {
    conv.status = conv.cancelRequested ? 'cancelled' : 'failed';
    conv.error = conv.cancelRequested ? null : error.message;
    if (!conv.cancelRequested) console.warn(`🔄 Converting scene ${conv.sceneId} failed: ${error.message}`);
    await fsImpl.promises.unlink(partPath).catch(() => {});
  } finally {
    conv.finishedAt = new Date().toISOString();
  }
  return conv;
}

/** Returns the scene's ready or in-progress conversion, starting one (queued, one at a time) when there is none. */
async function ensureConversion(deps, { groupId, sceneId, file, localSource }) {
  const existing = liveConversion(deps, sceneId, localSource) || await adoptConvertedFile(deps, { groupId, sceneId, file, localSource });
  if (existing) return existing;
  const conv = {
    sceneId, groupId, localSource,
    convertedPath: convertedPathFor(localSource),
    status: 'queued', progress: 0, error: null, encoding: null, hevc: false,
    startedAt: null, finishedAt: null, child: null, cancelRequested: false
  };
  conversions.set(sceneId, conv);
  conv.promise = conversionQueue = conversionQueue.then(() => runConversion(deps, conv, file)).catch(() => conv);
  return conv;
}

/** POST body { sceneId } - convert an incompatible source to MP4 ahead of the split (the preview then plays it). */
async function startConversion(deps, groupId, body) {
  const { graphql } = deps;
  if (!graphql) throw new SplitError('Stash is not configured', 503);
  if (!deps.ffmpegPath) throw new SplitError('ffmpeg is not installed on the server', 503);
  const sceneId = String(body?.sceneId || '');
  if (!sceneId) throw new SplitError('sceneId is required');
  const { group, file } = await loadStashGroupAndScene(graphql, String(groupId), sceneId);
  if (!transcodeReason(file)) throw new SplitError('This clip is already MP4-compatible; it is split without converting', 400, 'NO_CONVERSION_NEEDED');
  const localSource = stashPathToLocal(file.path);
  const access = await checkFileAccess(localSource, deps.fs || fs);
  if (!access.readable || !access.writable) throw new SplitError(access.error, 400, 'NO_FILE_ACCESS');
  return publicConversion(await ensureConversion(deps, { groupId: String(group.id), sceneId, file, localSource }));
}

async function getConversion(deps, groupId, sceneId) {
  const conv = conversions.get(String(sceneId));
  if (conv) return publicConversion(conv);
  if (!deps.graphql) return null;
  const { file } = await loadStashGroupAndScene(deps.graphql, String(groupId), String(sceneId));
  if (!transcodeReason(file)) return { needed: false, sceneId: String(sceneId), status: 'none', progress: 0 };
  return conversionStatus(deps, { groupId: String(groupId), sceneId: String(sceneId), file, localSource: stashPathToLocal(file.path) });
}

/** Absolute path of the scene's finished conversion (for streaming to the preview), or null. */
async function getConvertedFile(deps, groupId, sceneId) {
  const fsImpl = deps.fs || fs;
  let conv = conversions.get(String(sceneId));
  if (!conv && deps.graphql) {
    const { file } = await loadStashGroupAndScene(deps.graphql, String(groupId), String(sceneId));
    if (transcodeReason(file)) {
      conv = await adoptConvertedFile(deps, { groupId: String(groupId), sceneId: String(sceneId), file, localSource: stashPathToLocal(file.path) });
    }
  }
  if (!conv || conv.status !== 'ready' || !fsImpl.existsSync(conv.convertedPath)) return null;
  return path.resolve(conv.convertedPath);
}

/** Stop a running conversion, or delete a finished one. */
function cancelConversion(sceneId) {
  const conv = conversions.get(String(sceneId));
  if (!conv) throw new SplitError('No conversion for this scene', 404);
  if (['queued', 'running'].includes(conv.status)) {
    conv.cancelRequested = true;
    if (conv.child) conv.child.kill('SIGKILL');
    return publicConversion(conv);
  }
  if (conv.status === 'ready') {
    fs.promises.unlink(conv.convertedPath).catch(() => {});
    conv.status = 'discarded';
    conv.progress = 0;
  }
  return publicConversion(conv);
}

async function discardConversion(deps, sceneId) {
  const conv = conversions.get(String(sceneId));
  if (!conv) return;
  conversions.delete(String(sceneId));
  await (deps.fs || fs).promises.unlink(conv.convertedPath).catch(() => {});
}

// ---------------------------------------------------------------------------
// Black-frame detection (cut suggestions)
// ---------------------------------------------------------------------------

const BLACK_SCAN_DEFAULT_WINDOW = 90;
const BLACK_SCAN_MAX_WINDOW = 600;
const BLACK_SCAN_CHUNK_SECONDS = 600;
const BLACK_SCAN_SKIP_SECONDS = 5;
const BLACK_SCAN_MAX_FAILURES = 4;
const blackScans = new Map();

/** Merge ±window ranges around each cut into sorted, non-overlapping [start, end] scan ranges. */
function blackScanRanges(cuts, window, duration) {
  const max = Number(duration) > 0 ? Number(duration) : Infinity;
  const ranges = (Array.isArray(cuts) ? cuts : [])
    .map(Number)
    .filter(Number.isFinite)
    .map(t => [Math.max(0, t - window), Math.min(max, t + window)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Parse ffmpeg blackdetect stderr; times are relative to the scanned range, so `offset` is added. */
function parseBlackdetect(stderr, offset = 0, rangeEnd = null) {
  const intervals = [];
  const re = /black_start:\s*([\d.]+)(?:\s+black_end:\s*([\d.]+))?/g;
  let m;
  while ((m = re.exec(String(stderr || ''))) !== null) {
    const start = Number(m[1]) + offset;
    let end = m[2] !== undefined ? Number(m[2]) + offset : rangeEnd;
    if (!Number.isFinite(end) || end === null) continue;
    if (rangeEnd !== null) end = Math.min(end, rangeEnd);
    if (end > start) intervals.push({ start: round(start), end: round(end) });
  }
  return intervals;
}

/** Combine intervals from adjacent ranges that touch or overlap. */
function mergeBlackIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end + 0.15) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged.map(iv => ({ ...iv, duration: round(iv.end - iv.start) }));
}

function buildBlackdetectArgs(input, start, length) {
  return [
    '-hide_banner', '-nostats', '-v', 'info',
    // Fewer decoder threads keep memory low on long/high-resolution files; damaged frames are skipped, not fatal
    '-threads', '2', '-fflags', '+discardcorrupt', '-err_detect', 'ignore_err',
    '-ss', String(start), '-t', String(length),
    '-i', input,
    '-map', '0:v:0', '-an', '-sn', '-dn',
    '-vf', 'fps=10,scale=240:-2,blackdetect=d=0.2:pix_th=0.10:pic_th=0.98',
    '-progress', 'pipe:1',
    '-f', 'null', '-'
  ];
}

function runFfmpegCapture(ffmpegPath, args, { onProgress, holder } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    if (holder) holder.child = child;
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
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (holder) holder.child = null;
      if (code === 0) {
        resolve(stderr);
        return;
      }
      // A null exit code means ffmpeg didn't exit normally; it was terminated by a signal (crash, OOM killer, ...)
      const cause = code === null ? `ffmpeg was terminated by ${signal || 'a signal'}` : `ffmpeg exited with code ${code}`;
      const error = new Error(holder?.cancelled ? 'Cancelled' : `${cause}: ${stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`);
      error.stderr = stderr;
      error.signal = signal;
      reject(error);
    });
  });
}

function publicBlackScan(scan) {
  if (!scan) return null;
  const { child, cancelled, ...rest } = scan;
  return rest;
}

function registerBlackScan({ groupId, sceneId, fullScan, window, ranges }) {
  // One scan per scene: a new scan replaces the running one
  for (const existing of blackScans.values()) {
    if (existing.sceneId === sceneId && existing.status === 'running') {
      existing.cancelled = true;
      existing.child?.kill('SIGKILL');
      existing.status = 'cancelled';
    }
  }
  const scan = {
    id: crypto.randomUUID(),
    groupId: String(groupId),
    sceneId,
    fullScan,
    window,
    ranges,
    status: 'running',
    progress: 0,
    intervals: [],
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
  blackScans.set(scan.id, scan);
  const finished = [...blackScans.values()].filter(s => s.status !== 'running');
  while (blackScans.size > 50 && finished.length) blackScans.delete(finished.shift().id);
  return scan;
}

/**
 * Run blackdetect over the scan's ranges. Fully scanned ranges are saved to deps.blackFrameStore, also when
 * the scan is cancelled or fails part-way. Resolves once the scan has finished.
 */
async function runBlackScan(deps, scan, { localSource, file }) {
  const { ranges, sceneId } = scan;
  const totalLength = ranges.reduce((sum, [a, b]) => sum + (b - a), 0) || 1;
  const chunkSeconds = deps.blackScanChunkSeconds || BLACK_SCAN_CHUNK_SECONDS;
  const found = [];
  const completedRanges = [];
  const skipped = [];
  let done = 0;
  let lastError = null;
  try {
    for (const [rangeStart, rangeEnd] of ranges) {
      // Long ranges are scanned in chunks, and an ffmpeg that dies (out of memory, damaged frames) is resumed just
      // past the point it reached, so one bad spot doesn't throw away the whole scan
      let position = rangeStart;
      let failures = 0;
      while (position < rangeEnd - 0.05 && !scan.cancelled) {
        const chunkEnd = Math.min(rangeEnd, position + chunkSeconds);
        const length = chunkEnd - position;
        let reached = 0;
        try {
          const stderr = await runFfmpegCapture(deps.ffmpegPath, buildBlackdetectArgs(localSource, position, length), {
            holder: scan,
            onProgress: (t) => {
              reached = Math.max(reached, Math.min(t, length));
              scan.progress = Math.min(0.99, (done + reached) / totalLength);
            }
          });
          found.push(...parseBlackdetect(stderr, position, chunkEnd));
          completedRanges.push([position, chunkEnd]);
          done += length;
          position = chunkEnd;
          failures = 0;
        } catch (error) {
          if (scan.cancelled) break;
          lastError = error;
          // Keep what was found before ffmpeg stopped (minus the last second, which may be incomplete)
          const safe = Math.max(0, reached - 1);
          failures = safe > 10 ? 1 : failures + 1;
          if (safe > 0) {
            found.push(...parseBlackdetect(error.stderr, position, position + safe));
            completedRanges.push([position, position + safe]);
          }
          const resumeAt = Math.min(chunkEnd, position + safe + BLACK_SCAN_SKIP_SECONDS * failures);
          if (resumeAt > position + safe) skipped.push([round(position + safe), round(resumeAt)]);
          console.warn(`⬛ Black-frame scan of scene ${sceneId} interrupted at ${formatClock(position + reached)} (${error.message.split(':')[0]}); resuming at ${formatClock(resumeAt)}`);
          done += resumeAt - position;
          position = resumeAt;
          if (failures >= BLACK_SCAN_MAX_FAILURES) throw error;
        }
        scan.intervals = mergeBlackIntervals(found);
        scan.progress = Math.min(0.99, done / totalLength);
      }
      if (scan.cancelled) break;
    }
    if (!scan.cancelled) {
      if (completedRanges.length === 0 && lastError) throw lastError;
      scan.status = 'completed';
      scan.progress = 1;
      if (skipped.length > 0) {
        const lost = round(skipped.reduce((sum, [a, b]) => sum + (b - a), 0));
        scan.skipped = skipped;
        scan.warning = `ffmpeg stopped ${skipped.length} time(s) while scanning (${lastError?.message.split(':')[0]}); skipped ${lost}s around ${skipped.map(([a]) => formatClock(a)).join(', ')}`;
      }
      console.log(`⬛ Black-frame scan of scene ${sceneId}: ${scan.intervals.length} black interval(s) in ${ranges.length} range(s)${scan.warning ? ` (${scan.warning})` : ''}`);
    }
  } catch (error) {
    if (!scan.cancelled) {
      scan.status = 'failed';
      scan.error = `${error.message.split(':')[0]} repeatedly near ${formatClock(done)}; ${scan.intervals.length} black run(s) found before that were kept`;
      console.warn(`⬛ Black-frame scan of scene ${sceneId} failed: ${error.message}`);
    }
  } finally {
    scan.finishedAt = new Date().toISOString();
  }
  if (deps.blackFrameStore && completedRanges.length > 0) {
    try {
      const record = await deps.blackFrameStore.save(sceneId, file, { ranges: completedRanges, intervals: found });
      scan.stored = { blackRuns: record.intervals.length, fullScan: record.fullScan };
    } catch (error) {
      console.warn(`⬛ Could not store black-frame results for scene ${sceneId}: ${error.message}`);
    }
  }
  return scan;
}

/**
 * Start a background blackdetect scan of the source file, either around the given cut times (±window seconds)
 * or across the whole file. Poll getBlackScan for { status, progress, intervals }.
 */
async function startBlackScan(deps, groupId, body) {
  const { graphql } = deps;
  if (!graphql) throw new SplitError('Stash is not configured', 503);
  if (!deps.ffmpegPath) throw new SplitError('ffmpeg is not installed on the server', 503);
  const sceneId = String(body?.sceneId || '');
  if (!sceneId) throw new SplitError('sceneId is required');

  // Only one clip of a group is scanned at a time (rescanning the same clip replaces its scan)
  const active = activeGroupBlackScan(groupId);
  if (active && active.sceneId !== sceneId) {
    throw new SplitError('Another clip in this group is being scanned for black frames; wait for it to finish or cancel it first', 409, 'SCAN_BUSY');
  }

  const { file } = await loadStashGroupAndScene(graphql, String(groupId), sceneId);
  const duration = Number(file.duration) || 0;
  const localSource = stashPathToLocal(file.path);
  const access = await checkFileAccess(localSource, deps.fs || fs);
  if (!access.readable) throw new SplitError(access.error, 400, 'NO_FILE_ACCESS');

  const window = Math.min(Math.max(Number(body?.window) || BLACK_SCAN_DEFAULT_WINDOW, 5), BLACK_SCAN_MAX_WINDOW);
  const fullScan = Boolean(body?.fullScan);
  const ranges = fullScan ? [[0, duration]] : blackScanRanges(body?.cuts, window, duration);
  if (ranges.length === 0 || !(duration > 0)) throw new SplitError('Nothing to scan');

  const scan = registerBlackScan({ groupId, sceneId, fullScan, window, ranges });
  const converted = liveConversion(deps, sceneId, localSource);
  runBlackScan(deps, scan, { localSource: converted?.status === 'ready' ? converted.convertedPath : localSource, file });
  return publicBlackScan(scan);
}

function getBlackScan(scanId) {
  return publicBlackScan(blackScans.get(scanId));
}

function cancelBlackScan(scanId) {
  const scan = blackScans.get(scanId);
  if (!scan) throw new SplitError('Scan not found', 404);
  if (scan.status === 'running') {
    scan.cancelled = true;
    scan.status = 'cancelled';
    scan.child?.kill('SIGKILL');
  }
  return publicBlackScan(scan);
}

// ---------------------------------------------------------------------------
// Group clip list: stored black-frame results per clip, scanned one clip at a time
// ---------------------------------------------------------------------------

function activeGroupBlackScan(groupId) {
  return [...blackScans.values()].find(s => s.groupId === String(groupId) && s.status === 'running') || null;
}

/** The group's running scan (if any) plus a summary of the stored results for the given scenes. */
async function getGroupBlackFrames(deps, groupId, sceneIds = []) {
  const records = deps.blackFrameStore ? await deps.blackFrameStore.getMany(sceneIds) : {};
  const results = {};
  for (const [id, record] of Object.entries(records)) {
    results[id] = {
      blackRuns: record.intervals.length,
      fullScan: record.fullScan,
      scannedSeconds: round(record.ranges.reduce((sum, [a, b]) => sum + (b - a), 0)),
      duration: record.duration,
      scannedAt: record.scannedAt
    };
  }
  return { activeScan: publicBlackScan(activeGroupBlackScan(groupId)), results };
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
  if (job.awaitingConversion) {
    try { cancelConversion(job.sceneId); } catch { /* already finished */ }
  }
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
  summarizeSourceMedia,
  planEncoding,
  aacBitrate,
  mergeScenePerformers,
  buildSplitPlan,
  manualSegments,
  startSplitJob,
  executeSplitJob,
  runFfmpeg,
  getJob,
  listJobs,
  cancelJob,
  startConversion,
  getConversion,
  getConvertedFile,
  cancelConversion,
  convertedPathFor,
  blackScanRanges,
  parseBlackdetect,
  mergeBlackIntervals,
  buildBlackdetectArgs,
  startBlackScan,
  getBlackScan,
  cancelBlackScan,
  getGroupBlackFrames
};
