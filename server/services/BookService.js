/**
 * BookService - Unified Books Management
 * 
 * Centralized service for all book-related operations across the application.
 * Replaces distributed book handling in CustomOrderItems and HistoryBooks
 * with a single, modular, and reusable service layer.
 * 
 * Following Eddie Life Management modular architecture principles:
 * - Single responsibility for book domain
 * - Clean separation from other services
 * - Reusable across Custom Orders, History Plus, and standalone books
 * - Integration points for existing services
 */

const { PrismaClient } = require('@prisma/client');

class BookService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
    console.log('BookService: Initialized unified books management');
  }

  // ==========================================
  // BOOK CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new book
   * @param {Object} bookData - Book data
   * @returns {Promise<Object>} Created book with relations
   */
  async createBook(bookData) {
    try {
      // Check for existing book to avoid duplicates
      const existingBook = await this.findExistingBook({
        isbn: bookData.isbn,
        openLibraryId: bookData.openLibraryId,
        title: bookData.title,
        author: bookData.author
      });

      if (existingBook) {
        console.log(`📚 Found existing book: "${existingBook.title}" (ID: ${existingBook.id})`);
        return existingBook;
      }

      const book = await this.prisma.book.create({
        data: {
          title: bookData.title,
          author: bookData.author,
          isbn: bookData.isbn,
          publisher: bookData.publisher,
          publishYear: bookData.publishYear,
          description: bookData.description,
          coverUrl: bookData.coverUrl,
          pageCount: bookData.pageCount,
          openLibraryId: bookData.openLibraryId,
          komgaBookId: bookData.komgaBookId,
          komgaSeriesId: bookData.komgaSeriesId,
          komgaUrl: bookData.komgaUrl,
          komgaMetadata: bookData.komgaMetadata,
          artworkLastCached: bookData.artworkLastCached,
          artworkMimeType: bookData.artworkMimeType,
          localArtworkPath: bookData.localArtworkPath,
          originalArtworkUrl: bookData.originalArtworkUrl
        },
        include: {
          chapters: {
            include: {
              event: true,
              sections: {
                include: {
                  event: true
                }
              }
            }
          },
          bookCompletions: true,
          historyBookLinks: {
            include: {
              event: true
            }
          }
        }
      });

      console.log(`✅ Created new book: "${book.title}" (ID: ${book.id})`);
      return book;
    } catch (error) {
      console.error('Error creating book:', error);
      throw new Error(`Failed to create book: ${error.message}`);
    }
  }

  /**
   * Get book by ID with full relations
   * @param {number} bookId - Book ID
   * @returns {Promise<Object|null>} Book with relations or null
   */
  async getBookById(bookId) {
    try {
      return await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          chapters: {
            include: {
              event: true,
              sections: {
                include: {
                  event: true
                }
              },
              chapterCompletions: true
            },
            orderBy: { chapterNumber: 'asc' }
          },
          bookCompletions: true,
          historyBookLinks: {
            include: {
              event: true
            }
          },
          customOrderItems: {
            include: {
              customOrder: true
            }
          },
          readingSessions: {
            where: {
              activityType: 'read'
            },
            orderBy: { startTime: 'desc' },
            take: 10
          }
        }
      });
    } catch (error) {
      console.error(`Error getting book ${bookId}:`, error);
      throw new Error(`Failed to get book: ${error.message}`);
    }
  }

  /**
   * Get book by ISBN
   * @param {string} isbn - Book ISBN
   * @returns {Promise<Object|null>} Book or null
   */
  async getBookByIsbn(isbn) {
    try {
      return await this.prisma.book.findUnique({
        where: { isbn },
        include: {
          chapters: {
            include: {
              event: true,
              sections: {
                include: {
                  event: true
                }
              }
            },
            orderBy: { chapterNumber: 'asc' }
          },
          bookCompletions: true
        }
      });
    } catch (error) {
      console.error(`Error getting book by ISBN ${isbn}:`, error);
      throw new Error(`Failed to get book by ISBN: ${error.message}`);
    }
  }

  /**
   * Get all books with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of books
   */
  async getBooks(filters = {}) {
    try {
      const where = {};
      
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { author: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      if (filters.author) {
        where.author = { contains: filters.author, mode: 'insensitive' };
      }

      if (filters.hasChapters !== undefined) {
        if (filters.hasChapters) {
          where.chapters = { some: {} };
        } else {
          where.chapters = { none: {} };
        }
      }

      return await this.prisma.book.findMany({
        where,
        include: {
          chapters: {
            select: {
              id: true,
              title: true,
              chapterNumber: true
            },
            orderBy: { chapterNumber: 'asc' }
          },
          bookCompletions: true,
          historyBookLinks: {
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  category: true
                }
              }
            }
          },
          _count: {
            select: {
              chapters: true,
              customOrderItems: true,
              readingSessions: true
            }
          }
        },
        orderBy: filters.orderBy || { title: 'asc' },
        take: filters.limit,
        skip: filters.offset
      });
    } catch (error) {
      console.error('Error getting books:', error);
      throw new Error(`Failed to get books: ${error.message}`);
    }
  }

  /**
   * Update book
   * @param {number} bookId - Book ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated book
   */
  async updateBook(bookId, updateData) {
    try {
      const book = await this.prisma.book.update({
        where: { id: bookId },
        data: updateData,
        include: {
          chapters: {
            include: {
              sections: true
            }
          },
          bookCompletions: true
        }
      });

      console.log(`✅ Updated book: "${book.title}" (ID: ${book.id})`);
      return book;
    } catch (error) {
      console.error(`Error updating book ${bookId}:`, error);
      throw new Error(`Failed to update book: ${error.message}`);
    }
  }

  /**
   * Delete book and all related data (chapters, sections, completions)
   * @param {number} bookId - Book ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteBook(bookId) {
    try {
      // Get book details and related data counts for logging
      const bookWithRelations = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          chapters: {
            include: {
              sections: true,
              chapterCompletions: true
            }
          },
          bookCompletions: true,
          customOrderItems: {
            include: {
              customOrder: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!bookWithRelations) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      console.log(`🗑️ Starting deletion of book: "${bookWithRelations.title}" (ID: ${bookId})`);

      // Count related data for logging
      const chapterCount = bookWithRelations.chapters.length;
      const sectionCount = bookWithRelations.chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
      const chapterCompletionCount = bookWithRelations.chapters.reduce((total, chapter) => total + chapter.chapterCompletions.length, 0);
      const sectionCompletionCount = bookWithRelations.chapters.reduce((total, chapter) => 
        total + chapter.sections.reduce((sectionTotal, section) => sectionTotal + (section.sectionCompletions?.length || 0), 0), 0);
      const bookCompletionCount = bookWithRelations.bookCompletions.length;
      const customOrderItemCount = bookWithRelations.customOrderItems.length;

      console.log(`� Related data to delete:
        - Chapters: ${chapterCount}
        - Sections: ${sectionCount}
        - Book completions: ${bookCompletionCount}
        - Chapter completions: ${chapterCompletionCount}
        - Section completions: ${sectionCompletionCount}
        - Custom order items: ${customOrderItemCount}`);

      // Handle custom order items first
      if (customOrderItemCount > 0) {
        console.log(`📋 Book is referenced by ${customOrderItemCount} custom order items. Deleting them first...`);
        
        // Delete all custom order items that reference this book
        await this.prisma.customOrderItem.deleteMany({
          where: { bookId }
        });
        
        console.log(`✅ Deleted ${customOrderItemCount} custom order items that referenced book ${bookId}`);
        
        // Log which custom orders were affected
        const affectedOrders = [...new Set(bookWithRelations.customOrderItems.map(item => item.customOrder.name))];
        console.log(`📝 Affected custom orders: ${affectedOrders.join(', ')}`);
      }

      // Delete the book (this will cascade delete all chapters, sections, and completions)
      await this.prisma.book.delete({
        where: { id: bookId }
      });

      console.log(`✅ Successfully deleted book "${bookWithRelations.title}" (ID: ${bookId}) and all related data:
        - ${chapterCount} chapters
        - ${sectionCount} sections  
        - ${bookCompletionCount} book completions
        - ${chapterCompletionCount} chapter completions
        - ${sectionCompletionCount} section completions
        - ${customOrderItemCount} custom order items`);

      return true;
    } catch (error) {
      console.error(`Error deleting book ${bookId}:`, error);
      throw new Error(`Failed to delete book: ${error.message}`);
    }
  }

  // ==========================================
  // CHAPTER MANAGEMENT
  // ==========================================

  /**
   * Add chapter to book
   * @param {number} bookId - Book ID
   * @param {Object} chapterData - Chapter data
   * @returns {Promise<Object>} Created chapter
   */
  async addChapter(bookId, chapterData) {
    try {
      // Validate book exists
      const book = await this.prisma.book.findUnique({
        where: { id: bookId }
      });

      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      // Check for duplicate chapter number
      const existingChapter = await this.prisma.bookChapter.findUnique({
        where: {
          bookId_chapterNumber: {
            bookId,
            chapterNumber: chapterData.chapterNumber
          }
        }
      });

      if (existingChapter) {
        throw new Error(`Chapter ${chapterData.chapterNumber} already exists for this book`);
      }

      const chapter = await this.prisma.bookChapter.create({
        data: {
          bookId,
          title: chapterData.title,
          chapterNumber: chapterData.chapterNumber,
          description: chapterData.description,
          pageStart: chapterData.pageStart,
          pageEnd: chapterData.pageEnd
        },
        include: {
          sections: {
            orderBy: { sectionNumber: 'asc' }
          }
        }
      });

      console.log(`✅ Added chapter "${chapter.title}" to book (ID: ${bookId})`);
      return chapter;
    } catch (error) {
      console.error(`Error adding chapter to book ${bookId}:`, error);
      throw new Error(`Failed to add chapter: ${error.message}`);
    }
  }

  /**
   * Update chapter
   * @param {number} chapterId - Chapter ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated chapter
   */
  async updateChapter(chapterId, updateData) {
    try {
      const chapter = await this.prisma.bookChapter.update({
        where: { id: chapterId },
        data: updateData,
        include: {
          sections: {
            orderBy: { sectionNumber: 'asc' }
          }
        }
      });

      console.log(`✅ Updated chapter "${chapter.title}" (ID: ${chapter.id})`);
      return chapter;
    } catch (error) {
      console.error(`Error updating chapter ${chapterId}:`, error);
      throw new Error(`Failed to update chapter: ${error.message}`);
    }
  }

  /**
   * Delete chapter and all sections
   * @param {number} chapterId - Chapter ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteChapter(chapterId) {
    try {
      await this.prisma.bookChapter.delete({
        where: { id: chapterId }
      });

      console.log(`✅ Deleted chapter (ID: ${chapterId})`);
      return true;
    } catch (error) {
      console.error(`Error deleting chapter ${chapterId}:`, error);
      throw new Error(`Failed to delete chapter: ${error.message}`);
    }
  }

  // ==========================================
  // SECTION MANAGEMENT
  // ==========================================

  /**
   * Add section to chapter
   * @param {number} chapterId - Chapter ID
   * @param {Object} sectionData - Section data
   * @returns {Promise<Object>} Created section
   */
  async addSection(chapterId, sectionData) {
    try {
      // Validate chapter exists
      const chapter = await this.prisma.bookChapter.findUnique({
        where: { id: chapterId }
      });

      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      // Check for duplicate section number
      const existingSection = await this.prisma.bookSection.findUnique({
        where: {
          chapterId_sectionNumber: {
            chapterId,
            sectionNumber: sectionData.sectionNumber
          }
        }
      });

      if (existingSection) {
        throw new Error(`Section ${sectionData.sectionNumber} already exists for this chapter`);
      }

      const section = await this.prisma.bookSection.create({
        data: {
          chapterId,
          title: sectionData.title,
          sectionNumber: sectionData.sectionNumber,
          description: sectionData.description,
          content: sectionData.content,
          pageStart: sectionData.pageStart,
          pageEnd: sectionData.pageEnd
        }
      });

      console.log(`✅ Added section "${section.title}" to chapter (ID: ${chapterId})`);
      return section;
    } catch (error) {
      console.error(`Error adding section to chapter ${chapterId}:`, error);
      throw new Error(`Failed to add section: ${error.message}`);
    }
  }

  /**
   * Update section
   * @param {number} sectionId - Section ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated section
   */
  async updateSection(sectionId, updateData) {
    try {
      const section = await this.prisma.bookSection.update({
        where: { id: sectionId },
        data: updateData
      });

      console.log(`✅ Updated section "${section.title}" (ID: ${section.id})`);
      return section;
    } catch (error) {
      console.error(`Error updating section ${sectionId}:`, error);
      throw new Error(`Failed to update section: ${error.message}`);
    }
  }

  /**
   * Delete section
   * @param {number} sectionId - Section ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSection(sectionId) {
    try {
      await this.prisma.bookSection.delete({
        where: { id: sectionId }
      });

      console.log(`✅ Deleted section (ID: ${sectionId})`);
      return true;
    } catch (error) {
      console.error(`Error deleting section ${sectionId}:`, error);
      throw new Error(`Failed to delete section: ${error.message}`);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Find existing book to avoid duplicates
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object|null>} Existing book or null
   */
  async findExistingBook(criteria) {
    try {
      // Check by ISBN first (most reliable)
      if (criteria.isbn) {
        const book = await this.prisma.book.findUnique({
          where: { isbn: criteria.isbn }
        });
        if (book) return book;
      }

      // Check by OpenLibraryId
      if (criteria.openLibraryId) {
        const book = await this.prisma.book.findUnique({
          where: { openLibraryId: criteria.openLibraryId }
        });
        if (book) return book;
      }

      // Check by title and author (exact match)
      if (criteria.title && criteria.author) {
        const book = await this.prisma.book.findFirst({
          where: {
            title: criteria.title,
            author: criteria.author
          }
        });
        if (book) return book;
      }

      // Check by title only if no author provided
      if (criteria.title && !criteria.author) {
        const book = await this.prisma.book.findFirst({
          where: { title: criteria.title }
        });
        if (book) return book;
      }

      return null;
    } catch (error) {
      console.error('Error finding existing book:', error);
      return null;
    }
  }

  /**
   * Get book statistics
   * @param {number} bookId - Book ID
   * @returns {Promise<Object>} Book statistics
   */
  async getBookStats(bookId) {
    try {
      const stats = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          _count: {
            select: {
              chapters: true,
              readingSessions: true,
              customOrderItems: true,
              historyBookLinks: true
            }
          },
          chapters: {
            include: {
              _count: {
                select: {
                  sections: true
                }
              }
            }
          },
          bookCompletions: true
        }
      });

      if (!stats) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      const totalSections = stats.chapters.reduce((sum, chapter) => sum + chapter._count.sections, 0);
      const completion = stats.bookCompletions.find(c => c.userId === null); // Single-user for now

      return {
        bookId: stats.id,
        title: stats.title,
        author: stats.author,
        totalChapters: stats._count.chapters,
        totalSections,
        totalReadingSessions: stats._count.readingSessions,
        customOrderReferences: stats._count.customOrderItems,
        historyEventLinks: stats._count.historyBookLinks,
        isCompleted: completion?.isCompleted || false,
        currentPage: completion?.currentPage || 0,
        percentRead: completion?.percentRead || 0
      };
    } catch (error) {
      console.error(`Error getting book stats for ${bookId}:`, error);
      throw new Error(`Failed to get book statistics: ${error.message}`);
    }
  }

  /**
   * Search books across multiple fields
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchBooks(query, options = {}) {
    try {
      const searchTerms = query.toLowerCase().split(' ');
      
      const books = await this.prisma.book.findMany({
        where: {
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              author: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              isbn: {
                contains: query
              }
            }
          ]
        },
        include: {
          _count: {
            select: {
              chapters: true,
              customOrderItems: true
            }
          },
          bookCompletions: true
        },
        take: options.limit || 50,
        orderBy: {
          title: 'asc'
        }
      });

      // Add relevance scoring if needed
      return books.map(book => ({
        ...book,
        relevanceScore: this.calculateRelevanceScore(book, query)
      })).sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (error) {
      console.error('Error searching books:', error);
      throw new Error(`Failed to search books: ${error.message}`);
    }
  }

  /**
   * Calculate relevance score for search results
   * @param {Object} book - Book object
   * @param {string} query - Search query
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(book, query) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Exact title match gets highest score
    if (book.title.toLowerCase() === queryLower) score += 100;
    else if (book.title.toLowerCase().includes(queryLower)) score += 50;

    // Author match
    if (book.author && book.author.toLowerCase().includes(queryLower)) score += 30;

    // ISBN match
    if (book.isbn && book.isbn.includes(query)) score += 80;

    // Description match
    if (book.description && book.description.toLowerCase().includes(queryLower)) score += 10;

    return score;
  }

  // ==========================================
  // ADDITIONAL METHODS FOR API COMPATIBILITY
  // ==========================================

  /**
   * Get all books with pagination and filtering (alias for getBooks)
   * @param {Object} options - Query options including pagination and filters
   * @returns {Promise<Object>} Paginated books result
   */
  async getAllBooks(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'title',
        sortOrder = 'asc',
        filters = {}
      } = options;

      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {};
      
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search } },
          { author: { contains: filters.search } },
          { isbn: { contains: filters.search } }
        ];
      }

      if (filters.author) {
        where.author = { contains: filters.author };
      }

      if (filters.genre) {
        where.genre = { contains: filters.genre };
      }

      if (filters.publisher) {
        where.publisher = { contains: filters.publisher };
      }

      if (filters.year) {
        where.publishYear = parseInt(filters.year);
      }

      if (filters.hasChapters !== undefined) {
        if (filters.hasChapters) {
          where.chapters = { some: {} };
        } else {
          where.chapters = { none: {} };
        }
      }

      // Get total count and books in parallel
      const [total, books] = await Promise.all([
        this.prisma.book.count({ where }),
        this.prisma.book.findMany({
          where,
          include: {
            chapters: {
              include: {
                event: true,
                sections: {
                  include: {
                    event: true
                  }
                },
                chapterCompletions: true
              },
              orderBy: { chapterNumber: 'asc' }
            },
            bookCompletions: true,
            historyBookLinks: {
              include: {
                event: true
              }
            },
            customOrderItems: {
              include: {
                customOrder: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        })
      ]);

      return {
        books,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting all books:', error);
      throw new Error(`Failed to get books: ${error.message}`);
    }
  }

  /**
   * Get system-wide book statistics
   * @returns {Promise<Object>} System statistics
   */
  async getSystemStats() {
    try {
      const [
        totalBooks,
        completedBooks,
        totalChapters,
        totalSections,
        readingSessions,
        totalPages
      ] = await Promise.all([
        this.prisma.book.count(),
        this.prisma.bookCompletion.count({
          where: { isCompleted: true }
        }),
        this.prisma.bookChapter.count(),
        this.prisma.bookSection.count(),
        this.prisma.watchLog.count({
          where: { 
            mediaType: 'book',
            activityType: 'read'
          }
        }),
        this.prisma.book.aggregate({
          _sum: { pageCount: true }
        })
      ]);

      const averageBookLength = totalBooks > 0 
        ? Math.round((totalPages._sum.pageCount || 0) / totalBooks)
        : 0;

      return {
        totalBooks,
        completedBooks,
        totalChapters,
        totalSections,
        readingSessions,
        totalPages: totalPages._sum.pageCount || 0,
        averageBookLength,
        completionRate: totalBooks > 0 
          ? Math.round((completedBooks / totalBooks) * 100)
          : 0
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw new Error(`Failed to get system stats: ${error.message}`);
    }
  }

  /**
   * Get all unique authors
   * @returns {Promise<Array>} List of authors
   */
  async getAllAuthors() {
    try {
      const result = await this.prisma.book.findMany({
        select: { author: true },
        where: { 
          author: { 
            not: null 
          } 
        },
        distinct: ['author'],
        orderBy: { author: 'asc' }
      });

      return result.map(book => book.author).filter(author => author && author.trim() !== '');
    } catch (error) {
      console.error('Error getting authors:', error);
      throw new Error(`Failed to get authors: ${error.message}`);
    }
  }

  /**
   * Get all unique genres
   * @returns {Promise<Array>} List of genres
   */
  async getAllGenres() {
    try {
      const result = await this.prisma.book.findMany({
        select: { genre: true },
        where: { 
          genre: { 
            not: null 
          } 
        },
        distinct: ['genre'],
        orderBy: { genre: 'asc' }
      });

      return result.map(book => book.genre).filter(genre => genre && genre.trim() !== '');
    } catch (error) {
      console.error('Error getting genres:', error);
      throw new Error(`Failed to get genres: ${error.message}`);
    }
  }

  /**
   * Get all unique publishers
   * @returns {Promise<Array>} List of publishers
   */
  async getAllPublishers() {
    try {
      const result = await this.prisma.book.findMany({
        select: { publisher: true },
        where: { 
          publisher: { 
            not: null 
          } 
        },
        distinct: ['publisher'],
        orderBy: { publisher: 'asc' }
      });

      return result.map(book => book.publisher).filter(publisher => publisher && publisher.trim() !== '');
    } catch (error) {
      console.error('Error getting publishers:', error);
      throw new Error(`Failed to get publishers: ${error.message}`);
    }
  }

  /**
   * Get book chapters with optional sections
   * @param {number} bookId - Book ID
   * @param {Object} options - Include options
   * @returns {Promise<Array>} Book chapters
   */
  async getBookChapters(bookId, options = {}) {
    try {
      return await this.prisma.bookChapter.findMany({
        where: { bookId },
        include: {
          sections: options.includeSections || false,
          chapterCompletions: true
        },
        orderBy: { chapterNumber: 'asc' }
      });
    } catch (error) {
      console.error(`Error getting chapters for book ${bookId}:`, error);
      throw new Error(`Failed to get book chapters: ${error.message}`);
    }
  }

  /**
   * Get chapter sections
   * @param {number} chapterId - Chapter ID
   * @returns {Promise<Array>} Chapter sections
   */
  async getChapterSections(chapterId) {
    try {
      return await this.prisma.bookSection.findMany({
        where: { chapterId },
        include: {
          sectionCompletions: true
        },
        orderBy: { sectionNumber: 'asc' }
      });
    } catch (error) {
      console.error(`Error getting sections for chapter ${chapterId}:`, error);
      throw new Error(`Failed to get chapter sections: ${error.message}`);
    }
  }
}

module.exports = BookService;