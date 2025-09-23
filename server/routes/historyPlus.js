const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const HistoryPlusService = require('../services/historyPlusService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const historyPlusService = new HistoryPlusService();

// Configure multer for CSV file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'temp-uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('📁 Created temp-uploads directory:', uploadDir);
      }
      // Verify directory is writable
      fs.accessSync(uploadDir, fs.constants.W_OK);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Failed to create/access upload directory:', error);
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // Keep original filename but ensure it's a CSV
    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 20 // Max 20 files
  }
});

// ==========================================
// CSV FILE UPLOAD AND IMPORT ROUTES
// ==========================================

// POST /api/history-plus/upload-csv
router.post('/upload-csv', upload.array('csvFiles', 20), asyncHandler(async (req, res) => {
  console.log('📤 Processing CSV file uploads...');
  
  if (!req.files || req.files.length === 0) {
    return sendBadRequest(res, 'No CSV files uploaded');
  }
  
  const expectedFiles = [
    'export_metadata.csv',
    'historical_events.csv',
    'history_books.csv',
    'history_channels.csv',
    'history_chapters.csv',
    'history_sections.csv',
    'history_videos.csv',
    'user_book_reads.csv',
    'user_chapter_reads.csv',
    'user_event_reviews.csv',
    'user_section_reads.csv',
    'user_video_watches.csv'
  ];
  
  const uploadedFiles = req.files.map(file => file.filename);
  const missingFiles = expectedFiles.filter(expected => !uploadedFiles.includes(expected));
  const extraFiles = uploadedFiles.filter(uploaded => !expectedFiles.includes(uploaded));
  
  console.log(`📁 Uploaded ${uploadedFiles.length} files:`, uploadedFiles);
  if (missingFiles.length > 0) {
    console.log(`⚠️  Missing files:`, missingFiles);
  }
  if (extraFiles.length > 0) {
    console.log(`ℹ️  Extra files (will be ignored):`, extraFiles);
  }
  
  // Store upload session info
  const uploadSession = {
    id: Date.now().toString(),
    uploadedAt: new Date().toISOString(),
    files: uploadedFiles,
    directory: path.join(__dirname, '..', 'temp-uploads'),
    missingFiles: missingFiles,
    extraFiles: extraFiles,
    ready: missingFiles.length === 0
  };
  
  // Save upload session to temp file for import endpoint
  const sessionFile = path.join(__dirname, '..', 'temp-uploads', 'upload-session.json');
  fs.writeFileSync(sessionFile, JSON.stringify(uploadSession, null, 2));
  
  sendSuccess(res, {
    message: 'CSV files uploaded successfully',
    uploadSession: uploadSession,
    ready: missingFiles.length === 0,
    summary: {
      uploaded: uploadedFiles.length,
      expected: expectedFiles.length,
      missing: missingFiles.length,
      extra: extraFiles.length
    }
  });
}));

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

// POST /api/history-plus/books/:id/toggle-read
router.post('/books/:id/toggle-read', asyncHandler(async (req, res) => {
  const read = await historyPlusService.toggleBookRead(req.params.id);
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

// POST /api/history-plus/categories
router.post('/categories', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['name', 'color']);
  const category = await historyPlusService.createCategory(req.body);
  sendSuccess(res, category);
}));

// PUT /api/history-plus/categories/:id
router.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await historyPlusService.updateCategory(req.params.id, req.body);
  sendSuccess(res, category);
}));

// DELETE /api/history-plus/categories/:id
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  await historyPlusService.deleteCategory(req.params.id);
  sendSuccess(res, { message: 'Category deleted successfully' });
}));

// POST /api/history-plus/import-data
router.post('/import-data', asyncHandler(async (req, res) => {
  console.log('🔄 Starting History Plus data import via API...');
  
  const { force = false, useUploaded = false, clearExisting = false } = req.body;
  
  let exportDir;
  let importArgs;
  
  if (useUploaded) {
    // Use uploaded files from temp directory
    const tempDir = path.join(__dirname, '..', 'temp-uploads');
    const sessionFile = path.join(tempDir, 'upload-session.json');
    
    if (!fs.existsSync(sessionFile)) {
      return sendBadRequest(res, 'No uploaded files found. Please upload CSV files first.');
    }
    
    try {
      console.log('📖 Reading session file...');
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      console.log('📊 Session data:', JSON.stringify(sessionData, null, 2));
      exportDir = sessionData.directory;
    console.log('📁 Export directory from session:', exportDir);
    
    // Validate export directory exists and is accessible
    if (!fs.existsSync(exportDir)) {
      console.log('❌ Export directory does not exist:', exportDir);
      return sendBadRequest(res, 'Upload directory not found. Please try uploading files again.');
    }
    
    try {
      fs.accessSync(exportDir, fs.constants.R_OK);
    } catch (accessError) {
      console.log('❌ Export directory not accessible:', accessError.message);
      return sendBadRequest(res, 'Upload directory not accessible. Please try uploading files again.');
    }
    
    console.log('✅ Session ready check:', sessionData.ready);
    console.log('📋 Missing files:', sessionData.missingFiles);      if (!sessionData.ready || sessionData.missingFiles.length > 0) {
        console.log('❌ Session not ready or has missing files');
        return sendBadRequest(res, `Cannot import: missing required files: ${sessionData.missingFiles.join(', ')}`);
      }
      
      console.log(`📂 Using uploaded files from: ${exportDir}`);
      console.log(`📁 Found ${sessionData.files.length} uploaded CSV files`);
    } catch (error) {
      console.log('❌ Error reading session data:', error.message);
      return sendBadRequest(res, 'Failed to read upload session data.');
    }
    
    importArgs = [path.join(__dirname, '..', 'import-history-plus-data.js'), exportDir];
  } else {
    // Use traditional mounted directory
    exportDir = path.join(__dirname, '..', '..', 'history-plus-export');
    
    if (!fs.existsSync(exportDir)) {
      return sendBadRequest(res, 'History Plus export directory not found. Please ensure CSV files are available or use file upload.');
    }
    
    console.log(`📂 Using mounted directory: ${exportDir}`);
    importArgs = [path.join(__dirname, '..', 'import-history-plus-data.js'), exportDir];
  }
  
  // Check if CSV files exist
  const csvFiles = fs.readdirSync(exportDir).filter(file => file.endsWith('.csv'));
  if (csvFiles.length === 0) {
    return sendBadRequest(res, 'No CSV files found in directory.');
  }
  
  console.log(`� Found ${csvFiles.length} CSV files ready for import`);
  if (force) {
    console.log('🔄 Force mode enabled: Will update existing records');
    importArgs.push('--force');
  }
  if (clearExisting) {
    console.log('🗑️  Clear existing data enabled: Will delete all existing History Plus data first');
    importArgs.push('--clear-existing');
  }
  
  try {
    // Start the import process
    const result = await new Promise((resolve, reject) => {
      const importProcess = spawn('node', importArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(importArgs[0])
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
          const deletedMatch = output.match(/Deleted (\d+) existing records/);
          
          // Clean up uploaded files if this was an upload-based import
          if (useUploaded) {
            try {
              const tempDir = path.join(__dirname, '..', 'temp-uploads');
              if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                let cleanedCount = 0;
                files.forEach(file => {
                  try {
                    const filePath = path.join(tempDir, file);
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                  } catch (fileError) {
                    console.warn(`⚠️ Failed to delete file ${file}:`, fileError.message);
                  }
                });
                console.log(`🧹 Cleaned up ${cleanedCount} uploaded files`);
              } else {
                console.warn('⚠️ Temp directory not found during cleanup');
              }
            } catch (cleanupError) {
              console.warn('⚠️ Failed to clean up uploaded files:', cleanupError.message);
            }
          }
          
          resolve({
            success: true,
            message: 'History Plus data imported successfully',
            csvFiles: csvFiles.length,
            force: force,
            clearExisting: clearExisting,
            source: useUploaded ? 'uploaded' : 'mounted',
            statistics: {
              imported: importedMatch ? parseInt(importedMatch[1], 10) : 0,
              updated: updatedMatch ? parseInt(updatedMatch[1], 10) : 0,
              skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
              deleted: deletedMatch ? parseInt(deletedMatch[1], 10) : 0,
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
  try {
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
  } catch (error) {
    console.error('❌ Error in import-status endpoint:', error);
    sendServerError(res, 'Failed to check import status');
  }
}));

// ==========================================
// AI CATEGORIZATION ROUTES
// ==========================================

// POST /api/history-plus/ai/categorize-youtube
router.post('/ai/categorize-youtube', asyncHandler(async (req, res) => {
  const GeminiService = require('../services/GeminiService');
  const geminiService = new GeminiService();

  validateRequiredFields(req.body, ['youtubeUrl']);
  
  // Check if AI service is available
  if (!geminiService.isAvailable()) {
    const status = geminiService.getStatus();
    return sendBadRequest(res, 'AI categorization service is not available', { 
      error: 'Service unavailable',
      details: status 
    });
  }

  const { youtubeUrl } = req.body;

  try {
    // Get available categories
    const categories = await historyPlusService.getCategories();
    
    if (!categories || categories.length === 0) {
      return sendBadRequest(res, 'No categories available for AI analysis');
    }

    // Perform AI categorization
    const result = await geminiService.categorizeYouTubeContent(youtubeUrl, categories);
    
    sendSuccess(res, {
      message: 'YouTube content analyzed successfully',
      youtubeUrl: youtubeUrl,
      categorization: result,
      availableCategories: categories.length
    });

  } catch (error) {
    console.error('❌ AI categorization error:', error);
    sendServerError(res, 'AI categorization failed', error.message);
  }
}));

// POST /api/history-plus/ai/categorize-event
router.post('/ai/categorize-event/:eventId', asyncHandler(async (req, res) => {
  const GeminiService = require('../services/GeminiService');
  const geminiService = new GeminiService();

  // Check if AI service is available
  if (!geminiService.isAvailable()) {
    const status = geminiService.getStatus();
    return sendBadRequest(res, 'AI categorization service is not available', {
      error: 'Service unavailable', 
      details: status
    });
  }

  const { eventId } = req.params;

  try {
    // Get the event with its videos
    const event = await historyPlusService.getEventById(eventId);
    if (!event) {
      return sendBadRequest(res, 'Event not found');
    }

    // Find YouTube videos associated with this event
    const youtubeVideos = (event.videos || []).filter(video => 
      video.url && video.url.includes('youtube.com')
    );

    if (youtubeVideos.length === 0) {
      return sendBadRequest(res, 'No YouTube videos found for this event');
    }

    // Get available categories
    const categories = await historyPlusService.getCategories();
    
    if (!categories || categories.length === 0) {
      return sendBadRequest(res, 'No categories available for AI analysis');
    }

    // Use the first YouTube video for categorization
    const primaryVideo = youtubeVideos[0];
    const result = await geminiService.categorizeYouTubeContent(primaryVideo.url, categories);
    
    // If AI suggests a category and confidence is high enough, optionally auto-update
    const { autoApply = false, confidenceThreshold = 0.7 } = req.body;
    let updatedEvent = event;
    
    if (autoApply && result.success && result.confidence >= confidenceThreshold && result.suggestedCategoryId) {
      // Update the event's category
      updatedEvent = await historyPlusService.updateEvent(eventId, {
        category: result.suggestedCategory,
        categoryId: result.suggestedCategoryId
      });
      
      console.log(`✅ Auto-applied AI category "${result.suggestedCategory}" to event "${event.title}"`);
    }

    sendSuccess(res, {
      message: 'Event analyzed successfully',
      event: {
        id: event.id,
        title: event.title,
        currentCategory: event.category
      },
      analyzedVideo: {
        url: primaryVideo.url,
        title: primaryVideo.title
      },
      categorization: result,
      autoApplied: autoApply && result.success && result.confidence >= confidenceThreshold,
      updatedEvent: updatedEvent !== event ? updatedEvent : null
    });

  } catch (error) {
    console.error('❌ Event AI categorization error:', error);
    sendServerError(res, 'Event AI categorization failed', error.message);
  }
}));

// GET /api/history-plus/ai/status
router.get('/ai/status', asyncHandler(async (req, res) => {
  const GeminiService = require('../services/GeminiService');
  const geminiService = new GeminiService();

  const status = geminiService.getStatus();
  
  sendSuccess(res, {
    service: 'Gemini AI Integration',
    status: status,
    features: {
      youtubeAnalysis: status.available,
      eventCategorization: status.available,
      contentAnalysis: status.available
    },
    model: status.model,
    ready: status.available
  });
}));

// POST /api/history-plus/ai/analyze-content
router.post('/ai/analyze-content', asyncHandler(async (req, res) => {
  const GeminiService = require('../services/GeminiService');
  const geminiService = new GeminiService();

  validateRequiredFields(req.body, ['content']);
  
  // Check if AI service is available
  if (!geminiService.isAvailable()) {
    const status = geminiService.getStatus();
    return sendBadRequest(res, 'AI service is not available', { 
      error: 'Service unavailable',
      details: status 
    });
  }

  const { content, context = '' } = req.body;

  try {
    const result = await geminiService.analyzeContent(content, context);
    
    sendSuccess(res, {
      message: 'Content analyzed successfully',
      analysis: result,
      inputContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      context: context
    });

  } catch (error) {
    console.error('❌ Content analysis error:', error);
    sendServerError(res, 'Content analysis failed', error.message);
  }
}));

// POST /api/history-plus/ai/categorize-video/:videoId
router.post('/ai/categorize-video/:videoId', asyncHandler(async (req, res) => {
  const GeminiService = require('../services/GeminiService');
  const geminiService = new GeminiService();

  // Check if AI service is available
  if (!geminiService.isAvailable()) {
    const status = geminiService.getStatus();
    return sendBadRequest(res, 'AI categorization service is not available', {
      error: 'Service unavailable',
      details: status
    });
  }

  const { videoId } = req.params;
  const { preview } = req.query; // Check if this is a preview request

  try {
    // Get the video
    const video = await historyPlusService.getVideoById(videoId);
    if (!video) {
      return sendBadRequest(res, 'Video not found');
    }

    // Check if it's a YouTube video
    if (!video.url || !video.url.includes('youtube.com')) {
      return sendBadRequest(res, 'Video must be a YouTube video for AI analysis');
    }

    // Check if video is already assigned to an event
    if (video.eventId) {
      return sendBadRequest(res, 'Video is already assigned to an event');
    }

    // Get available events and categories for suggestions
    const [events, categories] = await Promise.all([
      historyPlusService.getAllEvents(),
      historyPlusService.getCategories()
    ]);

    if (!categories || categories.length === 0) {
      return sendBadRequest(res, 'No categories available for AI analysis');
    }

    // If preview mode, return the prompt data instead of calling AI
    if (preview === 'true') {
      const promptData = {
        videoUrl: video.url,
        videoTitle: video.title,
        videoDescription: video.description,
        events: (events || []).slice(0, 20).map(event => ({
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          category: event.category
        })),
        categories: (categories || []).map(cat => ({
          name: cat.name,
          description: cat.description
        })),
        fullPrompt: geminiService.buildVideoAssignmentPrompt(
          video.url,
          video.title || '',
          video.description || '',
          events || [],
          categories || []
        )
      };

      return sendSuccess(res, promptData);
    }

    // Use AI to analyze the video and suggest event assignment or new event creation
    const result = await geminiService.categorizeVideoForEventAssignment(
      video.url, 
      video.title || '', 
      video.description || '',
      events || [], 
      categories || []
    );
    
    sendSuccess(res, {
      message: 'Video analyzed successfully',
      video: {
        id: video.id,
        title: video.title,
        url: video.url,
        currentAssignment: video.eventId ? 'assigned' : 'unassigned'
      },
      suggestion: result,
      availableEvents: (events || []).length,
      availableCategories: (categories || []).length
    });

  } catch (error) {
    console.error('❌ Video AI categorization error:', error);
    sendServerError(res, 'Video AI categorization failed', error.message);
  }
}));

// POST /api/history-plus/ai/assign-video-to-event
router.post('/ai/assign-video-to-event', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['videoId', 'eventId']);
  
  const { videoId, eventId } = req.body;

  try {
    // Update video to assign it to the event
    const updatedVideo = await historyPlusService.updateVideo(videoId, {
      eventId: eventId
    });
    
    sendSuccess(res, {
      message: 'Video assigned to event successfully',
      video: updatedVideo
    });

  } catch (error) {
    console.error('❌ Error assigning video to event:', error);
    sendServerError(res, 'Failed to assign video to event', error.message);
  }
}));

// POST /api/history-plus/ai/create-event-for-video
router.post('/ai/create-event-for-video', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['videoId', 'eventData']);
  
  const { videoId, eventData } = req.body;

  try {
    // Create new event
    const newEvent = await historyPlusService.createEvent(eventData);
    
    // Assign video to the new event
    const updatedVideo = await historyPlusService.updateVideo(videoId, {
      eventId: newEvent.id
    });
    
    sendSuccess(res, {
      message: 'New event created and video assigned successfully',
      event: newEvent,
      video: updatedVideo
    });

  } catch (error) {
    console.error('❌ Error creating event for video:', error);
    sendServerError(res, 'Failed to create event for video', error.message);
  }
}));

module.exports = router;
