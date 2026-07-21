// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('../prismaClient');

/**
 * Thin REST client for Sonarr's v3 API.
 * See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 1).
 */
class SonarrService {
  constructor() {
    this.sonarrUrl = null;
    this.sonarrApiKey = null;
  }

  async ensureConfigLoaded() {
    if (!this.sonarrUrl || !this.sonarrApiKey) {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      this.sonarrUrl = (settings?.sonarrUrl || process.env.SONARR_URL || '').replace(/\/+$/, '');
      this.sonarrApiKey = settings?.sonarrApiKey || process.env.SONARR_API_KEY;

      if (!this.sonarrUrl) {
        throw new Error('Sonarr URL not configured. Set it in Settings or the SONARR_URL env var.');
      }
      if (!this.sonarrApiKey) {
        throw new Error('Sonarr API key not configured. Set it in Settings or the SONARR_API_KEY env var.');
      }
    }
  }

  /** Force settings to be reloaded on next request (e.g. after Settings are updated). */
  resetConfigCache() {
    this.sonarrUrl = null;
    this.sonarrApiKey = null;
  }

  async makeRequest(endpoint, options = {}) {
    await this.ensureConfigLoaded();

    const url = `${this.sonarrUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Api-Key': this.sonarrApiKey,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`Sonarr API request failed: ${response.status} ${response.statusText} ${bodyText}`.trim());
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

  /** Returns all series known to Sonarr (includes seasons[] summary, no episode-level detail). */
  async getSeries() {
    return this.makeRequest('/api/v3/series');
  }

  /** Returns Sonarr tag definitions so series tag IDs can be mapped to names. */
  async getTags() {
    return this.makeRequest('/api/v3/tag');
  }

  async getSeriesById(sonarrSeriesId) {
    return this.makeRequest(`/api/v3/series/${sonarrSeriesId}`);
  }

  /** Returns all episodes for a series (hasFile/episodeFileId, no embedded file details). */
  async getEpisodes(sonarrSeriesId) {
    return this.makeRequest(`/api/v3/episode?seriesId=${sonarrSeriesId}`);
  }

  /** Returns file details (path/size/mediaInfo) for every downloaded episode of a series. */
  async getEpisodeFiles(sonarrSeriesId) {
    return this.makeRequest(`/api/v3/episodefile?seriesId=${sonarrSeriesId}`);
  }
}

module.exports = SonarrService;
