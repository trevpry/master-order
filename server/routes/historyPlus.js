const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const HistoryPlusService = require('../services/historyPlusService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
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

// POST /api/history-plus/import-data
router.post('/import-data', asyncHandler(async (req, res) => {
  console.log('🔄 Starting History Plus data import via API...');
  
  const { force = false } = req.body;
  
  // Check if export directory exists
  const exportDir = path.join(__dirname, '..', '..', 'history-plus-export');
  console.log('🔍 Looking for CSV files at:', exportDir);
  console.log('📁 Directory exists:', fs.existsSync(exportDir));
  
  if (!fs.existsSync(exportDir)) {
    return sendBadRequest(res, 'History Plus export directory not found. Please ensure CSV files are available.');
  }
  
  // Check if CSV files exist
  const csvFiles = fs.readdirSync(exportDir).filter(file => file.endsWith('.csv'));
  if (csvFiles.length === 0) {
    return sendBadRequest(res, 'No CSV files found in export directory.');
  }
  
  console.log(`📂 Found ${csvFiles.length} CSV files ready for import`);
  if (force) {
    console.log('🔄 Force mode enabled: Will update existing records');
  }
  
  try {
    // Start the import process
    const importScript = path.join(__dirname, '..', 'import-history-plus-data.js');
    const args = [importScript, exportDir];
    if (force) {
      args.push('--force');
    }
    
    const result = await new Promise((resolve, reject) => {
      const importProcess = spawn('node', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(importScript)
      });
      
      let output = '';
      let errorOutput = '';
      
      // Send 'y' to confirm the import
      importProcess.stdin.write('y\n');
      importProcess.stdin.end();
      
      importProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(chunk.trim());
      });
      
      importProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.error(chunk.trim());
      });
      
      importProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ History Plus import completed successfully');
          
          // Parse the output to extract statistics  
          const importedMatch = output.match(/Records imported: (\d+)/);
          const updatedMatch = output.match(/Records updated: (\d+)/);
          const skippedMatch = output.match(/Records skipped.*: (\d+)/);
          const errorsMatch = output.match(/Errors: (\d+)/);
          
          resolve({
            success: true,
            message: 'History Plus data imported successfully',
            csvFiles: csvFiles.length,
            force: force,
            statistics: {
              imported: importedMatch ? parseInt(importedMatch[1], 10) : 0,
              updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
              skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
              errors: errorsMatch ? parseInt(errorsMatch[1], 10) : 0
            },
            output: output
          });
        } else {
          console.error('❌ History Plus import failed with code:', code);
          
          reject(new Error(`Import process failed with code ${code}: ${errorOutput || 'Unknown error'}`));
        }
      });
      
      importProcess.on('error', (err) => {
        console.error('❌ Failed to start import process:', err);
        reject(new Error(`Failed to start import process: ${err.message}`));
      });
    });
    
    sendSuccess(res, result);
    
  } catch (error) {
    console.error('❌ Import process error:', error);
    sendServerError(res, 'Import process failed', error.message);
  }
}));

// GET /api/history-plus/import-status
router.get('/import-status', asyncHandler(async (req, res) => {
  const exportDir = path.join(__dirname, '..', '..', 'history-plus-export');
  console.log('🔍 Checking import status for directory:', exportDir);
  console.log('📁 Directory exists:', fs.existsSync(exportDir));
  
  // Check if we have existing History Plus data
  const historicalEventCount = await prisma.historicalEvent.count();
  const historyVideoCount = await prisma.historyVideo.count();
  const historyBookCount = await prisma.historyBook.count();
  
  const totalRecords = historicalEventCount + historyVideoCount + historyBookCount;
  const hasData = totalRecords > 0;
  
  const status = {
    exportDirExists: fs.existsSync(exportDir),
    csvFiles: [],
    ready: false,
    hasData: hasData,
    existingRecords: {
      historicalEvents: historicalEventCount,
      historyVideos: historyVideoCount,
      historyBooks: historyBookCount,
      total: totalRecords
    }
  };
  
  if (status.exportDirExists) {
    status.csvFiles = fs.readdirSync(exportDir).filter(file => file.endsWith('.csv'));
    status.ready = status.csvFiles.length > 0;
  }
  
  sendSuccess(res, status);
}));

module.exports = router;
