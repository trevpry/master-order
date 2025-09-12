const { PrismaClient } = require('@prisma/client');

/**
 * History Plus Service - Business logic for historical content management
 * Handles events, books, videos, chapters, sections, and progress tracking
 */
class HistoryPlusService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // ==========================================
  // HISTORICAL EVENTS
  // ==========================================

  async getAllEvents() {
    const events = await this.prisma.historicalEvent.findMany({
      where: { hidden: false },
      include: {
        books: {
          include: {
            chapters: {
              include: {
                sections: true,
                user_chapter_reads: true
              }
            },
            user_book_reads: true
          }
        },
        chapters: {
          include: {
            book: true,
            sections: true,
            user_chapter_reads: true
          }
        },
        sections: {
          include: {
            chapter: {
              include: {
                book: true
              }
            },
            user_section_reads: true
          }
        },
        videos: {
          include: {
            channel: true,
            user_video_watches: true
          }
        },
        user_event_reviews: true
      },
      orderBy: { startDate: 'asc' }
    });

    // Map user_event_reviews to reviewed property for frontend compatibility
    return events.map(event => ({
      ...event,
      reviewed: event.user_event_reviews?.reviewed || false,
      videos: event.videos?.map(video => ({
        ...video,
        watched: video.user_video_watches?.watched || false
      })) || [],
      books: event.books?.map(book => ({
        ...book,
        read: book.user_book_reads?.read || false
      })) || [],
      chapters: event.chapters?.map(chapter => ({
        ...chapter,
        read: chapter.user_chapter_reads?.read || false
      })) || [],
      sections: event.sections?.map(section => ({
        ...section,
        read: section.user_section_reads?.read || false
      })) || []
    }));
  }

  async getEventById(id) {
    const event = await this.prisma.historicalEvent.findUnique({
      where: { id: parseInt(id) },
      include: {
        books: {
          include: {
            chapters: {
              include: {
                sections: true,
                user_chapter_reads: true
              }
            },
            user_book_reads: true
          }
        },
        chapters: {
          include: {
            book: true,
            sections: true,
            user_chapter_reads: true
          }
        },
        sections: {
          include: {
            chapter: {
              include: {
                book: true
              }
            },
            user_section_reads: true
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

    // Map user_event_reviews to reviewed property for frontend compatibility
    return {
      ...event,
      reviewed: event.user_event_reviews?.reviewed || false,
      videos: event.videos?.map(video => ({
        ...video,
        watched: video.user_video_watches?.watched || false
      })) || [],
      books: event.books?.map(book => ({
        ...book,
        read: book.user_book_reads?.read || false
      })) || [],
      chapters: event.chapters?.map(chapter => ({
        ...chapter,
        read: chapter.user_chapter_reads?.read || false
      })) || [],
      sections: event.sections?.map(section => ({
        ...section,
        read: section.user_section_reads?.read || false
      })) || []
    };
  }

  async createEvent(eventData) {
    return await this.prisma.historicalEvent.create({
      data: eventData
    });
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
  // BOOKS & CHAPTERS
  // ==========================================

  async getAllBooks() {
    const books = await this.prisma.historyBook.findMany({
      include: {
        chapters: {
          include: {
            sections: {
              include: {
                user_section_reads: true
              }
            },
            user_chapter_reads: true
          }
        },
        user_book_reads: true,
        event: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate statistics for each book
    const booksWithStats = books.map(book => {
      const chapters = book.chapters || [];
      const chaptersTotal = chapters.length;
      const chaptersRead = chapters.filter(chapter => 
        chapter.user_chapter_reads && chapter.user_chapter_reads.read
      ).length;
      
      const sectionsTotal = chapters.reduce((sum, chapter) => {
        const sections = chapter.sections || [];
        return sum + sections.length;
      }, 0);
      const sectionsRead = chapters.reduce((sum, chapter) => {
        const sections = chapter.sections || [];
        return sum + sections.filter(section => 
          section.user_section_reads && section.user_section_reads.read
        ).length;
      }, 0);

      const progressPercentage = sectionsTotal > 0 ? Math.round((sectionsRead / sectionsTotal) * 100) : 0;
      const read = book.user_book_reads && book.user_book_reads.read;

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
            user_chapter_reads: true
          }
        },
        user_book_reads: true
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
                user_section_reads: true
              }
            },
            user_chapter_reads: true
          }
        },
        user_book_reads: true,
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
        read: section.user_section_reads && section.user_section_reads.read
      }));

      return {
        ...chapter,
        read: chapter.user_chapter_reads && chapter.user_chapter_reads.read,
        sections: sectionsWithReadStatus,
        _count: { sections: sectionsWithReadStatus.length }
      };
    });

    // Map book read status
    return {
      ...book,
      read: book.user_book_reads && book.user_book_reads.read,
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
            user_section_reads: true
          }
        },
        user_chapter_reads: true,
        book: true,
        event: true
      }
    });

    if (!chapter) return null;

    // Map user tracking data to read status for sections
    const sections = chapter.sections || [];
    const sectionsWithReadStatus = sections.map(section => ({
      ...section,
      read: section.user_section_reads && section.user_section_reads.read
    }));

    // Map chapter read status
    return {
      ...chapter,
      read: chapter.user_chapter_reads && chapter.user_chapter_reads.read,
      sections: sectionsWithReadStatus
    };
  }

  // ==========================================
  // VIDEOS & CHANNELS
  // ==========================================

  async getVideosByEvent(eventId) {
    return await this.prisma.historyVideo.findMany({
      where: { eventId: parseInt(eventId) },
      include: {
        channel: true,
        user_video_watches: true
      }
    });
  }

  async getVideoById(id) {
    return await this.prisma.historyVideo.findUnique({
      where: { id: parseInt(id) },
      include: {
        channel: true,
        user_video_watches: true,
        event: true
      }
    });
  }

  async getAllVideos() {
    return await this.prisma.historyVideo.findMany({
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
    // First delete any related user_video_watches
    await this.prisma.user_video_watches.deleteMany({
      where: { videoId: parseInt(id) }
    });
    
    return await this.prisma.historyVideo.delete({
      where: { id: parseInt(id) }
    });
  }

  async getAllChannels() {
    return await this.prisma.historyChannel.findMany({
      include: {
        videos: true
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
        videos: true
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
        videos: true
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
          books: {
            include: { user_book_reads: true }
          },
          chapters: {
            include: { user_chapter_reads: true }
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
      const unwatchedVideos = event.videos.filter(video => 
        !video.user_video_watches || !video.user_video_watches.watched
      );
      
      // Check for any unread books
      const unreadBooks = event.books.filter(book =>
        !book.user_book_reads || !book.user_book_reads.read
      );
      
      // Check for any unread chapters
      const unreadChapters = event.chapters.filter(chapter =>
        !chapter.user_chapter_reads || !chapter.user_chapter_reads.read
      );
      
      // Check for any unread sections
      const unreadSections = event.sections.filter(section =>
        !section.user_section_reads || !section.user_section_reads.read
      );
      
      const totalUnconsumed = unwatchedVideos.length + unreadBooks.length + unreadChapters.length + unreadSections.length;
      
      console.log(`📊 Event "${event.title}" status:`, {
        unwatchedVideos: unwatchedVideos.length,
        unreadBooks: unreadBooks.length, 
        unreadChapters: unreadChapters.length,
        unreadSections: unreadSections.length,
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
    return await this.prisma.user_book_reads.upsert({
      where: { bookId: parseInt(bookId) },
      update: { read: true, readAt: new Date() },
      create: { 
        bookId: parseInt(bookId), 
        read: true, 
        readAt: new Date() 
      }
    });
  }

  async toggleBookRead(bookId) {
    const existing = await this.prisma.user_book_reads.findUnique({
      where: { bookId: parseInt(bookId) }
    });

    if (existing) {
      return await this.prisma.user_book_reads.update({
        where: { bookId: parseInt(bookId) },
        data: { read: !existing.read, readAt: existing.read ? null : new Date() }
      });
    } else {
      return await this.prisma.user_book_reads.create({
        data: { 
          bookId: parseInt(bookId), 
          read: true, 
          readAt: new Date() 
        }
      });
    }
  }

  async markChapterRead(chapterId) {
    return await this.prisma.user_chapter_reads.upsert({
      where: { chapterId: parseInt(chapterId) },
      update: { read: true, readAt: new Date() },
      create: { 
        chapterId: parseInt(chapterId), 
        read: true, 
        readAt: new Date() 
      }
    });
  }

  async toggleChapterRead(chapterId) {
    const existing = await this.prisma.user_chapter_reads.findUnique({
      where: { chapterId: parseInt(chapterId) }
    });

    if (existing) {
      return await this.prisma.user_chapter_reads.update({
        where: { chapterId: parseInt(chapterId) },
        data: { read: !existing.read, readAt: existing.read ? null : new Date() }
      });
    } else {
      return await this.prisma.user_chapter_reads.create({
        data: { 
          chapterId: parseInt(chapterId), 
          read: true, 
          readAt: new Date() 
        }
      });
    }
  }

  async markSectionRead(sectionId) {
    return await this.prisma.user_section_reads.upsert({
      where: { sectionId: parseInt(sectionId) },
      update: { read: true, readAt: new Date() },
      create: { 
        sectionId: parseInt(sectionId), 
        read: true, 
        readAt: new Date() 
      }
    });
  }

  async toggleSectionRead(sectionId) {
    const existing = await this.prisma.user_section_reads.findUnique({
      where: { sectionId: parseInt(sectionId) }
    });

    if (existing) {
      return await this.prisma.user_section_reads.update({
        where: { sectionId: parseInt(sectionId) },
        data: { read: !existing.read, readAt: existing.read ? null : new Date() }
      });
    } else {
      return await this.prisma.user_section_reads.create({
        data: { 
          sectionId: parseInt(sectionId), 
          read: true, 
          readAt: new Date() 
        }
      });
    }
  }

  // ==========================================
  // STATISTICS & PROGRESS
  // ==========================================

  async getEventProgress(eventId) {
    const event = await this.getEventById(eventId);
    if (!event) return null;

    let totalItems = 0;
    let completedItems = 0;

    // Count books and their completion status
    for (const book of event.books) {
      totalItems++;
      if (book.user_book_reads.length > 0 && book.user_book_reads[0].read) {
        completedItems++;
      }
    }

    // Count videos and their completion status
    for (const video of event.videos) {
      totalItems++;
      if (video.user_video_watches.length > 0 && video.user_video_watches[0].watched) {
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

    const completedBooks = await this.prisma.user_book_reads.count({
      where: { read: true }
    });

    const completedVideos = await this.prisma.user_video_watches.count({
      where: { watched: true }
    });

    const completedChapters = await this.prisma.user_chapter_reads.count({
      where: { read: true }
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
      // For now, return hardcoded categories
      // In the future, this could be made configurable
      return [
        { id: 1, name: 'Ancient History', color: '#8B5CF6' },
        { id: 2, name: 'Medieval History', color: '#059669' },
        { id: 3, name: 'Renaissance', color: '#DC2626' },
        { id: 4, name: 'Modern History', color: '#2563EB' },
        { id: 5, name: 'World War I', color: '#B45309' },
        { id: 6, name: 'World War II', color: '#7C2D12' },
        { id: 7, name: 'Cold War', color: '#374151' },
        { id: 8, name: 'Science & Technology', color: '#0891B2' },
        { id: 9, name: 'Philosophy', color: '#7C3AED' },
        { id: 10, name: 'Literature', color: '#BE185D' },
        { id: 11, name: 'Art & Culture', color: '#EA580C' },
        { id: 12, name: 'Politics', color: '#DC2626' },
        { id: 13, name: 'Religion', color: '#059669' },
        { id: 14, name: 'Economics', color: '#0D9488' }
      ];
    } catch (error) {
      console.error('Error getting categories:', error);
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
          books: {
            include: {
              chapters: {
                include: {
                  sections: {
                    include: {
                      user_section_reads: true
                    }
                  },
                  user_chapter_reads: true
                }
              },
              user_book_reads: true
            }
          },
          chapters: {
            include: {
              sections: {
                include: {
                  user_section_reads: true
                }
              },
              user_chapter_reads: true,
              book: true
            }
          },
          sections: {
            include: {
              user_section_reads: true,
              chapter: {
                include: {
                  book: true
                }
              }
            }
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

      // Sort events chronologically by converting string dates to Date objects
      const sortedEvents = events.sort((a, b) => {
        const dateA = this.parseHistoricalDate(a.startDate);
        const dateB = this.parseHistoricalDate(b.startDate);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`🔍 Checking ${sortedEvents.length} events for unreviewed content...`);
      
      console.log(`� Checking ${sortedEvents.length} events for unreviewed content...`);
      
      // Find the first event with actual unreviewed content
      for (const event of sortedEvents) {
        const isEventReviewed = event.user_event_reviews && event.user_event_reviews.reviewed;
        console.log(`📅 Event: "${event.title}" (${event.startDate}) - Marked as reviewed: ${isEventReviewed}`);
        
        if (!isEventReviewed) {
          // Check if this event actually has unwatched/unread content
          const hasUnwatchedContent = await this.checkEventHasUnwatchedContent(event);
          
          if (hasUnwatchedContent) {
            console.log(`✅ Selected event with unwatched content: "${event.title}"`);
            return event;
          } else {
            // Event has no unwatched content but isn't marked as reviewed - mark it as reviewed
            console.log(`🔄 Event "${event.title}" has no unwatched content, marking as reviewed and continuing...`);
            await this.markEventReviewed(event.id, true);
            // Continue to next event
          }
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
   */
  async checkEventHasUnwatchedContent(event) {
    try {
      // Check for any unwatched videos
      const unwatchedVideos = event.videos.filter(video => 
        !video.user_video_watches || !video.user_video_watches.watched
      );
      
      // Check for any unread books
      const unreadBooks = event.books.filter(book =>
        !book.user_book_reads || !book.user_book_reads.read
      );
      
      // Check for any unread chapters (direct event chapters)
      const unreadChapters = event.chapters.filter(chapter =>
        !chapter.user_chapter_reads || !chapter.user_chapter_reads.read
      );
      
      // Check for any unread sections (direct event sections)
      const unreadSections = event.sections.filter(section =>
        !section.user_section_reads || !section.user_section_reads.read
      );
      
      // Also check for unread chapters within books and sections within chapters
      const unreadBookChapters = event.books.flatMap(book => 
        book.chapters?.filter(chapter => !chapter.user_chapter_reads || !chapter.user_chapter_reads.read) || []
      );
      
      const unreadChapterSections = event.chapters.flatMap(chapter =>
        chapter.sections?.filter(section => !section.user_section_reads || !section.user_section_reads.read) || []
      );
      
      const unreadBookChapterSections = event.books.flatMap(book =>
        book.chapters?.flatMap(chapter =>
          chapter.sections?.filter(section => !section.user_section_reads || !section.user_section_reads.read) || []
        ) || []
      );
      
      const totalUnwatched = unwatchedVideos.length + unreadBooks.length + unreadChapters.length + 
                            unreadSections.length + unreadBookChapters.length + unreadChapterSections.length + 
                            unreadBookChapterSections.length;
      
      console.log(`📊 Event "${event.title}" unwatched content:`, {
        videos: unwatchedVideos.length,
        books: unreadBooks.length,
        chapters: unreadChapters.length,
        sections: unreadSections.length,
        bookChapters: unreadBookChapters.length,
        chapterSections: unreadChapterSections.length,
        bookChapterSections: unreadBookChapterSections.length,
        total: totalUnwatched
      });
      
      return totalUnwatched > 0;
    } catch (error) {
      console.error('Error checking event unwatched content:', error);
      return true; // Assume there's content if we can't check
    }
  }

  /**
   * Parse historical date string (e.g., "-2334-01-01") to Date object
   */
  parseHistoricalDate(dateString) {
    if (!dateString) return new Date(0);
    
    // Handle BCE dates (negative years)
    if (dateString.startsWith('-')) {
      const withoutMinus = dateString.substring(1);
      const [year, month, day] = withoutMinus.split('-').map(num => parseInt(num, 10));
      // For BCE dates, we use negative years and adjust for JavaScript Date behavior
      return new Date(-year + 1, (month || 1) - 1, day || 1);
    } else {
      // CE dates
      return new Date(dateString);
    }
  }

  /**
   * Check if an event has any unreviewed content
   */
  async hasUnreviewedContent(event) {
    console.log(`  🔍 Checking event "${event.title}" for unreviewed content:`);
    console.log(`    📺 Videos: ${event.videos.length}, 📚 Books: ${event.books.length}, 📖 Chapters: ${event.chapters.length}, 📄 Sections: ${event.sections.length}`);
    
    // Check videos
    for (const video of event.videos) {
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

    // Check books
    for (const book of event.books) {
      const readRecord = book.user_book_reads;
      const unreviewed = !readRecord || readRecord.length === 0 || !readRecord[0]?.read;
      console.log(`    📚 Book "${book.title}": ${unreviewed ? 'UNREVIEWED' : 'reviewed'}`);
      if (unreviewed) {
        return true;
      }
    }

    // Check chapters
    for (const chapter of event.chapters) {
      const readRecord = chapter.user_chapter_reads;
      const unreviewed = !readRecord || readRecord.length === 0 || !readRecord[0]?.read;
      console.log(`    📖 Chapter "${chapter.title}": ${unreviewed ? 'UNREVIEWED' : 'reviewed'}`);
      if (unreviewed) {
        return true;
      }
    }

    // Check sections
    for (const section of event.sections) {
      const readRecord = section.user_section_reads;
      const unreviewed = !readRecord || readRecord.length === 0 || !readRecord[0]?.read;
      console.log(`    📄 Section "${section.title}": ${unreviewed ? 'UNREVIEWED' : 'reviewed'}`);
      if (unreviewed) {
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
  async getRandomContentFromEvent(event) {
    try {
      const availableContent = [];

      // Collect only UNREVIEWED content
      event.videos?.forEach(video => {
        const isWatched = video.user_video_watches && video.user_video_watches.watched;
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

      event.books?.forEach(book => {
        const isRead = book.user_book_reads && book.user_book_reads.read;
        if (!isRead) {
          availableContent.push({
            type: 'book',
            content: book,
            title: book.title,
            description: book.description || '',
            // Book-specific fields to match custom order format
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
      });

      event.chapters?.forEach(chapter => {
        const isRead = chapter.user_chapter_reads && chapter.user_chapter_reads.read;
        if (!isRead) {
          availableContent.push({
            type: 'chapter',
            content: chapter,
            title: `${chapter.book?.title || 'Unknown Book'} - Chapter ${chapter.chapterNumber || ''}: ${chapter.title}`,
            description: chapter.description || '',
            // Book-specific fields with chapter details
            bookTitle: chapter.book?.title || 'Unknown Book',
            bookAuthor: chapter.book?.author || 'Unknown Author',
            bookYear: chapter.book?.publishYear,
            bookIsbn: chapter.book?.isbn,
            bookPublisher: chapter.book?.publisher,
            bookPageCount: chapter.book?.pageCount,
            bookCoverUrl: chapter.book?.coverUrl,
            bookDescription: chapter.book?.description,
            // Chapter-specific details
            chapterNumber: chapter.chapterNumber || 0,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd
          });
        }
      });

      event.sections?.forEach(section => {
        const isRead = section.user_section_reads && section.user_section_reads.read;
        if (!isRead) {
          availableContent.push({
            type: 'section',
            content: section,
            title: `${section.chapter?.book?.title || 'Unknown Book'} - Chapter ${section.chapter?.chapterNumber || ''}: ${section.chapter?.title || 'Unknown Chapter'} - Section ${section.sectionNumber || ''}: ${section.title}`,
            description: section.description || '',
            // Book-specific fields with section details
            bookTitle: section.chapter?.book?.title || 'Unknown Book',
            bookAuthor: section.chapter?.book?.author || 'Unknown Author',
            bookYear: section.chapter?.book?.publishYear,
            bookIsbn: section.chapter?.book?.isbn,
            bookPublisher: section.chapter?.book?.publisher,
            bookPageCount: section.chapter?.book?.pageCount,
            bookCoverUrl: section.chapter?.book?.coverUrl,
            bookDescription: section.chapter?.book?.description,
            // Chapter details
            chapterNumber: section.chapter?.chapterNumber || 0,
            chapterTitle: section.chapter?.title || 'Unknown Chapter',
            chapterDescription: section.chapter?.description,
            // Section-specific details
            sectionNumber: section.sectionNumber || 0,
            sectionTitle: section.title,
            sectionDescription: section.description,
            pageStart: section.pageStart,
            pageEnd: section.pageEnd
          });
        }
      });

      console.log(`🎲 Found ${availableContent.length} unreviewed items in event "${event.title}"`);
      
      if (availableContent.length === 0) {
        console.log('⚠️ No unreviewed content found in event');
        return null;
      }

      // Randomly select one piece of unreviewed content
      const randomIndex = Math.floor(Math.random() * availableContent.length);
      const selectedContent = availableContent[randomIndex];

      console.log(`🎲 Randomly selected ${selectedContent.type}: ${selectedContent.title}`);

      // Add event information
      selectedContent.eventId = event.id;
      selectedContent.eventTitle = event.title;
      selectedContent.eventDate = event.startDate;

      return selectedContent;
    } catch (error) {
      console.error('Error selecting random content from event:', error);
      throw error;
    }
  }
}

module.exports = HistoryPlusService;
