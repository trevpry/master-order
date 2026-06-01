/**
 * History Plus API Service
 * Handles all API communication for historical content management
 */

const API_BASE = '/api/history-plus';

export class HistoryPlusApiService {
  // ==========================================
  // HISTORICAL EVENTS
  // ==========================================

  static async getAllEvents() {
    const response = await fetch(`${API_BASE}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  }

  static async getEventById(id) {
    const response = await fetch(`${API_BASE}/events/${id}`);
    if (!response.ok) throw new Error('Failed to fetch event');
    return response.json();
  }

  static async createEvent(eventData) {
    const response = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });
    if (!response.ok) throw new Error('Failed to create event');
    return response.json();
  }

  static async updateEvent(id, updateData) {
    const response = await fetch(`${API_BASE}/events/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update event');
    return response.json();
  }

  static async deleteEvent(id) {
    const response = await fetch(`${API_BASE}/events/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete event');
    return response.json();
  }

  static async mergeEvents(mergeData) {
    const response = await fetch(`${API_BASE}/events/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mergeData)
    });
    if (!response.ok) throw new Error('Failed to merge events');
    return response.json();
  }

  static async getTimelinePromptTemplate() {
    const response = await fetch(`${API_BASE}/ai-prompt-template`);
    if (!response.ok) throw new Error('Failed to fetch timeline prompt template');
    return response.json();
  }

  static async saveTimelinePromptTemplate(template) {
    const response = await fetch(`${API_BASE}/ai-prompt-template`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ template })
    });
    if (!response.ok) throw new Error('Failed to save timeline prompt template');
    return response.json();
  }

  static async getEventProgress(id) {
    const response = await fetch(`${API_BASE}/events/${id}/progress`);
    if (!response.ok) throw new Error('Failed to fetch event progress');
    return response.json();
  }

  // ==========================================
  // BOOKS & CHAPTERS
  // ==========================================

  static async getBooksByEvent(eventId) {
    const response = await fetch(`${API_BASE}/events/${eventId}/books`);
    if (!response.ok) throw new Error('Failed to fetch books');
    return response.json();
  }

  static async getBookById(id) {
    const response = await fetch(`${API_BASE}/books/${id}`);
    if (!response.ok) throw new Error('Failed to fetch book');
    return response.json();
  }

  static async createBook(bookData) {
    const response = await fetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookData)
    });
    if (!response.ok) throw new Error('Failed to create book');
    return response.json();
  }

  static async getChapterById(id) {
    const response = await fetch(`${API_BASE}/chapters/${id}`);
    if (!response.ok) throw new Error('Failed to fetch chapter');
    return response.json();
  }

  // ==========================================
  // VIDEOS & CHANNELS
  // ==========================================

  static async getVideosByEvent(eventId) {
    const response = await fetch(`${API_BASE}/events/${eventId}/videos`);
    if (!response.ok) throw new Error('Failed to fetch videos');
    return response.json();
  }

  static async getVideoById(id) {
    const response = await fetch(`${API_BASE}/videos/${id}`);
    if (!response.ok) throw new Error('Failed to fetch video');
    return response.json();
  }

  static async createVideo(videoData) {
    const response = await fetch(`${API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(videoData)
    });
    if (!response.ok) throw new Error('Failed to create video');
    return response.json();
  }

  static async getAllChannels() {
    const response = await fetch(`${API_BASE}/channels`);
    if (!response.ok) throw new Error('Failed to fetch channels');
    return response.json();
  }

  static async createChannel(channelData) {
    const response = await fetch(`${API_BASE}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(channelData)
    });
    if (!response.ok) throw new Error('Failed to create channel');
    return response.json();
  }

  static async getChannelById(id) {
    const response = await fetch(`${API_BASE}/channels/${id}`);
    if (!response.ok) throw new Error('Failed to fetch channel');
    return response.json();
  }

  static async updateChannel(id, channelData) {
    const response = await fetch(`${API_BASE}/channels/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(channelData)
    });
    if (!response.ok) throw new Error('Failed to update channel');
    return response.json();
  }

  static async deleteChannel(id) {
    const response = await fetch(`${API_BASE}/channels/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete channel');
    return response.json();
  }

  // ==========================================
  // PROGRESS TRACKING
  // ==========================================

  static async markEventReviewed(eventId, reviewData = {}) {
    const response = await fetch(`${API_BASE}/events/${eventId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewData)
    });
    if (!response.ok) throw new Error('Failed to mark event as reviewed');
    return response.json();
  }

  static async markVideoWatched(videoId) {
    const response = await fetch(`${API_BASE}/videos/${videoId}/watch`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to mark video as watched');
    return response.json();
  }

  // Additional video methods
  static async getAllVideos() {
    const response = await fetch(`${API_BASE}/videos`);
    if (!response.ok) throw new Error('Failed to fetch videos');
    return response.json();
  }

  static async updateVideo(id, updateData) {
    const response = await fetch(`${API_BASE}/videos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update video');
    return response.json();
  }

  static async deleteVideo(id) {
    const response = await fetch(`${API_BASE}/videos/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete video');
    return response.json();
  }

  static async toggleVideoWatched(videoId) {
    const response = await fetch(`${API_BASE}/videos/${videoId}/toggle-watched`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to toggle video watched status');
    return response.json();
  }

  static async markBookRead(bookId) {
    const response = await fetch(`${API_BASE}/books/${bookId}/read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to mark book as read');
    return response.json();
  }

  static async markChapterRead(chapterId) {
    const response = await fetch(`${API_BASE}/chapters/${chapterId}/read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to mark chapter as read');
    return response.json();
  }

  static async markSectionRead(sectionId) {
    const response = await fetch(`${API_BASE}/sections/${sectionId}/read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to mark section as read');
    return response.json();
  }

  // ==========================================
  // BOOKS CRUD OPERATIONS
  // ==========================================

  static async getAllBooks() {
    const response = await fetch(`${API_BASE}/books`);
    if (!response.ok) throw new Error('Failed to fetch books');
    return response.json();
  }

  static async updateBook(id, updateData) {
    const response = await fetch(`${API_BASE}/books/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update book');
    return response.json();
  }

  static async deleteBook(id) {
    const response = await fetch(`${API_BASE}/books/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete book');
    return response.json();
  }

  // Chapters
  static async createChapter(chapterData) {
    const response = await fetch(`${API_BASE}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chapterData)
    });
    if (!response.ok) throw new Error('Failed to create chapter');
    return response.json();
  }

  static async updateChapter(id, updateData) {
    const response = await fetch(`${API_BASE}/chapters/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update chapter');
    return response.json();
  }

  static async deleteChapter(id) {
    const response = await fetch(`${API_BASE}/chapters/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete chapter');
    return response.json();
  }

  // Sections
  static async createSection(sectionData) {
    const response = await fetch(`${API_BASE}/sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sectionData)
    });
    if (!response.ok) throw new Error('Failed to create section');
    return response.json();
  }

  static async updateSection(id, updateData) {
    const response = await fetch(`${API_BASE}/sections/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update section');
    return response.json();
  }

  static async deleteSection(id) {
    const response = await fetch(`${API_BASE}/sections/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete section');
    return response.json();
  }

  // Toggle read status
  static async toggleBookRead(bookId) {
    const response = await fetch(`${API_BASE}/books/${bookId}/toggle-read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to toggle book read status');
    return response.json();
  }

  static async toggleChapterRead(chapterId) {
    const response = await fetch(`${API_BASE}/chapters/${chapterId}/toggle-read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to toggle chapter read status');
    return response.json();
  }

  static async toggleSectionRead(sectionId) {
    const response = await fetch(`${API_BASE}/sections/${sectionId}/toggle-read`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to toggle section read status');
    return response.json();
  }

  // Categories
  static async getCategories() {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  }

  static async createCategory(categoryData) {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  }

  static async updateCategory(id, updateData) {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update category');
    return response.json();
  }

  static async deleteCategory(id) {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete category');
    return response.json();
  }

  // ==========================================
  // SCRAPING
  // ==========================================

  static async scrapeChannelVideos(channelUrl, channelId = null) {
    const response = await fetch('/api/scraping/channel-videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelUrl, channelId })
    });
    if (!response.ok) throw new Error('Failed to scrape channel videos');
    return response.json();
  }

  static async getChannelInfo(channelUrl) {
    const response = await fetch('/api/scraping/channel-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelUrl })
    });
    if (!response.ok) throw new Error('Failed to get channel info');
    return response.json();
  }

  // ==========================================
  // STATISTICS & SEARCH
  // ==========================================

  static async getStatistics() {
    const response = await fetch(`${API_BASE}/statistics`);
    if (!response.ok) throw new Error('Failed to fetch statistics');
    return response.json();
  }

  static async getVideoStatistics() {
    const response = await fetch(`${API_BASE}/video-stats`);
    if (!response.ok) throw new Error('Failed to fetch video statistics');
    return response.json();
  }

  static async searchContent(query) {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search content');
    return response.json();
  }

  static async getCategories() {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  }
}

export default HistoryPlusApiService;

// Also export as historyPlusApi for backward compatibility
export const historyPlusApi = {
  getAllEvents: HistoryPlusApiService.getAllEvents,
  getEvents: HistoryPlusApiService.getAllEvents, // Alias
  getEventById: HistoryPlusApiService.getEventById,
  createEvent: HistoryPlusApiService.createEvent,
  updateEvent: HistoryPlusApiService.updateEvent,
  deleteEvent: HistoryPlusApiService.deleteEvent,
  mergeEvents: HistoryPlusApiService.mergeEvents,
  getTimelinePromptTemplate: HistoryPlusApiService.getTimelinePromptTemplate,
  saveTimelinePromptTemplate: HistoryPlusApiService.saveTimelinePromptTemplate,
  getEventProgress: HistoryPlusApiService.getEventProgress,
  getBooksByEvent: HistoryPlusApiService.getBooksByEvent,
  getBookById: HistoryPlusApiService.getBookById,
  createBook: HistoryPlusApiService.createBook,
  getChapterById: HistoryPlusApiService.getChapterById,
  getVideosByEvent: HistoryPlusApiService.getVideosByEvent,
  getVideoById: HistoryPlusApiService.getVideoById,
  getAllVideos: HistoryPlusApiService.getAllVideos,
  getVideos: HistoryPlusApiService.getAllVideos, // Alias for Videos component
  createVideo: HistoryPlusApiService.createVideo,
  updateVideo: HistoryPlusApiService.updateVideo,
  deleteVideo: HistoryPlusApiService.deleteVideo,
  markVideoWatched: HistoryPlusApiService.markVideoWatched,
  toggleVideoWatched: HistoryPlusApiService.toggleVideoWatched,
  markEventReviewed: HistoryPlusApiService.markEventReviewed,
  getAllChannels: HistoryPlusApiService.getAllChannels,
  getChannels: HistoryPlusApiService.getAllChannels, // Alias for Videos component
  getChannelById: HistoryPlusApiService.getChannelById,
  createChannel: HistoryPlusApiService.createChannel,
  updateChannel: HistoryPlusApiService.updateChannel,
  deleteChannel: HistoryPlusApiService.deleteChannel,
  markBookRead: HistoryPlusApiService.markBookRead,
  markChapterRead: HistoryPlusApiService.markChapterRead,
  markSectionRead: HistoryPlusApiService.markSectionRead,
  getStatistics: HistoryPlusApiService.getStatistics,
  getVideoStatistics: HistoryPlusApiService.getVideoStatistics,
  getVideoStats: HistoryPlusApiService.getVideoStatistics, // Alias for Videos component
  searchContent: HistoryPlusApiService.searchContent,
  getCategories: HistoryPlusApiService.getCategories,
  createCategory: HistoryPlusApiService.createCategory,
  updateCategory: HistoryPlusApiService.updateCategory,
  deleteCategory: HistoryPlusApiService.deleteCategory,
  // Scraping methods
  scrapeChannelVideos: HistoryPlusApiService.scrapeChannelVideos,
  getChannelInfo: HistoryPlusApiService.getChannelInfo,
};
