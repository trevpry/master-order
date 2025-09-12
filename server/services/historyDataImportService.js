const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

/**
 * History Data Import Service - Imports PostgreSQL history data to Eddie Life Management
 * Follows Eddie's modular service architecture from instructions
 */
class HistoryDataImportService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Main import method - imports PostgreSQL data to Eddie tables
   * Maps PostgreSQL structure to Eddie's HistoryChannel, HistoryVideo, etc.
   */
  async importFromPostgreSQL(exportFilePath) {
    console.log('🔄 Starting History Data Import...');
    console.log(`📁 Source: ${exportFilePath}`);
    
    try {
      // Read and parse PostgreSQL export
      const exportData = fs.readFileSync(exportFilePath, 'utf8');
      
      // Import in correct order due to foreign key dependencies
      await this.importChannels(exportData);
      await this.importHistoricalEvents(exportData);
      await this.importBooks(exportData);
      await this.importVideos(exportData);
      await this.importCategories(exportData);
      await this.importChapters(exportData);
      await this.importSections(exportData);
      await this.importUserTracking(exportData);
      
      console.log('✅ History data import completed successfully!');
      
      // Return summary
      return await this.getImportSummary();
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Import Channels from PostgreSQL to HistoryChannel table
   */
  async importChannels(exportData) {
    console.log('📺 Importing Channels...');
    
    const channelData = this.extractTableData(exportData, 'Channel');
    if (!channelData.length) {
      console.log('  No channel data found');
      return;
    }

    let successCount = 0;
    for (const row of channelData) {
      const [id, name, handle, channelUrl, description, subscriberCount, verified, createdAt, updatedAt] = row.split('\t');
      
      try {
        await this.prisma.historyChannel.upsert({
          where: { channelUrl: channelUrl },
          update: {
            name: this.parseString(name) || 'Unknown Channel',
            handle: this.parseString(handle),
            description: this.parseString(description),
            subscriberCount: this.parseString(subscriberCount),
            verified: verified === 't',
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            name: this.parseString(name) || 'Unknown Channel',
            handle: this.parseString(handle),
            channelUrl: channelUrl,
            description: this.parseString(description),
            subscriberCount: this.parseString(subscriberCount),
            verified: verified === 't',
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import channel ${name}:`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${channelData.length} channels`);
  }

  /**
   * Import Historical Events
   */
  async importHistoricalEvents(exportData) {
    console.log('📜 Importing Historical Events...');
    
    const eventData = this.extractTableData(exportData, 'HistoricalEvent');
    if (!eventData.length) {
      console.log('  No event data found');
      return;
    }

    let successCount = 0;
    for (const row of eventData) {
      const [id, title, startDate, endDate, details, category, reviewed, createdAt, updatedAt] = row.split('\t');
      
      try {
        // First try to find existing event by title to avoid duplicates
        const existingEvent = await this.prisma.historicalEvent.findFirst({
          where: { title: this.parseString(title) || 'Unknown Event' }
        });

        if (existingEvent) {
          // Update existing event
          await this.prisma.historicalEvent.update({
            where: { id: existingEvent.id },
            data: {
              title: this.parseString(title) || 'Unknown Event',
              startDate: this.parseDateString(startDate, true), // Required field
              endDate: this.parseDateString(endDate, false), // Optional field
              details: this.parseString(details),
              category: this.parseString(category) || 'General',
              reviewed: reviewed === 't',
              updatedAt: this.parseDate(updatedAt)
            }
          });
        } else {
          // Create new event without explicit ID
          await this.prisma.historicalEvent.create({
            data: {
              title: this.parseString(title) || 'Unknown Event',
              startDate: this.parseDateString(startDate, true), // Required field
              endDate: this.parseDateString(endDate, false), // Optional field
              details: this.parseString(details),
              category: this.parseString(category) || 'General',
              reviewed: reviewed === 't',
              hidden: false,
              createdAt: this.parseDate(createdAt),
              updatedAt: this.parseDate(updatedAt)
            }
          });
        }
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import event ${title}:`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${eventData.length} historical events`);
  }

  /**
   * Import Books from PostgreSQL to HistoryBook table
   */
  async importBooks(exportData) {
    console.log('📚 Importing Books...');
    
    const bookData = this.extractTableData(exportData, 'Book');
    if (!bookData.length) {
      console.log('  No book data found');
      return;
    }

    let successCount = 0;
    for (const row of bookData) {
      const [id, title, author, isbn, publisher, publishYear, description, eventId, createdAt, updatedAt] = row.split('\t');
      
      try {
        // Check if the event exists before linking
        let validEventId = null;
        const parsedEventId = this.parseInt(eventId);
        if (parsedEventId) {
          const eventExists = await this.prisma.historicalEvent.findUnique({
            where: { id: parsedEventId }
          });
          if (eventExists) {
            validEventId = parsedEventId;
          }
        }

        await this.prisma.historyBook.upsert({
          where: { id: this.parseInt(id) || 0 },
          update: {
            title: this.parseString(title) || 'Unknown Book',
            author: this.parseString(author),
            isbn: this.parseString(isbn),
            publisher: this.parseString(publisher),
            publishYear: this.parseInt(publishYear),
            description: this.parseString(description),
            eventId: validEventId,
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            id: this.parseInt(id),
            title: this.parseString(title) || 'Unknown Book',
            author: this.parseString(author),
            isbn: this.parseString(isbn),
            publisher: this.parseString(publisher),
            publishYear: this.parseInt(publishYear),
            description: this.parseString(description),
            eventId: validEventId,
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import book ${title}:`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${bookData.length} books`);
  }

  /**
   * Import Videos from PostgreSQL to HistoryVideo table
   */
  async importVideos(exportData) {
    console.log('🎬 Importing Videos...');
    
    const videoData = this.extractTableData(exportData, 'Video');
    if (!videoData.length) {
      console.log('  No video data found');
      return;
    }

    // Create a channel URL to ID mapping for faster lookups
    const channels = await this.prisma.historyChannel.findMany({
      select: { id: true, channelUrl: true }
    });
    const channelUrlToId = new Map(channels.map(ch => [ch.channelUrl, ch.id]));

    let successCount = 0;
    for (const row of videoData) {
      const parts = row.split('\t');
      // Field order from export: id, title, url, type, duration, description, thumbnailUrl, courseTitle, lectureNumber, createdAt, updatedAt, eventId, channelId, assignLater, status
      const [id, title, url, type, duration, description, thumbnailUrl, courseTitle, lectureNumber, createdAt, updatedAt, eventId, channelId, assignLater, status] = parts;
      
      try {
        // Map channel ID properly - need to look up by the original channel data
        let validChannelId = null;
        const parsedChannelId = this.parseInt(channelId);
        if (parsedChannelId) {
          // Find channel by ID in the original data, then map to our channel
          const originalChannelData = this.extractTableData(exportData, 'Channel');
          const originalChannel = originalChannelData.find(channelRow => {
            const [origId] = channelRow.split('\t');
            return parseInt(origId) === parsedChannelId;
          });
          
          if (originalChannel) {
            const [, , , channelUrl] = originalChannel.split('\t');
            validChannelId = channelUrlToId.get(channelUrl);
          }
        }

        // Check if the event exists before linking
        let validEventId = null;
        const parsedEventId = this.parseInt(eventId);
        if (parsedEventId) {
          const eventExists = await this.prisma.historicalEvent.findUnique({
            where: { id: parsedEventId }
          });
          if (eventExists) {
            validEventId = parsedEventId;
          }
        }

        await this.prisma.historyVideo.upsert({
          where: { url: url },
          update: {
            title: this.parseString(title),
            type: this.parseString(type) || 'unknown',
            duration: this.parseString(duration),
            description: this.parseString(description),
            thumbnailUrl: this.parseString(thumbnailUrl),
            courseTitle: this.parseString(courseTitle),
            lectureNumber: this.parseInt(lectureNumber),
            eventId: validEventId,
            channelId: validChannelId,
            assignLater: assignLater === 't',
            status: this.parseString(status),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            title: this.parseString(title),
            url: url,
            type: this.parseString(type) || 'unknown',
            duration: this.parseString(duration),
            description: this.parseString(description),
            thumbnailUrl: this.parseString(thumbnailUrl),
            courseTitle: this.parseString(courseTitle),
            lectureNumber: this.parseInt(lectureNumber),
            eventId: validEventId,
            channelId: validChannelId,
            assignLater: assignLater === 't',
            status: this.parseString(status),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import video ${this.parseString(title)}:`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${videoData.length} videos`);
  }

  /**
   * Import Categories, Chapters, Sections (placeholder implementations)
   */
  async importCategories(exportData) {
    console.log('🏷️  Importing Categories...');
    // Implementation for categories if needed
  }

  async importChapters(exportData) {
    console.log('📖 Importing Chapters...');
    
    const chapterData = this.extractTableData(exportData, 'Chapter');
    if (!chapterData.length) {
      console.log('  No chapter data found');
      return;
    }

    let successCount = 0;
    for (const row of chapterData) {
      const parts = row.split('\t');
      // Field order: id, title, chapterNumber, description, pageStart, pageEnd, createdAt, updatedAt, bookId, eventId
      const [id, title, chapterNumber, description, pageStart, pageEnd, createdAt, updatedAt, bookId, eventId] = parts;
      
      try {
        // Validate that the book exists
        const parsedBookId = this.parseInt(bookId);
        if (!parsedBookId) {
          console.warn(`  Warning: Chapter "${title}" has invalid bookId: ${bookId}`);
          continue;
        }

        const bookExists = await this.prisma.historyBook.findUnique({
          where: { id: parsedBookId }
        });
        
        if (!bookExists) {
          console.warn(`  Warning: Chapter "${title}" references non-existent book ID: ${parsedBookId}`);
          continue;
        }

        // Check if event exists (optional relationship)
        let validEventId = null;
        const parsedEventId = this.parseInt(eventId);
        if (parsedEventId) {
          const eventExists = await this.prisma.historicalEvent.findUnique({
            where: { id: parsedEventId }
          });
          if (eventExists) {
            validEventId = parsedEventId;
          }
        }

        // Check if chapter already exists by bookId and chapterNumber
        const existingChapter = await this.prisma.historyChapter.findFirst({
          where: { 
            bookId: parsedBookId,
            chapterNumber: this.parseInt(chapterNumber) || 1
          }
        });

        if (existingChapter) {
          // Update existing chapter
          await this.prisma.historyChapter.update({
            where: { id: existingChapter.id },
            data: {
              title: this.parseString(title) || 'Untitled Chapter',
              description: this.parseString(description),
              pageStart: this.parseInt(pageStart),
              pageEnd: this.parseInt(pageEnd),
              eventId: validEventId,
              updatedAt: this.parseDate(updatedAt)
            }
          });
        } else {
          // Create new chapter
          await this.prisma.historyChapter.create({
            data: {
              title: this.parseString(title) || 'Untitled Chapter',
              chapterNumber: this.parseInt(chapterNumber) || 1,
              description: this.parseString(description),
              pageStart: this.parseInt(pageStart),
              pageEnd: this.parseInt(pageEnd),
              bookId: parsedBookId,
              eventId: validEventId,
              createdAt: this.parseDate(createdAt),
              updatedAt: this.parseDate(updatedAt)
            }
          });
        }
        
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import chapter "${title}":`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${chapterData.length} chapters`);
  }

  async importSections(exportData) {
    console.log('📄 Importing Sections...');
    
    const sectionData = this.extractTableData(exportData, 'Section');
    if (!sectionData.length) {
      console.log('  No section data found');
      return;
    }

    let successCount = 0;
    for (const row of sectionData) {
      const parts = row.split('\t');
      // Field order: id, title, sectionNumber, description, pageStart, pageEnd, content, createdAt, updatedAt, chapterId, eventId
      const [id, title, sectionNumber, description, pageStart, pageEnd, content, createdAt, updatedAt, chapterId, eventId] = parts;
      
      try {
        // Validate that the chapter exists
        const parsedChapterId = this.parseInt(chapterId);
        if (!parsedChapterId) {
          console.warn(`  Warning: Section "${title}" has invalid chapterId: ${chapterId}`);
          continue;
        }

        const chapterExists = await this.prisma.historyChapter.findUnique({
          where: { id: parsedChapterId }
        });
        
        if (!chapterExists) {
          console.warn(`  Warning: Section "${title}" references non-existent chapter ID: ${parsedChapterId}`);
          continue;
        }

        // Check if event exists (optional relationship)
        let validEventId = null;
        const parsedEventId = this.parseInt(eventId);
        if (parsedEventId) {
          const eventExists = await this.prisma.historicalEvent.findUnique({
            where: { id: parsedEventId }
          });
          if (eventExists) {
            validEventId = parsedEventId;
          }
        }

        // Check if section already exists by chapterId and sectionNumber
        const existingSection = await this.prisma.historySection.findFirst({
          where: { 
            chapterId: parsedChapterId,
            sectionNumber: this.parseInt(sectionNumber) || 1
          }
        });

        if (existingSection) {
          // Update existing section
          await this.prisma.historySection.update({
            where: { id: existingSection.id },
            data: {
              title: this.parseString(title) || 'Untitled Section',
              description: this.parseString(description),
              pageStart: this.parseInt(pageStart),
              pageEnd: this.parseInt(pageEnd),
              content: this.parseString(content),
              eventId: validEventId,
              updatedAt: this.parseDate(updatedAt)
            }
          });
        } else {
          // Create new section
          await this.prisma.historySection.create({
            data: {
              title: this.parseString(title) || 'Untitled Section',
              sectionNumber: this.parseInt(sectionNumber) || 1,
              description: this.parseString(description),
              pageStart: this.parseInt(pageStart),
              pageEnd: this.parseInt(pageEnd),
              content: this.parseString(content),
              chapterId: parsedChapterId,
              eventId: validEventId,
              createdAt: this.parseDate(createdAt),
              updatedAt: this.parseDate(updatedAt)
            }
          });
        }
        
        successCount++;
      } catch (error) {
        console.warn(`  Warning: Failed to import section "${title}":`, error.message);
      }
    }
    
    console.log(`  ✅ Imported ${successCount}/${sectionData.length} sections`);
  }

  /**
   * Import User Tracking Data (watched/read/reviewed status)
   */
  async importUserTracking(exportData) {
    console.log('� Importing User Tracking Data...');
    
    const ADMIN_USER_ID = '22d061f4-13af-4a67-a770-cc4490a889fe'; // Admin user from PostgreSQL
    
    // Import video watches
    await this.importVideoWatches(exportData, ADMIN_USER_ID);
    
    // Import book reads
    await this.importBookReads(exportData, ADMIN_USER_ID);
    
    // Import chapter reads
    await this.importChapterReads(exportData, ADMIN_USER_ID);
    
    // Import section reads
    await this.importSectionReads(exportData, ADMIN_USER_ID);
    
    // Import event reviews
    await this.importEventReviews(exportData, ADMIN_USER_ID);
    
    console.log('✅ User tracking data import completed!');
  }

  async importVideoWatches(exportData, adminUserId) {
    console.log('  🎬 Importing Video Watches...');
    
    const watchData = this.extractTableData(exportData, 'user_video_watches');
    console.log(`    Found ${watchData.length} video watch records in export`);
    
    if (!watchData.length) {
      console.log('    No video watch data found');
      return;
    }

    let successCount = 0;
    let adminUserRecords = 0;
    
    for (const row of watchData) {
      const parts = row.split('\t');
      const [id, userId, videoId, watched, watchedAt, createdAt, updatedAt] = parts;
      
      // Count admin user records
      if (userId === adminUserId) {
        adminUserRecords++;
      }
      
      // Only import data for the admin user
      if (userId !== adminUserId) continue;
      
      try {
        const parsedVideoId = this.parseInt(videoId);
        if (!parsedVideoId) continue;

        // Check if video exists in our database
        const videoExists = await this.prisma.historyVideo.findUnique({
          where: { id: parsedVideoId }
        });
        
        if (!videoExists) continue;

        await this.prisma.user_video_watches.upsert({
          where: { videoId: parsedVideoId },
          update: {
            watched: watched === 't',
            watchedAt: watchedAt === '\\N' ? null : this.parseDate(watchedAt),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            videoId: parsedVideoId,
            watched: watched === 't',
            watchedAt: watchedAt === '\\N' ? null : this.parseDate(watchedAt),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        
        successCount++;
      } catch (error) {
        // Skip errors for non-existent videos
      }
    }
    
    console.log(`    Found ${adminUserRecords} records for admin user out of ${watchData.length} total`);
    console.log(`    ✅ Imported ${successCount} video watches`);
  }

  async importBookReads(exportData, adminUserId) {
    console.log('  📚 Importing Book Reads...');
    
    const readData = this.extractTableData(exportData, 'user_book_reads');
    if (!readData.length) {
      console.log('    No book read data found');
      return;
    }

    let successCount = 0;
    for (const row of readData) {
      const parts = row.split('\t');
      const [id, userId, bookId, read, readAt, createdAt, updatedAt] = parts;
      
      // Only import data for the admin user
      if (userId !== adminUserId) continue;
      
      try {
        const parsedBookId = this.parseInt(bookId);
        if (!parsedBookId) continue;

        // Check if book exists in our database
        const bookExists = await this.prisma.historyBook.findUnique({
          where: { id: parsedBookId }
        });
        
        if (!bookExists) continue;

        await this.prisma.user_book_reads.upsert({
          where: { bookId: parsedBookId },
          update: {
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            bookId: parsedBookId,
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        
        successCount++;
      } catch (error) {
        // Skip errors for non-existent books
      }
    }
    
    console.log(`    ✅ Imported ${successCount} book reads`);
  }

  async importChapterReads(exportData, adminUserId) {
    console.log('  📖 Importing Chapter Reads...');
    
    const readData = this.extractTableData(exportData, 'user_chapter_reads');
    if (!readData.length) {
      console.log('    No chapter read data found');
      return;
    }

    let successCount = 0;
    for (const row of readData) {
      const parts = row.split('\t');
      const [id, userId, chapterId, read, readAt, createdAt, updatedAt] = parts;
      
      // Only import data for the admin user
      if (userId !== adminUserId) continue;
      
      try {
        const parsedChapterId = this.parseInt(chapterId);
        if (!parsedChapterId) continue;

        // Check if chapter exists in our database
        const chapterExists = await this.prisma.historyChapter.findUnique({
          where: { id: parsedChapterId }
        });
        
        if (!chapterExists) continue;

        await this.prisma.user_chapter_reads.upsert({
          where: { chapterId: parsedChapterId },
          update: {
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            chapterId: parsedChapterId,
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        
        successCount++;
      } catch (error) {
        // Skip errors for non-existent chapters
      }
    }
    
    console.log(`    ✅ Imported ${successCount} chapter reads`);
  }

  async importSectionReads(exportData, adminUserId) {
    console.log('  📄 Importing Section Reads...');
    
    const readData = this.extractTableData(exportData, 'user_section_reads');
    if (!readData.length) {
      console.log('    No section read data found');
      return;
    }

    let successCount = 0;
    for (const row of readData) {
      const parts = row.split('\t');
      const [id, userId, sectionId, read, readAt, createdAt, updatedAt] = parts;
      
      // Only import data for the admin user
      if (userId !== adminUserId) continue;
      
      try {
        const parsedSectionId = this.parseInt(sectionId);
        if (!parsedSectionId) continue;

        // Check if section exists in our database
        const sectionExists = await this.prisma.historySection.findUnique({
          where: { id: parsedSectionId }
        });
        
        if (!sectionExists) continue;

        await this.prisma.user_section_reads.upsert({
          where: { sectionId: parsedSectionId },
          update: {
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            sectionId: parsedSectionId,
            read: read === 't',
            readAt: readAt === '\\N' ? null : this.parseDate(readAt),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        
        successCount++;
      } catch (error) {
        // Skip errors for non-existent sections
      }
    }
    
    console.log(`    ✅ Imported ${successCount} section reads`);
  }

  async importEventReviews(exportData, adminUserId) {
    console.log('  📜 Importing Event Reviews...');
    
    const reviewData = this.extractTableData(exportData, 'user_event_reviews');
    if (!reviewData.length) {
      console.log('    No event review data found');
      return;
    }

    let successCount = 0;
    for (const row of reviewData) {
      const parts = row.split('\t');
      const [id, userId, eventId, reviewed, reviewedAt, createdAt, updatedAt] = parts;
      
      // Only import data for the admin user
      if (userId !== adminUserId) continue;
      
      try {
        const parsedEventId = this.parseInt(eventId);
        if (!parsedEventId) continue;

        // Check if event exists in our database
        const eventExists = await this.prisma.historicalEvent.findUnique({
          where: { id: parsedEventId }
        });
        
        if (!eventExists) continue;

        await this.prisma.user_event_reviews.upsert({
          where: { eventId: parsedEventId },
          update: {
            reviewed: reviewed === 't',
            reviewedAt: reviewedAt === '\\N' ? null : this.parseDate(reviewedAt),
            updatedAt: this.parseDate(updatedAt)
          },
          create: {
            eventId: parsedEventId,
            reviewed: reviewed === 't',
            reviewedAt: reviewedAt === '\\N' ? null : this.parseDate(reviewedAt),
            createdAt: this.parseDate(createdAt),
            updatedAt: this.parseDate(updatedAt)
          }
        });
        
        successCount++;
      } catch (error) {
        // Skip errors for non-existent events
      }
    }
    
    console.log(`    ✅ Imported ${successCount} event reviews`);
  }

  /**
   * Extract table data from PostgreSQL COPY format
   */
  extractTableData(exportData, tableName) {
    // Try with quotes first (for table names like "TableName")
    let pattern = new RegExp(`COPY public\\."${tableName}"[^\\n]*\\n([\\s\\S]*?)\\n\\\\\\.`, 'i');
    let match = exportData.match(pattern);
    
    // If no match, try without quotes (for table names like user_table_name)
    if (!match || !match[1]) {
      pattern = new RegExp(`COPY public\\.${tableName}[^\\n]*\\n([\\s\\S]*?)\\n\\\\\\.`, 'i');
      match = exportData.match(pattern);
    }
    
    if (!match || !match[1]) {
      return [];
    }
    
    return match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line !== '\\.')
      .filter(line => !line.startsWith('--'));
  }

  /**
   * Parse date safely with fallback for DateTime fields
   */
  parseDate(dateString) {
    if (!dateString || dateString === '\\N' || dateString.trim() === '') {
      return new Date();
    }
    
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Parse date string for String date fields (HistoricalEvent)
   */
  parseDateString(dateString, required = false) {
    if (!dateString || dateString === '\\N' || dateString.trim() === '') {
      if (required) {
        return '1970-01-01T00:00:00.000Z'; // Default date for required fields
      }
      return null;
    }
    
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? (required ? '1970-01-01T00:00:00.000Z' : null) : dateString;
  }

  /**
   * Parse integer safely with fallback
   */
  parseInt(value) {
    if (!value || value === '\\N' || value.trim() === '') {
      return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse string safely, handling PostgreSQL null values
   */
  parseString(value) {
    if (!value || value === '\\N') {
      return null;
    }
    return value;
  }
  async getImportSummary() {
    const summary = {
      channels: await this.prisma.historyChannel.count(),
      events: await this.prisma.historicalEvent.count(),
      books: await this.prisma.historyBook.count(),
      videos: await this.prisma.historyVideo.count()
    };
    
    console.log('📊 Import Summary:');
    console.log(`  📺 Channels: ${summary.channels}`);
    console.log(`  📜 Events: ${summary.events}`);
    console.log(`  📚 Books: ${summary.books}`);
    console.log(`  🎬 Videos: ${summary.videos}`);
    
    return summary;
  }

  /**
   * Cleanup resources
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = HistoryDataImportService;