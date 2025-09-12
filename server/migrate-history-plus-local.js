#!/usr/bin/env node

/**
 * History Plus Data Migration Script - Local to Production
 * Migrates History Plus data from local SQLite to remote PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

class LocalToProductionMigrator {
  constructor() {
    this.sourcePrisma = null;
    this.targetPrisma = null;
    this.postgresUrl = null;
  }

  async initialize() {
    console.log('🚀 Initializing History Plus Migration (Local SQLite → Production PostgreSQL)...');
    
    // Get PostgreSQL connection string first
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.postgresUrl = await new Promise((resolve) => {
      rl.question('Enter your PostgreSQL connection string (postgres://user:password@host:port/database): ', resolve);
    });

    rl.close();

    // Source: Local SQLite database (backup the current env var)
    const originalDbUrl = process.env.DATABASE_URL;
    
    // Temporarily set SQLite URL
    process.env.DATABASE_URL = 'file:../master_order.db';
    this.sourcePrisma = new PrismaClient();

    // Target: Production PostgreSQL 
    process.env.DATABASE_URL = this.postgresUrl;
    // Clear require cache to force reload of Prisma with new env
    delete require.cache[require.resolve('@prisma/client')];
    const { PrismaClient: PostgresPrismaClient } = require('@prisma/client');
    this.targetPrisma = new PostgresPrismaClient();

    // Restore original env
    process.env.DATABASE_URL = originalDbUrl;

    console.log('✅ Database connections configured');
  }

  async validateConnections() {
    console.log('🔍 Validating database connections...');
    
    try {
      // Test SQLite connection
      await this.sourcePrisma.$queryRaw`SELECT 1`;
      console.log('✅ SQLite connection validated');
      
      // Test PostgreSQL connection
      await this.targetPrisma.$queryRaw`SELECT 1`;
      console.log('✅ PostgreSQL connection validated');
      
      return true;
    } catch (error) {
      console.error('❌ Connection validation failed:', error.message);
      return false;
    }
  }

  async analyzeSourceData() {
    console.log('📊 Analyzing source data...');
    
    const analysis = {
      historicalEvents: 0,
      historyVideos: 0,
      historyBooks: 0,
      historyChapters: 0,
      historySections: 0,
      historyChannels: 0,
      userEventReviews: 0,
      userVideoWatches: 0,
      userBookReads: 0,
      userChapterReads: 0,
      userSectionReads: 0
    };

    try {
      analysis.historicalEvents = await this.sourcePrisma.historicalEvent.count();
      analysis.historyVideos = await this.sourcePrisma.historyVideo.count();
      analysis.historyBooks = await this.sourcePrisma.historyBook.count();
      analysis.historyChapters = await this.sourcePrisma.historyChapter.count();
      analysis.historySections = await this.sourcePrisma.historySection.count();
      analysis.historyChannels = await this.sourcePrisma.historyChannel.count();
      analysis.userEventReviews = await this.sourcePrisma.user_event_reviews.count();
      analysis.userVideoWatches = await this.sourcePrisma.user_video_watches.count();
      analysis.userBookReads = await this.sourcePrisma.user_book_reads.count();
      analysis.userChapterReads = await this.sourcePrisma.user_chapter_reads.count();
      analysis.userSectionReads = await this.sourcePrisma.user_section_reads.count();

      console.log('📈 Source Data Analysis:');
      Object.entries(analysis).forEach(([key, count]) => {
        if (count > 0) {
          console.log(`   ${key}: ${count}`);
        }
      });

      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing source data:', error);
      throw error;
    }
  }

  async migrateData() {
    console.log('🔄 Starting History Plus data migration...');
    
    try {
      await this.targetPrisma.$transaction(async (tx) => {
        console.log('📦 Migration running in transaction for safety...');

        // 1. Migrate HistoryChannels (no dependencies)
        console.log('📺 Migrating History Channels...');
        const channels = await this.sourcePrisma.historyChannel.findMany();
        let channelCount = 0;
        let skippedChannels = 0;
        
        for (const channel of channels) {
          const existing = await tx.historyChannel.findUnique({
            where: { id: channel.id }
          });
          
          if (!existing) {
            await tx.historyChannel.create({ data: channel });
            channelCount++;
          } else {
            skippedChannels++;
          }
        }
        console.log(`✅ Migrated ${channelCount} new channels, skipped ${skippedChannels} existing`);

        // 2. Migrate HistoricalEvents (no dependencies)
        console.log('📅 Migrating Historical Events...');
        const events = await this.sourcePrisma.historicalEvent.findMany();
        let eventCount = 0;
        let skippedEvents = 0;
        
        for (const event of events) {
          const existing = await tx.historicalEvent.findUnique({
            where: { id: event.id }
          });
          
          if (!existing) {
            await tx.historicalEvent.create({ data: event });
            eventCount++;
          } else {
            skippedEvents++;
          }
        }
        console.log(`✅ Migrated ${eventCount} new events, skipped ${skippedEvents} existing`);

        // 3. Migrate HistoryVideos (depends on events and channels)
        console.log('🎥 Migrating History Videos...');
        const videos = await this.sourcePrisma.historyVideo.findMany();
        let videoCount = 0;
        let skippedVideos = 0;
        
        for (const video of videos) {
          const existing = await tx.historyVideo.findUnique({
            where: { id: video.id }
          });
          
          if (!existing) {
            await tx.historyVideo.create({ data: video });
            videoCount++;
          } else {
            skippedVideos++;
          }
        }
        console.log(`✅ Migrated ${videoCount} new videos, skipped ${skippedVideos} existing`);

        // 4. Migrate HistoryBooks (depends on events)
        console.log('📚 Migrating History Books...');
        const books = await this.sourcePrisma.historyBook.findMany();
        let bookCount = 0;
        let skippedBooks = 0;
        
        for (const book of books) {
          const existing = await tx.historyBook.findUnique({
            where: { id: book.id }
          });
          
          if (!existing) {
            await tx.historyBook.create({ data: book });
            bookCount++;
          } else {
            skippedBooks++;
          }
        }
        console.log(`✅ Migrated ${bookCount} new books, skipped ${skippedBooks} existing`);

        // 5. Migrate HistoryChapters (depends on books)
        console.log('📖 Migrating History Chapters...');
        const chapters = await this.sourcePrisma.historyChapter.findMany();
        let chapterCount = 0;
        let skippedChapters = 0;
        
        for (const chapter of chapters) {
          const existing = await tx.historyChapter.findUnique({
            where: { id: chapter.id }
          });
          
          if (!existing) {
            await tx.historyChapter.create({ data: chapter });
            chapterCount++;
          } else {
            skippedChapters++;
          }
        }
        console.log(`✅ Migrated ${chapterCount} new chapters, skipped ${skippedChapters} existing`);

        // 6. Migrate HistorySections (depends on chapters)
        console.log('📄 Migrating History Sections...');
        const sections = await this.sourcePrisma.historySection.findMany();
        let sectionCount = 0;
        let skippedSections = 0;
        
        for (const section of sections) {
          const existing = await tx.historySection.findUnique({
            where: { id: section.id }
          });
          
          if (!existing) {
            await tx.historySection.create({ data: section });
            sectionCount++;
          } else {
            skippedSections++;
          }
        }
        console.log(`✅ Migrated ${sectionCount} new sections, skipped ${skippedSections} existing`);

        // 7. Migrate User Progress Data
        console.log('👤 Migrating User Progress Data...');
        
        // User Event Reviews
        const eventReviews = await this.sourcePrisma.user_event_reviews.findMany();
        let reviewCount = 0;
        let skippedReviews = 0;
        
        for (const review of eventReviews) {
          const existing = await tx.user_event_reviews.findUnique({
            where: { eventId: review.eventId }
          });
          
          if (!existing) {
            await tx.user_event_reviews.create({ data: review });
            reviewCount++;
          } else {
            skippedReviews++;
          }
        }
        console.log(`✅ Migrated ${reviewCount} new event reviews, skipped ${skippedReviews} existing`);

        // User Video Watches
        const videoWatches = await this.sourcePrisma.user_video_watches.findMany();
        let watchCount = 0;
        let skippedWatches = 0;
        
        for (const watch of videoWatches) {
          const existing = await tx.user_video_watches.findUnique({
            where: { videoId: watch.videoId }
          });
          
          if (!existing) {
            await tx.user_video_watches.create({ data: watch });
            watchCount++;
          } else {
            skippedWatches++;
          }
        }
        console.log(`✅ Migrated ${watchCount} new video watches, skipped ${skippedWatches} existing`);

        // User Book Reads
        const bookReads = await this.sourcePrisma.user_book_reads.findMany();
        let readCount = 0;
        let skippedReads = 0;
        
        for (const read of bookReads) {
          const existing = await tx.user_book_reads.findUnique({
            where: { bookId: read.bookId }
          });
          
          if (!existing) {
            await tx.user_book_reads.create({ data: read });
            readCount++;
          } else {
            skippedReads++;
          }
        }
        console.log(`✅ Migrated ${readCount} new book reads, skipped ${skippedReads} existing`);

        // User Chapter Reads
        const chapterReads = await this.sourcePrisma.user_chapter_reads.findMany();
        let chapterReadCount = 0;
        let skippedChapterReads = 0;
        
        for (const read of chapterReads) {
          const existing = await tx.user_chapter_reads.findUnique({
            where: { chapterId: read.chapterId }
          });
          
          if (!existing) {
            await tx.user_chapter_reads.create({ data: read });
            chapterReadCount++;
          } else {
            skippedChapterReads++;
          }
        }
        console.log(`✅ Migrated ${chapterReadCount} new chapter reads, skipped ${skippedChapterReads} existing`);

        // User Section Reads
        const sectionReads = await this.sourcePrisma.user_section_reads.findMany();
        let sectionReadCount = 0;
        let skippedSectionReads = 0;
        
        for (const read of sectionReads) {
          const existing = await tx.user_section_reads.findUnique({
            where: { sectionId: read.sectionId }
          });
          
          if (!existing) {
            await tx.user_section_reads.create({ data: read });
            sectionReadCount++;
          } else {
            skippedSectionReads++;
          }
        }
        console.log(`✅ Migrated ${sectionReadCount} new section reads, skipped ${skippedSectionReads} existing`);

        console.log('🎉 All History Plus data migrated successfully!');
      });

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async cleanup() {
    if (this.sourcePrisma) {
      await this.sourcePrisma.$disconnect();
    }
    if (this.targetPrisma) {
      await this.targetPrisma.$disconnect();
    }
  }

  async run() {
    try {
      await this.initialize();
      
      const connectionsValid = await this.validateConnections();
      if (!connectionsValid) {
        throw new Error('Database connections failed');
      }

      const analysis = await this.analyzeSourceData();
      const totalRecords = Object.values(analysis).reduce((sum, count) => sum + count, 0);
      
      if (totalRecords === 0) {
        console.log('ℹ️ No History Plus data found to migrate');
        return;
      }

      console.log(`\n🔄 Ready to migrate ${totalRecords} total records`);
      console.log('⚠️ This will only INSERT new records and skip existing ones');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const proceed = await new Promise((resolve) => {
        rl.question('Proceed with migration? (yes/no): ', resolve);
      });

      rl.close();

      if (proceed.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        return;
      }

      await this.migrateData();
      console.log('🎉 History Plus migration completed successfully!');

    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the migration
const migrator = new LocalToProductionMigrator();
migrator.run().catch(console.error);