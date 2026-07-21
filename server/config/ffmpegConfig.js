/**
 * FFmpeg / FFprobe configuration resolver
 *
 * Centralizes locating the ffmpeg and ffprobe binaries used by the
 * direct-play/transcoding streaming service and media probing service
 * (see SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md, Phase 2/3).
 *
 * Resolution order for each binary:
 *   1. Explicit env var (FFMPEG_PATH / FFPROBE_PATH)
 *   2. Well-known system install locations (true in the production Docker
 *      image, which installs the `ffmpeg` apk package providing both
 *      binaries at /usr/bin) - preferred over the bundled package because
 *      prebuilt npm binaries are usually glibc-linked and may not run on
 *      Alpine's musl libc.
 *   3. Bundled npm package binary (ffmpeg-static / @ffprobe-installer/ffprobe)
 *      - convenient for local development on machines without ffmpeg installed
 *
 * Usage:
 *   const ffmpeg = require('../config/ffmpegConfig').ffmpeg;
 *   ffmpeg(inputPath).outputOptions(...)...
 */

const fs = require('fs');
const fluentFfmpeg = require('fluent-ffmpeg');

const SYSTEM_FFMPEG_CANDIDATES = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
const SYSTEM_FFPROBE_CANDIDATES = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe'];

function findExistingPath(candidates) {
  return candidates.find((candidatePath) => {
    try {
      return fs.existsSync(candidatePath);
    } catch (_error) {
      return false;
    }
  }) || null;
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }

  const systemPath = findExistingPath(SYSTEM_FFMPEG_CANDIDATES);
  if (systemPath) {
    return systemPath;
  }

  try {
    // ffmpeg-static exports the absolute path to a bundled ffmpeg binary
    return require('ffmpeg-static');
  } catch (_error) {
    // Not installed / not available on this platform - fall back to PATH lookup
    return null;
  }
}

function resolveFfprobePath() {
  if (process.env.FFPROBE_PATH) {
    return process.env.FFPROBE_PATH;
  }

  const systemPath = findExistingPath(SYSTEM_FFPROBE_CANDIDATES);
  if (systemPath) {
    return systemPath;
  }

  try {
    // @ffprobe-installer/ffprobe exports { path } to a bundled ffprobe binary
    return require('@ffprobe-installer/ffprobe').path;
  } catch (_error) {
    return null;
  }
}

const ffmpegPath = resolveFfmpegPath();
const ffprobePath = resolveFfprobePath();

if (ffmpegPath) {
  fluentFfmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  fluentFfmpeg.setFfprobePath(ffprobePath);
}

console.log(`🎬 ffmpeg path: ${ffmpegPath || '(system PATH)'}`);
console.log(`🎬 ffprobe path: ${ffprobePath || '(system PATH)'}`);

module.exports = {
  ffmpeg: fluentFfmpeg,
  ffmpegPath,
  ffprobePath,
};
