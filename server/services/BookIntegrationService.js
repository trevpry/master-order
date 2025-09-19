/**
 * Book Integration Service
 * 
 * Provides integration layer between the unified BookService and existing services.
 * Handles migration of book operations from CustomOrderService and HistoryPlusService
 * to the new unified book system while maintaining backward compatibility.
 * 
 * Key responsibilities:
 * - Bridge existing services to unified BookService
 * - Migrate book operations from legacy implementations
 * - Maintain API compatibility during transition
 * - Handle History Plus event-book associations
 * - Integrate with Custom Order book management
 */

const BookService = require('./BookService');
const BookCompletionService = require('./BookCompletionService');

class BookIntegrationService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || require('../prismaClient');
    this.bookService = new BookService(this.prisma);
    this.completionService = new BookCompletionService(this.prisma);
    console.log('BookIntegrationService: Initialized with unified book services');
  }

  // ==========================================
  // CUSTOM ORDER INTEGRATION
  // ==========================================

  /**
   * Create or get book for Custom Order item
   * @param {Object} customOrderItem - Custom order item data
   * @returns {Promise<Object>} Book record
   */
  async createOrGetBookForCustomOrder(customOrderItem) {
    try {
      // If item already has a bookId reference, get the book
      if (customOrderItem.bookId) {
        const existingBook = await this.bookService.getBookById(customOrderItem.bookId);
        if (existingBook) {
          return existingBook;
        }
      }

      // If no bookId, this is likely a non-book item or error state
      throw new Error(`CustomOrderItem ${customOrderItem.id} has no linked book. This should have been migrated to the unified system.`);
    } catch (error) {
      console.error('Error getting book for custom order:', error);
      throw new Error(`Failed to get custom order book: ${error.message}`);
    }
  }

  /**
   * Update custom order book progress
   * @param {number} customOrderItemId - Custom order item ID
   * @param {Object} progressData - Progress data
   * @returns {Promise<Object>} Updated progress
   */
  async updateCustomOrderBookProgress(customOrderItemId, progressData) {
    try {
      const customOrderItem = await this.prisma.customOrderItem.findUnique({
        where: { id: customOrderItemId },
        select: { bookId: true }
      });

      if (!customOrderItem?.bookId) {
        throw new Error(`CustomOrderItem ${customOrderItemId} is not linked to a book`);
      }

      return await this.completionService.updateBookProgress(
        customOrderItem.bookId,
        progressData
      );
    } catch (error) {
      console.error('Error updating custom order book progress:', error);
      throw new Error(`Failed to update custom order book progress: ${error.message}`);
    }
  }

  // ==========================================
  // HISTORY PLUS INTEGRATION
  // ==========================================

  /**
   * Create book with History Plus event association
   * @param {Object} historyBookData - History book data
   * @param {number} eventId - Historical event ID
   * @returns {Promise<Object>} Created book with event link
   */
  async createHistoryPlusBook(historyBookData, eventId) {
    try {
      // Create the book
      const book = await this.bookService.createBook({
        title: historyBookData.title,
        author: historyBookData.author,
        isbn: historyBookData.isbn,
        publisher: historyBookData.publisher,
        publishYear: historyBookData.publishYear,
        description: historyBookData.description,
        coverUrl: historyBookData.coverUrl,
        pageCount: historyBookData.pageCount
      });

      // Create the event association
      await this.prisma.historyBookLink.create({
        data: {
          bookId: book.id,
          eventId: eventId
        }
      });

      console.log(`📖 Created History Plus book "${book.title}" linked to event ${eventId}`);
      return book;
    } catch (error) {
      console.error('Error creating History Plus book:', error);
      throw new Error(`Failed to create History Plus book: ${error.message}`);
    }
  }

  /**
   * Migrate History Book to unified system
   * @param {Object} historyBook - History book data with chapters/sections
   * @returns {Promise<Object>} Migrated book
   */
  async migrateHistoryBook(historyBook) {
    try {
      // Create the book
      const book = await this.bookService.createBook({
        title: historyBook.title,
        author: historyBook.author,
        isbn: historyBook.isbn,
        publisher: historyBook.publisher,
        publishYear: historyBook.publishYear,
        description: historyBook.description,
        coverUrl: historyBook.coverUrl,
        pageCount: historyBook.pageCount
      });

      // Create event association if exists
      if (historyBook.eventId) {
        await this.prisma.historyBookLink.create({
          data: {
            bookId: book.id,
            eventId: historyBook.eventId
          }
        });
      }

      // Migrate chapters
      if (historyBook.chapters) {
        for (const historyChapter of historyBook.chapters) {
          const chapter = await this.bookService.addChapter(book.id, {
            title: historyChapter.title,
            chapterNumber: historyChapter.chapterNumber,
            description: historyChapter.description,
            pageStart: historyChapter.pageStart,
            pageEnd: historyChapter.pageEnd
          });

          // Migrate sections
          if (historyChapter.sections) {
            for (const historySection of historyChapter.sections) {
              await this.bookService.addSection(chapter.id, {
                title: historySection.title,
                sectionNumber: historySection.sectionNumber,
                description: historySection.description,
                content: historySection.content,
                pageStart: historySection.pageStart,
                pageEnd: historySection.pageEnd
              });
            }
          }
        }
      }

      // Migrate user reading data
      if (historyBook.user_book_reads) {
        await this.completionService.updateBookProgress(book.id, {
          isCompleted: historyBook.user_book_reads.completed,
          completedAt: historyBook.user_book_reads.completed_at
        });
      }

      console.log(`📚 Migrated History Book "${book.title}" with ${historyBook.chapters?.length || 0} chapters`);
      return book;
    } catch (error) {
      console.error('Error migrating History Book:', error);
      throw new Error(`Failed to migrate History Book: ${error.message}`);
    }
  }

  /**
   * Get books for historical event
   * @param {number} eventId - Historical event ID
   * @returns {Promise<Array>} Books associated with event
   */
  async getBooksForEvent(eventId) {
    try {
      const bookLinks = await this.prisma.historyBookLink.findMany({
        where: { eventId },
        include: {
          book: {
            include: {
              chapters: {
                include: {
                  sections: true
                },
                orderBy: { chapterNumber: 'asc' }
              },
              bookCompletions: true
            }
          }
        }
      });

      return bookLinks.map(link => link.book);
    } catch (error) {
      console.error(`Error getting books for event ${eventId}:`, error);
      throw new Error(`Failed to get books for event: ${error.message}`);
    }
  }

  /**
   * Mark History Plus content as read
   * @param {Object} contentData - Content identification data
   * @returns {Promise<Object>} Completion result
   */
  async markHistoryPlusContentAsRead(contentData) {
    try {
      const { contentType, contentId, bookId, chapterId, sectionId } = contentData;

      switch (contentType) {
        case 'book':
          return await this.completionService.markBookCompleted(bookId);
        
        case 'chapter':
          return await this.completionService.markChapterCompleted(chapterId);
        
        case 'section':
          return await this.completionService.markSectionCompleted(sectionId);
        
        default:
          throw new Error(`Invalid content type: ${contentType}`);
      }
    } catch (error) {
      console.error('Error marking History Plus content as read:', error);
      throw new Error(`Failed to mark content as read: ${error.message}`);
    }
  }

  /**
   * Toggle completion status for book content
   * @param {string} type - Content type ('book', 'chapter', 'section')
   * @param {number} id - Content ID
   * @returns {Promise<Object>} Completion result
   */
  async toggleContentCompletion(type, id) {
    try {
      switch (type) {
        case 'book':
          return await this.completionService.toggleBookCompletion(id);
        
        case 'chapter':
          return await this.completionService.toggleChapterCompletion(id);
        
        case 'section':
          return await this.completionService.toggleSectionCompletion(id);
        
        default:
          throw new Error(`Invalid content type: ${type}`);
      }
    } catch (error) {
      console.error('Error toggling content completion:', error);
      throw new Error(`Failed to toggle completion: ${error.message}`);
    }
  }

  // ==========================================
  // READING SESSION INTEGRATION
  // ==========================================

  /**
   * Start unified book reading session
   * @param {Object} sessionData - Reading session data
   * @returns {Promise<Object>} Reading session
   */
  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Get unified book data for any book source
   * @param {Object} identifier - Book identifier (bookId, customOrderItemId, etc.)
   * @returns {Promise<Object>} Unified book data
   */
  async getUnifiedBookData(identifier) {
    try {
      let book;

      if (identifier.bookId) {
        book = await this.bookService.getBookById(identifier.bookId);
      } else if (identifier.customOrderItemId) {
        const customOrderItem = await this.prisma.customOrderItem.findUnique({
          where: { id: identifier.customOrderItemId },
          include: { book: true }
        });
        book = customOrderItem?.book;
      } else if (identifier.isbn) {
        book = await this.bookService.getBookByIsbn(identifier.isbn);
      }

      if (!book) {
        throw new Error('Book not found with provided identifier');
      }

      // Get progress report
      const progressReport = await this.completionService.getBookProgressReport(book.id);

      return {
        ...book,
        progress: progressReport
      };
    } catch (error) {
      console.error('Error getting unified book data:', error);
      throw new Error(`Failed to get unified book data: ${error.message}`);
    }
  }

  /**
   * Search across all book sources
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results with source information
   */
  async searchAllBooks(query, options = {}) {
    try {
      const books = await this.bookService.searchBooks(query, options);

      // Enhance with source information
      const enhancedBooks = await Promise.all(
        books.map(async book => {
          const stats = await this.bookService.getBookStats(book.id);
          const progressReport = await this.completionService.getBookProgressReport(book.id);

          return {
            ...book,
            stats,
            progress: progressReport,
            sources: {
              customOrders: stats.customOrderReferences > 0,
              historyPlus: stats.historyEventLinks > 0,
              standalone: stats.customOrderReferences === 0 && stats.historyEventLinks === 0
            }
          };
        })
      );

      return enhancedBooks;
    } catch (error) {
      console.error('Error searching all books:', error);
      throw new Error(`Failed to search books: ${error.message}`);
    }
  }

  // ==========================================
  // LEGACY COMPATIBILITY METHODS
  // ==========================================

  /**
   * Legacy method for CustomOrderService compatibility
   * @param {number} customOrderItemId - Custom order item ID
   * @returns {Promise<Object>} Book data in legacy format
   */
  async getLegacyCustomOrderBookData(customOrderItemId) {
    try {
      const customOrderItem = await this.prisma.customOrderItem.findUnique({
        where: { id: customOrderItemId },
        include: { book: true }
      });

      if (!customOrderItem) {
        throw new Error(`CustomOrderItem ${customOrderItemId} not found`);
      }

      // Return in legacy format using unified book data
      return {
        id: customOrderItem.id,
        bookTitle: customOrderItem.book?.title || customOrderItem.title,
        bookAuthor: customOrderItem.book?.author || null,
        bookIsbn: customOrderItem.book?.isbn || null,
        bookPublisher: customOrderItem.book?.publisher || null,
        bookYear: customOrderItem.book?.publishYear || null,
        bookCoverUrl: customOrderItem.book?.coverUrl || null,
        bookPageCount: customOrderItem.book?.pageCount || null,
        bookOpenLibraryId: customOrderItem.book?.openLibraryId || null,
        // Add unified book reference
        unifiedBook: customOrderItem.book
      };
    } catch (error) {
      console.error('Error getting legacy custom order book data:', error);
      throw new Error(`Failed to get legacy book data: ${error.message}`);
    }
  }
}

module.exports = BookIntegrationService;