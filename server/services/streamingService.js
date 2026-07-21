const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ffmpeg } = require('../config/ffmpegConfig');
const prisma = require('../prismaClient');

const CONTENT_TYPE_BY_EXTENSION = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

// Codecs ExoPlayer (and browsers) can play natively without re-encoding.
const DIRECT_PLAY_VIDEO_CODECS = new Set(['h264']);
const REMUX_COMPATIBLE_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265']);
const DIRECT_PLAY_AUDIO_CODECS = new Set(['aac']);
const REMUX_COMPATIBLE_AUDIO_CODECS = new Set(['aac', 'ac3', 'eac3', 'mp3']);
const DIRECT_PLAY_CONTAINERS = new Set(['.mp4', '.m4v', '.mov']);

const SEGMENT_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.(ts|m3u8)$/;

/**
 * Direct-play + on-demand HLS transcoding for movies/episodes populated by
 * Radarr/Sonarr. See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 3).
 *
 * Playback modes:
 *   - "direct"    - client is served the original file bytes as-is
 *   - "remux"     - ffmpeg repackages the existing streams into HLS without
 *                   re-encoding (`-c copy`), used when only the container is
 *                   incompatible (e.g. mkv) but codecs are fine
 *   - "transcode" - ffmpeg re-encodes video+audio to H.264/AAC HLS, used
 *                   when the source codec itself isn't playable
 *
 * NOTE: "remux" and "transcode" currently apply uniformly to both the video
 * and audio stream (no mixed copy-video/transcode-audio mode yet) - a
 * reasonable Phase 3 simplification that can be refined later.
 */
class StreamingService {
  constructor() {
    this.tmpRootDir = process.env.TRANSCODE_TMP_DIR
      || path.join(process.env.DATA_PATH || path.join(__dirname, '..', 'data'), 'transcode');
    this.maxConcurrentTranscodes = Math.max(1, parseInt(process.env.MAX_CONCURRENT_TRANSCODES || '1', 10));
    this.idleTimeoutMs = Math.max(30, parseInt(process.env.TRANSCODE_IDLE_TIMEOUT_SECONDS || '90', 10)) * 1000;
    this.hwAccel = (process.env.HW_ACCEL || 'none').toLowerCase();

    /** @type {Map<string, object>} sessionId -> session record */
    this.sessions = new Map();

    fs.mkdirSync(this.tmpRootDir, { recursive: true });

    this.idleSweepInterval = setInterval(() => this.sweepIdleSessions(), 30000);
    this.idleSweepInterval.unref?.();
  }

  // ===================== Item lookup =====================

  async getPlayableItem(mediaType, id) {
    const numericId = Number.parseInt(id, 10);
    if (!Number.isFinite(numericId)) {
      const error = new Error('Invalid item id');
      error.statusCode = 400;
      throw error;
    }

    let item;
    if (mediaType === 'movie') {
      item = await prisma.movie.findUnique({ where: { id: numericId } });
    } else if (mediaType === 'episode') {
      item = await prisma.episode.findUnique({ where: { id: numericId } });
    } else {
      const error = new Error('mediaType must be "movie" or "episode"');
      error.statusCode = 400;
      throw error;
    }

    if (!item || item.removed) {
      const error = new Error(`${mediaType} ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (!item.hasFile || !item.filePath) {
      const error = new Error(`${mediaType} ${id} has no available file`);
      error.statusCode = 404;
      throw error;
    }

    if (!fs.existsSync(item.filePath)) {
      const error = new Error(`File not found on disk for ${mediaType} ${id}: ${item.filePath}`);
      error.statusCode = 404;
      throw error;
    }

    return { item, mediaType, filePath: item.filePath };
  }

  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return CONTENT_TYPE_BY_EXTENSION[ext] || 'application/octet-stream';
  }

  // ===================== Playback decision =====================

  /** Decide whether a probed item can be direct-played, remuxed, or must be transcoded. */
  decidePlaybackMode(item) {
    const ext = item.filePath ? path.extname(item.filePath).toLowerCase() : null;
    const videoCodec = (item.videoCodec || '').toLowerCase();
    const audioCodec = (item.audioCodec || '').toLowerCase();

    if (!item.probedAt) {
      return { mode: 'transcode', reason: 'File has not been probed yet; transcoding conservatively' };
    }

    if (
      ext && DIRECT_PLAY_CONTAINERS.has(ext)
      && DIRECT_PLAY_VIDEO_CODECS.has(videoCodec)
      && DIRECT_PLAY_AUDIO_CODECS.has(audioCodec)
    ) {
      return { mode: 'direct', reason: `Container ${ext}, video ${videoCodec}, audio ${audioCodec} are natively playable` };
    }

    if (REMUX_COMPATIBLE_VIDEO_CODECS.has(videoCodec) && REMUX_COMPATIBLE_AUDIO_CODECS.has(audioCodec)) {
      return { mode: 'remux', reason: `Codecs ${videoCodec}/${audioCodec} are compatible; only the container needs repackaging` };
    }

    return { mode: 'transcode', reason: `Codecs ${videoCodec || 'unknown'}/${audioCodec || 'unknown'} require re-encoding` };
  }

  getStreamInfo(item) {
    const decision = this.decidePlaybackMode(item);
    return {
      recommendedMode: decision.mode,
      reason: decision.reason,
      probed: !!item.probedAt,
      probeError: item.probeError || null,
      durationSeconds: item.durationSeconds ?? null,
      videoCodec: item.videoCodec || null,
      audioCodec: item.audioCodec || null,
      resolution: item.resolution || null,
      videoWidth: item.videoWidth ?? null,
      videoHeight: item.videoHeight ?? null,
      container: item.filePath ? path.extname(item.filePath).replace(/^\./, '') : null,
      audioTracks: this.parseJsonSafe(item.audioTracksJson),
      subtitleTracks: this.parseJsonSafe(item.subtitleTracksJson),
    };
  }

  parseJsonSafe(json) {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (_error) {
      return [];
    }
  }

  // ===================== Direct play (Range streaming) =====================

  /** Stream a local file directly to the response, honoring HTTP Range requests. */
  streamDirect(req, res, filePath) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const contentType = this.getContentType(filePath);
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    if (!range) {
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const start = match[1] ? Math.min(Number(match[1]), fileSize - 1) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;

    if (start > end || start >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  // ===================== HLS transcode sessions =====================

  findActiveSessionForItem(mediaType, id) {
    for (const session of this.sessions.values()) {
      if (session.mediaType === mediaType && session.id === id && !session.stopped) {
        return session;
      }
    }
    return null;
  }

  countActiveTranscodeSessions() {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (!session.stopped && session.mode !== 'direct') count += 1;
    }
    return count;
  }

  buildOutputOptions(mode, segmentPattern) {
    const videoOptions = mode === 'remux'
      ? ['-c:v', 'copy']
      : this.getTranscodeVideoOptions();

    const audioOptions = mode === 'remux'
      ? ['-c:a', 'copy']
      : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];

    return [
      '-map', '0:v:0',
      '-map', '0:a:0?',
      ...videoOptions,
      ...audioOptions,
      '-sn',
      '-f', 'hls',
      '-start_number', '0',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
    ];
  }

  getTranscodeVideoOptions() {
    if (this.hwAccel === 'nvenc') {
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '21'];
    }
    if (this.hwAccel === 'vaapi') {
      return ['-vaapi_device', '/dev/dri/renderD128', '-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi'];
    }
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p'];
  }

  /**
   * Get (creating if needed) an HLS session for a movie/episode. Reuses an
   * existing session for the same item when one is already running.
   */
  async getOrCreateHlsSession(mediaType, id, filePath, mode) {
    const existing = this.findActiveSessionForItem(mediaType, id);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing;
    }

    if (mode !== 'direct' && this.countActiveTranscodeSessions() >= this.maxConcurrentTranscodes) {
      const error = new Error('Server is at maximum concurrent transcode capacity, try again shortly');
      error.statusCode = 503;
      throw error;
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = path.join(this.tmpRootDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const playlistPath = path.join(sessionDir, 'playlist.m3u8');
    const segmentPattern = path.join(sessionDir, 'seg%05d.ts');

    const session = {
      sessionId,
      mediaType,
      id,
      mode,
      dir: sessionDir,
      playlistPath,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ready: false,
      stopped: false,
      command: null,
      error: null,
    };
    this.sessions.set(sessionId, session);

    const command = ffmpeg(filePath)
      .outputOptions(this.buildOutputOptions(mode, segmentPattern))
      .output(playlistPath)
      .on('start', (commandLine) => {
        console.log(`🎬 Started ${mode} HLS session ${sessionId}: ${commandLine}`);
      })
      .on('error', (err) => {
        console.error(`🎬 HLS session ${sessionId} ffmpeg error:`, err.message);
        session.error = err.message;
      })
      .on('end', () => {
        console.log(`🎬 HLS session ${sessionId} finished encoding`);
      });

    session.command = command;
    command.run();

    await this.waitForPlaylist(session);
    return session;
  }

  waitForPlaylist(session, timeoutMs = 15000) {
    const pollIntervalMs = 200;
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
      const poll = () => {
        if (session.error) {
          reject(new Error(`Transcode failed to start: ${session.error}`));
          return;
        }
        if (fs.existsSync(session.playlistPath)) {
          session.ready = true;
          resolve(session);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error('Timed out waiting for HLS transcode to produce a playlist'));
          return;
        }
        setTimeout(poll, pollIntervalMs);
      };
      poll();
    });
  }

  /** Read a session's playlist, rewriting segment filenames to the session's route path. */
  getSessionPlaylist(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.stopped) {
      const error = new Error(`No active session ${sessionId}`);
      error.statusCode = 404;
      throw error;
    }

    session.lastAccessedAt = Date.now();

    const raw = fs.readFileSync(session.playlistPath, 'utf8');
    return raw.replace(/^(?!#)(\S+\.ts)$/gm, (match) => `/api/stream/session/${sessionId}/${match}`);
  }

  /** Resolve + validate a segment/playlist filename within a session's directory. */
  getSessionFilePath(sessionId, filename) {
    const session = this.sessions.get(sessionId);
    if (!session || session.stopped) {
      const error = new Error(`No active session ${sessionId}`);
      error.statusCode = 404;
      throw error;
    }

    if (!SEGMENT_FILENAME_PATTERN.test(filename)) {
      const error = new Error('Invalid segment filename');
      error.statusCode = 400;
      throw error;
    }

    session.lastAccessedAt = Date.now();

    const resolvedPath = path.join(session.dir, filename);
    if (path.dirname(resolvedPath) !== session.dir) {
      const error = new Error('Invalid segment path');
      error.statusCode = 400;
      throw error;
    }

    if (!fs.existsSync(resolvedPath)) {
      const error = new Error(`Segment ${filename} not found (yet) for session ${sessionId}`);
      error.statusCode = 404;
      throw error;
    }

    return resolvedPath;
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.stopped = true;
    try {
      session.command?.kill('SIGKILL');
    } catch (error) {
      console.warn(`Failed to kill ffmpeg process for session ${sessionId}:`, error.message);
    }

    fs.rm(session.dir, { recursive: true, force: true }, (error) => {
      if (error) console.warn(`Failed to remove transcode dir for session ${sessionId}:`, error.message);
    });

    this.sessions.delete(sessionId);
    console.log(`🎬 Stopped HLS session ${sessionId}`);
    return true;
  }

  sweepIdleSessions() {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (now - session.lastAccessedAt > this.idleTimeoutMs) {
        console.log(`🎬 Session ${session.sessionId} idle for too long, stopping`);
        this.stopSession(session.sessionId);
      }
    }
  }

  stopAllSessions() {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.stopSession(sessionId);
    }
    clearInterval(this.idleSweepInterval);
  }

  listSessions() {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      mediaType: session.mediaType,
      id: session.id,
      mode: session.mode,
      ready: session.ready,
      createdAt: new Date(session.createdAt).toISOString(),
      lastAccessedAt: new Date(session.lastAccessedAt).toISOString(),
      error: session.error,
    }));
  }
}

// Singleton - ffmpeg session state must be shared across all requests.
module.exports = new StreamingService();
