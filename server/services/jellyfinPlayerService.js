/**
 * Remote playback on Jellyfin clients (replaces the Plex player service for
 * movies/TV). Players are Jellyfin sessions that support remote control.
 * The stored player id (Settings.selectedPlayer) is the Jellyfin DeviceId,
 * which is stable across sessions; it's resolved to the live session id at
 * play time.
 */
const jellyfin = require('./jellyfinService');
const { ticksToMs } = require('./jellyfinService');
const prisma = require('../prismaClient');

function formatSession(session) {
  const nowPlaying = session.NowPlayingItem;
  return {
    machineIdentifier: session.DeviceId,
    deviceId: session.DeviceId,
    sessionId: session.Id,
    name: session.DeviceName,
    product: session.Client,
    platform: session.Client,
    version: session.ApplicationVersion,
    userName: session.UserName || null,
    supportsRemoteControl: !!session.SupportsRemoteControl,
    lastActivity: session.LastActivityDate,
    state: nowPlaying ? (session.PlayState?.IsPaused ? 'paused' : 'playing') : 'idle',
    nowPlaying: nowPlaying ? {
      ratingKey: nowPlaying.Id,
      title: nowPlaying.Name,
      type: nowPlaying.Type === 'Episode' ? 'episode' : nowPlaying.Type === 'Movie' ? 'movie' : String(nowPlaying.Type || '').toLowerCase(),
      seriesTitle: nowPlaying.SeriesName || null,
      seasonNumber: nowPlaying.ParentIndexNumber ?? null,
      episodeNumber: nowPlaying.IndexNumber ?? null,
      durationMs: ticksToMs(nowPlaying.RunTimeTicks),
      positionMs: ticksToMs(session.PlayState?.PositionTicks)
    } : null
  };
}

class JellyfinPlayerService {
  async getPlayers() {
    const sessions = await jellyfin.getSessions({ controllableOnly: true });
    const byDevice = new Map();
    for (const s of sessions) {
      const existing = byDevice.get(s.DeviceId);
      if (!existing || new Date(s.LastActivityDate) > new Date(existing.LastActivityDate)) {
        byDevice.set(s.DeviceId, s);
      }
    }
    return [...byDevice.values()].map(formatSession);
  }

  async getAllSessions() {
    const sessions = await jellyfin.getSessions();
    return sessions.map(formatSession);
  }

  async resolveSession(playerId) {
    const sessions = await jellyfin.getSessions({ controllableOnly: true });
    const matches = sessions
      .filter(s => s.DeviceId === playerId || s.Id === playerId)
      .sort((a, b) => new Date(b.LastActivityDate) - new Date(a.LastActivityDate));
    return matches[0] || null;
  }

  async getSelectedPlayerId() {
    const settings = await prisma.settings.findFirst();
    return settings?.selectedPlayer || null;
  }

  /**
   * Start playback of a Jellyfin item on a client.
   * @param {string} playerId DeviceId or session id (defaults to the selected player)
   * @param {string} itemId Jellyfin item id
   * @param {number} offsetMs start position in milliseconds
   */
  async playMedia(playerId, itemId, offsetMs = 0) {
    const target = playerId || await this.getSelectedPlayerId();
    if (!target) {
      return { success: false, error: 'No player specified and no default player selected in settings' };
    }
    const session = await this.resolveSession(target);
    if (!session) {
      return { success: false, error: `Jellyfin player ${target} is not online or does not support remote control` };
    }
    try {
      await jellyfin.playOnSession(session.Id, itemId, offsetMs);
      return {
        success: true,
        message: `Playback started on ${session.DeviceName}`,
        player: formatSession(session),
        ratingKey: itemId
      };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async controlPlayback(playerId, action, options = {}) {
    const target = playerId || await this.getSelectedPlayerId();
    const session = target ? await this.resolveSession(target) : null;
    if (!session) {
      return { success: false, error: 'Selected Jellyfin player is not online' };
    }
    const map = { play: 'Unpause', resume: 'Unpause', pause: 'Pause', stop: 'Stop', skipNext: 'NextTrack', skipPrevious: 'PreviousTrack', seekTo: 'Seek' };
    const command = map[action];
    if (!command) return { success: false, error: `Unsupported action ${action}` };
    try {
      if (command === 'Seek') {
        const ms = Number(options.offset ?? options.positionMs ?? 0);
        await jellyfin.post(`/Sessions/${session.Id}/Playing/Seek`, undefined, { seekPositionTicks: Math.round(ms * 10000) });
      } else {
        await jellyfin.sendPlaystateCommand(session.Id, command);
      }
      return { success: true, action, player: session.DeviceName };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getDeviceStatus(playerId) {
    const session = await this.resolveSession(playerId);
    if (!session) {
      return { online: false, machineIdentifier: playerId };
    }
    return { online: true, ...formatSession(session) };
  }
}

module.exports = new JellyfinPlayerService();
module.exports.JellyfinPlayerService = JellyfinPlayerService;
module.exports.formatSession = formatSession;
