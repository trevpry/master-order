// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('../prismaClient');

/**
 * Thin REST client for Radarr's v3 API.
 * See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 1).
 */
class RadarrService {
  constructor() {
    this.radarrUrl = null;
    this.radarrApiKey = null;
  }

  async ensureConfigLoaded() {
    if (!this.radarrUrl || !this.radarrApiKey) {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      this.radarrUrl = (settings?.radarrUrl || process.env.RADARR_URL || '').replace(/\/+$/, '');
      this.radarrApiKey = settings?.radarrApiKey || process.env.RADARR_API_KEY;

      if (!this.radarrUrl) {
        throw new Error('Radarr URL not configured. Set it in Settings or the RADARR_URL env var.');
      }
      if (!this.radarrApiKey) {
        throw new Error('Radarr API key not configured. Set it in Settings or the RADARR_API_KEY env var.');
      }
    }
  }

  /** Force settings to be reloaded on next request (e.g. after Settings are updated). */
  resetConfigCache() {
    this.radarrUrl = null;
    this.radarrApiKey = null;
  }

  async makeRequest(endpoint, options = {}) {
    await this.ensureConfigLoaded();

    const url = `${this.radarrUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Api-Key': this.radarrApiKey,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`Radarr API request failed: ${response.status} ${response.statusText} ${bodyText}`.trim());
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection() {
    const status = await this.makeRequest('/api/v3/system/status');
    return {
      version: status?.version,
      instanceName: status?.instanceName,
    };
  }

  /** Returns all movies known to Radarr, including embedded movieFile/mediaInfo when present. */
  async getMovies() {
    return this.makeRequest('/api/v3/movie');
  }

  async getMovie(radarrId) {
    return this.makeRequest(`/api/v3/movie/${radarrId}`);
  }
}

module.exports = RadarrService;
