/**
 * Book Completion Service
 * 
 * Handles granular completion tracking for books, chapters, and sections.
 * Integrates with the unified BookService to provide progress management
 * across all book sources (Custom Orders, History Plus, standalone books).
 * 
 * Features:
 * - Book-level completion tracking
 * - Chapter-level progress management
 * - Section-level granular tracking
 * - Progress calculation and percentage updates
 * - Reading session integration
 */

const { PrismaClient } = require('@prisma/client');

class BookCompletionService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
    console.log('BookCompletionService: Initialized completion tracking');
  }

  /**
   * Normalize userId for database operations
   * Uses "default" for null values to handle unique constraints properly
   * @param {string|null} userId 
   * @returns {string}
   */
  normalizeUserId(userId) {
    return userId || "default";
  }

  // ==========================================
  // BOOK COMPLETION TRACKING
  // ==========================================

  /**
   * Get or create book completion record
   * @param {number} bookId - Book ID
   * @param {string} userId - User ID (null for single-user system)
   * @returns {Promise<Object>} Book completion record
   */
  async getOrCreateBookCompletion(bookId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      let completion = await this.prisma.bookCompletion.findUnique({
        where: {
          bookId_userId: {
            bookId,
            userId: normalizedUserId
          }
        }
      });

      if (!completion) {
        completion = await this.prisma.bookCompletion.create({
          data: {
            bookId,
            userId: normalizedUserId,
            isCompleted: false,
            currentPage: 0,
            percentRead: 0
          }
        });
        console.log(`📖 Created book completion record for book ${bookId}`);
      }

      return completion;
    } catch (error) {
      console.error(`Error getting/creating book completion for ${bookId}:`, error);
      throw new Error(`Failed to get book completion: ${error.message}`);
    }
  }

  /**
   * Update book reading progress
   * @param {number} bookId - Book ID
   * @param {Object} progressData - Progress data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated completion record
   */
  async updateBookProgress(bookId, progressData, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      // Prepare update data, only including defined values
      const updateData = {};
      if (progressData.currentPage !== undefined) {
        updateData.currentPage = progressData.currentPage;
      }
      if (progressData.percentRead !== undefined) {
        updateData.percentRead = progressData.percentRead;
      }
      if (progressData.isCompleted !== undefined) {
        updateData.isCompleted = progressData.isCompleted;
        updateData.completedAt = progressData.isCompleted ? new Date() : null;
      }
      
      // Always update the updatedAt timestamp
      updateData.updatedAt = new Date();
      
      const completion = await this.prisma.bookCompletion.upsert({
        where: {
          bookId_userId: {
            bookId,
            userId: normalizedUserId
          }
        },
        create: {
          bookId,
          userId: normalizedUserId,
          currentPage: progressData.currentPage || 0,
          percentRead: progressData.percentRead || 0,
          isCompleted: progressData.isCompleted || false,
          completedAt: progressData.isCompleted ? new Date() : null
        },
        update: updateData
      });

      console.log(`📊 Updated book progress: ${completion.percentRead}% (Page ${completion.currentPage}), isCompleted: ${completion.isCompleted}`);
      return completion;
    } catch (error) {
      console.error(`Error updating book progress for ${bookId}:`, error);
      throw new Error(`Failed to update book progress: ${error.message}`);
    }
  }

  /**
   * Mark book as completed
   * @param {number} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated completion record
   */
  async markBookCompleted(bookId, userId = null) {
    try {
      const completion = await this.updateBookProgress(bookId, {
        isCompleted: true,
        percentRead: 100
      }, userId);

      // Auto-mark all chapters as completed
      const chapters = await this.prisma.bookChapter.findMany({
        where: { bookId },
        include: { sections: true }
      });

      for (const chapter of chapters) {
        await this.markChapterCompleted(chapter.id, userId);
      }

      console.log(`✅ Marked book ${bookId} as completed`);
      return completion;
    } catch (error) {
      console.error(`Error marking book ${bookId} as completed:`, error);
      throw new Error(`Failed to mark book as completed: ${error.message}`);
    }
  }

  // ==========================================
  // CHAPTER COMPLETION TRACKING
  // ==========================================

  /**
   * Mark chapter as completed
   * @param {number} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @param {boolean} skipSectionUpdate - Skip auto-updating sections to prevent infinite recursion
   * @returns {Promise<Object>} Chapter completion record
   */
  async markChapterCompleted(chapterId, userId = null, skipSectionUpdate = false) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      const completion = await this.prisma.chapterCompletion.upsert({
        where: {
          chapterId_userId: {
            chapterId,
            userId: normalizedUserId
          }
        },
        create: {
          chapterId,
          userId: normalizedUserId,
          isCompleted: true,
          completedAt: new Date()
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Update book progress
      await this.updateBookProgressFromChapters(chapterId, userId);

      console.log(`✅ Marked chapter ${chapterId} as completed`);
      return completion;
    } catch (error) {
      console.error(`Error marking chapter ${chapterId} as completed:`, error);
      throw new Error(`Failed to mark chapter as completed: ${error.message}`);
    }
  }

  /**
   * Get chapter completion status
   * @param {number} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Chapter completion record
   */
  async getChapterCompletion(chapterId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      return await this.prisma.chapterCompletion.findUnique({
        where: {
          chapterId_userId: {
            chapterId,
            userId: normalizedUserId
          }
        }
      });
    } catch (error) {
      console.error(`Error getting chapter completion for ${chapterId}:`, error);
      throw new Error(`Failed to get chapter completion: ${error.message}`);
    }
  }

  // ==========================================
  // SECTION COMPLETION TRACKING
  // ==========================================

  /**
   * Mark section as completed
   * @param {number} sectionId - Section ID
   * @param {string} userId - User ID
   * @param {boolean} skipChapterUpdate - Skip chapter progress update to prevent infinite recursion
   * @returns {Promise<Object>} Section completion record
   */
  async markSectionCompleted(sectionId, userId = null, skipChapterUpdate = false) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      const completion = await this.prisma.sectionCompletion.upsert({
        where: {
          sectionId_userId: {
            sectionId,
            userId: normalizedUserId
          }
        },
        create: {
          sectionId,
          userId: normalizedUserId,
          isCompleted: true,
          completedAt: new Date()
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Update chapter progress (only if not already in chapter update)
      if (!skipChapterUpdate) {
        await this.updateChapterProgressFromSections(sectionId, userId);
      }

      console.log(`✅ Marked section ${sectionId} as completed`);
      return completion;
    } catch (error) {
      console.error(`Error marking section ${sectionId} as completed:`, error);
      throw new Error(`Failed to mark section as completed: ${error.message}`);
    }
  }

  /**
   * Get section completion status
   * @param {number} sectionId - Section ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Section completion record
   */
  async getSectionCompletion(sectionId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      return await this.prisma.sectionCompletion.findUnique({
        where: {
          sectionId_userId: {
            sectionId,
            userId: normalizedUserId
          }
        }
      });
    } catch (error) {
      console.error(`Error getting section completion for ${sectionId}:`, error);
      throw new Error(`Failed to get section completion: ${error.message}`);
    }
  }

  // ==========================================
  // TOGGLE COMPLETION METHODS
  // ==========================================

  /**
   * Toggle book completion status
   * @param {number} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated completion record
   */
  async toggleBookCompletion(bookId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      // Get current completion status
      const currentCompletion = await this.getOrCreateBookCompletion(bookId, normalizedUserId);
      const isCurrentlyCompleted = currentCompletion && currentCompletion.isCompleted;
      
      if (isCurrentlyCompleted) {
        // Mark as not completed
        return await this.updateBookProgress(bookId, {
          isCompleted: false,
          percentRead: 0,
          completedAt: null
        }, normalizedUserId);
      } else {
        // Mark as completed
        return await this.markBookCompleted(bookId, normalizedUserId);
      }
    } catch (error) {
      console.error(`Error toggling book ${bookId} completion:`, error);
      throw new Error(`Failed to toggle book completion: ${error.message}`);
    }
  }

  /**
   * Toggle chapter completion status
   * @param {number} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated completion record
   */
  async toggleChapterCompletion(chapterId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      // Get current completion status
      const currentCompletion = await this.getChapterCompletion(chapterId, normalizedUserId);
      const isCurrentlyCompleted = currentCompletion && currentCompletion.isCompleted;
      
      if (isCurrentlyCompleted) {
        // Mark as not completed
        return await this.prisma.chapterCompletion.upsert({
          where: {
            chapterId_userId: {
              chapterId,
              userId: normalizedUserId
            }
          },
          create: {
            chapterId,
            userId: normalizedUserId,
            isCompleted: false,
            completedAt: null
          },
          update: {
            isCompleted: false,
            completedAt: null,
            updatedAt: new Date()
          }
        });
      } else {
        // Mark as completed
        return await this.markChapterCompleted(chapterId, normalizedUserId);
      }
    } catch (error) {
      console.error(`Error toggling chapter ${chapterId} completion:`, error);
      throw new Error(`Failed to toggle chapter completion: ${error.message}`);
    }
  }

  /**
   * Toggle section completion status
   * @param {number} sectionId - Section ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated completion record
   */
  async toggleSectionCompletion(sectionId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      // Get current completion status
      const currentCompletion = await this.getSectionCompletion(sectionId, normalizedUserId);
      const isCurrentlyCompleted = currentCompletion && currentCompletion.isCompleted;
      
      if (isCurrentlyCompleted) {
        // Mark as not completed
        return await this.prisma.sectionCompletion.upsert({
          where: {
            sectionId_userId: {
              sectionId,
              userId: normalizedUserId
            }
          },
          create: {
            sectionId,
            userId: normalizedUserId,
            isCompleted: false,
            completedAt: null
          },
          update: {
            isCompleted: false,
            completedAt: null,
            updatedAt: new Date()
          }
        });
      } else {
        // Mark as completed
        return await this.markSectionCompleted(sectionId, normalizedUserId);
      }
    } catch (error) {
      console.error(`Error toggling section ${sectionId} completion:`, error);
      throw new Error(`Failed to toggle section completion: ${error.message}`);
    }
  }

  // ==========================================
  // PROGRESS CALCULATION
  // ==========================================

  /**
   * Calculate book progress based on completed chapters
   * @param {number} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Progress percentage
   */
  async calculateBookProgress(bookId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      const chapters = await this.prisma.bookChapter.findMany({
        where: { bookId },
        include: {
          chapterCompletions: {
            where: { userId: normalizedUserId }
          }
        }
      });

      if (chapters.length === 0) {
        return 0;
      }

      const completedChapters = chapters.filter(chapter => 
        chapter.chapterCompletions.length > 0 && chapter.chapterCompletions[0].isCompleted
      );

      const progressPercent = Math.round((completedChapters.length / chapters.length) * 100);
      
      // Update book completion record
      await this.updateBookProgress(bookId, {
        percentRead: progressPercent,
        isCompleted: progressPercent === 100
      }, userId);

      return progressPercent;
    } catch (error) {
      console.error(`Error calculating book progress for ${bookId}:`, error);
      throw new Error(`Failed to calculate book progress: ${error.message}`);
    }
  }

  /**
   * Calculate chapter progress based on completed sections
   * @param {number} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Progress percentage
   */
  async calculateChapterProgress(chapterId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      const sections = await this.prisma.bookSection.findMany({
        where: { chapterId },
        include: {
          sectionCompletions: {
            where: { userId: normalizedUserId }
          }
        }
      });

      if (sections.length === 0) {
        return 100; // Chapter with no sections is considered complete
      }

      const completedSections = sections.filter(section => 
        section.sectionCompletions.length > 0 && section.sectionCompletions[0].isCompleted
      );

      return Math.round((completedSections.length / sections.length) * 100);
    } catch (error) {
      console.error(`Error calculating chapter progress for ${chapterId}:`, error);
      throw new Error(`Failed to calculate chapter progress: ${error.message}`);
    }
  }

  /**
   * Get comprehensive progress report for a book
   * @param {number} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Progress report
   */
  async getBookProgressReport(bookId, userId = null) {
    try {
      const normalizedUserId = this.normalizeUserId(userId);
      
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          chapters: {
            include: {
              sections: {
                include: {
                  sectionCompletions: {
                    where: { userId: normalizedUserId }
                  }
                }
              },
              chapterCompletions: {
                where: { userId: normalizedUserId }
              }
            },
            orderBy: { chapterNumber: 'asc' }
          },
          bookCompletions: {
            where: { userId: normalizedUserId }
          }
        }
      });

      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      const bookCompletion = book.bookCompletions[0];
      const chapters = book.chapters.map(chapter => {
        const chapterCompletion = chapter.chapterCompletions[0];
        const sections = chapter.sections.map(section => {
          const sectionCompletion = section.sectionCompletions[0];
          return {
            id: section.id,
            title: section.title,
            sectionNumber: section.sectionNumber,
            isCompleted: sectionCompletion?.isCompleted || false,
            completedAt: sectionCompletion?.completedAt
          };
        });

        const completedSections = sections.filter(s => s.isCompleted).length;
        const totalSections = sections.length;

        return {
          id: chapter.id,
          title: chapter.title,
          chapterNumber: chapter.chapterNumber,
          isCompleted: chapterCompletion?.isCompleted || false,
          completedAt: chapterCompletion?.completedAt,
          sectionsProgress: totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 100,
          sections
        };
      });

      const completedChapters = chapters.filter(c => c.isCompleted).length;
      const totalChapters = chapters.length;
      const overallProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

      return {
        bookId: book.id,
        title: book.title,
        author: book.author,
        isCompleted: bookCompletion?.isCompleted || false,
        currentPage: bookCompletion?.currentPage || 0,
        percentRead: bookCompletion?.percentRead !== undefined ? bookCompletion.percentRead : overallProgress,
        completedAt: bookCompletion?.completedAt,
        chaptersProgress: overallProgress,
        totalChapters,
        completedChapters,
        chapters
      };
    } catch (error) {
      console.error(`Error getting book progress report for ${bookId}:`, error);
      throw new Error(`Failed to get progress report: ${error.message}`);
    }
  }

  // ==========================================
  // INTERNAL HELPER METHODS
  // ==========================================

  /**
   * Update book progress based on chapter completion
   * @param {number} chapterId - Chapter ID that was completed
   * @param {string} userId - User ID
   * @private
   */
  async updateBookProgressFromChapters(chapterId, userId = null) {
    try {
      const chapter = await this.prisma.bookChapter.findUnique({
        where: { id: chapterId },
        select: { bookId: true }
      });

      if (chapter) {
        await this.calculateBookProgress(chapter.bookId, userId);
      }
    } catch (error) {
      console.error('Error updating book progress from chapters:', error);
    }
  }

  /**
   * Update chapter progress based on section completion
   * @param {number} sectionId - Section ID that was completed
   * @param {string} userId - User ID
   * @private
   */
  async updateChapterProgressFromSections(sectionId, userId = null) {
    try {
      const section = await this.prisma.bookSection.findUnique({
        where: { id: sectionId },
        include: { chapter: true }
      });

      if (section) {
        const chapterProgress = await this.calculateChapterProgress(section.chapterId, userId);
        
        // If chapter is 100% complete, mark it as completed (with skipSectionUpdate to prevent recursion)
        if (chapterProgress === 100) {
          await this.markChapterCompleted(section.chapterId, userId, true);
        }
      }
    } catch (error) {
      console.error('Error updating chapter progress from sections:', error);
    }
  }

  // ==========================================
  // READING SESSION INTEGRATION
  // ==========================================

  /**
   * Update progress based on reading session data
   * @param {number} bookId - Book ID
   * @param {Object} sessionData - Reading session data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated progress
   */
  async updateProgressFromSession(bookId, sessionData, userId = null) {
    try {
      console.log(`🔍 updateProgressFromSession: bookId=${bookId}, sessionData=`, sessionData);
      const progressData = {};

      // First, handle totalPages if provided - update Book.pageCount if needed
      if (sessionData.totalPages && sessionData.totalPages > 0) {
        console.log(`📖 Checking if Book ${bookId} needs pageCount update...`);
        const book = await this.prisma.book.findUnique({
          where: { id: bookId },
          select: { pageCount: true }
        });
        
        if (book && !book.pageCount) {
          await this.prisma.book.update({
            where: { id: bookId },
            data: { pageCount: sessionData.totalPages }
          });
          console.log(`📚 Updated Book ${bookId} pageCount to ${sessionData.totalPages}`);
        }
      }

      // Handle currentPage
      if (sessionData.currentPage !== undefined && sessionData.currentPage >= 0) {
        progressData.currentPage = sessionData.currentPage;
        
        // Calculate percentage if we have currentPage and can determine total pages
        if (sessionData.currentPage > 0) {
          let totalPages = null;
          
          // Try sessionData.totalPages first (from the calling code)
          if (sessionData.totalPages && sessionData.totalPages > 0) {
            totalPages = sessionData.totalPages;
            console.log(`📊 Using provided totalPages: ${totalPages}`);
          } else {
            // Fallback to book.pageCount
            console.log(`📖 Looking up book ${bookId} for page count...`);
            const book = await this.prisma.book.findUnique({
              where: { id: bookId },
              select: { pageCount: true }
            });
            console.log(`📖 Found book:`, book);
            totalPages = book?.pageCount;
          }
          
          if (totalPages && totalPages > 0) {
            const calculatedPercent = Math.min(
              Math.round((sessionData.currentPage / totalPages) * 100),
              100
            );
            
            // Only use calculated percentage if percentRead is not explicitly provided
            if (sessionData.percentRead === undefined) {
              progressData.percentRead = calculatedPercent;
              console.log(`📊 Calculated percentage: ${sessionData.currentPage}/${totalPages} = ${calculatedPercent}%`);
            } else {
              console.log(`📊 Ignoring calculated percentage (${calculatedPercent}%) - using provided percentRead`);
            }
          } else {
            console.log(`⚠️ No pageCount found for book ${bookId} - cannot calculate percentage from currentPage`);
          }
        }
      }

      // Handle percentRead (this takes precedence over calculated percentage)
      if (sessionData.percentRead !== undefined) {
        progressData.percentRead = sessionData.percentRead;
        console.log(`📊 Using provided percentRead: ${sessionData.percentRead}%`);
      }

      // Handle completion status
      if (sessionData.isCompleted !== undefined) {
        progressData.isCompleted = sessionData.isCompleted;
        console.log(`📚 Setting isCompleted to: ${sessionData.isCompleted}`);
      }

      console.log(`📊 Final progressData:`, progressData);
      return await this.updateBookProgress(bookId, progressData, userId);
    } catch (error) {
      console.error(`Error updating progress from session for book ${bookId}:`, error);
      throw new Error(`Failed to update progress from session: ${error.message}`);
    }
  }
}

module.exports = BookCompletionService;