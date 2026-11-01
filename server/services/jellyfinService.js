/**
 * Jellyfin API client.
 *
 * Jellyfin is the source of truth for movies and TV episodes (Plex is only
 * used for music). Configuration is read from the Settings row
 * (jellyfinUrl / jellyfinApiKey / jellyfinUserId) with JELLYFIN_URL /
 * JELLYFIN_API_KEY / JELLYFIN_USER_ID environment variables as fallbacks.
 */
const axios = require('axios');
const crypto = require('crypto');
const { getSettings } = require('../databaseUtils');

const CLIENT_NAME = 'Master Order';
const CLIENT_VERSION = '1.0.0';
const DEVICE_NAME = 'Master Order Server';
const DEVICE_ID = 'master-order-server';
const TICKS_PER_MS = 10000;

const ITEM_FIELDS = [
  'ProviderIds', 'Path', 'Overview', 'Genres', 'Studios', 'People', 'DateCreated',
  'PremiereDate', 'ProductionYear', 'OfficialRating', 'CommunityRating', 'CriticRating',
  'MediaSources', 'Taglines', 'SortName', 'ParentId', 'ChildCount', 'RecursiveItemCount',
  'Tags', 'ImageTags', 'BackdropImageTags', 'Chapters', 'OriginalTitle', 'Status', 'EndDate'
].join(',');

function normalizeUrl(url) {
  if (!url) return null;
  return String(url).trim().replace(/\/+$/, '');
}

function isJellyfinId(value) {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value.replace(/-/g, ''));
}

function ticksToMs(ticks) {
  if (ticks === null || ticks === undefined) return null;
  return Math.round(Number(ticks) / TICKS_PER_MS);
}

function msToTicks(ms) {
  if (ms === null || ms === undefined) return 0;
  return Math.round(Number(ms) * TICKS_PER_MS);
}

function dateToUnixSeconds(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

/**
 * Convert Jellyfin ProviderIds into Plex-style guid strings
 * (imdb://tt123, tmdb://456, tvdb://789) which the rest of the codebase
 * already understands.
 */
function providerIdsToGuids(providerIds = {}) {
  const guids = [];
  for (const [key, value] of Object.entries(providerIds || {})) {
    if (!value) continue;
    const k = key.toLowerCase();
    if (k === 'imdb') guids.push(`imdb://${value}`);
    else if (k === 'tmdb') guids.push(`tmdb://${value}`);
    else if (k === 'tvdb') guids.push(`tvdb://${value}`);
  }
  return guids;
}

class JellyfinService {
  constructor(config = null) {
    this.overrideConfig = config;
  }

  async getConfig() {
    if (this.overrideConfig) {
      return {
        url: normalizeUrl(this.overrideConfig.url),
        apiKey: this.overrideConfig.apiKey,
        userId: this.overrideConfig.userId || null
      };
    }
    let settings = null;
    try {
      settings = await getSettings();
    } catch (error) {
      settings = null;
    }
    return {
      url: normalizeUrl(settings?.jellyfinUrl || process.env.JELLYFIN_URL),
      apiKey: settings?.jellyfinApiKey || process.env.JELLYFIN_API_KEY || null,
      userId: settings?.jellyfinUserId || process.env.JELLYFIN_USER_ID || null
    };
  }

  async isConfigured() {
    const cfg = await this.getConfig();
    return !!(cfg.url && cfg.apiKey);
  }

  buildAuthHeader(apiKey, deviceId = DEVICE_ID) {
    return `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${deviceId}", Version="${CLIENT_VERSION}", Token="${apiKey}"`;
  }

  async request(method, path, { params, data, timeout = 30000, responseType } = {}) {
    const cfg = await this.getConfig();
    if (!cfg.url || !cfg.apiKey) {
      throw new Error('Jellyfin is not configured (jellyfinUrl / jellyfinApiKey missing)');
    }
    const response = await axios({
      method,
      url: `${cfg.url}${path.startsWith('/') ? path : `/${path}`}`,
      params,
      data,
      timeout,
      responseType,
      headers: {
        Authorization: this.buildAuthHeader(cfg.apiKey),
        Accept: 'application/json',
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {})
      }
    });
    return response.data;
  }

  get(path, params, opts = {}) {
    return this.request('GET', path, { ...opts, params });
  }

  post(path, data = {}, params, opts = {}) {
    return this.request('POST', path, { ...opts, data, params });
  }

  delete(path, params, opts = {}) {
    return this.request('DELETE', path, { ...opts, params });
  }

  /**
   * Resolve the Jellyfin user used for watch state. Uses the configured user
   * id, otherwise the first administrator (or first user) on the server.
   */
  async getUserId() {
    const cfg = await this.getConfig();
    if (cfg.userId) return cfg.userId;
    if (this._cachedUserId) return this._cachedUserId;
    const users = await this.getUsers();
    const admin = users.find(u => u.Policy?.IsAdministrator) || users[0];
    if (!admin) throw new Error('No Jellyfin users found');
    this._cachedUserId = admin.Id;
    return admin.Id;
  }

  async getUsers() {
    return this.get('/Users');
  }

  async getSystemInfo() {
    return this.get('/System/Info');
  }

  async testConnection() {
    const info = await this.getSystemInfo();
    const libraries = await this.getVideoLibraries();
    return {
      serverName: info.ServerName,
      version: info.Version,
      id: info.Id,
      libraries: libraries.map(l => ({ id: l.ItemId, name: l.Name, type: l.CollectionType }))
    };
  }

  /** All libraries ("virtual folders") on the server. */
  async getLibraries() {
    return this.get('/Library/VirtualFolders');
  }

  /** Every movie and TV library - all of them are always considered. */
  async getVideoLibraries() {
    const libs = await this.getLibraries();
    return (libs || []).filter(l => l.CollectionType === 'movies' || l.CollectionType === 'tvshows');
  }

  /**
   * Fetch all items for a query, transparently paging through results.
   */
  async getAllItems(params, { pageSize = 500, onPage } = {}) {
    const userId = params.userId || await this.getUserId();
    const items = [];
    let startIndex = 0;
    let total = Infinity;
    while (startIndex < total) {
      const page = await this.get('/Items', {
        Fields: ITEM_FIELDS,
        EnableUserData: true,
        ...params,
        userId,
        StartIndex: startIndex,
        Limit: pageSize
      }, { timeout: 120000 });
      const pageItems = page?.Items || [];
      total = typeof page?.TotalRecordCount === 'number' ? page.TotalRecordCount : pageItems.length;
      items.push(...pageItems);
      if (onPage) await onPage(pageItems, { startIndex, total });
      if (pageItems.length === 0) break;
      startIndex += pageItems.length;
    }
    return items;
  }

  async getItem(itemId) {
    const userId = await this.getUserId();
    return this.get(`/Items/${itemId}`, { userId, Fields: ITEM_FIELDS });
  }

  async getItems(ids) {
    if (!ids || ids.length === 0) return [];
    const userId = await this.getUserId();
    const result = await this.get('/Items', { userId, Ids: ids.join(','), Fields: ITEM_FIELDS, EnableUserData: true });
    return result?.Items || [];
  }

  async getCollections() {
    return this.getAllItems({ IncludeItemTypes: 'BoxSet', Recursive: true, SortBy: 'SortName' });
  }

  async getCollectionChildren(collectionId) {
    return this.getAllItems({ ParentId: collectionId });
  }

  async searchItems(searchTerm, types = ['Movie', 'Series', 'Episode'], limit = 25) {
    const userId = await this.getUserId();
    const result = await this.get('/Items', {
      userId,
      SearchTerm: searchTerm,
      IncludeItemTypes: types.join(','),
      Recursive: true,
      Limit: limit,
      Fields: ITEM_FIELDS
    });
    return result?.Items || [];
  }

  async getSeriesEpisodes(seriesId) {
    const userId = await this.getUserId();
    const result = await this.get(`/Shows/${seriesId}/Episodes`, { userId, Fields: ITEM_FIELDS });
    return result?.Items || [];
  }

  async markPlayed(itemId, datePlayed = null) {
    const userId = await this.getUserId();
    const params = { userId };
    if (datePlayed) params.datePlayed = new Date(datePlayed).toISOString();
    return this.post(`/UserPlayedItems/${itemId}`, undefined, params);
  }

  async markUnplayed(itemId) {
    const userId = await this.getUserId();
    return this.delete(`/UserPlayedItems/${itemId}`, { userId });
  }

  async getSessions({ controllableOnly = false } = {}) {
    const params = { activeWithinSeconds: 960 };
    const sessions = await this.get('/Sessions', params);
    return (sessions || []).filter(s => !controllableOnly || s.SupportsRemoteControl);
  }

  async playOnSession(sessionId, itemIds, startPositionMs = 0) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    const params = { playCommand: 'PlayNow', itemIds: ids.join(',') };
    if (startPositionMs) params.startPositionTicks = msToTicks(startPositionMs);
    return this.post(`/Sessions/${sessionId}/Playing`, undefined, params);
  }

  async sendPlaystateCommand(sessionId, command) {
    const map = { pause: 'Pause', play: 'Unpause', resume: 'Unpause', unpause: 'Unpause', stop: 'Stop', playpause: 'PlayPause', next: 'NextTrack', previous: 'PreviousTrack' };
    const cmd = map[String(command).toLowerCase()] || command;
    return this.post(`/Sessions/${sessionId}/Playing/${cmd}`);
  }

  async reportPlaybackStart(body) {
    return this.post('/Sessions/Playing', body);
  }

  async reportPlaybackProgress(body) {
    return this.post('/Sessions/Playing/Progress', body);
  }

  async reportPlaybackStopped(body) {
    return this.post('/Sessions/Playing/Stopped', body);
  }

  /** Path (relative to the server) for an item's image, used with /api/artwork proxy. */
  static imagePath(itemId, type = 'Primary') {
    if (!itemId) return null;
    return `/Items/${itemId}/Images/${type}`;
  }

  async getImageUrl(itemId, type = 'Primary', { maxWidth } = {}) {
    const cfg = await this.getConfig();
    if (!cfg.url) return null;
    const params = new URLSearchParams();
    if (maxWidth) params.set('maxWidth', String(maxWidth));
    params.set('api_key', cfg.apiKey);
    return `${cfg.url}/Items/${itemId}/Images/${type}?${params.toString()}`;
  }

  async getStreamUrl(itemId, { mediaSourceId, includeApiKey = true } = {}) {
    const cfg = await this.getConfig();
    const params = new URLSearchParams({ static: 'true' });
    if (mediaSourceId) params.set('mediaSourceId', mediaSourceId);
    if (includeApiKey) params.set('api_key', cfg.apiKey);
    return `${cfg.url}/Videos/${itemId}/stream?${params.toString()}`;
  }

  async getHlsUrl(itemId, { mediaSourceId, playSessionId, deviceId } = {}) {
    const cfg = await this.getConfig();
    const params = new URLSearchParams({
      MediaSourceId: mediaSourceId || itemId,
      VideoCodec: 'h264',
      AudioCodec: 'aac,mp3',
      PlaySessionId: playSessionId || crypto.randomUUID().replace(/-/g, ''),
      DeviceId: deviceId || DEVICE_ID,
      api_key: cfg.apiKey
    });
    return `${cfg.url}/Videos/${itemId}/master.m3u8?${params.toString()}`;
  }

  /** Web UI deep link for an item. */
  async getWebUrl(itemId) {
    const cfg = await this.getConfig();
    return cfg.url ? `${cfg.url}/web/#/details?id=${itemId}` : null;
  }
}

const jellyfinService = new JellyfinService();

module.exports = jellyfinService;
module.exports.JellyfinService = JellyfinService;
module.exports.isJellyfinId = isJellyfinId;
module.exports.ticksToMs = ticksToMs;
module.exports.msToTicks = msToTicks;
module.exports.dateToUnixSeconds = dateToUnixSeconds;
module.exports.providerIdsToGuids = providerIdsToGuids;
module.exports.ITEM_FIELDS = ITEM_FIELDS;
