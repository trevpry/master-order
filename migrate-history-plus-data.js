#!/usr/bin/env node

/**
 * History Plus Data Migration Script
 * Safely migrates all History Plus data from SQLite to PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class HistoryPlusDataMigrator {
  constructor() {
    this.sourcePrisma = null;
    this.targetPrisma = null;
    this.migrationLog = [];
  }

  async initialize() {
    console.log('🚀 Initializing History Plus Data Migration...');
    
    // Source: SQLite database
    this.sourcePrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./master_order.db'
        }
      }
    });

    // Target: PostgreSQL database (from environment)
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('postgresql')) {
      throw new Error('❌ PostgreSQL DATABASE_URL environment variable is required');
    }

    this.targetPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    console.log('✅ Database connections initialized');
  }

  async validateConnections() {
    try {
      console.log('🔍 Validating database connections...');
      
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
    console.log('📊 Analyzing source data structure...');
    
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
      // Count all History Plus related records
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
      console.log(`   Historical Events: ${analysis.historicalEvents}`);
      console.log(`   History Videos: ${analysis.historyVideos}`);
      console.log(`   History Books: ${analysis.historyBooks}`);
      console.log(`   History Chapters: ${analysis.historyChapters}`);
      console.log(`   History Sections: ${analysis.historySections}`);
      console.log(`   History Channels: ${analysis.historyChannels}`);
      console.log(`   User Event Reviews: ${analysis.userEventReviews}`);
      console.log(`   User Video Watches: ${analysis.userVideoWatches}`);
      console.log(`   User Book Reads: ${analysis.userBookReads}`);
      console.log(`   User Chapter Reads: ${analysis.userChapterReads}`);
      console.log(`   User Section Reads: ${analysis.userSectionReads}`);

      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing source data:', error.message);
      return null;
    }
  }

  async createBackup() {
    console.log('💾 Creating backup of target PostgreSQL database...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./backup_postgresql_${timestamp}.sql`;
      
      // For PostgreSQL backup, we'd typically use pg_dump
      // Since we can't run external commands, we'll document this step
      console.log('⚠️  Manual backup required:');
      console.log(`   Run: pg_dump "${process.env.DATABASE_URL}" > ${backupPath}`);
      console.log('   Complete this step before proceeding');
      
      // Wait for user confirmation
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        readline.question('✅ Have you completed the PostgreSQL backup? (yes/no): ', (answer) => {
          readline.close();
          resolve(answer.toLowerCase() === 'yes');
        });
      });
    } catch (error) {
      console.error('❌ Backup creation failed:', error.message);
      return false;
    }
  }

  async migrateData() {
    console.log('🔄 Starting History Plus data migration...');
    console.log('🛡️  SAFE MODE: Only inserting new records, preserving existing PostgreSQL data');
    
    try {
      // Start transaction for safety
      await this.targetPrisma.$transaction(async (tx) => {
        
        // 1. Migrate HistoryChannels first (no dependencies)
        console.log('📺 Migrating History Channels...');
        const channels = await this.sourcePrisma.historyChannel.findMany();
        let channelCount = 0;
        let skippedChannels = 0;
        
        for (const channel of channels) {
          // Check if channel already exists
          const existing = await tx.historyChannel.findUnique({
            where: { id: channel.id }
          });
          
          if (!existing) {
            await tx.historyChannel.create({
              data: channel
            });
            channelCount++;
          } else {
            skippedChannels++;
          }
        }
        console.log(`✅ Migrated ${channelCount} new channels, skipped ${skippedChannels} existing`);

        // 2. Migrate HistoricalEvents
        console.log('📅 Migrating Historical Events...');
        const events = await this.sourcePrisma.historicalEvent.findMany();
        let eventCount = 0;
        let skippedEvents = 0;
        
        for (const event of events) {
          // Check if event already exists
          const existing = await tx.historicalEvent.findUnique({
            where: { id: event.id }
          });
          
          if (!existing) {
            await tx.historicalEvent.create({
              data: event
            });
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
          // Check if video already exists
          const existing = await tx.historyVideo.findUnique({
            where: { id: video.id }
          });
          
          if (!existing) {
            await tx.historyVideo.create({
              data: video
            });
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
          // Check if book already exists
          const existing = await tx.historyBook.findUnique({
            where: { id: book.id }
          });
          
          if (!existing) {
            await tx.historyBook.create({
              data: book
            });
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
          // Check if chapter already exists
          const existing = await tx.historyChapter.findUnique({
            where: { id: chapter.id }
          });
          
          if (!existing) {
            await tx.historyChapter.create({
              data: chapter
            });
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
          // Check if section already exists
          const existing = await tx.historySection.findUnique({
            where: { id: section.id }
          });
          
          if (!existing) {
            await tx.historySection.create({
              data: section
            });
            sectionCount++;
          } else {
            skippedSections++;
          }
        }
        console.log(`✅ Migrated ${sectionCount} new sections, skipped ${skippedSections} existing`);

        // 7. Migrate User Progress Data (SAFE MODE)
        console.log('👤 Migrating User Progress Data...');
        
        // User Event Reviews
        const eventReviews = await this.sourcePrisma.user_event_reviews.findMany();
        let reviewCount = 0;
        let skippedReviews = 0;
        
        for (const review of eventReviews) {
          // Check if review already exists
          const existing = await tx.user_event_reviews.findUnique({
            where: { eventId: review.eventId }
          });
          
          if (!existing) {
            await tx.user_event_reviews.create({
              data: review
            });
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
          // Check if watch already exists
          const existing = await tx.user_video_watches.findUnique({
            where: { videoId: watch.videoId }
          });
          
          if (!existing) {
            await tx.user_video_watches.create({
              data: watch
            });
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
          // Check if read already exists
          const existing = await tx.user_book_reads.findUnique({
            where: { bookId: read.bookId }
          });
          
          if (!existing) {
            await tx.user_book_reads.create({
              data: read
            });
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
          // Check if chapter read already exists
          const existing = await tx.user_chapter_reads.findUnique({
            where: { chapterId: read.chapterId }
          });
          
          if (!existing) {
            await tx.user_chapter_reads.create({
              data: read
            });
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
          // Check if section read already exists
          const existing = await tx.user_section_reads.findUnique({
            where: { sectionId: read.sectionId }
          });
          
          if (!existing) {
            await tx.user_section_reads.create({
              data: read
            });
            sectionReadCount++;
          } else {
            skippedSectionReads++;
          }
        }
        console.log(`✅ Migrated ${sectionReadCount} new section reads, skipped ${skippedSectionReads} existing`);

        console.log('✅ All History Plus data migrated safely - existing PostgreSQL data preserved!');
      });

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  async validateMigration() {
    console.log('🔍 Validating migration results...');
    
    try {
      const sourceAnalysis = await this.analyzeSourceData();
      
      // Count records in target
      const targetCounts = {
        historicalEvents: await this.targetPrisma.historicalEvent.count(),
        historyVideos: await this.targetPrisma.historyVideo.count(),
        historyBooks: await this.targetPrisma.historyBook.count(),
        historyChapters: await this.targetPrisma.historyChapter.count(),
        historySections: await this.targetPrisma.historySection.count(),
        historyChannels: await this.targetPrisma.historyChannel.count(),
        userEventReviews: await this.targetPrisma.user_event_reviews.count(),
        userVideoWatches: await this.targetPrisma.user_video_watches.count(),
        userBookReads: await this.targetPrisma.user_book_reads.count(),
        userChapterReads: await this.targetPrisma.user_chapter_reads.count(),
        userSectionReads: await this.targetPrisma.user_section_reads.count()
      };

      console.log('📊 Migration Validation:');
      let allMatched = true;
      
      for (const [key, sourceCount] of Object.entries(sourceAnalysis)) {
        const targetCount = targetCounts[key];
        const matched = sourceCount === targetCount;
        const status = matched ? '✅' : '❌';
        
        console.log(`   ${status} ${key}: ${sourceCount} → ${targetCount}`);
        
        if (!matched) {
          allMatched = false;
        }
      }

      if (allMatched) {
        console.log('🎉 Migration validation PASSED - All data successfully migrated!');
        return true;
      } else {
        console.log('⚠️  Migration validation FAILED - Data counts don\'t match');
        return false;
      }

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return false;
    }
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const reportPath = `./history-plus-migration-report-${timestamp.split('T')[0]}.md`;
    
    const report = `# History Plus Migration Report

**Date**: ${timestamp}
**Status**: ${this.migrationSuccessful ? '✅ SUCCESS' : '❌ FAILED'}

## Migration Summary

${this.migrationLog.join('\n')}

## Post-Migration Steps

1. ✅ Verify all History Plus functionality in the web interface
2. ✅ Test Android app History Plus features  
3. ✅ Confirm Up Next integration with History Plus content
4. ✅ Validate user progress tracking (watched/read status)
5. ✅ Test completion workflows and event review marking

## Rollback Instructions

If issues are discovered:

1. Stop the production application
2. Restore PostgreSQL from backup: \`psql "${process.env.DATABASE_URL}" < backup_postgresql_[timestamp].sql\`
3. Restart application
4. Report issues for investigation

---
Generated by History Plus Data Migrator
`;

    fs.writeFileSync(reportPath, report);
    console.log(`📄 Migration report saved to: ${reportPath}`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up connections...');
    
    if (this.sourcePrisma) {
      await this.sourcePrisma.$disconnect();
    }
    
    if (this.targetPrisma) {
      await this.targetPrisma.$disconnect();
    }
    
    console.log('✅ Cleanup completed');
  }

  async run() {
    this.migrationSuccessful = false;
    
    try {
      await this.initialize();
      
      if (!(await this.validateConnections())) {
        throw new Error('Connection validation failed');
      }
      
      const sourceAnalysis = await this.analyzeSourceData();
      if (!sourceAnalysis) {
        throw new Error('Source data analysis failed');
      }
      
      if (!(await this.createBackup())) {
        throw new Error('Backup creation cancelled or failed');
      }
      
      await this.migrateData();
      
      const validationPassed = await this.validateMigration();
      if (!validationPassed) {
        throw new Error('Migration validation failed');
      }
      
      this.migrationSuccessful = true;
      console.log('🎉 History Plus migration completed successfully!');
      
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      console.log('🔙 Consider restoring from backup if any data was modified');
      
    } finally {
      await this.generateReport();
      await this.cleanup();
    }
  }
}

// Execute migration if run directly
if (require.main === module) {
  const migrator = new HistoryPlusDataMigrator();
  migrator.run().catch(console.error);
}

module.exports = HistoryPlusDataMigrator;