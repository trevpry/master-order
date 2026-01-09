/**
 * MusicBrainz API Service
 * Handles all interactions with the MusicBrainz API
 */

class MusicBrainzService {
  constructor() {
    this.baseUrl = 'https://musicbrainz.org/ws/2';
    this.userAgent = 'EddieLifeManagement/1.0.0 (https://github.com/yourusername/eddie)';
    this.rateLimit = 1000; // 1 request per second
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
   * Make a request to MusicBrainz API
   */
  async request(endpoint, params = {}) {
    await this.waitForRateLimit();

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.append('fmt', 'json');
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
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

      const result = await this.request('release-group', {
        query,
        limit
      });

      return result['release-groups'] || [];
    } catch (error) {
      console.error('MusicBrainz release search error:', error);
      throw error;
    }
  }

  /**
   * Search for artists
   */
  async searchArtist(name, limit = 10) {
    try {
      const query = `artist:"${name}"`;

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
   * Get detailed album information by MBID
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
   * Get release details by MBID (alias for getAlbumDetails)
   */
  async getRelease(mbid) {
    return await this.getAlbumDetails(mbid);
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
