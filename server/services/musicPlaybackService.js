class MusicPlaybackService {
  constructor(prisma, { fetchImpl = require('node-fetch'), now = () => new Date() } = {}) {
    this.prisma = prisma;
    this.fetch = fetchImpl;
    this.now = now;
    this.sessions = new Map();
    this.androidPlays = new Map();
  }

  static getInstance() {
    if (!this.instance) this.instance = new MusicPlaybackService(require('../prismaClient'));
    return this.instance;
  }

  updatePlayback(sessionId, track, isPlaying) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 128) {
      const error = new Error('A valid playback session ID is required');
      error.statusCode = 400;
      throw error;
    }
    if (!track) {
      this.sessions.delete(sessionId);
      return;
    }
    if (typeof track.title !== 'string' || !track.title.trim()) {
      const error = new Error('A track title is required');
      error.statusCode = 400;
      throw error;
    }
    const state = { source: 'web_player', isPlaying: isPlaying === true, updatedAt: this.now().toISOString() };
    for (const field of ['title', 'artist', 'album', 'ratingKey', 'artworkUrl', 'thumb', 'parentThumb', 'grandparentThumb', 'art']) {
      state[field] = typeof track[field] === 'string' ? track[field].slice(0, 2048) : null;
    }
    state.userRating = Number.isFinite(track.userRating) ? track.userRating : null;
    this.sessions.set(sessionId, state);
    this.getCurrentPlayback();
  }

  getCurrentPlayback() {
    const now = this.now().getTime();
    for (const [sessionId, state] of this.sessions) {
      if (now - Date.parse(state.updatedAt) > 45000) this.sessions.delete(sessionId);
    }
    return [...this.sessions.values()].sort((left, right) =>
      Number(right.isPlaying) - Number(left.isPlaying) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    )[0] || null;
  }

  async updateAndroidPlayback(payload = {}) {
    if (payload && !payload.title && payload.ratingKey !== null && payload.ratingKey !== undefined) {
      const track = await this.prisma.plexTrack.findUnique({ where: { ratingKey: String(payload.ratingKey) }, select: { title: true } });
      if (track) payload = { ...payload, title: track.title };
    }
    if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) return null;
    const text = value => typeof value === 'string' ? value.trim().slice(0, 2048) || null : null;
    const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const state = {
      title: text(payload.title), artist: text(payload.artist), album: text(payload.album),
      ratingKey: payload.ratingKey !== null && payload.ratingKey !== undefined ? String(payload.ratingKey).trim() || null : null,
      isPlaying: payload.isPlaying === undefined ? true : payload.isPlaying === true,
      positionMs: number(payload.positionMs), durationMs: number(payload.durationMs),
      userRating: number(payload.userRating), source: 'android_app',
      appName: text(payload.appName), updatedAt: this.now().toISOString()
    };
    for (const field of ['artworkUrl', 'thumb', 'parentThumb', 'grandparentThumb', 'art']) state[field] = text(payload[field]);
    const sessionId = String(payload.deviceId || payload.sessionId || 'android-default').slice(0, 128);
    state.deviceId = sessionId;
    const identity = state.ratingKey || JSON.stringify([state.title, state.artist, state.album]);
    let play = this.androidPlays.get(sessionId);
    const restarted = play?.recorded && state.isPlaying && state.positionMs !== null && state.positionMs <= 1000 && play.positionMs > 1000;
    const sameTrack = play && (play.identity === identity || (state.ratingKey && play.state.ratingKey === state.ratingKey));
    if (!sameTrack || restarted || (payload.playbackId && play.playbackId !== payload.playbackId)) {
      if (play && play.durationMs > 0 && play.positionMs >= play.durationMs * 0.9) await this.completeAndroidPlay(play);
      play = { identity, playbackId: payload.playbackId || null, state, positionMs: 0, durationMs: null, recorded: false, request: null };
      this.androidPlays.set(sessionId, play);
    }
    state.ratingKey = state.ratingKey || play.state.ratingKey;
    play.state = state;
    if (state.positionMs !== null) play.positionMs = Math.max(play.positionMs, state.positionMs);
    if (state.durationMs > 0) play.durationMs = state.durationMs;
    if (payload.completed === true || payload.isCompleted === true || payload.playbackState === 'ended' || (play.durationMs > 0 && play.positionMs >= play.durationMs)) {
      await this.completeAndroidPlay(play);
    }
    return state;
  }

  async completeAndroidPlay(play) {
    if (play.recorded) return;
    if (!play.request) {
      play.request = (async () => {
        let ratingKey = play.state.ratingKey;
        if (!ratingKey) {
          const candidates = await this.prisma.plexTrack.findMany({
            where: {
              removed: false,
              AND: [
                { OR: [{ title: play.state.title }, { userTitle: play.state.title }] },
                ...(play.state.album ? [{ album: { OR: [{ title: play.state.album }, { userTitle: play.state.album }] } }] : []),
                ...(play.state.artist ? [{ OR: [
                  { originalTitle: play.state.artist },
                  { album: { artist: { OR: [{ title: play.state.artist }, { userTitle: play.state.artist }] } } }
                ] }] : [])
              ]
            },
            select: { ratingKey: true },
            take: 2
          });
          if (candidates.length === 1) ratingKey = candidates[0].ratingKey;
        }
        if (ratingKey) {
          await this.recordPlay(ratingKey);
          play.state.ratingKey = ratingKey;
        }
        play.recorded = true;
      })().catch(error => {
        play.request = null;
        throw error;
      });
    }
    await play.request;
  }

  async stopAndroidPlayback(payload = {}) {
    const sessionId = String(payload.deviceId || payload.sessionId || 'android-default').slice(0, 128);
    const play = this.androidPlays.get(sessionId);
    if (play) {
      await this.updateAndroidPlayback({ ...play.state, ...payload, deviceId: sessionId, isPlaying: false });
      if (play.durationMs > 0 && play.positionMs >= play.durationMs * 0.9) await this.completeAndroidPlay(play);
      this.androidPlays.delete(sessionId);
    }
  }

  async recordPlay(ratingKey) {
    const track = await this.prisma.plexTrack.findUnique({ where: { ratingKey } });
    if (!track) {
      const error = new Error('Track not found');
      error.statusCode = 404;
      throw error;
    }
    const updated = await this.prisma.plexTrack.update({
      where: { ratingKey },
      data: {
        viewCount: track.viewCount === null ? 1 : { increment: 1 },
        lastViewedAt: this.now()
      }
    });
    let plexUpdated = false;
    try {
      const settings = await this.prisma.settings.findFirst();
      if (settings?.plexUrl && settings?.plexToken) {
        const duration = String(track.duration || 180000);
        const timelineParams = new URLSearchParams({ ratingKey, key: track.key || `/library/metadata/${ratingKey}`, state: 'stopped', time: duration, duration, 'X-Plex-Token': settings.plexToken });
        const scrobbleParams = new URLSearchParams({ key: ratingKey, identifier: 'com.plexapp.plugins.library', 'X-Plex-Token': settings.plexToken });
        const responses = await Promise.allSettled([
          this.fetch(`${settings.plexUrl}/:/timeline?${timelineParams}`, { headers: { Accept: 'application/json' }, timeout: 10000 }),
          this.fetch(`${settings.plexUrl}/:/scrobble?${scrobbleParams}`, { headers: { Accept: 'application/json' }, timeout: 10000 })
        ]);
        plexUpdated = responses.some(response => response.status === 'fulfilled' && response.value.ok);
      }
    } catch {
      console.warn('Music play recorded locally; Plex synchronization unavailable');
    }
    return { message: 'Track marked as played', viewCount: updated.viewCount, lastViewedAt: updated.lastViewedAt, plexUpdated };
  }
}

module.exports = MusicPlaybackService;