/**
 * Android History Plus Reading Session Routes
 * Handles reading session management specifically for History Plus content
 * Implements dual-layer approach: reading sessions for parent books, granular marking for specific content
 */

const express = require('express');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../../utils/responses');
const { validateRequiredFields } = require('../../middleware/validation');
const WatchLogService = require('../../watchLogService');
const HistoryPlusService = require('../../services/historyPlusService');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create History Plus reading session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createHistoryPlusReadingSessionRoutes(prisma) {
  console.log('🔧 Creating History Plus reading session routes...');
  const router = express.Router();
  
  if (!prisma) {
    console.error('❌ Error: prisma client not provided to History Plus reading session routes');
    throw new Error('Prisma client is required for History Plus reading session routes');
  }
  
  console.log('✅ History Plus reading session routes: Prisma client initialized');
  const watchLogService = new WatchLogService(prisma);
  const historyPlusService = new HistoryPlusService(prisma);

  // Start History Plus reading session
  router.post('/history-plus/reading/start', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to start History Plus reading session...');
    console.log('📱 Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      contentType, contentId, bookId, bookTitle,
      chapterId, chapterTitle, chapterNumber,
      sectionId, sectionTitle, sectionNumber,
      eventId, eventTitle 
    } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['contentType', 'contentId', 'bookId', 'bookTitle', 'eventId', 'eventTitle']);

    // Validate content type
    if (!['book', 'chapter', 'section'].includes(contentType)) {
      return res.status(400).json(createAndroidErrorResponse(
        'INVALID_CONTENT_TYPE',
        'Invalid content type',
        'Content type must be book, chapter, or section'
      ));
    }

    // Additional validation based on content type
    if (contentType === 'section' && (!chapterId || !sectionId)) {
      return res.status(400).json(createAndroidErrorResponse(
        'MISSING_SECTION_DATA',
        'Missing section data',
        'Section content requires chapterId and sectionId'
      ));
    }

    if (contentType === 'chapter' && !chapterId) {
      return res.status(400).json(createAndroidErrorResponse(
        'MISSING_CHAPTER_DATA',
        'Missing chapter data',
        'Chapter content requires chapterId'
      ));
    }

    try {
      // Create reading session for the parent book (always track time at book level)
      console.log(`📚 Creating reading session for parent book: ${bookTitle} (ID: ${bookId})`);
      
      // Store History Plus context in the seriesTitle field with a special format
      const historyPlusSeriesTitle = `HISTORY_PLUS:${eventId}:${contentType}:${contentId}:${eventTitle}`;
      
      const bookReadingSession = await watchLogService.startReading({
        customOrderItemId: null, // History Plus doesn't use custom order items
        mediaType: 'book',
        title: bookTitle,
        seriesTitle: historyPlusSeriesTitle // Encode History Plus context here
      });

      // Build formatted title for the specific content being read
      let formattedTitle = bookTitle;
      if (contentType === 'chapter') {
        formattedTitle = `${bookTitle} - Chapter ${chapterNumber || ''}: ${chapterTitle || 'Unknown Chapter'}`;
      } else if (contentType === 'section') {
        formattedTitle = `${bookTitle} - Chapter ${chapterNumber || ''}: ${chapterTitle || 'Unknown Chapter'} - Section ${sectionNumber || ''}: ${sectionTitle || 'Unknown Section'}`;
      }

      console.log(`✅ Started History Plus reading session. Book session ID: ${bookReadingSession.id}, Content: ${formattedTitle}`);

      const responseData = {
        success: true,
        sessionId: `history-plus-${contentType}-${contentId}`, // Virtual session ID for the specific content
        bookSessionId: bookReadingSession.id, // Actual session ID for the book
        contentType,
        contentId,
        bookId,
        bookTitle,
        readingContent: {
          type: contentType,
          title: formattedTitle,
          ...(contentType === 'chapter' && { chapterNumber, chapterTitle }),
          ...(contentType === 'section' && { 
            chapterNumber, chapterTitle, sectionNumber, sectionTitle 
          })
        },
        eventContext: {
          eventId,
          eventTitle
        },
        startedAt: bookReadingSession.startTime,
        isPaused: false,
        message: `Started reading session for "${bookTitle}" (${contentType === 'book' ? 'Book' : contentType === 'chapter' ? `Chapter ${chapterNumber}: ${chapterTitle}` : `Section ${sectionNumber}: ${sectionTitle}`})`,
        timestamp: new Date().toISOString()
      };

      res.json(createAndroidResponse('HISTORY_PLUS_READING_SESSION_STARTED', responseData));

    } catch (error) {
      console.error('Error starting History Plus reading session:', error);
      res.status(500).json(createAndroidErrorResponse(
        'SESSION_START_ERROR',
        'Failed to start reading session',
        error.message
      ));
    }
  }));

  // Pause/Resume History Plus reading session
  router.post('/history-plus/reading/pause', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to pause/resume History Plus reading session...');
    
    try {
      // Get the active reading session (should be for a book)
      const activeSession = await watchLogService.getActiveReadingSession();
      
      if (!activeSession) {
        return res.status(404).json(createAndroidErrorResponse(
          'NO_ACTIVE_SESSION',
          'No active reading session',
          'No active reading session found to pause/resume'
        ));
      }

      // Verify this is a History Plus session by checking seriesTitle format
      console.log('🔍 Checking active session for History Plus context...');
      console.log('📋 Active session seriesTitle:', activeSession.seriesTitle);
      console.log('📋 Active session title:', activeSession.title);
      console.log('📋 Active session mediaType:', activeSession.mediaType);
      
      if (!activeSession.seriesTitle || !activeSession.seriesTitle.startsWith('HISTORY_PLUS:')) {
        console.log('❌ Session is not a History Plus session - seriesTitle does not start with HISTORY_PLUS:');
        return res.status(400).json(createAndroidErrorResponse(
          'NOT_HISTORY_PLUS_SESSION',
          'Not a History Plus session',
          'Active session is not a History Plus reading session'
        ));
      }

      // Parse the History Plus context from seriesTitle
      const contextParts = activeSession.seriesTitle.split(':');
      if (contextParts.length < 5) {
        return res.status(400).json(createAndroidErrorResponse(
          'INVALID_HISTORY_PLUS_CONTEXT',
          'Invalid History Plus context',
          'Invalid History Plus context format'
        ));
      }

      const [prefix, eventId, contentType, contentId, ...eventTitleParts] = contextParts;
      const eventTitle = eventTitleParts.join(':'); // Rejoin in case event title had colons

      console.log(`📖 Managing History Plus session for ${eventTitle}, contentType: ${contentType}, contentId: ${contentId}`);

      // Pause or resume the session
      const updatedSession = await watchLogService.pauseReading(activeSession.id);
      
      // Build response title based on content type
      let formattedTitle = activeSession.title;
      if (contentType === 'chapter') {
        // We'll need to get chapter details from the database for full context
        formattedTitle = `${activeSession.title} - Chapter: ${contentType}`;
      } else if (contentType === 'section') {
        formattedTitle = `${activeSession.title} - Section: ${contentType}`;
      }

      const responseData = {
        success: true,
        sessionId: `history-plus-${contentType}-${contentId}`,
        bookSessionId: activeSession.id,
        isPaused: updatedSession.isPaused,
        bookTitle: activeSession.title,
        contentType: contentType,
        readingContent: {
          title: formattedTitle
        },
        message: `${updatedSession.isPaused ? 'Paused' : 'Resumed'} reading session for "${activeSession.title}"`,
        pausedAt: updatedSession.isPaused ? new Date().toISOString() : null,
        resumedAt: !updatedSession.isPaused ? new Date().toISOString() : null,
        totalActiveTime: updatedSession.totalActiveTime || 0,
        timestamp: new Date().toISOString()
      };

      res.json(createAndroidResponse('HISTORY_PLUS_READING_SESSION_PAUSED', responseData));

    } catch (error) {
      console.error('Error pausing/resuming History Plus reading session:', error);
      res.status(500).json(createAndroidErrorResponse(
        'SESSION_PAUSE_ERROR',
        'Failed to pause/resume reading session',
        error.message
      ));
    }
  }));

  // Stop History Plus reading session
  router.post('/history-plus/reading/stop', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to stop History Plus reading session...');
    
    try {
      // Get the active reading session
      const activeSession = await watchLogService.getActiveReadingSession();
      
      if (!activeSession) {
        return res.status(404).json(createAndroidErrorResponse(
          'NO_ACTIVE_SESSION',
          'No active reading session',
          'No active reading session found to stop'
        ));
      }

      // Verify this is a History Plus session by checking seriesTitle format
      if (!activeSession.seriesTitle || !activeSession.seriesTitle.startsWith('HISTORY_PLUS:')) {
        return res.status(400).json(createAndroidErrorResponse(
          'NOT_HISTORY_PLUS_SESSION',
          'Not a History Plus session',
          'Active session is not a History Plus reading session'
        ));
      }

      // Parse the History Plus context from seriesTitle
      const contextParts = activeSession.seriesTitle.split(':');
      if (contextParts.length < 5) {
        return res.status(400).json(createAndroidErrorResponse(
          'INVALID_HISTORY_PLUS_CONTEXT',
          'Invalid History Plus context',
          'Invalid History Plus context format'
        ));
      }

      const [prefix, eventId, contentType, contentId, ...eventTitleParts] = contextParts;
      const eventTitle = eventTitleParts.join(':'); // Rejoin in case event title had colons

      console.log(`📖 Stopping History Plus session for ${eventTitle}, contentType: ${contentType}, contentId: ${contentId}`);

      // Stop the session
      const stoppedSession = await watchLogService.stopReading(activeSession.id);
      
      // Build response title based on content type
      let formattedTitle = activeSession.title;
      if (contentType === 'chapter') {
        formattedTitle = `${activeSession.title} - Chapter: ${contentType}`;
      } else if (contentType === 'section') {
        formattedTitle = `${activeSession.title} - Section: ${contentType}`;
      }

      const responseData = {
        success: true,
        sessionId: `history-plus-${contentType}-${contentId}`,
        bookSessionId: activeSession.id,
        bookTitle: activeSession.title,
        contentType: contentType,
        readingContent: {
          title: formattedTitle
        },
        duration: stoppedSession.duration || 0,
        totalActiveTime: stoppedSession.totalActiveTime || 0,
        message: `Stopped reading session for "${activeSession.title}"`,
        completedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      res.json(createAndroidResponse('HISTORY_PLUS_READING_SESSION_STOPPED', responseData));

    } catch (error) {
      console.error('Error stopping History Plus reading session:', error);
      res.status(500).json(createAndroidErrorResponse(
        'SESSION_STOP_ERROR',
        'Failed to stop reading session',
        error.message
      ));
    }
  }));

  // Mark History Plus content as read
  router.post('/history-plus/reading/mark-read', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to mark History Plus content as read...');
    console.log('📱 Request body:', JSON.stringify(req.body, null, 2));
    
    const { contentType, contentId, bookId, chapterId, eventId } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['contentType', 'contentId', 'bookId', 'eventId']);

    if (!['book', 'chapter', 'section'].includes(contentType)) {
      return res.status(400).json(createAndroidErrorResponse(
        'INVALID_CONTENT_TYPE',
        'Invalid content type',
        'Content type must be book, chapter, or section'
      ));
    }

    if (contentType === 'section' && !chapterId) {
      return res.status(400).json(createAndroidErrorResponse(
        'MISSING_CHAPTER_ID',
        'Missing chapter ID',
        'Section content requires chapterId'
      ));
    }

    try {
      let markedContent;
      let affectedContent = {};

      // Mark the specific content as read based on type
      if (contentType === 'book') {
        await historyPlusService.markBookAsRead(contentId);
        const book = await prisma.book.findUnique({
          where: { id: contentId },
          include: { chapters: true }
        });
        markedContent = book;
        affectedContent = {
          bookTitle: book.title,
          chaptersInBook: book.chapters.length,
          chaptersMarkedRead: book.chapters.length // Assuming all chapters are marked when book is marked
        };
      } else if (contentType === 'chapter') {
        await historyPlusService.markChapterAsRead(contentId);
        const chapter = await prisma.chapter.findUnique({
          where: { id: contentId },
          include: { 
            book: true,
            sections: true
          }
        });
        markedContent = chapter;
        affectedContent = {
          chapterTitle: chapter.title,
          bookTitle: chapter.book.title,
          sectionsInChapter: chapter.sections.length,
          sectionsMarkedRead: chapter.sections.length // Assuming all sections are marked when chapter is marked
        };
      } else if (contentType === 'section') {
        await historyPlusService.markSectionAsRead(contentId);
        const section = await prisma.section.findUnique({
          where: { id: contentId },
          include: { 
            chapter: {
              include: { book: true }
            }
          }
        });
        markedContent = section;
        affectedContent = {
          sectionTitle: section.title,
          chapterTitle: section.chapter.title,
          bookTitle: section.chapter.book.title
        };
      }

      // Calculate event progress
      const eventProgress = await historyPlusService.getEventProgress(eventId);
      
      const responseData = {
        success: true,
        contentType,
        contentId,
        bookId,
        ...(chapterId && { chapterId }),
        markedAsRead: true,
        affectedContent,
        eventProgress: {
          eventId,
          eventTitle: eventProgress.eventTitle,
          totalContent: eventProgress.totalItems,
          readContent: eventProgress.readItems,
          completionPercentage: Math.round((eventProgress.readItems / eventProgress.totalItems) * 100 * 10) / 10,
          eventCompleted: eventProgress.isCompleted
        },
        message: `Marked ${contentType} "${markedContent.title}" as read${eventProgress.isCompleted ? ' - Event completed!' : ''}`,
        timestamp: new Date().toISOString()
      };

      res.json(createAndroidResponse('HISTORY_PLUS_CONTENT_MARKED_READ', responseData));

    } catch (error) {
      console.error('Error marking History Plus content as read:', error);
      res.status(500).json(createAndroidErrorResponse(
        'MARK_READ_ERROR',
        'Failed to mark content as read',
        error.message
      ));
    }
  }));

  return router;
}

module.exports = createHistoryPlusReadingSessionRoutes;