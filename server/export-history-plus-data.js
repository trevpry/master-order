#!/usr/bin/env node

/**
 * History Plus Data Export Script
 * Exports all History Plus data from SQLite to CSV files for easy migration
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class HistoryPlusDataExporter {
  constructor() {
    this.sourcePrisma = null;
    this.exportDir = path.join(__dirname, '..', 'history-plus-export');
  }

  async initialize() {
    console.log('📤 Initializing History Plus Data Export...');
    
    // Find SQLite database (check multiple possible locations)
    const sqlitePaths = [
      'file:./prisma/master_order.db',  // Primary development database
      'file:../master_order.db',        // Parent directory (from server/)
      'file:./master_order.db',         // Current directory (server/)
      'file:../data/master_order.db',   // Docker volume mount location
      'file:/app/data/master_order.db', // Absolute Docker path
      'file:./data/master_order.db'     // Current directory data folder
    ];
    
    let sqliteUrl = null;
    for (const testPath of sqlitePaths) {
      console.log(`Trying path: ${testPath}`);
      try {
        const testPrisma = new PrismaClient({
          datasources: { db: { url: testPath } }
        });
        // Test connection with a simple query that works in SQLite
        await testPrisma.$queryRaw`SELECT 1 as test`;
        await testPrisma.$disconnect();
        sqliteUrl = testPath;
        console.log(`✅ Found SQLite database at: ${testPath}`);
        break;
      } catch (error) {
        console.log(`❌ Failed ${testPath}: ${error.message}`);
        // Try next path
      }
    }
    
    if (!sqliteUrl) {
      throw new Error('❌ SQLite database not found in any expected location');
    }
    
    this.sourcePrisma = new PrismaClient({
      datasources: { db: { url: sqliteUrl } }
    });

    // Create export directory
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }

    console.log(`📁 Export directory: ${this.exportDir}`);
  }

  async analyzeData() {
    console.log('🔍 Analyzing source data...');
    
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

  // Utility function to convert object to CSV row
  objectToCsvRow(obj, headers) {
    return headers.map(header => {
      let value = obj[header];
      
      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      } else if (value instanceof Date) {
        return value.toISOString();
      } else if (typeof value === 'string') {
        // Escape quotes and handle commas
        return `"${value.replace(/"/g, '""')}"`;
      } else {
        return String(value);
      }
    }).join(',');
  }

  // Utility function to write CSV file
  async writeCsvFile(filename, data, headers) {
    const filePath = path.join(this.exportDir, filename);
    console.log(`📝 Exporting ${data.length} records to ${filename}...`);
    
    // Create CSV content
    const csvLines = [
      headers.join(','), // Header row
      ...data.map(record => this.objectToCsvRow(record, headers))
    ];
    
    // Write to file
    fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8');
    console.log(`✅ Exported to ${filePath}`);
    
    return filePath;
  }

  async exportHistoricalEvents() {
    console.log('📤 Exporting Historical Events...');
    
    const events = await this.sourcePrisma.historicalEvent.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (events.length === 0) {
      console.log('   No historical events found');
      return null;
    }
    
    const headers = [
      'id', 'title', 'startDate', 'endDate', 'details', 'category', 
      'reviewed', 'hidden', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('historical_events.csv', events, headers);
  }

  async exportHistoryVideos() {
    console.log('📤 Exporting History Videos...');
    
    const videos = await this.sourcePrisma.historyVideo.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (videos.length === 0) {
      console.log('   No history videos found');
      return null;
    }
    
    const headers = [
      'id', 'historicalEventId', 'title', 'url', 'thumbnail', 'duration', 
      'watchedProgress', 'isWatched', 'source', 'sourceId', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('history_videos.csv', videos, headers);
  }

  async exportHistoryBooks() {
    console.log('📤 Exporting History Books...');
    
    const books = await this.sourcePrisma.historyBook.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (books.length === 0) {
      console.log('   No history books found');
      return null;
    }
    
    const headers = [
      'id', 'title', 'author', 'isbn', 'publisher', 'publishYear', 
      'description', 'coverUrl', 'pageCount', 'eventId', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('history_books.csv', books, headers);
  }

  async exportHistoryChapters() {
    console.log('📤 Exporting History Chapters...');
    
    const chapters = await this.sourcePrisma.historyChapter.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (chapters.length === 0) {
      console.log('   No history chapters found');
      return null;
    }
    
    const headers = [
      'id', 'bookId', 'title', 'chapterNumber', 'startPage', 
      'endPage', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('history_chapters.csv', chapters, headers);
  }

  async exportHistorySections() {
    console.log('📤 Exporting History Sections...');
    
    const sections = await this.sourcePrisma.historySection.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (sections.length === 0) {
      console.log('   No history sections found');
      return null;
    }
    
    const headers = [
      'id', 'chapterId', 'title', 'sectionNumber', 'content', 
      'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('history_sections.csv', sections, headers);
  }

  async exportHistoryChannels() {
    console.log('📤 Exporting History Channels...');
    
    const channels = await this.sourcePrisma.historyChannel.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (channels.length === 0) {
      console.log('   No history channels found');
      return null;
    }
    
    const headers = [
      'id', 'name', 'description', 'url', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('history_channels.csv', channels, headers);
  }

  async exportUserEventReviews() {
    console.log('📤 Exporting User Event Reviews...');
    
    const reviews = await this.sourcePrisma.user_event_reviews.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (reviews.length === 0) {
      console.log('   No user event reviews found');
      return null;
    }
    
    const headers = [
      'id', 'userId', 'eventId', 'reviewed', 'reviewDate', 
      'notes', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('user_event_reviews.csv', reviews, headers);
  }

  async exportUserVideoWatches() {
    console.log('📤 Exporting User Video Watches...');
    
    const watches = await this.sourcePrisma.user_video_watches.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (watches.length === 0) {
      console.log('   No user video watches found');
      return null;
    }
    
    const headers = [
      'id', 'userId', 'videoId', 'watched', 'watchDate', 
      'progress', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('user_video_watches.csv', watches, headers);
  }

  async exportUserBookReads() {
    console.log('📤 Exporting User Book Reads...');
    
    const reads = await this.sourcePrisma.user_book_reads.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (reads.length === 0) {
      console.log('   No user book reads found');
      return null;
    }
    
    const headers = [
      'id', 'userId', 'bookId', 'read', 'readDate', 
      'progress', 'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('user_book_reads.csv', reads, headers);
  }

  async exportUserChapterReads() {
    console.log('📤 Exporting User Chapter Reads...');
    
    const reads = await this.sourcePrisma.user_chapter_reads.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (reads.length === 0) {
      console.log('   No user chapter reads found');
      return null;
    }
    
    const headers = [
      'id', 'userId', 'chapterId', 'read', 'readDate', 
      'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('user_chapter_reads.csv', reads, headers);
  }

  async exportUserSectionReads() {
    console.log('📤 Exporting User Section Reads...');
    
    const reads = await this.sourcePrisma.user_section_reads.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (reads.length === 0) {
      console.log('   No user section reads found');
      return null;
    }
    
    const headers = [
      'id', 'userId', 'sectionId', 'read', 'readDate', 
      'createdAt', 'updatedAt'
    ];
    
    return await this.writeCsvFile('user_section_reads.csv', reads, headers);
  }

  async exportAll() {
    console.log('🚀 Starting comprehensive History Plus data export...');
    console.log('');
    
    try {
      // Analyze source data first
      const analysis = await this.analyzeData();
      if (!analysis) {
        throw new Error('Failed to analyze source data');
      }
      
      console.log('');
      
      // Export all tables
      const exportedFiles = [];
      
      const files = [
        await this.exportHistoricalEvents(),
        await this.exportHistoryVideos(),
        await this.exportHistoryBooks(),
        await this.exportHistoryChapters(),
        await this.exportHistorySections(),
        await this.exportHistoryChannels(),
        await this.exportUserEventReviews(),
        await this.exportUserVideoWatches(),
        await this.exportUserBookReads(),
        await this.exportUserChapterReads(),
        await this.exportUserSectionReads()
      ];
      
      // Filter out null files (no data)
      const successfulExports = files.filter(file => file !== null);
      
      console.log('');
      console.log('✅ Export completed successfully!');
      console.log(`📁 Export directory: ${this.exportDir}`);
      console.log(`📄 Files exported: ${successfulExports.length}`);
      
      if (successfulExports.length > 0) {
        console.log('📋 Exported files:');
        successfulExports.forEach(file => {
          console.log(`   - ${path.basename(file)}`);
        });
      }
      
      // Create export summary
      const summary = {
        exportDate: new Date().toISOString(),
        sourceAnalysis: analysis,
        exportedFiles: successfulExports.map(file => path.basename(file)),
        exportDirectory: this.exportDir
      };
      
      const summaryPath = path.join(this.exportDir, 'export_summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`📊 Export summary: ${summaryPath}`);
      
      return { success: true, summary };
      
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async cleanup() {
    if (this.sourcePrisma) {
      await this.sourcePrisma.$disconnect();
    }
  }
}

// Main execution
async function main() {
  const exporter = new HistoryPlusDataExporter();
  
  try {
    await exporter.initialize();
    const result = await exporter.exportAll();
    
    if (result.success) {
      console.log('');
      console.log('🎉 History Plus data export completed successfully!');
      console.log('📦 You can now copy the export directory to your target system');
      console.log('🔄 Use import-history-plus-data.js to import this data to PostgreSQL');
      process.exit(0);
    } else {
      console.error('💥 Export failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    await exporter.cleanup();
  }
}

// Handle interruption gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️  Export interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Export terminated');
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = HistoryPlusDataExporter;