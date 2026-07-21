const { ffmpeg } = require('../config/ffmpegConfig');
const prisma = require('../prismaClient');

/**
 * Probes movie/episode files with ffprobe to extract technical metadata
 * (resolution, codecs, audio/subtitle tracks, duration) and caches the
 * result on the Movie/Episode row so the streaming service (Phase 3) can
 * decide direct-play vs remux vs transcode without re-probing on every
 * playback request. See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md Phase 2.
 */
class MediaProbeService {
  /** Run ffprobe on a file, resolving with the raw ffprobe JSON output. */
  probeFile(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath).ffprobe((err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  /** Parse raw ffprobe JSON into the flat set of fields stored on Movie/Episode. */
  parseProbeResult(probeData) {
    const format = probeData?.format || {};
    const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];

    const videoStream = streams.find((stream) => stream.codec_type === 'video') || null;
    const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
    const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
    const primaryAudio = audioStreams[0] || null;

    let frameRate = null;
    if (videoStream?.r_frame_rate && videoStream.r_frame_rate.includes('/')) {
      const [numerator, denominator] = videoStream.r_frame_rate.split('/').map(Number);
      if (denominator) {
        frameRate = Math.round((numerator / denominator) * 1000) / 1000;
      }
    }

    const durationSeconds = format.duration
      ? parseFloat(format.duration)
      : (videoStream?.duration ? parseFloat(videoStream.duration) : null);

    return {
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      videoWidth: videoStream?.width ?? null,
      videoHeight: videoStream?.height ?? null,
      frameRate,
      videoCodec: videoStream?.codec_name ?? null,
      audioCodec: primaryAudio?.codec_name ?? null,
      audioChannels: primaryAudio?.channels ?? null,
      audioLanguage: primaryAudio?.tags?.language ?? null,
      audioTracksJson: JSON.stringify(audioStreams.map((stream) => ({
        index: stream.index,
        codec: stream.codec_name,
        channels: stream.channels ?? null,
        language: stream.tags?.language || null,
        title: stream.tags?.title || null,
      }))),
      subtitleTracksJson: JSON.stringify(subtitleStreams.map((stream) => ({
        index: stream.index,
        codec: stream.codec_name,
        language: stream.tags?.language || null,
        title: stream.tags?.title || null,
        forced: !!stream.disposition?.forced,
      }))),
      probedAt: new Date(),
      probeError: null,
    };
  }

  /** Probe a single Movie row (must have a resolved local filePath) and persist the result. */
  async probeMovie(movie) {
    if (!movie.filePath) {
      throw new Error(`Movie ${movie.id} ("${movie.title}") has no resolved filePath to probe`);
    }

    try {
      const raw = await this.probeFile(movie.filePath);
      const parsed = this.parseProbeResult(raw);
      const resolution = parsed.videoWidth && parsed.videoHeight
        ? `${parsed.videoWidth}x${parsed.videoHeight}`
        : movie.resolution;

      const data = {
        ...parsed,
        videoCodec: parsed.videoCodec || movie.videoCodec,
        audioCodec: parsed.audioCodec || movie.audioCodec,
        resolution,
      };

      await prisma.movie.update({ where: { id: movie.id }, data });
      return data;
    } catch (error) {
      await prisma.movie.update({
        where: { id: movie.id },
        data: { probeError: error.message, probedAt: new Date() },
      });
      throw error;
    }
  }

  /** Probe a single Episode row (must have a resolved local filePath) and persist the result. */
  async probeEpisode(episode) {
    if (!episode.filePath) {
      throw new Error(`Episode ${episode.id} has no resolved filePath to probe`);
    }

    try {
      const raw = await this.probeFile(episode.filePath);
      const parsed = this.parseProbeResult(raw);
      const resolution = parsed.videoWidth && parsed.videoHeight
        ? `${parsed.videoWidth}x${parsed.videoHeight}`
        : episode.resolution;

      const data = {
        ...parsed,
        videoCodec: parsed.videoCodec || episode.videoCodec,
        audioCodec: parsed.audioCodec || episode.audioCodec,
        resolution,
      };

      await prisma.episode.update({ where: { id: episode.id }, data });
      return data;
    } catch (error) {
      await prisma.episode.update({
        where: { id: episode.id },
        data: { probeError: error.message, probedAt: new Date() },
      });
      throw error;
    }
  }

  /** Run `worker` over `items` with at most `concurrency` in flight at once. */
  async runWithConcurrency(items, concurrency, worker) {
    const results = { succeeded: 0, failed: 0 };
    let cursor = 0;

    async function runNext() {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        try {
          await worker(item);
          results.succeeded += 1;
        } catch (error) {
          results.failed += 1;
          console.warn('Media probe failed:', error.message);
        }
      }
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => runNext()));

    return results;
  }

  /**
   * Probe every movie/episode that has a file but hasn't been probed yet
   * (or previously failed to probe). Safe to call repeatedly - already
   * probed rows are skipped unless `force` is set.
   */
  async probeAllUnprobed({ concurrency = 2, limit = 200, force = false } = {}) {
    const movieWhere = {
      hasFile: true,
      removed: false,
      filePath: { not: null },
      ...(force ? {} : { probedAt: null }),
    };
    const episodeWhere = {
      hasFile: true,
      removed: false,
      filePath: { not: null },
      ...(force ? {} : { probedAt: null }),
    };

    const [movies, episodes] = await Promise.all([
      prisma.movie.findMany({ where: movieWhere, take: limit }),
      prisma.episode.findMany({ where: episodeWhere, take: limit }),
    ]);

    console.log(`🔬 Probing ${movies.length} movie(s) and ${episodes.length} episode(s)...`);

    const movieResults = await this.runWithConcurrency(movies, concurrency, (movie) => this.probeMovie(movie));
    const episodeResults = await this.runWithConcurrency(episodes, concurrency, (episode) => this.probeEpisode(episode));

    const summary = {
      movies: { total: movies.length, ...movieResults },
      episodes: { total: episodes.length, ...episodeResults },
    };

    console.log('🔬 Media probe run complete:', summary);
    return summary;
  }
}

module.exports = MediaProbeService;
