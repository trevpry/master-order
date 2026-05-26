const { PrismaClient } = require('@prisma/client');
const BookCompletionService = require('./BookCompletionService');

/**
 * History Plus Service - Business logic for historical content management
 * Handles events, books, videos, chapters, sections, and progress tracking
 */
class HistoryPlusService {
  constructor() {
    this.prisma = new PrismaClient();
    this.completionService = new BookCompletionService(this.prisma);
  }

  // ==========================================
  // HISTORICAL EVENTS
  // ==========================================

  async getAllEvents() {
    const events = await this.prisma.historicalEvent.findMany({
      where: { hidden: false },
      include: {
        // NEW: Unified book system relationships only
        bookLinks: {
          include: {
            book: {
              include: {
                bookCompletions: {
                  where: { userId: "default" }
                },
                chapters: {
                  include: {
                    sections: true
                  }
                }
              }
            }
          }
        },
        bookChapters: {
          include: {
            book: true,
            chapterCompletions: {
              where: { userId: "default" }
            },
            sections: true
          }
        },
        bookSections: {
          include: {
            chapter: {
              include: {
                book: true
              }
            },
            sectionCompletions: {
              where: { userId: "default" }
            }
          }
        },
        videos: {
          include: {
            channel: true,
            user_video_watches: true
          }
        },
        user_event_reviews: true
      }
      // Note: No orderBy here - client handles chronological sorting with parseHistoricalDate()
      // Database string sorting doesn't work correctly for BCE dates (e.g., -65000 vs -6500)
    });

    // Map user_event_reviews to reviewed property for frontend compatibility
    return events.map(event => {
      // Only use unified books now
      const unifiedBooks = (event.bookLinks || []).map(bookLink => ({
        ...bookLink.book,
        read: bookLink.book.bookCompletions?.[0]?.isCompleted || false,
        source: 'unified'
      }));

      // Only use unified chapters now
      const unifiedChapters = (event.bookChapters || []).map(chapter => ({
        ...chapter,
        read: chapter.chapterCompletions?.[0]?.isCompleted || false,
        source: 'unified'
      }));

      // Only use unified sections now
      const unifiedSections = (event.bookSections || []).map(section => ({
        ...section,
        read: section.sectionCompletions?.[0]?.isCompleted || false,
        source: 'unified'
      }));

      return {
        ...event,
        reviewed: event.user_event_reviews?.reviewed || false,
        videos: event.videos?.map(video => ({
          ...video,
          watched: video.user_video_watches?.watched || false
        })) || [],
        books: unifiedBooks,
        chapters: unifiedChapters,
        sections: unifiedSections
      };
    });
  }

  async getEventById(id) {
    const event = await this.prisma.historicalEvent.findUnique({
      where: { id: parseInt(id) },
      include: {
        // NEW: Unified book system relationships only
        bookLinks: {
          include: {
            book: {
              include: {
                bookCompletions: {
                  where: { userId: "default" }
                },
                chapters: {
                  include: {
                    sections: true
                  }
                }
              }
            }
          }
        },
        bookChapters: {
          include: {
            book: true,
            chapterCompletions: {
              where: { userId: "default" }
            },
            sections: true
          }
        },
        bookSections: {
          include: {
            chapter: {
              include: {
                book: true
              }
            },
            sectionCompletions: {
              where: { userId: "default" }
            }
          }
        },
        videos: {
          include: {
            channel: true,
            user_video_watches: true
          }
        },
        user_event_reviews: true
      }
    });

    if (!event) return null;

    // Only use unified books now
    const unifiedBooks = (event.bookLinks || []).map(bookLink => ({
      ...bookLink.book,
      read: bookLink.book.bookCompletions?.[0]?.isCompleted || false,
      source: 'unified'
    }));

    // Only use unified chapters now
    const unifiedChapters = (event.bookChapters || []).map(chapter => ({
      ...chapter,
      read: chapter.chapterCompletions?.[0]?.isCompleted || false,
      source: 'unified'
    }));

    // Only use unified sections now
    const unifiedSections = (event.bookSections || []).map(section => ({
      ...section,
      read: section.sectionCompletions?.[0]?.isCompleted || false,
      source: 'unified'
    }));

    // Map user_event_reviews to reviewed property for frontend compatibility
    return {
      ...event,
      reviewed: event.user_event_reviews?.reviewed || false,
      videos: event.videos?.map(video => ({
        ...video,
        watched: video.user_video_watches?.watched || false
      })) || [],
      books: unifiedBooks,
      chapters: unifiedChapters,
      sections: unifiedSections
    };
  }

  async createEvent(eventData) {
    // Ensure no id field is passed to prevent unique constraint errors
    const { id, ...cleanData } = eventData;
    
    if (id !== undefined) {
      console.warn('⚠️ Attempting to create event with explicit id, removing it:', id);
    }
    
    console.log('🏗️ HistoryPlusService.createEvent called with:', JSON.stringify(cleanData, null, 2));
    
    try {
      const result = await this.prisma.historicalEvent.create({
        data: cleanData
      });
      console.log('🎯 Event created in database:', { id: result.id, title: result.title });
      return result;
    } catch (error) {
      // Handle PostgreSQL sequence sync issues (P2002 unique constraint on id)
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        console.log('🔧 PostgreSQL sequence sync issue detected, attempting to fix...');
        
        // Try to sync the sequence by finding the max ID and resetting it
        try {
          await this.prisma.$executeRaw`
            SELECT setval('public."HistoricalEvent_id_seq"', COALESCE((SELECT MAX(id) FROM "HistoricalEvent"), 1), true);
          `;
          console.log('✅ Sequence synced, retrying event creation...');
          
          // Retry the creation after sequence sync
          return await this.prisma.historicalEvent.create({
            data: cleanData
          });
        } catch (seqError) {
          console.error('❌ Failed to sync sequence:', seqError);
          // If sequence sync fails, throw the original error
          throw error;
        }
      }
      // Re-throw any other errors
      throw error;
    }
  }

  async updateEvent(id, updateData) {
    return await this.prisma.historicalEvent.update({
      where: { id: parseInt(id) },
      data: updateData
    });
  }

  async deleteEvent(id) {
    return await this.prisma.historicalEvent.delete({
      where: { id: parseInt(id) }
    });
  }

  async getEventsByContent(filters) {
    const { bookId, chapterId, sectionId } = filters;
    
    let events = [];
    
    if (sectionId) {
      // Find events linked to this specific section
      const section = await this.prisma.historySection.findUnique({
        where: { id: parseInt(sectionId) },
        include: { event: true }
      });
      if (section?.event) {
        events.push(section.event);
      }
    } else if (chapterId) {
      // Find events linked to this specific chapter and its sections
      const chapter = await this.prisma.historyChapter.findUnique({
        where: { id: parseInt(chapterId) },
        include: { 
          event: true,
          sections: {
            include: { event: true }
          }
        }
      });
      
      if (chapter?.event) {
        events.push(chapter.event);
      }
      
      chapter?.sections?.forEach(section => {
        if (section.event && !events.find(e => e.id === section.event.id)) {
          events.push(section.event);
        }
      });
    } else if (bookId) {
      // Find events linked to this specific book and its chapters/sections
      const book = await this.prisma.historyBook.findUnique({
        where: { id: parseInt(bookId) },
        include: { 
          event: true,
          chapters: {
            include: {
              event: true,
              sections: {
                include: { event: true }
              }
            }
          }
        }
      });
      
      if (book?.event) {
        events.push(book.event);
      }
      
      book?.chapters?.forEach(chapter => {
        if (chapter.event && !events.find(e => e.id === chapter.event.id)) {
          events.push(chapter.event);
        }
        
        chapter.sections?.forEach(section => {
          if (section.event && !events.find(e => e.id === section.event.id)) {
            events.push(section.event);
          }
        });
      });
    }

    // Filter out null/undefined events and add user reviews
    const validEvents = events.filter(event => event != null);
    
    // Get user reviews for these events
    const eventsWithReviews = await Promise.all(
      validEvents.map(async (event) => {
        const userReview = await this.prisma.user_event_reviews.findUnique({
          where: { eventId: event.id }
        });
        
        return {
          ...event,
          reviewed: userReview?.reviewed || false
        };
      })
    );

    return eventsWithReviews;
  }

  // ==========================================
  // VIDEOS & CHANNELS
  // ==========================================

  async getVideosByEvent(eventId) {
    const books = await this.prisma.historyBook.findMany({
      include: {
        chapters: {
          include: {
            sections: {
              include: {
                sectionCompletions: {
                  where: { userId: "default" }
                }
              }
            },
            chapterCompletions: {
              where: { userId: "default" }
            }
          }
        },
        bookCompletions: {
          where: { userId: "default" }
        },
        event: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate statistics for each book
    const booksWithStats = books.map(book => {
      const chapters = book.chapters || [];
      const chaptersTotal = chapters.length;
      const chaptersRead = chapters.filter(chapter => 
        chapter.chapterCompletions && chapter.chapterCompletions.length > 0 && chapter.chapterCompletions[0].isCompleted
      ).length;
      
      const sectionsTotal = chapters.reduce((sum, chapter) => {
        const sections = chapter.sections || [];
        return sum + sections.length;
      }, 0);
      const sectionsRead = chapters.reduce((sum, chapter) => {
        const sections = chapter.sections || [];
        return sum + sections.filter(section => 
          section.sectionCompletions && section.sectionCompletions.length > 0 && section.sectionCompletions[0].isCompleted
        ).length;
      }, 0);

      const progressPercentage = sectionsTotal > 0 ? Math.round((sectionsRead / sectionsTotal) * 100) : 0;
      const read = book.bookCompletions && book.bookCompletions.length > 0 && book.bookCompletions[0].isCompleted;

      return {
        ...book,
        read,
        stats: {
          chaptersTotal,
          chaptersRead,
          sectionsTotal,
          sectionsRead,
          progressPercentage
        }
      };
    });

    return booksWithStats;
  }

  async getBooksByEvent(eventId) {
    return await this.prisma.historyBook.findMany({
      where: { eventId: parseInt(eventId) },
      include: {
        chapters: {
          include: {
            sections: true,
            chapterCompletions: {
              where: { userId: "default" }
            }
          }
        },
        bookCompletions: {
          where: { userId: "default" }
        }
      }
    });
  }

  async getBookById(id) {
    const book = await this.prisma.historyBook.findUnique({
      where: { id: parseInt(id) },
      include: {
        chapters: {
          include: {
            sections: {
              include: {
                sectionCompletions: {
                  where: { userId: "default" }
                }
              }
            },
            chapterCompletions: {
              where: { userId: "default" }
            }
          }
        },
        bookCompletions: {
          where: { userId: "default" }
        },
        event: true
      }
    });

    if (!book) return null;

    // Map user tracking data to read status for chapters and sections
    const chapters = book.chapters || [];
    const chaptersWithReadStatus = chapters.map(chapter => {
      const sections = chapter.sections || [];
      const sectionsWithReadStatus = sections.map(section => ({
        ...section,
        read: section.sectionCompletions && section.sectionCompletions.length > 0 && section.sectionCompletions[0].isCompleted
      }));

      return {
        ...chapter,
        read: chapter.chapterCompletions && chapter.chapterCompletions.length > 0 && chapter.chapterCompletions[0].isCompleted,
        sections: sectionsWithReadStatus,
        _count: { sections: sectionsWithReadStatus.length }
      };
    });

    // Map book read status
    return {
      ...book,
      read: book.bookCompletions && book.bookCompletions.length > 0 && book.bookCompletions[0].isCompleted,
      chapters: chaptersWithReadStatus
    };
  }

  async createBook(bookData) {
    return await this.prisma.historyBook.create({
      data: bookData
    });
  }

  async updateBook(id, updateData) {
    return await this.prisma.historyBook.update({
      where: { id: parseInt(id) },
      data: updateData
    });
  }

  async deleteBook(id) {
    return await this.prisma.historyBook.delete({
      where: { id: parseInt(id) }
    });
  }

  async createChapter(chapterData) {
    // Auto-generate chapter number if not provided
    if (!chapterData.chapterNumber) {
      const lastChapter = await this.prisma.historyChapter.findFirst({
        where: { bookId: chapterData.bookId },
        orderBy: { chapterNumber: 'desc' }
      });
      chapterData.chapterNumber = (lastChapter?.chapterNumber || 0) + 1;
    }

    return await this.prisma.historyChapter.create({
      data: chapterData
    });
  }

  async updateChapter(id, updateData) {
    return await this.prisma.historyChapter.update({
      where: { id: parseInt(id) },
      data: updateData
    });
  }

  async deleteChapter(id) {
    return await this.prisma.historyChapter.delete({
      where: { id: parseInt(id) }
    });
  }

  async createSection(sectionData) {
    // Auto-generate section number if not provided
    if (!sectionData.sectionNumber) {
      const lastSection = await this.prisma.historySection.findFirst({
        where: { chapterId: sectionData.chapterId },
        orderBy: { sectionNumber: 'desc' }
      });
      sectionData.sectionNumber = (lastSection?.sectionNumber || 0) + 1;
    }

    return await this.prisma.historySection.create({
      data: sectionData
    });
  }

  async updateSection(id, updateData) {
    return await this.prisma.historySection.update({
      where: { id: parseInt(id) },
      data: updateData
    });
  }

  async deleteSection(id) {
    return await this.prisma.historySection.delete({
      where: { id: parseInt(id) }
    });
  }

  async getChapterById(id) {
    const chapter = await this.prisma.historyChapter.findUnique({
      where: { id: parseInt(id) },
      include: {
        sections: {
          include: {
            sectionCompletions: {
              where: { userId: "default" }
            }
          }
        },
        chapterCompletions: {
          where: { userId: "default" }
        },
        book: true,
        event: true
      }
    });

    if (!chapter) return null;

    // Map user tracking data to read status for sections
    const sections = chapter.sections || [];
    const sectionsWithReadStatus = sections.map(section => ({
      ...section,
      read: section.sectionCompletions && section.sectionCompletions.length > 0 && section.sectionCompletions[0].isCompleted
    }));

    // Map chapter read status
    return {
      ...chapter,
      read: chapter.chapterCompletions && chapter.chapterCompletions.length > 0 && chapter.chapterCompletions[0].isCompleted,
      sections: sectionsWithReadStatus
    };
  }

  // ==========================================
  // VIDEOS & CHANNELS
  // ==========================================

  async getVideosByEvent(eventId) {
    return await this.prisma.historyVideo.findMany({
      where: { 
        eventId: parseInt(eventId),
        deleted: false
      },
      include: {
        channel: true,
        user_video_watches: true
      }
    });
  }

  async getVideoById(id) {
    return await this.prisma.historyVideo.findUnique({
      where: { 
        id: parseInt(id),
        deleted: false
      },
      include: {
        channel: true,
        user_video_watches: true,
        event: true
      }
    });
  }

  async getAllVideos() {
    return await this.prisma.historyVideo.findMany({
      where: {
        deleted: false
      },
      include: {
        channel: true,
        user_video_watches: true,
        event: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async createVideo(videoData) {
    // Clean up the create data - handle relationships properly
    const cleanVideoData = { ...videoData };
    
    // Handle publishedAt date conversion
    if (cleanVideoData.publishedAt !== undefined) {
      if (cleanVideoData.publishedAt && cleanVideoData.publishedAt !== '') {
        cleanVideoData.publishedAt = new Date(cleanVideoData.publishedAt);
      } else {
        cleanVideoData.publishedAt = null;
      }
    }
    
    // Handle channel relationship
    if (cleanVideoData.channelId !== undefined) {
      const channelId = cleanVideoData.channelId ? parseInt(cleanVideoData.channelId) : null;
      delete cleanVideoData.channelId;
      if (channelId) {
        cleanVideoData.channel = {
          connect: { id: channelId }
        };
      }
    }
    
    // Handle event relationship
    if (cleanVideoData.eventId !== undefined) {
      const eventId = cleanVideoData.eventId ? parseInt(cleanVideoData.eventId) : null;
      delete cleanVideoData.eventId;
      if (eventId) {
        cleanVideoData.event = {
          connect: { id: eventId }
        };
      }
    }
    
    return await this.prisma.historyVideo.create({
      data: cleanVideoData,
      include: {
        channel: true,
        user_video_watches: true,
        event: true
      }
    });
  }

  async updateVideo(id, updateData) {
    // Clean up the update data - handle relationships properly
    const cleanUpdateData = { ...updateData };
    
    // Handle publishedAt date conversion
    if (cleanUpdateData.publishedAt !== undefined) {
      if (cleanUpdateData.publishedAt && cleanUpdateData.publishedAt !== '') {
        cleanUpdateData.publishedAt = new Date(cleanUpdateData.publishedAt);
      } else {
        cleanUpdateData.publishedAt = null;
      }
    }
    
    // Handle channel relationship
    if (cleanUpdateData.channelId !== undefined) {
      const channelId = cleanUpdateData.channelId ? parseInt(cleanUpdateData.channelId) : null;
      delete cleanUpdateData.channelId;
      if (channelId) {
        cleanUpdateData.channel = {
          connect: { id: channelId }
        };
      } else {
        cleanUpdateData.channel = {
          disconnect: true
        };
      }
    }
    
    // Handle event relationship
    if (cleanUpdateData.eventId !== undefined) {
      const eventId = cleanUpdateData.eventId ? parseInt(cleanUpdateData.eventId) : null;
      delete cleanUpdateData.eventId;
      if (eventId) {
        cleanUpdateData.event = {
          connect: { id: eventId }
        };
        
        // When assigning a video to an event that has been marked as reviewed, mark that event as unreviewed
        const existingReview = await this.prisma.user_event_reviews.findUnique({
          where: { eventId: eventId }
        });
        
        if (existingReview && existingReview.reviewed) {
          console.log(`📝 Video being assigned to reviewed event ${eventId}, marking event as unreviewed`);
          await this.prisma.user_event_reviews.update({
            where: { eventId: eventId },
            data: { 
              reviewed: false,
              reviewedAt: null,
              updatedAt: new Date()
            }
          });
        }
      } else {
        cleanUpdateData.event = {
          disconnect: true
        };
      }
    }
    
    return await this.prisma.historyVideo.update({
      where: { id: parseInt(id) },
      data: cleanUpdateData,
      include: {
        channel: true,
        user_video_watches: true,
        event: true
      }
    });
  }

  async deleteVideo(id) {
    // Soft delete - mark video as deleted instead of removing from database
    return await this.prisma.historyVideo.update({
      where: { id: parseInt(id) },
      data: { deleted: true }
    });
  }

  async getAllChannels() {
    return await this.prisma.historyChannel.findMany({
      include: {
        videos: {
          where: { deleted: false }
        }
      }
    });
  }

  async createChannel(channelData) {
    return await this.prisma.historyChannel.create({
      data: channelData
    });
  }

  async updateChannel(id, updateData) {
    return await this.prisma.historyChannel.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        videos: {
          where: { deleted: false }
        }
      }
    });
  }

  async deleteChannel(id) {
    // First update all videos to remove channel association
    await this.prisma.historyVideo.updateMany({
      where: { channelId: parseInt(id) },
      data: { channelId: null }
    });
    
    return await this.prisma.historyChannel.delete({
      where: { id: parseInt(id) }
    });
  }

  async getChannelById(id) {
    return await this.prisma.historyChannel.findUnique({
      where: { id: parseInt(id) },
      include: {
        videos: {
          where: { deleted: false }
        }
      }
    });
  }

  // ==========================================
  // PROGRESS TRACKING
  // ==========================================

  async markEventReviewed(eventId, reviewData = {}) {
    const { reviewed = true, reviewedAt = new Date() } = reviewData;
    
    return await this.prisma.user_event_reviews.upsert({
      where: { eventId: parseInt(eventId) },
      update: { reviewed, reviewedAt },
      create: { 
        eventId: parseInt(eventId), 
        reviewed, 
        reviewedAt 
      }
    });
  }

  async markVideoWatched(videoId) {
    return await this.prisma.user_video_watches.upsert({
      where: { videoId: parseInt(videoId) },
      update: { watched: true, watchedAt: new Date() },
      create: { 
        videoId: parseInt(videoId), 
        watched: true, 
        watchedAt: new Date() 
      }
    });
  }

  async toggleVideoWatched(videoId) {
    const existing = await this.prisma.user_video_watches.findUnique({
      where: { videoId: parseInt(videoId) }
    });

    if (existing) {
      return await this.prisma.user_video_watches.update({
        where: { videoId: parseInt(videoId) },
        data: { watched: !existing.watched, watchedAt: existing.watched ? null : new Date() }
      });
    } else {
      return await this.prisma.user_video_watches.create({
        data: { 
          videoId: parseInt(videoId), 
          watched: true, 
          watchedAt: new Date() 
        }
      });
    }
  }

  /**
   * Complete a History Plus video and check if event should be marked as reviewed
   * Called when videos are completed in Up Next
   */
  async completeVideo(videoId) {
    try {
      // First, mark the video as watched
      const watchResult = await this.markVideoWatched(videoId);
      
      // Get the video to find its event
      const video = await this.prisma.historyVideo.findUnique({
        where: { id: parseInt(videoId) },
        include: { event: true }
      });
      
      if (!video || !video.event) {
        console.log(`⚠️ Video ${videoId} not found or not linked to an event`);
        return { watchResult, eventCompleted: false };
      }
      
      console.log(`📺 Completed video "${video.title}" in event "${video.event.title}"`);
      
      // Check if the event is now complete (all content watched/read)
      const eventCompleted = await this.checkAndMarkEventAsReviewed(video.event.id);
      
      return {
        watchResult,
        eventCompleted,
        eventId: video.event.id,
        eventTitle: video.event.title
      };
    } catch (error) {
      console.error('Error completing video:', error);
      throw error;
    }
  }

  /**
   * Complete a History Plus book and check if event should be marked as reviewed
   * Called when books are completed in Up Next
   */
  async completeBook(bookId) {
    try {
      // First, mark the book as read
      const readResult = await this.markBookRead(bookId);
      
      // Get the book to find its event
      const book = await this.prisma.historyBook.findUnique({
        where: { id: parseInt(bookId) },
        include: { event: true }
      });
      
      if (!book || !book.event) {
        console.log(`⚠️ Book ${bookId} not found or not linked to an event`);
        return { readResult, eventCompleted: false };
      }
      
      console.log(`📖 Completed book "${book.title}" in event "${book.event.title}"`);
      
      // Check if the event is now complete (all content watched/read)
      const eventCompleted = await this.checkAndMarkEventAsReviewed(book.event.id);
      
      return {
        readResult,
        eventCompleted,
        eventId: book.event.id,
        eventTitle: book.event.title
      };
    } catch (error) {
      console.error('Error completing book:', error);
      throw error;
    }
  }

  /**
   * Complete a History Plus chapter and check if event should be marked as reviewed
   * Called when chapters are completed in Up Next
   */
  async completeChapter(chapterId) {
    try {
      // First, mark the chapter as read
      const readResult = await this.markChapterRead(chapterId);
      
      // Get the chapter to find its event
      const chapter = await this.prisma.historyChapter.findUnique({
        where: { id: parseInt(chapterId) },
        include: { 
          event: true,
          book: true
        }
      });
      
      if (!chapter || !chapter.event) {
        console.log(`⚠️ Chapter ${chapterId} not found or not linked to an event`);
        return { readResult, eventCompleted: false };
      }
      
      console.log(`📄 Completed chapter "${chapter.title}" from "${chapter.book?.title || 'Unknown Book'}" in event "${chapter.event.title}"`);
      
      // Check if the event is now complete (all content watched/read)
      const eventCompleted = await this.checkAndMarkEventAsReviewed(chapter.event.id);
      
      return {
        readResult,
        eventCompleted,
        eventId: chapter.event.id,
        eventTitle: chapter.event.title
      };
    } catch (error) {
      console.error('Error completing chapter:', error);
      throw error;
    }
  }

  /**
   * Complete a History Plus section and check if event should be marked as reviewed
   * Called when sections are completed in Up Next
   */
  async completeSection(sectionId) {
    try {
      // First, mark the section as read
      const readResult = await this.markSectionRead(sectionId);
      
      // Get the section to find its event
      const section = await this.prisma.historySection.findUnique({
        where: { id: parseInt(sectionId) },
        include: { 
          event: true,
          chapter: {
            include: { book: true }
          }
        }
      });
      
      if (!section || !section.event) {
        console.log(`⚠️ Section ${sectionId} not found or not linked to an event`);
        return { readResult, eventCompleted: false };
      }
      
      console.log(`📝 Completed section "${section.title}" from chapter "${section.chapter?.title || 'Unknown Chapter'}" of "${section.chapter?.book?.title || 'Unknown Book'}" in event "${section.event.title}"`);
      
      // Check if the event is now complete (all content watched/read)
      const eventCompleted = await this.checkAndMarkEventAsReviewed(section.event.id);
      
      return {
        readResult,
        eventCompleted,
        eventId: section.event.id,
        eventTitle: section.event.title
      };
    } catch (error) {
      console.error('Error completing section:', error);
      throw error;
    }
  }

  /**
   * Check if an event has any remaining unwatched/unread content
   * If not, mark the event as reviewed
   */
  async checkAndMarkEventAsReviewed(eventId) {
    try {
      const event = await this.prisma.historicalEvent.findUnique({
        where: { id: parseInt(eventId) },
        include: {
          videos: {
            include: { user_video_watches: true }
          },
          // Unified book system relationships
          bookLinks: {
            include: {
              book: {
                include: { 
                  bookCompletions: {
                    where: { userId: "default" }
                  },
                  chapters: {
                    include: {
                      chapterCompletions: { where: { userId: "default" } },
                      sections: {
                        include: { sectionCompletions: { where: { userId: "default" } } }
                      }
                    }
                  }
                }
              }
            }
          },
          bookChapters: {
            include: { 
              chapterCompletions: {
                where: { userId: "default" }
              },
              sections: {
                include: { sectionCompletions: { where: { userId: "default" } } }
              },
              book: {
                include: {
                  bookCompletions: {
                    where: { userId: "default" }
                  }
                }
              }
            }
          },
          bookSections: {
            include: { 
              sectionCompletions: {
                where: { userId: "default" }
              },
              chapter: {
                include: {
                  chapterCompletions: {
                    where: { userId: "default" }
                  },
                  book: {
                    include: {
                      bookCompletions: {
                        where: { userId: "default" }
                      }
                    }
                  }
                }
              }
            }
          },
          // Legacy book system relationships
          books: {
            include: {
              user_book_reads: true,
              chapters: {
                include: {
                  user_chapter_reads: true,
                  sections: {
                    include: { user_section_reads: true }
                  }
                }
              }
            }
          },
          chapters: {
            include: {
              user_chapter_reads: true,
              sections: {
                include: { user_section_reads: true }
              }
            }
          },
          sections: {
            include: { user_section_reads: true }
          },
          user_event_reviews: true
        }
      });
      
      if (!event) {
        console.log(`⚠️ Event ${eventId} not found`);
        return false;
      }
      
      // Check for any unwatched videos
      const unwatchedVideos = (event.videos || []).filter(video => {
        const watchRecord = video.user_video_watches;
        return !watchRecord || !watchRecord.watched;
      });
      
      // --- UNIFIED BOOK SYSTEM ---
      
      // Check for any unread unified books (via bookLinks)
      const unreadUnifiedBooks = (event.bookLinks || []).filter(bookLink =>
        !bookLink.book.bookCompletions?.length || !bookLink.book.bookCompletions[0]?.isCompleted
      );
      
      // Check for any unread unified chapters (directly linked)
      const unreadUnifiedChapters = (event.bookChapters || []).filter(chapter =>
        !chapter.chapterCompletions?.length || !chapter.chapterCompletions[0]?.isCompleted
      );
      
      // Check for any unread unified sections (directly linked)
      const unreadUnifiedSections = (event.bookSections || []).filter(section =>
        !section.sectionCompletions?.length || !section.sectionCompletions[0]?.isCompleted
      );
      
      // Check sections nested under event-linked chapters
      let unreadNestedUnifiedSections = 0;
      for (const chapter of (event.bookChapters || [])) {
        for (const section of (chapter.sections || [])) {
          if (!section.sectionCompletions?.length || !section.sectionCompletions[0]?.isCompleted) {
            unreadNestedUnifiedSections++;
          }
        }
      }
      
      // Check chapters/sections nested under event-linked books
      let unreadNestedUnifiedBookContent = 0;
      for (const bookLink of (event.bookLinks || [])) {
        for (const chapter of (bookLink.book.chapters || [])) {
          if (!chapter.chapterCompletions?.length || !chapter.chapterCompletions[0]?.isCompleted) {
            unreadNestedUnifiedBookContent++;
          }
          for (const section of (chapter.sections || [])) {
            if (!section.sectionCompletions?.length || !section.sectionCompletions[0]?.isCompleted) {
              unreadNestedUnifiedBookContent++;
            }
          }
        }
      }
      
      // --- LEGACY BOOK SYSTEM ---
      
      // Check for any unread legacy books
      const unreadLegacyBooks = (event.books || []).filter(book =>
        !book.user_book_reads?.read
      );
      
      // Check for any unread legacy chapters (directly linked)
      const unreadLegacyChapters = (event.chapters || []).filter(chapter =>
        !chapter.user_chapter_reads?.read
      );
      
      // Check for any unread legacy sections (directly linked)
      const unreadLegacySections = (event.sections || []).filter(section =>
        !section.user_section_reads?.read
      );
      
      // Check sections nested under event-linked legacy chapters
      let unreadNestedLegacySections = 0;
      for (const chapter of (event.chapters || [])) {
        for (const section of (chapter.sections || [])) {
          if (!section.user_section_reads?.read) {
            unreadNestedLegacySections++;
          }
        }
      }
      
      // Check chapters/sections nested under event-linked legacy books
      let unreadNestedLegacyBookContent = 0;
      for (const book of (event.books || [])) {
        for (const chapter of (book.chapters || [])) {
          if (!chapter.user_chapter_reads?.read) {
            unreadNestedLegacyBookContent++;
          }
          for (const section of (chapter.sections || [])) {
            if (!section.user_section_reads?.read) {
              unreadNestedLegacyBookContent++;
            }
          }
        }
      }
      
      // Calculate totals across both systems
      const totalUnconsumed = unwatchedVideos.length + 
        unreadUnifiedBooks.length + unreadUnifiedChapters.length + unreadUnifiedSections.length +
        unreadNestedUnifiedSections + unreadNestedUnifiedBookContent +
        unreadLegacyBooks.length + unreadLegacyChapters.length + unreadLegacySections.length +
        unreadNestedLegacySections + unreadNestedLegacyBookContent;
      
      console.log(`📊 Event "${event.title}" status:`, {
        unwatchedVideos: unwatchedVideos.length,
        unreadUnifiedBooks: unreadUnifiedBooks.length,
        unreadUnifiedChapters: unreadUnifiedChapters.length,
        unreadUnifiedSections: unreadUnifiedSections.length,
        nestedUnifiedSections: unreadNestedUnifiedSections,
        nestedUnifiedBookContent: unreadNestedUnifiedBookContent,
        unreadLegacyBooks: unreadLegacyBooks.length,
        unreadLegacyChapters: unreadLegacyChapters.length,
        unreadLegacySections: unreadLegacySections.length,
        nestedLegacySections: unreadNestedLegacySections,
        nestedLegacyBookContent: unreadNestedLegacyBookContent,
        totalUnconsumed
      });
      
      if (totalUnconsumed === 0) {
        // All content consumed - mark event as reviewed
        await this.markEventReviewed(eventId, true);
        console.log(`✅ Event "${event.title}" marked as reviewed - all content consumed`);
        return true;
      } else {
        console.log(`📝 Event "${event.title}" still has ${totalUnconsumed} unconsumed items`);
        return false;
      }
    } catch (error) {
      console.error('Error checking event completion:', error);
      throw error;
    }
  }

  async markBookRead(bookId) {
    return await this.completionService.markBookCompleted(parseInt(bookId));
  }

  async toggleBookRead(bookId) {
    // Use the unified BookCompletionService toggle method
    return await this.completionService.toggleBookCompletion(parseInt(bookId));
  }

  async markChapterRead(chapterId) {
    return await this.completionService.markChapterCompleted(parseInt(chapterId));
  }

  async toggleChapterRead(chapterId) {
    // Use the unified BookCompletionService toggle method
    return await this.completionService.toggleChapterCompletion(parseInt(chapterId));
  }

  async markSectionRead(sectionId) {
    return await this.completionService.markSectionCompleted(parseInt(sectionId));
  }

  async toggleSectionRead(sectionId) {
    // Use the unified BookCompletionService toggle method
    return await this.completionService.toggleSectionCompletion(parseInt(sectionId));
  }

  // ==========================================
  // STATISTICS & PROGRESS
  // ==========================================

  async getEventProgress(eventId) {
    const event = await this.getEventById(eventId);
    if (!event) return null;

    let totalItems = 0;
    let completedItems = 0;

    // Count books and their completion status through bookLinks
    for (const bookLink of event.bookLinks || []) {
      const book = bookLink.book;
      totalItems++;
      if (book.bookCompletions && book.bookCompletions.length > 0 && book.bookCompletions[0].isCompleted) {
        completedItems++;
      }
    }

    // Count videos and their completion status
    for (const video of event.videos || []) {
      totalItems++;
      if (video.user_video_watches && video.user_video_watches.length > 0 && video.user_video_watches[0].watched) {
        completedItems++;
      }
    }

    return {
      eventId: event.id,
      title: event.title,
      totalItems,
      completedItems,
      completionPercentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      isReviewed: event.user_event_reviews.length > 0 && event.user_event_reviews[0].reviewed
    };
  }

  async getOverallStatistics() {
    const events = await this.prisma.historicalEvent.count({
      where: { hidden: false }
    });

    const books = await this.prisma.historyBook.count();
    const videos = await this.prisma.historyVideo.count();
    const chapters = await this.prisma.historyChapter.count();

    const completedBooks = await this.prisma.bookCompletion.count({
      where: { 
        isCompleted: true,
        userId: "default"
      }
    });

    const completedVideos = await this.prisma.user_video_watches.count({
      where: { watched: true }
    });

    const completedChapters = await this.prisma.chapterCompletion.count({
      where: { 
        isCompleted: true,
        userId: "default"
      }
    });

    return {
      events,
      books,
      videos,
      chapters,
      completedBooks,
      completedVideos,
      completedChapters,
      bookCompletionRate: books > 0 ? Math.round((completedBooks / books) * 100) : 0,
      videoCompletionRate: videos > 0 ? Math.round((completedVideos / videos) * 100) : 0,
      chapterCompletionRate: chapters > 0 ? Math.round((completedChapters / chapters) * 100) : 0
    };
  }

  // ==========================================
  // VIDEO STATISTICS
  // ==========================================

  async getVideoStatistics() {
    try {
      const [
        total,
        watched,
        unassigned,
        assignLater
      ] = await Promise.all([
        this.prisma.historyVideo.count(),
        this.prisma.user_video_watches.count({
          where: { watched: true }
        }),
        this.prisma.historyVideo.count({
          where: { eventId: null }
        }),
        this.prisma.historyVideo.count({
          where: { assignLater: true }
        })
      ]);

      const unwatched = total - watched;

      return {
        total,
        watched,
        unwatched,
        unassigned,
        assignLater
      };
    } catch (error) {
      console.error('Error getting video statistics:', error);
      throw error;
    }
  }

  // ==========================================
  // SEARCH & FILTERING
  // ==========================================

  async searchContent(query) {
    const searchTerm = `%${query}%`;

    const [events, books, videos] = await Promise.all([
      this.prisma.historicalEvent.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { details: { contains: query } },
            { category: { contains: query } }
          ],
          hidden: false
        }
      }),
      this.prisma.historyBook.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { description: { contains: query } }
          ]
        },
        include: { event: true }
      }),
      this.prisma.historyVideo.findMany({
        where: {
          deleted: false,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { courseTitle: { contains: query } }
          ]
        },
        include: { event: true, channel: true }
      })
    ]);

    return {
      events,
      books,
      videos
    };
  }

  // Categories methods
  async getCategories() {
    try {
      return await this.prisma.historyCategory.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  async createCategory(categoryData) {
    try {
      return await this.prisma.historyCategory.create({
        data: {
          name: categoryData.name,
          description: categoryData.description || null,
          color: categoryData.color || '#3B82F6'
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('A category with this name already exists');
      }
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(id, updateData) {
    try {
      return await this.prisma.historyCategory.update({
        where: { id: parseInt(id) },
        data: {
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.description !== undefined && { description: updateData.description || null }),
          ...(updateData.color && { color: updateData.color })
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('A category with this name already exists');
      } else if (error.code === 'P2025') {
        throw new Error('Category not found');
      }
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id) {
    try {
      // Check if any events use this category
      const eventsCount = await this.prisma.historicalEvent.count({
        where: { category: { equals: await this.prisma.historyCategory.findUnique({ where: { id: parseInt(id) } }).then(cat => cat?.name) } }
      });

      if (eventsCount > 0) {
        throw new Error(`Cannot delete category: ${eventsCount} events are using this category`);
      }

      return await this.prisma.historyCategory.delete({
        where: { id: parseInt(id) }
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error('Category not found');
      }
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // ==========================================
  // UP NEXT INTEGRATION
  // ==========================================

  /**
   * Find the next unreviewed historical event
   * An event is considered "unreviewed" if it has at least one piece of content 
   * (video, book, chapter, or section) that hasn't been marked as read/watched
   */
  async getNextUnreviewedEvent() {
    try {
      const events = await this.prisma.historicalEvent.findMany({
        where: { hidden: false },
        include: {
          // Unified book system relationships
          bookLinks: {
            include: {
              book: {
                include: {
                  bookCompletions: true,
                  chapters: {
                    include: {
                      chapterCompletions: true,
                      sections: {
                        include: { sectionCompletions: true }
                      }
                    }
                  }
                }
              }
            }
          },
          bookChapters: {
            include: {
              chapterCompletions: true,
              sections: {
                include: { sectionCompletions: true }
              },
              book: {
                include: {
                  bookCompletions: true
                }
              }
            }
          },
          bookSections: {
            include: {
              sectionCompletions: true,
              chapter: {
                include: {
                  chapterCompletions: true,
                  book: {
                    include: {
                      bookCompletions: true
                    }
                  }
                }
              }
            }
          },
          // Legacy book system relationships
          books: {
            include: {
              user_book_reads: true,
              chapters: {
                include: {
                  user_chapter_reads: true,
                  sections: {
                    include: { user_section_reads: true }
                  }
                }
              }
            }
          },
          chapters: {
            include: {
              user_chapter_reads: true,
              sections: {
                include: { user_section_reads: true }
              }
            }
          },
          sections: {
            include: { user_section_reads: true }
          },
          videos: {
            include: {
              user_video_watches: true,
              channel: true
            }
          },
          user_event_reviews: true
        }
      });

      // Sort events chronologically by parsing dates to numeric values
      const sortedEvents = events.sort((a, b) => {
        const dateA = this.parseHistoricalDate(a.startDate);
        const dateB = this.parseHistoricalDate(b.startDate);
        return dateA - dateB;
      });

      console.log(`🔍 Checking ${sortedEvents.length} events for unreviewed content...`);
      
      // Find the first event with actual unreviewed content
      for (const event of sortedEvents) {
        const isEventReviewed = event.user_event_reviews && event.user_event_reviews.reviewed;
        console.log(`📅 Event: "${event.title}" (${event.startDate}) - Marked as reviewed: ${isEventReviewed}`);
        
        // Always check if this event has unwatched/unread content (regardless of review status)
        const hasUnwatchedContent = await this.checkEventHasUnwatchedContent(event);
        
        if (hasUnwatchedContent) {
          console.log(`✅ Selected event with unwatched content: "${event.title}"`);
          return event;
        } else {
          // Event has no unwatched content
          if (!isEventReviewed) {
            // Safety: re-run authoritative completion check before auto-marking.
            // This prevents false positives from partial parent-level completion state.
            console.log(`🔄 Event "${event.title}" has no unwatched content in candidate scan, verifying before marking reviewed...`);
            const verifiedCompleted = await this.checkAndMarkEventAsReviewed(event.id);
            if (!verifiedCompleted) {
              console.log(`⚠️ Verification kept event "${event.title}" unreviewed due to remaining unread content`);
              return event;
            }
          } else {
            console.log(`⏭️ Event "${event.title}" already reviewed and has no unwatched content, continuing...`);
          }
          // Continue to next event
        }
      }

      // If no unreviewed events, return the first event (or null if no events)
      console.log('⚠️ No unreviewed events found, returning first event');
      return sortedEvents.length > 0 ? sortedEvents[0] : null;
    } catch (error) {
      console.error('Error finding next unreviewed event:', error);
      throw error;
    }
  }

  /**
   * Check if an event has any unwatched/unread content
   * Returns true if there is content to consume, false if all content is consumed
   * Checks content linked directly to the event AND content nested under event-linked parents
   */
  async checkEventHasUnwatchedContent(event) {
    try {
      // Check for any unwatched videos
      const unwatchedVideos = (event.videos || []).filter(video => {
        const watchRecord = video.user_video_watches;
        return !watchRecord || !watchRecord.watched;
      });
      
      // --- UNIFIED BOOK SYSTEM ---
      
      // Check for any unread unified books (via bookLinks)
      const unreadUnifiedBooks = (event.bookLinks || []).filter(bookLink =>
        !bookLink.book.bookCompletions?.[0]?.isCompleted
      );
      
      // Check for any unread unified chapters (directly linked to event)
      const unreadUnifiedChapters = (event.bookChapters || []).filter(chapter =>
        !chapter.chapterCompletions?.[0]?.isCompleted
      );
      
      // Check for any unread unified sections (directly linked to event)
      const unreadUnifiedSections = (event.bookSections || []).filter(section =>
        !section.sectionCompletions?.[0]?.isCompleted
      );
      
      // Check sections nested under event-linked chapters (sections without their own eventId)
      let unreadNestedUnifiedSections = 0;
      for (const chapter of (event.bookChapters || [])) {
        for (const section of (chapter.sections || [])) {
          if (!section.sectionCompletions?.[0]?.isCompleted) {
            unreadNestedUnifiedSections++;
          }
        }
      }
      
      // Check chapters/sections nested under event-linked books (via bookLinks)
      let unreadNestedUnifiedBookContent = 0;
      for (const bookLink of (event.bookLinks || [])) {
        for (const chapter of (bookLink.book.chapters || [])) {
          if (!chapter.chapterCompletions?.[0]?.isCompleted) {
            unreadNestedUnifiedBookContent++;
          }
          for (const section of (chapter.sections || [])) {
            if (!section.sectionCompletions?.[0]?.isCompleted) {
              unreadNestedUnifiedBookContent++;
            }
          }
        }
      }
      
      // --- LEGACY BOOK SYSTEM ---
      
      // Check for any unread legacy books
      const unreadLegacyBooks = (event.books || []).filter(book =>
        !book.user_book_reads?.read
      );
      
      // Check for any unread legacy chapters (directly linked to event)
      const unreadLegacyChapters = (event.chapters || []).filter(chapter =>
        !chapter.user_chapter_reads?.read
      );
      
      // Check for any unread legacy sections (directly linked to event)
      const unreadLegacySections = (event.sections || []).filter(section =>
        !section.user_section_reads?.read
      );
      
      // Check sections nested under event-linked legacy chapters
      let unreadNestedLegacySections = 0;
      for (const chapter of (event.chapters || [])) {
        for (const section of (chapter.sections || [])) {
          if (!section.user_section_reads?.read) {
            unreadNestedLegacySections++;
          }
        }
      }
      
      // Check chapters/sections nested under event-linked legacy books
      let unreadNestedLegacyBookContent = 0;
      for (const book of (event.books || [])) {
        if (book.user_book_reads?.read) continue;
        for (const chapter of (book.chapters || [])) {
          if (!chapter.user_chapter_reads?.read) {
            unreadNestedLegacyBookContent++;
          }
          for (const section of (chapter.sections || [])) {
            if (!section.user_section_reads?.read) {
              unreadNestedLegacyBookContent++;
            }
          }
        }
      }
      
      // Calculate total unwatched/unread content across both systems
      const totalUnwatched = unwatchedVideos.length + 
                           unreadUnifiedBooks.length + unreadUnifiedChapters.length + unreadUnifiedSections.length +
                           unreadNestedUnifiedSections + unreadNestedUnifiedBookContent +
                           unreadLegacyBooks.length + unreadLegacyChapters.length + unreadLegacySections.length +
                           unreadNestedLegacySections + unreadNestedLegacyBookContent;
      
      console.log(`📊 Event "${event.title}" unwatched/unread content:`, {
        videos: unwatchedVideos.length,
        unifiedBooks: unreadUnifiedBooks.length,
        unifiedChapters: unreadUnifiedChapters.length,
        unifiedSections: unreadUnifiedSections.length,
        nestedUnifiedSections: unreadNestedUnifiedSections,
        nestedUnifiedBookContent: unreadNestedUnifiedBookContent,
        legacyBooks: unreadLegacyBooks.length,
        legacyChapters: unreadLegacyChapters.length,
        legacySections: unreadLegacySections.length,
        nestedLegacySections: unreadNestedLegacySections,
        nestedLegacyBookContent: unreadNestedLegacyBookContent,
        total: totalUnwatched
      });
      
      return totalUnwatched > 0;
    } catch (error) {
      console.error('Error checking event unwatched content:', error);
      return true; // Assume there's content if we can't check
    }
  }

  /**
   * Parse historical date string (e.g., "-700000-01-01") to numeric value for sorting
   */
  parseHistoricalDate(dateInput) {
    if (!dateInput) return 0;
    
    const dateString = String(dateInput);
    
    // Handle BCE dates (negative years in our format: "-YYYY...-MM-DD")
    if (dateString.startsWith('-')) {
      // Find the second dash (after the year)
      const secondDashIndex = dateString.indexOf('-', 1);
      
      if (secondDashIndex === -1) {
        // No second dash found, treat entire string after '-' as year
        const year = parseInt(dateString.slice(1));
        return -(year * 10000 + 101); // Default to Jan 1
      }
      
      // Extract year between first and second dash
      const yearStr = dateString.slice(1, secondDashIndex);
      const year = parseInt(yearStr);
      
      // Extract month and day after second dash
      const remainingDate = dateString.slice(secondDashIndex);
      const parts = remainingDate.split('-');
      const month = parseInt(parts[1]) || 1;
      const day = parseInt(parts[2]) || 1;
      
      // For BCE, convert to negative number for sorting (higher BCE numbers = earlier in time)
      return -(year * 10000 + month * 100 + day);
    } else {
      // Handle CE dates (positive years: "YYYY...-MM-DD")
      const firstDashIndex = dateString.indexOf('-');
      
      if (firstDashIndex === -1) {
        // No dash found, treat entire string as year
        const year = parseInt(dateString);
        return year * 10000 + 101; // Default to Jan 1
      }
      
      const yearStr = dateString.slice(0, firstDashIndex);
      const year = parseInt(yearStr);
      const remainingDate = dateString.slice(firstDashIndex);
      const parts = remainingDate.split('-');
      const month = parseInt(parts[1]) || 1;
      const day = parseInt(parts[2]) || 1;
      
      // For CE, use positive number (normal chronological order)
      return year * 10000 + month * 100 + day;
    }
  }

  /**
   * Check if an event has any unreviewed content
   * Updated to use unified book system
   */
  async hasUnreviewedContent(event) {
    console.log(`  🔍 Checking event "${event.title}" for unreviewed content:`);
    console.log(`    📺 Videos: ${event.videos?.length || 0}, 📚 Book Links: ${event.bookLinks?.length || 0}, 📖 Chapters: ${event.bookChapters?.length || 0}, 📄 Sections: ${event.bookSections?.length || 0}`);
    
    // Check videos
    for (const video of event.videos || []) {
      const watchRecord = video.user_video_watches;
      console.log(`    📺 Video "${video.title}":`, {
        hasWatchRecord: !!watchRecord,
        isArray: Array.isArray(watchRecord),
        length: watchRecord?.length,
        watched: watchRecord?.[0]?.watched
      });
      
      const unreviewed = !watchRecord || watchRecord.length === 0 || !watchRecord[0]?.watched;
      console.log(`    📺 Video "${video.title}": ${unreviewed ? 'UNREVIEWED' : 'reviewed'}`);
      if (unreviewed) {
        return true;
      }
    }

    // Check books via bookLinks
    for (const bookLink of event.bookLinks || []) {
      const book = bookLink.book;
      const isCompleted = book.bookCompletions && book.bookCompletions.length > 0 && book.bookCompletions[0].isCompleted;
      console.log(`    📚 Book "${book.title}": ${!isCompleted ? 'UNREVIEWED' : 'reviewed'}`);
      if (!isCompleted) {
        return true;
      }
    }

    // Check chapters (skip if parent book is already read)
    for (const chapter of event.bookChapters || []) {
      const isCompleted = chapter.chapterCompletions && chapter.chapterCompletions.length > 0 && chapter.chapterCompletions[0].isCompleted;
      const parentBookRead = chapter.book?.bookCompletions?.[0]?.isCompleted;
      console.log(`    📖 Chapter "${chapter.title}": ${!isCompleted && !parentBookRead ? 'UNREVIEWED' : 'reviewed'}`);
      if (!isCompleted && !parentBookRead) {
        return true;
      }
    }

    // Check sections (skip if parent chapter or book is already read)
    for (const section of event.bookSections || []) {
      const isCompleted = section.sectionCompletions && section.sectionCompletions.length > 0 && section.sectionCompletions[0].isCompleted;
      const parentChapterRead = section.chapter?.chapterCompletions?.[0]?.isCompleted;
      const parentBookRead = section.chapter?.book?.bookCompletions?.[0]?.isCompleted;
      console.log(`    📄 Section "${section.title}": ${!isCompleted && !parentChapterRead && !parentBookRead ? 'UNREVIEWED' : 'reviewed'}`);
      if (!isCompleted && !parentChapterRead && !parentBookRead) {
        return true;
      }
    }

    console.log(`    ✅ All content reviewed for "${event.title}"`);
    return false;
  }

  /**
   * Randomly select a piece of content from an event
   * Returns an object with type and content data suitable for Up Next display
   */
  async getRandomContentFromEvent(event, allowedTypes = null) {
    try {
      let availableContent = [];

      // Collect only UNREVIEWED content
      event.videos?.forEach(video => {
        const isWatched = video.user_video_watches?.watched;
        if (!isWatched) {
          availableContent.push({
            type: 'video',
            content: video,
            title: video.title,
            description: video.description || '',
            duration: video.duration,
            thumbnail: video.thumbnail,
            channel: video.channel?.name || 'Unknown Channel'
          });
        }
      });

      // ==========================================
      // UNIFIED BOOK SYSTEM
      // ==========================================
      
      // Track IDs already added to avoid duplicates from nested traversal
      const addedChapterIds = new Set();
      const addedSectionIds = new Set();

      // Books (via bookLinks)
      event.bookLinks?.forEach(bookLink => {
        const book = bookLink.book;
        const isRead = book.bookCompletions?.[0]?.isCompleted;
        if (!isRead) {
          availableContent.push({
            type: 'book',
            content: book,
            title: book.title,
            description: book.description || '',
            bookTitle: book.title,
            bookAuthor: book.author || 'Unknown Author',
            bookYear: book.publishYear,
            bookIsbn: book.isbn,
            bookPublisher: book.publisher,
            bookPageCount: book.pageCount,
            bookCoverUrl: book.coverUrl,
            bookDescription: book.description
          });
          
          // Also add unread chapters/sections nested under this book
          for (const chapter of (book.chapters || [])) {
            if (!chapter.chapterCompletions?.[0]?.isCompleted && !addedChapterIds.has(chapter.id)) {
              addedChapterIds.add(chapter.id);
              availableContent.push({
                type: 'chapter',
                content: chapter,
                title: `${book.title} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title}`,
                description: chapter.description || '',
                chapterNumber: chapter.chapterNumber || 0,
                chapterTitle: chapter.title,
                chapterDescription: chapter.description,
                pageStart: chapter.pageStart,
                pageEnd: chapter.pageEnd,
                bookTitle: book.title,
                bookAuthor: book.author || 'Unknown Author',
                bookYear: book.publishYear,
                bookIsbn: book.isbn,
                bookPublisher: book.publisher,
                bookPageCount: book.pageCount,
                bookCoverUrl: book.coverUrl,
                bookDescription: book.description
              });
            }
            for (const section of (chapter.sections || [])) {
              if (!section.sectionCompletions?.[0]?.isCompleted && 
                  !chapter.chapterCompletions?.[0]?.isCompleted &&
                  !addedSectionIds.has(section.id)) {
                addedSectionIds.add(section.id);
                availableContent.push({
                  type: 'section',
                  content: section,
                  title: `${book.title} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title} - Section ${section.sectionNumber || ''}: ${section.title}`,
                  description: section.description || '',
                  sectionNumber: section.sectionNumber || 0,
                  sectionTitle: section.title,
                  sectionDescription: section.description,
                  sectionPageStart: section.pageStart,
                  sectionPageEnd: section.pageEnd,
                  chapterNumber: chapter.chapterNumber || 0,
                  chapterTitle: chapter.title,
                  chapterDescription: chapter.description,
                  pageStart: chapter.pageStart,
                  pageEnd: chapter.pageEnd,
                  bookTitle: book.title,
                  bookAuthor: book.author || 'Unknown Author',
                  bookYear: book.publishYear,
                  bookIsbn: book.isbn,
                  bookPublisher: book.publisher,
                  bookPageCount: book.pageCount,
                  bookCoverUrl: book.coverUrl,
                  bookDescription: book.description
                });
              }
            }
          }
        }
      });

      // Chapters directly linked to events
      event.bookChapters?.forEach(chapter => {
        const isRead = chapter.chapterCompletions?.[0]?.isCompleted;
        const parentBookRead = chapter.book?.bookCompletions?.[0]?.isCompleted;
        if (!isRead && !parentBookRead && !addedChapterIds.has(chapter.id)) {
          addedChapterIds.add(chapter.id);
          const parentBook = chapter.book;
          
          availableContent.push({
            type: 'chapter',
            content: chapter,
            title: `${parentBook?.title || 'Unknown Book'} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title}`,
            description: chapter.description || '',
            chapterNumber: chapter.chapterNumber || 0,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd,
            bookTitle: parentBook?.title || 'Unknown Book',
            bookAuthor: parentBook?.author || 'Unknown Author',
            bookYear: parentBook?.publishYear,
            bookIsbn: parentBook?.isbn,
            bookPublisher: parentBook?.publisher,
            bookPageCount: parentBook?.pageCount,
            bookCoverUrl: parentBook?.coverUrl,
            bookDescription: parentBook?.description
          });
          
          // Also add unread sections nested under this chapter
          for (const section of (chapter.sections || [])) {
            if (!section.sectionCompletions?.[0]?.isCompleted && !addedSectionIds.has(section.id)) {
              addedSectionIds.add(section.id);
              availableContent.push({
                type: 'section',
                content: section,
                title: `${parentBook?.title || 'Unknown Book'} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title} - Section ${section.sectionNumber || ''}: ${section.title}`,
                description: section.description || '',
                sectionNumber: section.sectionNumber || 0,
                sectionTitle: section.title,
                sectionDescription: section.description,
                sectionPageStart: section.pageStart,
                sectionPageEnd: section.pageEnd,
                chapterNumber: chapter.chapterNumber || 0,
                chapterTitle: chapter.title,
                chapterDescription: chapter.description,
                pageStart: chapter.pageStart,
                pageEnd: chapter.pageEnd,
                bookTitle: parentBook?.title || 'Unknown Book',
                bookAuthor: parentBook?.author || 'Unknown Author',
                bookYear: parentBook?.publishYear,
                bookIsbn: parentBook?.isbn,
                bookPublisher: parentBook?.publisher,
                bookPageCount: parentBook?.pageCount,
                bookCoverUrl: parentBook?.coverUrl,
                bookDescription: parentBook?.description
              });
            }
          }
        }
      });

      // Sections directly linked to events
      event.bookSections?.forEach(section => {
        const isRead = section.sectionCompletions?.[0]?.isCompleted;
        const parentChapterRead = section.chapter?.chapterCompletions?.[0]?.isCompleted;
        const parentBookRead = section.chapter?.book?.bookCompletions?.[0]?.isCompleted;
        if (!isRead && !parentChapterRead && !parentBookRead && !addedSectionIds.has(section.id)) {
          addedSectionIds.add(section.id);
          const parentChapter = section.chapter;
          const parentBook = parentChapter?.book;
          
          availableContent.push({
            type: 'section',
            content: section,
            title: `${parentBook?.title || 'Unknown Book'} - Chapter ${parentChapter?.chapterNumber || ''}: ${parentChapter?.title || 'Unknown Chapter'} - Section ${section.sectionNumber || ''}: ${section.title}`,
            description: section.description || '',
            sectionNumber: section.sectionNumber || 0,
            sectionTitle: section.title,
            sectionDescription: section.description,
            sectionPageStart: section.pageStart,
            sectionPageEnd: section.pageEnd,
            chapterNumber: parentChapter?.chapterNumber || 0,
            chapterTitle: parentChapter?.title || 'Unknown Chapter',
            chapterDescription: parentChapter?.description,
            pageStart: parentChapter?.pageStart,
            pageEnd: parentChapter?.pageEnd,
            bookTitle: parentBook?.title || 'Unknown Book',
            bookAuthor: parentBook?.author || 'Unknown Author',
            bookYear: parentBook?.publishYear,
            bookIsbn: parentBook?.isbn,
            bookPublisher: parentBook?.publisher,
            bookPageCount: parentBook?.pageCount,
            bookCoverUrl: parentBook?.coverUrl,
            bookDescription: parentBook?.description
          });
        }
      });

      // ==========================================
      // LEGACY BOOK SYSTEM
      // ==========================================
      
      const addedLegacyChapterIds = new Set();
      const addedLegacySectionIds = new Set();

      // Legacy books (directly linked to event)
      event.books?.forEach(book => {
        if (!book.user_book_reads?.read) {
          availableContent.push({
            type: 'book',
            content: book,
            title: book.title,
            description: book.description || '',
            bookTitle: book.title,
            bookAuthor: book.author || 'Unknown Author',
            bookYear: book.publishYear,
            bookIsbn: book.isbn,
            bookPublisher: book.publisher,
            bookPageCount: book.pageCount,
            bookCoverUrl: book.coverUrl,
            bookDescription: book.description
          });
          
          // Also add unread chapters/sections nested under this book
          for (const chapter of (book.chapters || [])) {
            if (!chapter.user_chapter_reads?.read && !addedLegacyChapterIds.has(chapter.id)) {
              addedLegacyChapterIds.add(chapter.id);
              availableContent.push({
                type: 'chapter',
                content: chapter,
                title: `${book.title} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title}`,
                description: chapter.description || '',
                chapterNumber: chapter.chapterNumber || 0,
                chapterTitle: chapter.title,
                chapterDescription: chapter.description,
                pageStart: chapter.pageStart,
                pageEnd: chapter.pageEnd,
                bookTitle: book.title,
                bookAuthor: book.author || 'Unknown Author',
                bookYear: book.publishYear,
                bookIsbn: book.isbn,
                bookPublisher: book.publisher,
                bookPageCount: book.pageCount,
                bookCoverUrl: book.coverUrl,
                bookDescription: book.description
              });
            }
            for (const section of (chapter.sections || [])) {
              if (!section.user_section_reads?.read && !addedLegacySectionIds.has(section.id)) {
                addedLegacySectionIds.add(section.id);
                availableContent.push({
                  type: 'section',
                  content: section,
                  title: `${book.title} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title} - Section ${section.sectionNumber || ''}: ${section.title}`,
                  description: section.description || '',
                  sectionNumber: section.sectionNumber || 0,
                  sectionTitle: section.title,
                  sectionDescription: section.description,
                  sectionPageStart: section.pageStart,
                  sectionPageEnd: section.pageEnd,
                  chapterNumber: chapter.chapterNumber || 0,
                  chapterTitle: chapter.title,
                  chapterDescription: chapter.description,
                  pageStart: chapter.pageStart,
                  pageEnd: chapter.pageEnd,
                  bookTitle: book.title,
                  bookAuthor: book.author || 'Unknown Author',
                  bookYear: book.publishYear,
                  bookIsbn: book.isbn,
                  bookPublisher: book.publisher,
                  bookPageCount: book.pageCount,
                  bookCoverUrl: book.coverUrl,
                  bookDescription: book.description
                });
              }
            }
          }
        }
      });

      // Legacy chapters (directly linked to event)
      event.chapters?.forEach(chapter => {
        if (!chapter.user_chapter_reads?.read && !addedLegacyChapterIds.has(chapter.id)) {
          addedLegacyChapterIds.add(chapter.id);
          availableContent.push({
            type: 'chapter',
            content: chapter,
            title: `Chapter ${chapter.chapterNumber || ''}: ${chapter.title}`,
            description: chapter.description || '',
            chapterNumber: chapter.chapterNumber || 0,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd,
            bookTitle: 'Unknown Book',
            bookAuthor: 'Unknown Author'
          });
          
          // Also add unread sections nested under this chapter
          for (const section of (chapter.sections || [])) {
            if (!section.user_section_reads?.read && !addedLegacySectionIds.has(section.id)) {
              addedLegacySectionIds.add(section.id);
              availableContent.push({
                type: 'section',
                content: section,
                title: `Chapter ${chapter.chapterNumber || ''}: ${chapter.title} - Section ${section.sectionNumber || ''}: ${section.title}`,
                description: section.description || '',
                sectionNumber: section.sectionNumber || 0,
                sectionTitle: section.title,
                sectionDescription: section.description,
                sectionPageStart: section.pageStart,
                sectionPageEnd: section.pageEnd,
                chapterNumber: chapter.chapterNumber || 0,
                chapterTitle: chapter.title,
                chapterDescription: chapter.description,
                pageStart: chapter.pageStart,
                pageEnd: chapter.pageEnd,
                bookTitle: 'Unknown Book',
                bookAuthor: 'Unknown Author'
              });
            }
          }
        }
      });

      // Legacy sections (directly linked to event)
      event.sections?.forEach(section => {
        if (!section.user_section_reads?.read && !addedLegacySectionIds.has(section.id)) {
          addedLegacySectionIds.add(section.id);
          availableContent.push({
            type: 'section',
            content: section,
            title: `Section ${section.sectionNumber || ''}: ${section.title}`,
            description: section.description || '',
            sectionNumber: section.sectionNumber || 0,
            sectionTitle: section.title,
            sectionDescription: section.description,
            sectionPageStart: section.pageStart,
            sectionPageEnd: section.pageEnd
          });
        }
      });

      console.log(`🎲 Found ${availableContent.length} unreviewed items in event "${event.title}"`);
      
      // Filter by allowed types if specified
      if (allowedTypes && allowedTypes.length > 0) {
        availableContent = availableContent.filter(item => allowedTypes.includes(item.type));
        console.log(`🎯 After media type filtering: ${availableContent.length} items (allowed: ${allowedTypes.join(', ')})`);
      }
      
      if (availableContent.length === 0) {
        console.log('⚠️ No unreviewed content found in event');
        return null;
      }

      // Randomly select one piece of unreviewed content
      const randomIndex = Math.floor(Math.random() * availableContent.length);
      const selectedContent = availableContent[randomIndex];

      console.log(`🎲 Randomly selected ${selectedContent.type}: ${selectedContent.title}`);

      // Add event information with formatted date range
      selectedContent.eventId = event.id;
      selectedContent.eventTitle = event.title;
      selectedContent.eventDate = event.startDate;
      
      // Format the event title with date range for Android display
      const formatHistoricalDate = (dateStr) => {
        if (!dateStr) return '';
        const match = dateStr.match(/^(-?\d{1,4})/);
        if (match) {
          const year = parseInt(match[1]);
          if (year < 0) {
            return `${Math.abs(year)} BCE`;
          } else if (year > 0) {
            return `${year} CE`;
          }
        }
        return dateStr;
      };
      
      let formattedEventTitle = event.title;
      if (event.startDate && event.endDate && event.startDate !== event.endDate) {
        const startFormatted = formatHistoricalDate(event.startDate);
        const endFormatted = formatHistoricalDate(event.endDate);
        formattedEventTitle = `${event.title} (${startFormatted} - ${endFormatted})`;
      } else if (event.startDate) {
        const startFormatted = formatHistoricalDate(event.startDate);
        formattedEventTitle = `${event.title} (${startFormatted})`;
      }
      selectedContent.eventTitleWithDates = formattedEventTitle;

      return selectedContent;
    } catch (error) {
      console.error('Error selecting random content from event:', error);
      throw error;
    }
  }
}

module.exports = HistoryPlusService;
