/**
 * ComicVine Cache Service
 * Part of Eddie Life Management - Modular ComicVine Optimization
 * 
 * Provides intelligent caching for ComicVine API responses to reduce redundant queries
 * Follows modular architecture principles with reusable caching utilities
 */

class ComicVineCacheService {
  constructor(ttlMinutes = 60) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
    this.hitCount = 0;
    this.missCount = 0;
    
    // Cleanup expired entries every 10 minutes
    setInterval(() => this.cleanupExpired(), 10 * 60 * 1000);
  }

  /**
   * Generate cache key for different types of queries
   * @param {string} type - Type of query ('search', 'issue', 'series')
   * @param {object} params - Query parameters
   * @returns {string} Cache key
   */
  generateCacheKey(type, params) {
    const normalizedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = String(params[key]).toLowerCase().trim();
        return acc;
      }, {});
    
    return `${type}:${JSON.stringify(normalizedParams)}`;
  }

  /**
   * Get cached result if available and not expired
   * @param {string} cacheKey - Cache key
   * @returns {object|null} Cached result or null
   */
  get(cacheKey) {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      this.missCount++;
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      this.missCount++;
      return null;
    }
    
    this.hitCount++;
    console.log(`🎯 ComicVine cache HIT: ${cacheKey}`);
    return entry.data;
  }

  /**
   * Store result in cache with expiration
   * @param {string} cacheKey - Cache key
   * @param {object} data - Data to cache
   */
  set(cacheKey, data) {
    this.cache.set(cacheKey, {
      data: data,
      expiresAt: Date.now() + this.ttl,
      createdAt: Date.now()
    });
    
    console.log(`💾 ComicVine cache SET: ${cacheKey}`);
  }

  /**
   * Check if cache has unexpired entry
   * @param {string} cacheKey - Cache key
   * @returns {boolean} True if cached and not expired
   */
  has(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }
    
    return true;
  }

  /**
   * Remove expired entries from cache
   */
  cleanupExpired() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 ComicVine cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log(`🗑️ ComicVine cache cleared: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(1) : 0;
    
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate}%`,
      ttlMinutes: this.ttl / (60 * 1000)
    };
  }

  /**
   * Generate cache key for series search
   * @param {string} seriesName - Comic series name
   * @returns {string} Cache key
   */
  getSeriesSearchKey(seriesName) {
    return this.generateCacheKey('search', { query: seriesName });
  }

  /**
   * Generate cache key for issue lookup
   * @param {number} volumeId - ComicVine volume ID
   * @param {string|number} issueNumber - Issue number
   * @returns {string} Cache key
   */
  getIssueKey(volumeId, issueNumber) {
    return this.generateCacheKey('issue', { volumeId, issueNumber });
  }

  /**
   * Generate cache key for search-with-issues
   * @param {string} seriesName - Comic series name
   * @param {string|number} issueNumber - Issue number
   * @param {string} issueTitle - Optional issue title
   * @returns {string} Cache key
   */
  getSearchWithIssuesKey(seriesName, issueNumber, issueTitle = '') {
    return this.generateCacheKey('search-with-issues', { 
      query: seriesName, 
      issueNumber, 
      issueTitle 
    });
  }
}

module.exports = ComicVineCacheService;