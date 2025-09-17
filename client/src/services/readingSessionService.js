/**
 * Reading Session Service
 * Modular service for unified reading session management
 * Integrates with the unified watch-tracking API used by Up Next and Android
 */

import config from '../config.js';

class ReadingSessionService {
  constructor() {
    this.baseUrl = `${config.apiBaseUrl}/api`;
  }

  /**
   * Get the currently active reading session
   * @returns {Promise<Object|null>} Active session or null
   */
  async getActiveSession() {
    try {
      const response = await fetch(`${this.baseUrl}/reading/active`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        return data.data;
      }
      
      if (response.status === 404) {
        return null; // No active session
      }
      
      throw new Error(data.error || 'Failed to get active reading session');
    } catch (error) {
      console.error('Error getting active reading session:', error);
      throw error;
    }
  }

  /**
   * Start a new reading session
   * @param {Object} params - Reading session parameters
   * @param {string} params.mediaType - Type of media ('book', 'comic', 'shortstory')
   * @param {string} params.title - Title of the content
   * @param {string} [params.seriesTitle] - Series title (optional)
   * @param {string} [params.comicSeries] - Comic series name (required for comics)
   * @param {string} [params.comicIssue] - Comic issue number (required for comics)
   * @param {number} [params.customOrderItemId] - Custom order item ID (optional)
   * @returns {Promise<Object>} Created reading session
   */
  async startSession(params) {
    try {
      const requestBody = {
        mediaType: params.mediaType || 'book',
        title: params.title,
        seriesTitle: params.seriesTitle || null,
        customOrderItemId: params.customOrderItemId || null
      };

      // Add comic-specific fields if this is a comic
      if (params.mediaType === 'comic') {
        requestBody.comicSeries = params.comicSeries;
        requestBody.comicIssue = params.comicIssue;
      }

      const response = await fetch(`${this.baseUrl}/reading/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data;
      }
      
      throw new Error(data.error || 'Failed to start reading session');
    } catch (error) {
      console.error('Error starting reading session:', error);
      throw error;
    }
  }

  /**
   * Pause or resume the active reading session
   * @returns {Promise<Object>} Updated reading session
   */
  async pauseResumeSession() {
    try {
      const response = await fetch(`${this.baseUrl}/reading/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data;
      }
      
      throw new Error(data.error || 'Failed to pause/resume reading session');
    } catch (error) {
      console.error('Error pausing/resuming reading session:', error);
      throw error;
    }
  }

  /**
   * Stop the active reading session
   * @param {Object} [progressData] - Optional progress data
   * @param {number} [progressData.currentPage] - Current page number
   * @param {number} [progressData.totalPages] - Total pages in book
   * @param {number} [progressData.percentComplete] - Percentage complete
   * @returns {Promise<Object>} Completed reading session
   */
  async stopSession(progressData = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/reading/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          progress: progressData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data;
      }
      
      throw new Error(data.error || 'Failed to stop reading session');
    } catch (error) {
      console.error('Error stopping reading session:', error);
      throw error;
    }
  }

  /**
   * Helper method to determine custom order item ID for a book
   * @param {Object} book - Book object
   * @returns {number|null} Custom order item ID or null
   */
  getCustomOrderItemId(book) {
    if (book.customOrderItems && book.customOrderItems.length > 0) {
      return book.customOrderItems[0].id;
    }
    return null;
  }

  /**
   * Helper method to create session parameters from book data
   * @param {Object} book - Book object
   * @param {Object} [chapter] - Chapter object (optional)
   * @param {Object} [section] - Section object (optional)
   * @returns {Object} Session parameters
   */
  createSessionParams(book, chapter = null, section = null) {
    let title = book.title;
    
    if (section) {
      title = `${book.title} - ${chapter.title} - ${section.title}`;
    } else if (chapter) {
      title = `${book.title} - ${chapter.title}`;
    }

    return {
      mediaType: 'book',
      title: title,
      seriesTitle: book.author ? `by ${book.author}` : null,
      customOrderItemId: this.getCustomOrderItemId(book)
    };
  }
}

// Export singleton instance
export default new ReadingSessionService();