const express = require('express');
const router = express.Router();
const HistoryPlusService = require('../services/historyPlusService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const historyPlusService = new HistoryPlusService();

// ==========================================
// HISTORICAL EVENTS ROUTES
// ==========================================

// GET /api/history-plus/events
router.get('/events', asyncHandler(async (req, res) => {
  const { bookId, chapterId, sectionId } = req.query;
  
  if (bookId || chapterId || sectionId) {
    const events = await historyPlusService.getEventsByContent(req.query);
    sendSuccess(res, { events });
  } else {
    const events = await historyPlusService.getAllEvents();
    sendSuccess(res, events);
  }
}));

// GET /api/history-plus/events/:id
router.get('/events/:id', asyncHandler(async (req, res) => {
  const event = await historyPlusService.getEventById(req.params.id);
  if (!event) {
    return sendBadRequest(res, 'Event not found');
  }
  sendSuccess(res, event);
}));

// POST /api/history-plus/events
router.post('/events', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title', 'startDate', 'category']);
  
  const event = await historyPlusService.createEvent(req.body);
  sendSuccess(res, event);
}));

// PUT /api/history-plus/events/:id
router.put('/events/:id', asyncHandler(async (req, res) => {
  const event = await historyPlusService.updateEvent(req.params.id, req.body);
  sendSuccess(res, event);
}));

// DELETE /api/history-plus/events/:id
router.delete('/events/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteEvent(req.params.id);
  sendSuccess(res, { message: 'Event deleted successfully' });
}));

// GET /api/history-plus/events/:id/progress
router.get('/events/:id/progress', asyncHandler(async (req, res) => {
  const progress = await historyPlusService.getEventProgress(req.params.id);
  if (!progress) {
    return sendBadRequest(res, 'Event not found');
  }
  sendSuccess(res, progress);
}));

// ==========================================
// BOOKS ROUTES
// ==========================================

// GET /api/history-plus/books
router.get('/books', asyncHandler(async (req, res) => {
  const books = await historyPlusService.getAllBooks();
  sendSuccess(res, { books });
}));

// GET /api/history-plus/events/:eventId/books
router.get('/events/:eventId/books', asyncHandler(async (req, res) => {
  const books = await historyPlusService.getBooksByEvent(req.params.eventId);
  sendSuccess(res, books);
}));

// GET /api/history-plus/books/:id
router.get('/books/:id', asyncHandler(async (req, res) => {
  const book = await historyPlusService.getBookById(req.params.id);
  if (!book) {
    return sendBadRequest(res, 'Book not found');
  }
  sendSuccess(res, book);
}));

// POST /api/history-plus/books
router.post('/books', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title', 'author']);
  
  const book = await historyPlusService.createBook(req.body);
  sendSuccess(res, book);
}));

// PUT /api/history-plus/books/:id
router.put('/books/:id', asyncHandler(async (req, res) => {
  const book = await historyPlusService.updateBook(req.params.id, req.body);
  sendSuccess(res, book);
}));

// DELETE /api/history-plus/books/:id
router.delete('/books/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteBook(req.params.id);
  sendSuccess(res, { message: 'Book deleted successfully' });
}));

// POST /api/history-plus/books/:id/toggle-read
router.post('/books/:id/toggle-read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.toggleBookRead(req.params.id);
  sendSuccess(res, read);
}));

// ==========================================
// CHAPTERS ROUTES
// ==========================================

// GET /api/history-plus/chapters/:id
router.get('/chapters/:id', asyncHandler(async (req, res) => {
  const chapter = await historyPlusService.getChapterById(req.params.id);
  if (!chapter) {
    return sendBadRequest(res, 'Chapter not found');
  }
  sendSuccess(res, chapter);
}));

// POST /api/history-plus/chapters
router.post('/chapters', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title', 'bookId']);
  
  const chapter = await historyPlusService.createChapter(req.body);
  sendSuccess(res, chapter);
}));

// PUT /api/history-plus/chapters/:id
router.put('/chapters/:id', asyncHandler(async (req, res) => {
  const chapter = await historyPlusService.updateChapter(req.params.id, req.body);
  sendSuccess(res, chapter);
}));

// DELETE /api/history-plus/chapters/:id
router.delete('/chapters/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteChapter(req.params.id);
  sendSuccess(res, { message: 'Chapter deleted successfully' });
}));

// POST /api/history-plus/chapters/:id/toggle-read
router.post('/chapters/:id/toggle-read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.toggleChapterRead(req.params.id);
  sendSuccess(res, read);
}));

// ==========================================
// SECTIONS ROUTES
// ==========================================

// POST /api/history-plus/sections
router.post('/sections', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title', 'chapterId']);
  
  const section = await historyPlusService.createSection(req.body);
  sendSuccess(res, section);
}));

// PUT /api/history-plus/sections/:id
router.put('/sections/:id', asyncHandler(async (req, res) => {
  const section = await historyPlusService.updateSection(req.params.id, req.body);
  sendSuccess(res, section);
}));

// DELETE /api/history-plus/sections/:id
router.delete('/sections/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteSection(req.params.id);
  sendSuccess(res, { message: 'Section deleted successfully' });
}));

// POST /api/history-plus/sections/:id/toggle-read
router.post('/sections/:id/toggle-read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.toggleSectionRead(req.params.id);
  sendSuccess(res, read);
}));

// ==========================================
// VIDEOS ROUTES
// ==========================================

// GET /api/history-plus/videos
router.get('/videos', asyncHandler(async (req, res) => {
  const videos = await historyPlusService.getAllVideos();
  sendSuccess(res, { videos });
}));

// GET /api/history-plus/events/:eventId/videos
router.get('/events/:eventId/videos', asyncHandler(async (req, res) => {
  const videos = await historyPlusService.getVideosByEvent(req.params.eventId);
  sendSuccess(res, videos);
}));

// GET /api/history-plus/videos/:id
router.get('/videos/:id', asyncHandler(async (req, res) => {
  const video = await historyPlusService.getVideoById(req.params.id);
  if (!video) {
    return sendBadRequest(res, 'Video not found');
  }
  sendSuccess(res, video);
}));

// POST /api/history-plus/videos
router.post('/videos', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['url', 'type']);
  
  const video = await historyPlusService.createVideo(req.body);
  sendSuccess(res, video);
}));

// PUT /api/history-plus/videos/:id
router.put('/videos/:id', asyncHandler(async (req, res) => {
  const video = await historyPlusService.updateVideo(req.params.id, req.body);
  sendSuccess(res, video);
}));

// DELETE /api/history-plus/videos/:id
router.delete('/videos/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteVideo(req.params.id);
  sendSuccess(res, { message: 'Video deleted successfully' });
}));

// ==========================================
// CHANNELS ROUTES
// ==========================================

// GET /api/history-plus/channels
router.get('/channels', asyncHandler(async (req, res) => {
  const channels = await historyPlusService.getAllChannels();
  sendSuccess(res, channels);
}));

// POST /api/history-plus/channels
router.post('/channels', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['name', 'channelUrl']);
  
  const channel = await historyPlusService.createChannel(req.body);
  sendSuccess(res, channel);
}));

// GET /api/history-plus/channels/:id
router.get('/channels/:id', asyncHandler(async (req, res) => {
  const channel = await historyPlusService.getChannelById(req.params.id);
  if (!channel) {
    return sendBadRequest(res, 'Channel not found');
  }
  sendSuccess(res, channel);
}));

// PUT /api/history-plus/channels/:id
router.put('/channels/:id', asyncHandler(async (req, res) => {
  const channel = await historyPlusService.updateChannel(req.params.id, req.body);
  sendSuccess(res, channel);
}));

// DELETE /api/history-plus/channels/:id
router.delete('/channels/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteChannel(req.params.id);
  sendSuccess(res, { message: 'Channel deleted successfully' });
}));

// ==========================================
// PROGRESS TRACKING ROUTES
// ==========================================

// POST /api/history-plus/events/:id/review
router.post('/events/:id/review', asyncHandler(async (req, res) => {
  const review = await historyPlusService.markEventReviewed(req.params.id, req.body);
  sendSuccess(res, review);
}));

// POST /api/history-plus/videos/:id/watch
router.post('/videos/:id/watch', asyncHandler(async (req, res) => {
  const watch = await historyPlusService.markVideoWatched(req.params.id);
  sendSuccess(res, watch);
}));

// POST /api/history-plus/videos/:id/toggle-watched
router.post('/videos/:id/toggle-watched', asyncHandler(async (req, res) => {
  const watch = await historyPlusService.toggleVideoWatched(req.params.id);
  sendSuccess(res, watch);
}));

// POST /api/history-plus/videos/:id/complete
// Called when History Plus videos are completed in Up Next (web/Android)
router.post('/videos/:id/complete', asyncHandler(async (req, res) => {
  const result = await historyPlusService.completeVideo(req.params.id);
  sendSuccess(res, result);
}));

// POST /api/history-plus/books/:id/complete
// Called when History Plus books are completed in Up Next (web/Android)
router.post('/books/:id/complete', asyncHandler(async (req, res) => {
  const result = await historyPlusService.completeBook(req.params.id);
  sendSuccess(res, result);
}));

// POST /api/history-plus/chapters/:id/complete
// Called when History Plus chapters are completed in Up Next (web/Android)
router.post('/chapters/:id/complete', asyncHandler(async (req, res) => {
  const result = await historyPlusService.completeChapter(req.params.id);
  sendSuccess(res, result);
}));

// POST /api/history-plus/sections/:id/complete
// Called when History Plus sections are completed in Up Next (web/Android)
router.post('/sections/:id/complete', asyncHandler(async (req, res) => {
  const result = await historyPlusService.completeSection(req.params.id);
  sendSuccess(res, result);
}));

// POST /api/history-plus/books/:id/read (legacy endpoint)
router.post('/books/:id/read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.markBookRead(req.params.id);
  sendSuccess(res, read);
}));

// POST /api/history-plus/chapters/:id/read (legacy endpoint)
router.post('/chapters/:id/read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.markChapterRead(req.params.id);
  sendSuccess(res, read);
}));

// POST /api/history-plus/sections/:id/read (legacy endpoint)
router.post('/sections/:id/read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.markSectionRead(req.params.id);
  sendSuccess(res, read);
}));

// ==========================================
// STATISTICS & DASHBOARD ROUTES
// ==========================================

// GET /api/history-plus/statistics
router.get('/statistics', asyncHandler(async (req, res) => {
  const statistics = await historyPlusService.getOverallStatistics();
  sendSuccess(res, statistics);
}));

// GET /api/history-plus/video-stats
router.get('/video-stats', asyncHandler(async (req, res) => {
  const videoStats = await historyPlusService.getVideoStatistics();
  sendSuccess(res, videoStats);
}));

// GET /api/history-plus/search
router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return sendBadRequest(res, 'Search query is required');
  }
  
  const results = await historyPlusService.searchContent(q);
  sendSuccess(res, results);
}));

// GET /api/history-plus/categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await historyPlusService.getCategories();
  sendSuccess(res, categories);
}));

module.exports = router;
