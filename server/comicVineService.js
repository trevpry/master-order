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
   * Calculate string similarity using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1 (1 being identical)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();
    
    if (a === b) return 1;
    
    const matrix = [];
    const n = b.length;
    const m = a.length;

    if (n === 0) return m === 0 ? 1 : 0;
    if (m === 0) return 0;

    for (let i = 0; i <= n; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[n][m];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }

  /**
   * Search for a comic series by name with fuzzy matching
   * @param {string} seriesName - The name of the comic series
   * @returns {Promise<Array>} Array of search results with similarity scores
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
      
      if (results.length === 0) {
        console.log(`No exact matches found for "${seriesName}". Trying fuzzy search...`);
        
        // If no exact matches, try a broader search with just key words
        const searchTerms = seriesName.toLowerCase().split(/\s+/).filter(term => term.length > 2);
        let fuzzyResults = [];
        
        for (const term of searchTerms.slice(0, 3)) { // Use max 3 terms to avoid too many API calls
          try {
            const fuzzyResponse = await axios.get(`${this.baseURL}/search/`, {
              params: {
                api_key: this.apiKey,
                format: 'json',
                query: term,
                resources: 'volume',
                limit: 20
              },
              headers: {
                'User-Agent': 'MasterOrder/1.0'
              }
            });
            
            const termResults = fuzzyResponse.data.results || [];
            fuzzyResults = fuzzyResults.concat(termResults);
          } catch (termError) {
            console.warn(`Error searching for term "${term}":`, termError.message);
          }
        }
        
        // Remove duplicates and calculate similarity scores
        const uniqueResults = new Map();
        for (const result of fuzzyResults) {
          if (!uniqueResults.has(result.id)) {
            const similarity = this.calculateSimilarity(seriesName, result.name);
            uniqueResults.set(result.id, {
              ...result,
              similarity: similarity,
              isFuzzyMatch: true
            });
          }
        }
        
        // Sort by similarity and return top matches above threshold
        const sortedResults = Array.from(uniqueResults.values())
          .filter(result => result.similarity > 0.3) // Only return reasonable matches
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 10);
        
        if (sortedResults.length > 0) {
          console.log(`Found ${sortedResults.length} fuzzy matches for "${seriesName}"`);
          console.log(`Best match: "${sortedResults[0].name}" (${Math.round(sortedResults[0].similarity * 100)}% similarity)`);
        }
        
        return sortedResults;
      }
      
      // Add exact match indicators to normal results
      return results.map(result => ({
        ...result,
        similarity: this.calculateSimilarity(seriesName, result.name),
        isFuzzyMatch: false
      }));
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
      }      console.log(`Parsing comic string: ${comicString}`);
      
      // Parse the format "Series Name (Year) #Issue" or "Series Name #Issue"
      let match = comicString.match(/^(.+?)\s*\((\d{4})\)\s*#(.+)$/);
      let seriesName, year, issueNumber;
      
      if (match) {
        // Format with year: "Series Name (Year) #Issue"
        [, seriesName, year, issueNumber] = match;
        console.log(`Parsed - Series: ${seriesName}, Year: ${year}, Issue: #${issueNumber}`);
      } else {
        // Try format without year: "Series Name #Issue"
        match = comicString.match(/^(.+?)\s*#(.+)$/);
        if (match) {
          [, seriesName, issueNumber] = match;
          year = null;
          console.log(`Parsed - Series: ${seriesName}, Year: none, Issue: #${issueNumber}`);
        } else {
          console.log(`Invalid comic format: ${comicString}. Expected format: "Series Name (Year) #Issue" or "Series Name #Issue"`);
          return null;
        }
      }

      // Search for the series
      const seriesResults = await this.searchSeries(seriesName);
      if (seriesResults.length === 0) {
        console.log(`No series found for: ${seriesName}`);
        return null;
      }      // Find the best matching series (preferably with matching year)
      let bestMatch = null;
      
      if (year) {
        // First try to find exact year match if year is provided
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
      } else {
        // No year provided, just use the first result
        bestMatch = seriesResults[0];
        console.log(`No year specified, using first result: ${bestMatch.name} (${bestMatch.start_year})`);
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
        year: year ? parseInt(year) : bestMatch.start_year,
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
