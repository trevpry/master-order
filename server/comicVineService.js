const axios = require('axios');
const prisma = require('./prismaClient'); // Use shared Prisma client

class ComicVineService {
  constructor() {
    this.baseURL = 'https://comicvine.gamespot.com/api';
    this.apiKey = null; // Will be loaded from database
  }

  async loadApiKey() {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.apiKey = settings?.comicVineApiKey || null;
    } catch (error) {
      console.error('Error loading ComicVine API key from settings:', error);
      this.apiKey = null;
    }
  }

  async isApiKeyAvailable() {
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    return this.apiKey && this.apiKey.trim() !== '';
  }

  /**
   * Search for a comic series by name
   * @param {string} seriesName - The name of the comic series
   * @returns {Promise<Array>} Array of search results
   */  async searchSeries(seriesName) {
    try {
      if (!(await this.isApiKeyAvailable())) {
        console.log('ComicVine API key not available');
        return [];
      }

      console.log(`Searching ComicVine for series: ${seriesName}`);
      
      const response = await axios.get(`${this.baseURL}/search/`, {
        params: {
          api_key: this.apiKey,
          format: 'json',
          query: seriesName,
          resources: 'volume',
          limit: 10
        },
        headers: {
          'User-Agent': 'MasterOrder/1.0'
        }
      });

      const results = response.data.results || [];
      console.log(`Found ${results.length} series results for: ${seriesName}`);
      
      return results;
    } catch (error) {
      console.error('ComicVine series search failed:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get issues for a specific volume
   * @param {number} volumeId - The ComicVine volume ID
   * @param {number} issueNumber - The issue number to find
   * @returns {Promise<Object|null>} Issue details or null
   */  async getIssueByNumber(volumeId, issueNumber) {
    try {
      if (!(await this.isApiKeyAvailable())) {
        console.log('ComicVine API key not available');
        return null;
      }

      console.log(`Searching for issue #${issueNumber} in volume ${volumeId}`);
      
      const response = await axios.get(`${this.baseURL}/issues/`, {
        params: {
          api_key: this.apiKey,
          format: 'json',
          filter: `volume:${volumeId},issue_number:${issueNumber}`,
          limit: 1
        },
        headers: {
          'User-Agent': 'MasterOrder/1.0'
        }
      });

      const issues = response.data.results || [];
      if (issues.length > 0) {
        console.log(`Found issue #${issueNumber}: ${issues[0].name || 'Untitled'}`);
        return issues[0];
      }
      
      console.log(`No issue #${issueNumber} found in volume ${volumeId}`);
      return null;
    } catch (error) {
      console.error('ComicVine issue search failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Parse comic format and get cover art
   * @param {string} comicString - Format: "Series Name (Year) #Issue"
   * @returns {Promise<Object|null>} Comic details with cover art URL
   */  async getComicCoverArt(comicString) {
    try {
      if (!(await this.isApiKeyAvailable())) {
        console.log('ComicVine API key not available, skipping comic cover art lookup');
        return null;
      }

      console.log(`Parsing comic string: ${comicString}`);
      
      // Parse the format "Series Name (Year) #Issue"
      const match = comicString.match(/^(.+?)\s*\((\d{4})\)\s*#(.+)$/);
      if (!match) {
        console.log(`Invalid comic format: ${comicString}. Expected format: "Series Name (Year) #Issue"`);
        return null;
      }

      const [, seriesName, year, issueNumber] = match;
      console.log(`Parsed - Series: ${seriesName}, Year: ${year}, Issue: #${issueNumber}`);

      // Search for the series
      const seriesResults = await this.searchSeries(seriesName);
      if (seriesResults.length === 0) {
        console.log(`No series found for: ${seriesName}`);
        return null;
      }

      // Find the best matching series (preferably with matching year)
      let bestMatch = null;
      
      // First try to find exact year match
      for (const series of seriesResults) {
        const seriesYear = series.start_year;
        if (seriesYear && seriesYear.toString() === year) {
          bestMatch = series;
          break;
        }
      }
      
      // If no exact year match, use the first result
      if (!bestMatch) {
        bestMatch = seriesResults[0];
        console.log(`No exact year match for ${year}, using: ${bestMatch.name} (${bestMatch.start_year})`);
      }

      console.log(`Selected series: ${bestMatch.name} (ID: ${bestMatch.id})`);

      // Get the specific issue
      const issue = await this.getIssueByNumber(bestMatch.id, issueNumber);
      if (!issue) {
        console.log(`Issue #${issueNumber} not found`);
        return null;
      }

      // Return comic details with cover art
      const coverUrl = issue.image?.original_url || issue.image?.screen_url || issue.image?.small_url;
      
      return {
        seriesName: bestMatch.name,
        seriesId: bestMatch.id,
        year: bestMatch.start_year || parseInt(year),
        issueNumber: issueNumber,
        issueId: issue.id,
        issueName: issue.name,
        coverUrl: coverUrl,
        description: issue.description,
        publisher: bestMatch.publisher?.name
      };

    } catch (error) {
      console.error('Error getting comic cover art:', error.message);
      return null;
    }
  }
}

module.exports = new ComicVineService();
