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

  describeClient(userAgent = '') {
    if (!/Mozilla/i.test(userAgent)) {
      return /Android|Dalvik|ExoPlayer|okhttp/i.test(userAgent) ? 'Android app' : 'Media client';
    }
    const browser = [[/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/SamsungBrowser/, 'Samsung Internet'], [/Firefox|FxiOS/, 'Firefox'], [/Chrome|CriOS/, 'Chrome'], [/Safari/, 'Safari']]
      .find(([pattern]) => pattern.test(userAgent))?.[1] || 'Browser';
    const os = [[/Android/, 'Android'], [/iPhone|iPad|iPod/, 'iOS'], [/Windows/, 'Windows'], [/Mac OS X/, 'macOS'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']]
      .find(([pattern]) => pattern.test(userAgent))?.[1];
    return os ? `${browser} on ${os}` : browser;
  }

  updatePlayback(sessionId, track, isPlaying, { source = 'web_player', appName = null, clientAddress = null } = {}) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 128) {
      const error = new Error('A valid playback session ID is required');
      error.statusCode = 400;
      throw error;
    }
    const previous = this.sessions.get(sessionId);
    if (!track) {
      if (previous) console.log(`🎵 Music stopped on ${this.describe(previous)}: ${previous.title}`);
      this.sessions.delete(sessionId);
      return;
    }
    if (typeof track.title !== 'string' || !track.title.trim()) {
      const error = new Error('A track title is required');
      error.statusCode = 400;
      throw error;
    }
    const state = { sessionId, source, appName, clientAddress, isPlaying: isPlaying === true, updatedAt: this.now().toISOString() };
    for (const field of ['title', 'artist', 'album', 'ratingKey', 'artworkUrl', 'thumb', 'parentThumb', 'grandparentThumb', 'art']) {
      state[field] = typeof track[field] === 'string' ? track[field].slice(0, 2048) : null;
    }
    state.userRating = Number.isFinite(track.userRating) ? track.userRating : null;
    this.logTrackChange(previous, state);
    this.sessions.set(sessionId, state);
    this.getCurrentPlayback();
  }

  // Server-observed stream; used when the client does not report its own state.
  recordStream(sessionId, track, { appName = null, clientAddress = null } = {}) {
    this.prune();
    const ratingKey = track?.ratingKey != null ? String(track.ratingKey) : null;
    if (!sessionId || !ratingKey || !track.title) return;
    const previous = this.sessions.get(sessionId);
    if (previous && previous.source !== 'server_stream' && previous.ratingKey === ratingKey) return;
    const now = this.now();
    const durationMs = Number(track.duration) > 0 ? Number(track.duration) : null;
    const state = {
      sessionId, source: 'server_stream', appName, clientAddress, isPlaying: true,
      title: track.title, artist: track.originalTitle || track.grandparentTitle || null, album: track.parentTitle || null,
      ratingKey, artworkUrl: null, thumb: track.thumb || null, parentThumb: track.parentThumb || null,
      grandparentThumb: track.grandparentThumb || null, art: track.art || null,
      userRating: Number.isFinite(track.userRating) ? track.userRating : null,
      durationMs, updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (durationMs || 15000) + 30000).toISOString()
    };
    this.logTrackChange(previous, state);
    this.sessions.set(sessionId, state);
  }

  describe(state) {
    return [state.source, state.appName].filter(Boolean).join(' / ');
  }

  logTrackChange(previous, next) {
    if (previous && previous.ratingKey === next.ratingKey && previous.title === next.title) return;
    console.log(`🎵 Now playing on ${this.describe(next)}: ${next.title}${next.artist ? ` — ${next.artist}` : ''}`);
  }

  prune() {
    const now = this.now().getTime();
    for (const [sessionId, state] of this.sessions) {
      const expired = state.expiresAt ? now > Date.parse(state.expiresAt) : now - Date.parse(state.updatedAt) > 45000;
      if (expired) this.sessions.delete(sessionId);
    }
  }

  getCurrentPlayback() {
    this.prune();
    return [...this.sessions.values()].sort((left, right) =>
      Number(right.isPlaying) - Number(left.isPlaying) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    )[0] || null;
  }

  getActivePlayback() {
    this.prune();
    const now = this.now().getTime();
    const android = [...this.androidPlays.values()].map(play => play.state).filter(state => {
      const remaining = state.durationMs > 0 && state.positionMs !== null ? state.durationMs - state.positionMs : null;
      const ttl = state.isPlaying && remaining !== null ? Math.max(remaining, 0) + 60000 : 600000;
      return now - Date.parse(state.updatedAt) <= ttl;
    });
    const all = [...this.sessions.values(), ...android];
    const speakerTracks = new Set(all.filter(s => s.source === 'sonos' && s.ratingKey).map(s => String(s.ratingKey)));
    const reportingAddresses = new Set(all.filter(s => s.source !== 'server_stream' && s.clientAddress).map(s => s.clientAddress));
    return all.filter(s => {
      // The tab controlling a speaker also reports/streams the same track.
      if ((s.source === 'web_player' || s.source === 'server_stream') && s.ratingKey && speakerTracks.has(String(s.ratingKey))) return false;
      return !(s.source === 'server_stream' && s.clientAddress && reportingAddresses.has(s.clientAddress));
    }).sort((left, right) =>
      Number(right.isPlaying) - Number(left.isPlaying) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    );
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
      appName: text(payload.appName), clientAddress: text(payload.clientAddress), updatedAt: this.now().toISOString()
    };
    for (const field of ['artworkUrl', 'thumb', 'parentThumb', 'grandparentThumb', 'art']) state[field] = text(payload[field]);
    const sessionId = String(payload.deviceId || payload.sessionId || 'android-default').slice(0, 128);
    state.deviceId = sessionId;
    state.sessionId = `android:${sessionId}`;
    const identity = state.ratingKey || JSON.stringify([state.title, state.artist, state.album]);
    let play = this.androidPlays.get(sessionId);
    const previousState = play?.state;
    const restarted = play?.recorded && state.isPlaying && state.positionMs !== null && state.positionMs <= 1000 && play.positionMs > 1000;
    const sameTrack = play && (play.identity === identity || (state.ratingKey && play.state.ratingKey === state.ratingKey));
    if (!sameTrack || restarted || (payload.playbackId && play.playbackId !== payload.playbackId)) {
      if (play && play.durationMs > 0 && play.positionMs >= play.durationMs * 0.9) await this.completeAndroidPlay(play);
      play = { identity, playbackId: payload.playbackId || null, state, positionMs: 0, durationMs: null, recorded: false, request: null };
      this.androidPlays.set(sessionId, play);
    }
    state.ratingKey = state.ratingKey || play.state.ratingKey;
    this.logTrackChange(previousState, state);
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
      console.log(`🎵 Music stopped on ${this.describe(play.state)}: ${play.state.title}`);
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