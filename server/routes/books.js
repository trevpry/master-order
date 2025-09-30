/**
 * Books API Routes
 * 
 * Unified book management endpoints providing comprehensive functionality
 * for the new Books system. Replaces distributed book handling across
 * CustomOrders and HistoryPlus with a single, consistent API.
 * 
 * Features:
 * - Complete CRUD operations for books, chapters, and sections
 * - Unified reading session management
 * - Progress tracking and completion handling
 * - Search and filtering capabilities
 * - Migration and integration support
 * - Backward compatibility for existing systems
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const BookService = require('../services/BookService');
const BookCompletionService = require('../services/BookCompletionService');
const BookIntegrationService = require('../services/BookIntegrationService');

// Initialize services
const bookService = new BookService();
const completionService = new BookCompletionService();
const integrationService = new BookIntegrationService();

// Keep the existing reference book endpoint for backward compatibility
const prisma = require('../prismaClient');

// ==========================================
// LEGACY COMPATIBILITY - REFERENCE BOOKS
// ==========================================

// Create a reference book (for containing short stories) without adding to collection order
router.post('/reference', validateRequiredFields('customOrderId', 'customOrderId is required to create a book'), asyncHandler(async (req, res) => {
  const {
    title,
    bookTitle,
    bookAuthor,
    bookYear,
    bookIsbn,
    bookPublisher,
    bookOpenLibraryId,
    bookCoverUrl,
    bookPageCount,
    customOrderId // Order context is needed due to schema constraints
  } = req.body;

  // Check if this book already exists globally by OpenLibrary ID
  const existingBook = await prisma.customOrderItem.findFirst({
    where: {
      mediaType: 'book',
      bookOpenLibraryId: bookOpenLibraryId
    }
  });

  if (existingBook) {
    return res.json(existingBook);
  }

  // Generate a unique plexKey for the book (since it's required by schema)
  const bookPlexKey = `book_${bookOpenLibraryId || Date.now()}`;

  // Create the book entry in the specified order
  const book = await prisma.customOrderItem.create({
    data: {
      mediaType: 'book',
      plexKey: bookPlexKey,
      title: title,
      bookTitle: bookTitle,
      bookAuthor: bookAuthor,
      bookYear: bookYear,
      bookIsbn: bookIsbn,
      bookPublisher: bookPublisher,
      bookOpenLibraryId: bookOpenLibraryId,
      bookCoverUrl: bookCoverUrl,
      bookPageCount: bookPageCount ? parseInt(bookPageCount) : null,
      sortOrder: 0,
      customOrderId: customOrderId,
      isWatched: true // Reference books are automatically marked as watched
    }
  });

  res.status(201).json(book);
}));

// ==========================================
// UNIFIED BOOK MANAGEMENT ENDPOINTS
// ==========================================

/**
 * GET /api/books
 * Get all books with optional filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    search,
    author,
    genre,
    year,
    publisher,
    completed,
    hasChapters,
    owned,
    eventId,
    page = 1,
    limit = 20,
    sortBy = 'title',
    sortOrder = 'asc'
  } = req.query;

  const options = {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100), // Max 100 per page
    sortBy,
    sortOrder,
    filters: {
      author,
      genre,
      year: year ? parseInt(year) : undefined,
      publisher,
      completed: completed !== undefined ? completed === 'true' : undefined,
      hasChapters: hasChapters !== undefined ? hasChapters === 'true' : undefined,
      owned: owned !== undefined ? owned === 'true' : undefined
    }
  };

  let books;
  if (eventId) {
    // Get books for specific historical event
    books = await integrationService.getBooksForEvent(parseInt(eventId));
  } else if (search) {
    // Search books
    books = await integrationService.searchAllBooks(search, options);
  } else {
    // Get all books with filtering - simplified for debugging
    try {
      books = await bookService.getAllBooks(options);
    } catch (error) {
      console.error('Error in getAllBooks:', error);
      books = { books: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  // Add progress information to each book
  if (books.books && books.books.length > 0) {
    console.log(`📊 Adding progress data to ${books.books.length} books...`);
    const booksWithProgress = await Promise.all(
      books.books.map(async (book) => {
        try {
          const progressReport = await completionService.getBookProgressReport(book.id);
          book.progress = {
            ...progressReport,
            percentageComplete: progressReport.percentRead || 0
          };
          return book;
        } catch (error) {
          console.error(`Error getting progress for book ${book.id}:`, error);
          // Return book without progress if there's an error
          book.progress = { percentageComplete: 0 };
          return book;
        }
      })
    );
    books.books = booksWithProgress;
  }

  sendSuccess(res, books);
}));

// ==========================================
// SEARCH & FILTERING ENDPOINTS (MUST BE BEFORE /:id)
// ==========================================

/**
 * GET /api/books/search
 * Search books across all sources
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { query, ...options } = req.query;

  if (!query) {
    return sendBadRequest(res, 'Search query is required');
  }

  const books = await integrationService.searchAllBooks(query, options);
  sendSuccess(res, books);
}));

/**
 * GET /api/books/authors
 * Get all authors
 */
router.get('/authors', asyncHandler(async (req, res) => {
  const authors = await bookService.getAllAuthors();
  sendSuccess(res, authors);
}));

/**
 * GET /api/books/genres
 * Get all genres
 */
router.get('/genres', asyncHandler(async (req, res) => {
  const genres = await bookService.getAllGenres();
  sendSuccess(res, genres);
}));

/**
 * GET /api/books/publishers
 * Get all publishers
 */
router.get('/publishers', asyncHandler(async (req, res) => {
  const publishers = await bookService.getAllPublishers();
  sendSuccess(res, publishers);
}));

/**
 * GET /api/books/stats
 * Get overall book system statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await bookService.getSystemStats();
  sendSuccess(res, stats);
}));

// ==========================================
// INTEGRATION ENDPOINTS (MUST BE BEFORE /:id) 
// ==========================================

/**
 * POST /api/books/migrate/custom-order-item/:id
 * Migrate CustomOrderItem to unified book system
 */
router.post('/migrate/custom-order-item/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customOrderItem = await integrationService.prisma.customOrderItem.findUnique({
    where: { id: parseInt(id) }
  });

  if (!customOrderItem) {
    return sendBadRequest(res, 'CustomOrderItem not found');
  }

  const book = await integrationService.createOrGetBookForCustomOrder(customOrderItem);
  sendSuccess(res, book);
}));

// ==========================================
// HISTORY PLUS INTEGRATION ENDPOINTS (MUST BE BEFORE /:id)
// ==========================================

/**
 * GET /api/books/history-events/:eventId
 * Get books associated with historical event
 */
router.get('/history-events/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const books = await integrationService.getBooksForEvent(parseInt(eventId));
  sendSuccess(res, books);
}));

/**
 * POST /api/books/history-events/:eventId
 * Create book associated with historical event
 */
router.post('/history-events/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateRequiredFields(req.body, ['title']);

  const bookData = req.body;
  const book = await integrationService.createHistoryPlusBook(bookData, parseInt(eventId));

  sendSuccess(res, book);
}));

/**
 * POST /api/books/history-plus/mark-read
 * Mark History Plus content as read
 */
router.post('/history-plus/mark-read', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['contentType']);

  const contentData = req.body;
  const result = await integrationService.markHistoryPlusContentAsRead(contentData);

  sendSuccess(res, result);
}));

// ==========================================
// LEGACY COMPATIBILITY ENDPOINTS (MUST BE BEFORE /:id)
// ==========================================

/**
 * GET /api/books/legacy/custom-order-item/:id
 * Get book data in legacy CustomOrderItem format
 */
router.get('/legacy/custom-order-item/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const legacyData = await integrationService.getLegacyCustomOrderBookData(parseInt(id));
  sendSuccess(res, legacyData);
}));

// ==========================================
// BOOK MANAGEMENT ENDPOINTS (PARAMETERIZED - MUST BE LAST)
// ==========================================

/**
 * GET /api/books/:id
 * Get book by ID with full details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeChapters = true, includeProgress = true } = req.query;

  const book = await bookService.getBookById(parseInt(id));

  if (!book) {
    return sendBadRequest(res, 'Book not found');
  }

  // Add progress information if requested
  if (includeProgress === 'true') {
    const progressReport = await completionService.getBookProgressReport(book.id);
    
    // Merge progress data into the book structure
    book.progress = {
      ...progressReport,
      percentageComplete: progressReport.percentRead || 0
    };
    
    // If we have chapters with progress data, merge them with the book chapters
    if (progressReport.chapters && book.chapters) {
      book.chapters = book.chapters.map(chapter => {
        const progressChapter = progressReport.chapters.find(pc => pc.id === chapter.id);
        return {
          ...chapter,
          isCompleted: progressChapter?.isCompleted || false,
          completedAt: progressChapter?.completedAt,
          sectionsProgress: progressChapter?.sectionsProgress || 0,
          sections: chapter.sections?.map(section => {
            const progressSection = progressChapter?.sections?.find(ps => ps.id === section.id);
            return {
              ...section,
              isCompleted: progressSection?.isCompleted || false,
              completedAt: progressSection?.completedAt
            };
          }) || []
        };
      });
    }
  }

  sendSuccess(res, book);
}));

/**
 * POST /api/books
 * Create a new book
 */
router.post('/', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title']);

  const bookData = req.body;
  const book = await bookService.createBook(bookData);

  sendSuccess(res, book);
}));

/**
 * PUT /api/books/:id
 * Update book by ID
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const book = await bookService.updateBook(parseInt(id), updateData);
  sendSuccess(res, book);
}));

/**
 * PUT /api/books/:id/owned
 * Update book owned status
 */
router.put('/:id/owned', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { owned } = req.body;

  if (typeof owned !== 'boolean') {
    return sendBadRequest(res, 'owned must be a boolean value');
  }

  const book = await bookService.updateBook(parseInt(id), { owned });
  sendSuccess(res, book);
}));

/**
 * DELETE /api/books/:id
 * Delete book by ID
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await bookService.deleteBook(parseInt(id));
  sendSuccess(res, { message: 'Book deleted successfully' });
}));

// ==========================================
// CHAPTER MANAGEMENT ENDPOINTS
// ==========================================

/**
 * GET /api/books/:bookId/chapters
 * Get all chapters for a book
 */
router.get('/:bookId/chapters', asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { includeSections = false } = req.query;

  const chapters = await bookService.getBookChapters(parseInt(bookId), {
    includeSections: includeSections === 'true'
  });

  sendSuccess(res, chapters);
}));

/**
 * POST /api/books/:bookId/chapters
 * Add chapter to book
 */
router.post('/:bookId/chapters', asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  validateRequiredFields(req.body, ['title']);

  const chapterData = req.body;
  const chapter = await bookService.addChapter(parseInt(bookId), chapterData);

  sendSuccess(res, chapter);
}));

/**
 * PUT /api/books/:bookId/chapters/:chapterId
 * Update chapter
 */
router.put('/:bookId/chapters/:chapterId', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;
  const updateData = req.body;

  const chapter = await bookService.updateChapter(parseInt(chapterId), updateData);
  sendSuccess(res, chapter);
}));

/**
 * DELETE /api/books/:bookId/chapters/:chapterId
 * Delete chapter
 */
router.delete('/:bookId/chapters/:chapterId', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;

  await bookService.deleteChapter(parseInt(chapterId));
  sendSuccess(res, { message: 'Chapter deleted successfully' });
}));

// ==========================================
// SECTION MANAGEMENT ENDPOINTS
// ==========================================

/**
 * GET /api/books/:bookId/chapters/:chapterId/sections
 * Get all sections for a chapter
 */
router.get('/:bookId/chapters/:chapterId/sections', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;

  const sections = await bookService.getChapterSections(parseInt(chapterId));
  sendSuccess(res, sections);
}));

/**
 * POST /api/books/:bookId/chapters/:chapterId/sections
 * Add section to chapter
 */
router.post('/:bookId/chapters/:chapterId/sections', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;
  validateRequiredFields(req.body, ['title']);

  const sectionData = req.body;
  const section = await bookService.addSection(parseInt(chapterId), sectionData);

  sendSuccess(res, section);
}));

/**
 * PUT /api/books/:bookId/chapters/:chapterId/sections/:sectionId
 * Update section
 */
router.put('/:bookId/chapters/:chapterId/sections/:sectionId', asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const updateData = req.body;

  const section = await bookService.updateSection(parseInt(sectionId), updateData);
  sendSuccess(res, section);
}));

/**
 * DELETE /api/books/:bookId/chapters/:chapterId/sections/:sectionId
 * Delete section
 */
router.delete('/:bookId/chapters/:chapterId/sections/:sectionId', asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  await bookService.deleteSection(parseInt(sectionId));
  sendSuccess(res, { message: 'Section deleted successfully' });
}));

// ==========================================
// COMPLETION & PROGRESS ENDPOINTS
// ==========================================

/**
 * GET /api/books/:id/progress
 * Get book progress report
 */
router.get('/:id/progress', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const progressReport = await completionService.getBookProgressReport(parseInt(id));
  sendSuccess(res, progressReport);
}));

/**
 * POST /api/books/:id/progress
 * Update book progress
 */
router.post('/:id/progress', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const progressData = req.body;

  const result = await completionService.updateBookProgress(parseInt(id), progressData);
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:id/complete
 * Mark book as completed
 */
router.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await completionService.markBookCompleted(parseInt(id));
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:bookId/chapters/:chapterId/complete
 * Mark chapter as completed
 */
router.post('/:bookId/chapters/:chapterId/complete', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;

  const result = await completionService.markChapterCompleted(parseInt(chapterId));
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:bookId/chapters/:chapterId/sections/:sectionId/complete
 * Mark section as completed
 */
router.post('/:bookId/chapters/:chapterId/sections/:sectionId/complete', asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const result = await completionService.markSectionCompleted(parseInt(sectionId));
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:id/toggle-complete
 * Toggle book completion status
 */
router.post('/:id/toggle-complete', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await integrationService.toggleContentCompletion('book', parseInt(id));
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:bookId/chapters/:chapterId/toggle-complete
 * Toggle chapter completion status
 */
router.post('/:bookId/chapters/:chapterId/toggle-complete', asyncHandler(async (req, res) => {
  const { chapterId } = req.params;

  const result = await integrationService.toggleContentCompletion('chapter', parseInt(chapterId));
  sendSuccess(res, result);
}));

/**
 * POST /api/books/:bookId/chapters/:chapterId/sections/:sectionId/toggle-complete
 * Toggle section completion status
 */
router.post('/:bookId/chapters/:chapterId/sections/:sectionId/toggle-complete', asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const result = await integrationService.toggleContentCompletion('section', parseInt(sectionId));
  sendSuccess(res, result);
}));

// ==========================================
// READING SESSION ENDPOINTS
// ==========================================

module.exports = router;
