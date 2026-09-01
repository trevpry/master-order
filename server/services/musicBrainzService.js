/**
 * MusicBrainz API Service
 * Handles all interactions with the MusicBrainz API
 */

class MusicBrainzService {
  constructor() {
    this.baseUrl = 'https://musicbrainz.org/ws/2';
    this.userAgent = 'EddieLifeManagement/1.0.0 (https://github.com/yourusername/eddie)';
    this.rateLimit = 2000; // 2 seconds between requests (MusicBrainz allows 1 request per second)
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
   * Make a request to MusicBrainz API with retry logic
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
    let retryDelay = 2000; // Start with 2 second delay (MusicBrainz rate limiting)

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          // Check for 503 Service Temporarily Unavailable
          if (response.status === 503) {
            // Log the 503 error and wait before retrying
            console.log(`MusicBrainz API returned 503 (attempt ${attempt + 1}/${maxRetries + 1}). Waiting ${retryDelay / 1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff: 1s, 2s, 4s
            continue;
          }
          
          // For other errors, throw immediately
          throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Error during request attempt ${attempt + 1}:`, error);
        lastError = error;
        // If we've exhausted retries, throw the error
        if (attempt === maxRetries) {
          throw new Error(`MusicBrainz API error after ${maxRetries + 1} attempts: ${error.message}`);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff: 2s, 4s, 8s, 16s
      }
    }

    throw new Error(`MusicBrainz API error after ${maxRetries + 1} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
  }

  /**
   * Search for releases (albums)
   */
  async searchRelease(title, artist, limit = 10) {
    try {
      let query = `release:"${title}"`;
      if (artist) {
        query += ` AND artist:"${artist}"`;
      }

      const result = await this.request('release', {
        query,
        limit
      });

      return result.releases || [];
    } catch (error) {
      console.error('MusicBrainz release search error:', error);
      throw error;
    }
  }

  /**
   * Search for artists
   * Handles both Latin and non-Latin alphabet names
   */
  async searchArtist(name, limit = 10) {
    try {
      // For non-Latin alphabet names, search with artistaccent to preserve diacritics
      // For Latin names, use artist field
      const query = `artistaccent:"${name}"`;

      const result = await this.request('artist', {
        query,
        limit
      });

      return result.artists || [];
    } catch (error) {
      console.error('MusicBrainz artist search error:', error);
      throw error;
    }
  }

  /**
   * Search for artists by alias
   * Useful when the artist name doesn't match directly but aliases might
   */
  async searchArtistByAlias(name, limit = 10) {
    try {
      const query = `alias:"${name}"`;

      const result = await this.request('artist', {
        query,
        limit
      });

      return result.artists || [];
    } catch (error) {
      console.error('MusicBrainz artist alias search error:', error);
      throw error;
    }
  }

  /**
   * Search for artists by sort name
   * Useful for finding artists when you know their sort name format
   */
  async searchArtistBySortName(name, limit = 10) {
    try {
      const query = `sortname:"${name}"`;

      const result = await this.request('artist', {
        query,
        limit
      });

      return result.artists || [];
    } catch (error) {
      console.error('MusicBrainz artist sort name search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed release-group information by MBID
   */
  async getAlbumDetails(mbid) {
    try {
      return await this.request(`release-group/${mbid}`, {
        inc: 'artist-credits+releases+tags'
      });
    } catch (error) {
      console.error('MusicBrainz album details error:', error);
      throw error;
    }
  }

  /**
   * Get detailed release information by MBID
   */
  async getReleaseDetails(mbid) {
    try {
      return await this.request(`release/${mbid}`, {
        inc: 'artist-credits+labels+recordings+release-groups+media+tags+artist-rels+recording-rels+work-rels+work-level-rels'
      });
    } catch (error) {
      console.error('MusicBrainz release details error:', error);
      throw error;
    }
  }

  /**
   * Get album details by MBID, supporting both release and release-group IDs
   */
  async getRelease(mbid) {
    try {
      return await this.getReleaseDetails(mbid);
    } catch (error) {
      if (!String(error.message).includes('404')) {
        throw error;
      }

      const releaseGroup = await this.getAlbumDetails(mbid);
      const fallbackReleaseId = releaseGroup?.releases?.[0]?.id;

      if (!fallbackReleaseId) {
        return releaseGroup;
      }

      const release = await this.getReleaseDetails(fallbackReleaseId);
      return {
        ...release,
        releaseGroup
      };
    }
  }

  /**
   * Get detailed recording information by MBID
   */
  async getRecordingDetails(mbid) {
    try {
      return await this.request(`recording/${mbid}`, {
        inc: 'artist-credits+artist-rels+work-rels+work-level-rels+tags'
      });
    } catch (error) {
      console.error('MusicBrainz recording details error:', error);
      throw error;
    }
  }

  /**
   * Get detailed artist information by MBID
   */
  async getArtistDetails(mbid) {
    try {
      return await this.request(`artist/${mbid}`, {
        inc: 'aliases+tags+ratings'
      });
    } catch (error) {
      console.error('MusicBrainz artist details error:', error);
      throw error;
    }
  }

  /**
   * Get artist details by MBID (alias for getArtistDetails)
   */
  async getArtist(mbid) {
    return await this.getArtistDetails(mbid);
  }

  /**
   * Search for recordings by AcoustID fingerprint
   */
  async searchRecordingsByFingerprint(fingerprint, limit = 10) {
    try {
      const result = await this.request('recording', {
        query: `fingerprint:"${fingerprint}"`,
        limit
      });
      return result.recordings || [];
    } catch (error) {
      console.error('MusicBrainz recording fingerprint search error:', error);
      throw error;
    }
  }

  /**
   * Search for recordings by AcoustID
   */
  async searchRecordingsByAcoustId(acoustId, limit = 10) {
    try {
      const result = await this.request('recording', {
        query: `acoustid:"${acoustId}"`,
        limit
      });
      return result.recordings || [];
    } catch (error) {
      console.error('MusicBrainz recording AcoustID search error:', error);
      throw error;
    }
  }

  /**
   * Build a search query for an album
   */
  buildAlbumQuery(title, artist, year) {
    const parts = [];
    
    if (title) {
      parts.push(`release:"${title}"`);
    }
    
    if (artist) {
      parts.push(`artist:"${artist}"`);
    }
    
    if (year) {
      parts.push(`date:${year}`);
    }
    
    return parts.join(' AND ');
  }

  /**
   * Build a search query for an artist
   */
  buildArtistQuery(name, country) {
    const parts = [];
    
    if (name) {
      parts.push(`artist:"${name}"`);
    }
    
    if (country) {
      parts.push(`country:${country}`);
    }
    
    return parts.join(' AND ');
  }
}

module.exports = MusicBrainzService;
