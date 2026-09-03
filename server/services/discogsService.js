/**
 * Discogs API Service
 * Handles all interactions with the Discogs API
 */

class DiscogsService {
  constructor() {
    this.baseUrl = 'https://api.discogs.com';
    this.userAgent = 'EddieLifeManagement/1.0.0 (https://github.com/yourusername/eddie)';
    this.rateLimit = 60000 / 60; // 1000ms between requests (60 requests per minute)
    this.lastRequestTime = 0;
  }

  /**
   * Rate limiting helper
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a request to Discogs API with retry logic
   */
  async request(endpoint, params = {}, maxRetries = 3) {
    await this.waitForRateLimit();

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.append('fmt', 'json');
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    let lastError = null;
    let retryDelay = 1000; // Start with 1 second delay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/vnd.discogs.v2.json',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          // Check for 429 Rate Limited
          if (response.status === 429) {
            // Log the 429 error and wait before retrying
            console.log(`Discogs API returned 429 (attempt ${attempt + 1}/${maxRetries + 1}). Waiting ${retryDelay / 1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff: 1s, 2s, 4s
            continue;
          }
          
          // For other errors, throw immediately
          throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Error during request attempt ${attempt + 1}:`, error);
        lastError = error;
        // If we've exhausted retries, throw the error
        if (attempt === maxRetries) {
          throw new Error(`Discogs API error after ${maxRetries + 1} attempts: ${error.message}`);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff: 2s, 4s, 8s, 16s
      }
    }

    throw new Error(`Discogs API error after ${maxRetries + 1} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
  }

  /**
   * Get release details by ID
   */
  async getRelease(releaseId) {
    try {
      const result = await this.request(`releases/${releaseId}`);
      // Discogs returns { data: {...} } for release endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error fetching release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * Search for releases by title and artist
   */
  async searchReleases(title, artist, limit = 10) {
    try {
      const params = {
        q: `release:"${title}"`,
        type: 'release',
        limit
      };

      if (artist) {
        params.q += ` AND artist:"${artist}"`;
      }

      const result = await this.request('master', params);
      // Discogs returns { data: {...} } for search endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error searching releases for "${title}" by "${artist}":`, error);
      throw error;
    }
  }

  /**
   * Get artist details by ID
   */
  async getArtist(artistId) {
    try {
      const result = await this.request(`artists/${artistId}`);
      // Discogs returns { data: {...} } for artist endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error fetching artist ${artistId}:`, error);
      throw error;
    }
  }

  /**
   * Search for artists by name
   */
  async searchArtists(name, limit = 10) {
    try {
      const params = {
        q: `name:"${name}"`,
        type: 'artist',
        limit
      };

      const result = await this.request('master', params);
      // Discogs returns { data: {...} } for search endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error searching artists for "${name}":`, error);
      throw error;
    }
  }

  /**
   * Get label details by ID
   */
  async getLabel(labelId) {
    try {
      const result = await this.request(`labels/${labelId}`);
      // Discogs returns { data: {...} } for label endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error fetching label ${labelId}:`, error);
      throw error;
    }
  }

  /**
   * Search for labels by name
   */
  async searchLabels(name, limit = 10) {
    try {
      const params = {
        q: `name:"${name}"`,
        type: 'label',
        limit
      };

      const result = await this.request('master', params);
      // Discogs returns { data: {...} } for search endpoints
      return result.data || result;
    } catch (error) {
      console.error(`Error searching labels for "${name}":`, error);
      throw error;
    }
  }
}

module.exports = DiscogsService;
