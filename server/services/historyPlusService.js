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
    return await this.prisma.historicalEvent.findMany({
      where: { hidden: false },
      include: {
        books: {
          include: {
            chapters: {
              include: {
                sections: true
              }
            }
          }
        },
        videos: {
          include: {
            channel: true
          }
        },
        user_event_reviews: true
      },
      orderBy: { startDate: 'asc' }
    });
  }

  async getEventById(id) {
    return await this.prisma.historicalEvent.findUnique({
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
        videos: {
          include: {
            channel: true,
            user_video_watches: true
          }
        },
        user_event_reviews: true
      }
    });
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
      const chaptersTotal = book.chapters.length;
      const chaptersRead = book.chapters.filter(chapter => 
        chapter.user_chapter_reads.length > 0 && chapter.user_chapter_reads[0].read
      ).length;
      
      const sectionsTotal = book.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0);
      const sectionsRead = book.chapters.reduce((sum, chapter) => 
        sum + chapter.sections.filter(section => 
          section.user_section_reads.length > 0 && section.user_section_reads[0].read
        ).length, 0
      );

      const progressPercentage = sectionsTotal > 0 ? Math.round((sectionsRead / sectionsTotal) * 100) : 0;
      const read = book.user_book_reads.length > 0 && book.user_book_reads[0].read;

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
    return await this.prisma.historyBook.findUnique({
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
    return await this.prisma.historyChapter.findUnique({
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
}

module.exports = HistoryPlusService;
