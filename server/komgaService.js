const axios = require('axios');
const prisma = require('./prismaClient');

class KomgaService {
  constructor() {
    this.baseUrl = null;
    this.apiKey = null;
  }

  async initialize() {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (settings?.komgaUrl && settings?.komgaApiKey) {
        this.baseUrl = settings.komgaUrl.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = settings.komgaApiKey;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize Komga service:', error);
      return false;
    }
  }

  async isConfigured() {
    return await this.initialize();
  }

  async makeRequest(endpoint, params = {}) {
    if (!await this.isConfigured()) {
      throw new Error('Komga service not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey
        },
        params: params,
        timeout: 10000 // 10 second timeout
      });
      return response.data;
    } catch (error) {
      console.error(`Komga API request failed for ${endpoint}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async searchSeries(query) {
    try {
      const data = await this.makeRequest('/api/v1/series', {
        search: query,
        size: 20
      });
      
      return data.content || [];
    } catch (error) {
      console.error('Error searching Komga series:', error);
      return [];
    }
  }

  async getSeriesById(seriesId) {
    try {
      return await this.makeRequest(`/api/v1/series/${seriesId}`);
    } catch (error) {
      console.error(`Error getting Komga series ${seriesId}:`, error);
      return null;
    }
  }

  async getSeriesBooks(seriesId) {
    try {
      const data = await this.makeRequest(`/api/v1/series/${seriesId}/books`, {
        size: 1000 // Get all books in series
      });
      
      return data.content || [];
    } catch (error) {
      console.error(`Error getting books for Komga series ${seriesId}:`, error);
      return [];
    }
  }

  async searchBooks(query, seriesFilter = null) {
    try {
      const params = {
        search: query,
        size: 50
      };
      
      if (seriesFilter) {
        params.series_id = seriesFilter;
      }
      
      const data = await this.makeRequest('/api/v1/books', params);
      return data.content || [];
    } catch (error) {
      console.error('Error searching Komga books:', error);
      return [];
    }
  }

  async getBookById(bookId) {
    try {
      return await this.makeRequest(`/api/v1/books/${bookId}`);
    } catch (error) {
      console.error(`Error getting Komga book ${bookId}:`, error);
      return null;
    }
  }

  async searchComic(comicSeries, comicIssue, comicYear = null) {
    try {
      console.log(`Searching Komga for comic: "${comicSeries}" #${comicIssue}` + (comicYear ? ` (${comicYear})` : ''));
      
      // First, search for series that match the comic series name
      const series = await this.searchSeries(comicSeries);
      
      if (!series.length) {
        console.log(`No series found in Komga for: ${comicSeries}`);
        return null;
      }

      // Look through each series to find a matching issue
      for (const seriesData of series) {
        // Check if series name is a close match
        const seriesNameMatch = this.isSeriesNameMatch(seriesData.name, comicSeries);
        
        if (!seriesNameMatch) continue;

        console.log(`Checking series: "${seriesData.name}" (ID: ${seriesData.id})`);
        
        // Get books in this series
        const books = await this.getSeriesBooks(seriesData.id);
        
        // Look for matching issue number
        const matchingBook = this.findMatchingIssue(books, comicIssue, comicYear);
        
        if (matchingBook) {
          console.log(`Found matching comic in Komga: "${matchingBook.name}" in series "${seriesData.name}"`);
          
          return {
            series: seriesData,
            book: matchingBook,
            komgaUrl: `${this.baseUrl}/book/${matchingBook.id}`,
            komgaSeriesUrl: `${this.baseUrl}/series/${seriesData.id}`,
            metadata: {
              title: matchingBook.name,
              seriesTitle: seriesData.name,
              issueNumber: this.extractIssueNumber(matchingBook.name),
              publisher: seriesData.metadata?.publisher,
              releaseDate: matchingBook.metadata?.releaseDate,
              summary: matchingBook.metadata?.summary || seriesData.metadata?.summary,
              authors: matchingBook.metadata?.authors || [],
              tags: seriesData.metadata?.tags || [],
              ageRating: seriesData.metadata?.ageRating,
              language: seriesData.metadata?.language,
              genre: seriesData.metadata?.genre?.join(', '),
              coverUrl: `${this.baseUrl}/api/v1/books/${matchingBook.id}/thumbnail`,
              pageCount: matchingBook.media?.pagesCount,
              fileSize: matchingBook.size,
              fileFormat: matchingBook.media?.mediaType
            }
          };
        }
      }

      console.log(`No matching issue found in Komga for: ${comicSeries} #${comicIssue}`);
      return null;

    } catch (error) {
      console.error('Error searching Komga for comic:', error);
      return null;
    }
  }

  isSeriesNameMatch(komgaSeriesName, searchSeriesName) {
    const normalize = (str) => str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();

    const komgaNormalized = normalize(komgaSeriesName);
    const searchNormalized = normalize(searchSeriesName);
    
    // Check for exact match
    if (komgaNormalized === searchNormalized) return true;
    
    // Check if one contains the other (for cases like "Spider-Man" vs "The Amazing Spider-Man")
    if (komgaNormalized.includes(searchNormalized) || searchNormalized.includes(komgaNormalized)) {
      return true;
    }
    
    // Check for word overlap (at least 60% of words match)
    const komgaWords = komgaNormalized.split(' ');
    const searchWords = searchNormalized.split(' ');
    const totalWords = Math.max(komgaWords.length, searchWords.length);
    const matchingWords = komgaWords.filter(word => searchWords.includes(word)).length;
    
    return (matchingWords / totalWords) >= 0.6;
  }

  findMatchingIssue(books, targetIssue, targetYear = null) {
    // Try to parse target issue number
    const targetIssueNum = this.parseIssueNumber(targetIssue);
    
    for (const book of books) {
      const bookIssueNum = this.extractIssueNumber(book.name);
      
      // Check if issue numbers match
      if (bookIssueNum !== null && targetIssueNum !== null && bookIssueNum === targetIssueNum) {
        // If year is specified, try to match it
        if (targetYear) {
          const bookYear = this.extractYear(book);
          if (bookYear && Math.abs(bookYear - parseInt(targetYear)) <= 1) {
            return book;
          }
        } else {
          return book;
        }
      }
      
      // Also try string matching for issue numbers
      const targetIssueStr = String(targetIssue).toLowerCase();
      if (book.name.toLowerCase().includes(`#${targetIssueStr}`) || 
          book.name.toLowerCase().includes(`issue ${targetIssueStr}`) ||
          book.name.toLowerCase().includes(`no. ${targetIssueStr}`) ||
          book.name.toLowerCase().includes(`number ${targetIssueStr}`)) {
        return book;
      }
    }
    
    return null;
  }

  extractIssueNumber(bookName) {
    // Try various patterns to extract issue number
    const patterns = [
      /#(\d+(?:\.\d+)?)/,        // #123 or #123.5
      /issue (\d+(?:\.\d+)?)/i,   // Issue 123
      /no\.?\s*(\d+(?:\.\d+)?)/i, // No. 123 or No 123
      /number (\d+(?:\.\d+)?)/i,  // Number 123
      /vol\.?\s*\d+\s*#(\d+(?:\.\d+)?)/i, // Vol 1 #123
      // New pattern for "Series Name 001" format (common in Komga)
      /\s(\d{3,})\s*\(/,         // Space followed by 3+ digits followed by space and opening paren: "Flash Comics 024 ("
      /\s(\d{3,})$/,             // Space followed by 3+ digits at end: "Flash Comics 024"
      /\s(\d+)\s*\(/,            // Space followed by any digits followed by space and paren: "Flash Comics 24 ("
      /\s(\d+)$/                 // Space followed by any digits at end: "Flash Comics 24"
    ];
    
    for (const pattern of patterns) {
      const match = bookName.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    
    return null;
  }

  parseIssueNumber(issueStr) {
    if (typeof issueStr === 'number') return issueStr;
    const num = parseFloat(String(issueStr));
    return isNaN(num) ? null : num;
  }

  extractYear(book) {
    // Try to extract year from release date
    if (book.metadata?.releaseDate) {
      const year = new Date(book.metadata.releaseDate).getFullYear();
      if (year > 1800 && year <= new Date().getFullYear() + 5) {
        return year;
      }
    }
    
    // Try to extract from name
    const yearMatch = book.name.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0]);
    }
    
    return null;
  }

  // Test connection to Komga
  async testConnection() {
    try {
      await this.makeRequest('/api/v1/libraries');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }
}

module.exports = new KomgaService();
