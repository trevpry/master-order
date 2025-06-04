const axios = require('axios');
const prisma = require('./prismaClient');

class OpenLibraryService {
  constructor() {
    this.baseUrl = 'https://openlibrary.org';
    this.searchUrl = 'https://openlibrary.org/search.json';
    this.coversUrl = 'https://covers.openlibrary.org/b';
  }

  /**
   * Search for books using the OpenLibrary Search API
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} Array of book results
   */
  async searchBooks(query, limit = 20) {
    try {
      console.log(`Searching OpenLibrary for: ${query}`);
      
      const response = await axios.get(this.searchUrl, {
        params: {
          q: query,
          limit: limit,
          fields: 'key,title,author_name,first_publish_year,isbn,publisher,cover_i,edition_count,subject,language'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.docs) {
        console.log('No results found in OpenLibrary search');
        return [];
      }

      const books = response.data.docs.map(book => ({
        id: book.key,
        title: book.title || 'Unknown Title',
        authors: book.author_name || [],
        firstPublishYear: book.first_publish_year || null,
        isbn: book.isbn ? book.isbn[0] : null,
        publishers: book.publisher || [],
        coverId: book.cover_i || null,
        editionCount: book.edition_count || 1,
        subjects: book.subject || [],
        languages: book.language || [],
        coverUrl: book.cover_i ? `${this.coversUrl}/id/${book.cover_i}-M.jpg` : null
      }));

      console.log(`Found ${books.length} books in OpenLibrary search`);
      return books;
    } catch (error) {
      console.error('Error searching OpenLibrary:', error.message);
      throw new Error(`OpenLibrary search failed: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific book by its OpenLibrary key
   * @param {string} bookKey - OpenLibrary book key (e.g., '/works/OL45804W')
   * @returns {Promise<Object>} Detailed book information
   */
  async getBookDetails(bookKey) {
    try {
      console.log(`Getting book details for: ${bookKey}`);
      
      // Remove leading slash if present
      const cleanKey = bookKey.replace(/^\//, '');
      
      const response = await axios.get(`${this.baseUrl}/${cleanKey}.json`, {
        timeout: 10000
      });

      const book = response.data;
      
      // Get cover information if available
      let coverUrl = null;
      if (book.covers && book.covers.length > 0) {
        coverUrl = `${this.coversUrl}/id/${book.covers[0]}-L.jpg`;
      }

      return {
        id: book.key,
        title: book.title || 'Unknown Title',
        description: book.description ? 
          (typeof book.description === 'string' ? book.description : book.description.value) : null,
        subjects: book.subjects || [],
        firstPublishDate: book.first_publish_date || null,
        coverUrl: coverUrl,
        covers: book.covers || [],
        authors: book.authors || [],
        deweyDecimal: book.dewey_decimal_class || [],
        lcClassifications: book.lc_classifications || []
      };
    } catch (error) {
      console.error(`Error getting book details for ${bookKey}:`, error.message);
      throw new Error(`Failed to get book details: ${error.message}`);
    }
  }

  /**
   * Get cover image URL for a book
   * @param {string} coverId - OpenLibrary cover ID
   * @param {string} size - Size of cover (S, M, L)
   * @returns {string} Cover image URL
   */
  getCoverUrl(coverId, size = 'M') {
    if (!coverId) return null;
    return `${this.coversUrl}/id/${coverId}-${size}.jpg`;
  }

  /**
   * Get cover image URL by ISBN
   * @param {string} isbn - Book ISBN
   * @param {string} size - Size of cover (S, M, L)
   * @returns {string} Cover image URL
   */
  getCoverUrlByIsbn(isbn, size = 'M') {
    if (!isbn) return null;
    return `${this.coversUrl}/isbn/${isbn}-${size}.jpg`;
  }

  /**
   * Search for a specific book by title and author
   * @param {string} title - Book title
   * @param {string} author - Book author (optional)
   * @param {number} year - Publication year (optional)
   * @returns {Promise<Object|null>} Best matching book or null
   */
  async findBook(title, author = null, year = null) {
    try {
      let query = title;
      if (author) {
        query += ` author:"${author}"`;
      }
      if (year) {
        query += ` first_publish_year:${year}`;
      }

      const results = await this.searchBooks(query, 5);
      
      if (results.length === 0) {
        return null;
      }

      // Return the first result as the best match
      const bestMatch = results[0];
      
      // Get detailed information for the best match
      try {
        const details = await this.getBookDetails(bestMatch.id);
        return {
          ...bestMatch,
          ...details
        };
      } catch (detailError) {
        console.warn(`Could not get details for ${bestMatch.id}, returning basic info`);
        return bestMatch;
      }
    } catch (error) {
      console.error('Error finding book:', error.message);
      throw error;
    }
  }
}

module.exports = new OpenLibraryService();
