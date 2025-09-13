#!/usr/bin/env node

/**
 * History Plus Data Import Script
 * Imports History Plus data from CSV files to PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class HistoryPlusDataImporter {
  constructor() {
    this.targetPrisma = null;
    this.importDir = path.join(__dirname, '..', 'history-plus-export');
    this.importLog = [];
    this.stats = {
      imported: 0,
      skipped: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('📥 Initializing History Plus Data Import...');
    
    // Check if export directory exists
    if (!fs.existsSync(this.importDir)) {
      throw new Error(`❌ Export directory not found: ${this.importDir}`);
    }
    
    // Initialize PostgreSQL connection
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ DATABASE_URL environment variable not set');
    }
    
    this.targetPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });
    
    // Test connection
    await this.targetPrisma.$executeRaw`SELECT 1`;
    console.log('✅ Connected to PostgreSQL database');
    console.log(`📁 Import directory: ${this.importDir}`);
  }

  async loadExportSummary() {
    const summaryPath = path.join(this.importDir, 'export_summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      console.log('⚠️  No export summary found, proceeding with discovery...');
      return null;
    }
    
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      console.log('📊 Export Summary:');
      console.log(`   Export Date: ${summary.exportDate}`);
      console.log(`   Files: ${summary.exportedFiles.length}`);
      console.log(`   Source Analysis:`);
      Object.entries(summary.sourceAnalysis).forEach(([key, value]) => {
        if (value > 0) {
          console.log(`     ${key}: ${value}`);
        }
      });
      return summary;
    } catch (error) {
      console.log('⚠️  Error reading export summary:', error.message);
      return null;
    }
  }

  // Utility function to parse CSV
  parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',');
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = this.parseCSVLine(line);
      if (values.length !== headers.length) {
        console.warn(`⚠️  Line ${i + 1}: Column count mismatch`);
        continue;
      }
      
      const record = {};
      headers.forEach((header, index) => {
        let value = values[index];
        
        // Convert empty strings to null
        if (value === '') {
          value = null;
        }
        // Convert numeric strings to numbers where appropriate
        else if (!isNaN(value) && !isNaN(parseFloat(value)) && header.includes('id')) {
          value = parseInt(value);
        }
        // Convert ISO dates to Date objects
        else if (value && (header.includes('_at') || header.includes('_date')) && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
          value = new Date(value);
        }
        // Convert boolean-like strings
        else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        }
        
        record[header] = value;
      });
      
      records.push(record);
    }
    
    return records;
  }

  // Simple CSV line parser (handles quoted values)
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current);
    return result;
  }

  async loadCSVFile(filename) {
    const filePath = path.join(this.importDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filename}`);
      return [];
    }
    
    try {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const records = this.parseCSV(csvContent);
      console.log(`📄 Loaded ${records.length} records from ${filename}`);
      return records;
    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error.message);
      return [];
    }
  }

  async checkExistingRecords(tableName, records) {
    if (records.length === 0) return { existing: [], new: [] };
    
    const existing = [];
    const newRecords = [];
    
    try {
      for (const record of records) {
        // Check if record already exists by ID
        const existingRecord = await this.targetPrisma[tableName].findUnique({
          where: { id: record.id }
        });
        
        if (existingRecord) {
          existing.push(record);
        } else {
          newRecords.push(record);
        }
      }
      
      console.log(`   Found ${existing.length} existing, ${newRecords.length} new records`);
      return { existing, new: newRecords };
    } catch (error) {
      console.error(`❌ Error checking existing records for ${tableName}:`, error.message);
      return { existing: [], new: records };
    }
  }

  async importHistoricalEvents() {
    console.log('📥 Importing Historical Events...');

    const records = await this.loadCSVFile('historical_events.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: parseInt(record.id),
      title: record.title,
      startDate: record.startDate,
      endDate: record.endDate || null,
      details: record.details || null,
      category: record.category,
      hidden: record.hidden === 'true',
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('historicalEvent', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.historicalEvent.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} historical events`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing historical events:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importHistoryVideos() {
    console.log('📥 Importing History Videos...');
    
    const records = await this.loadCSVFile('history_videos.csv');
    if (records.length === 0) return;
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyVideo', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyVideo.createMany({
        data: newRecords,
        skipDuplicates: true
      });
      
      console.log(`✅ Imported ${result.count} history videos`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history videos:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importHistoryBooks() {
    console.log('📥 Importing History Books...');
    
    const records = await this.loadCSVFile('history_books.csv');
    if (records.length === 0) return;
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyBook', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyBook.createMany({
        data: newRecords,
        skipDuplicates: true
      });
      
      console.log(`✅ Imported ${result.count} history books`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history books:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importHistoryChapters() {
    console.log('📥 Importing History Chapters...');
    
    const records = await this.loadCSVFile('history_chapters.csv');
    if (records.length === 0) return;
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyChapter', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyChapter.createMany({
        data: newRecords,
        skipDuplicates: true
      });
      
      console.log(`✅ Imported ${result.count} history chapters`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history chapters:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importHistorySections() {
    console.log('📥 Importing History Sections...');
    
    const records = await this.loadCSVFile('history_sections.csv');
    if (records.length === 0) return;
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historySection', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historySection.createMany({
        data: newRecords,
        skipDuplicates: true
      });
      
      console.log(`✅ Imported ${result.count} history sections`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history sections:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importHistoryChannels() {
    console.log('📥 Importing History Channels...');
    
    const records = await this.loadCSVFile('history_channels.csv');
    if (records.length === 0) return;
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyChannel', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyChannel.createMany({
        data: newRecords,
        skipDuplicates: true
      });
      
      console.log(`✅ Imported ${result.count} history channels`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history channels:', error.message);
      this.stats.errors += newRecords.length;
    }
  }

  async importUserEventReviews() {
    console.log('📥 Importing User Event Reviews...');

    const records = await this.loadCSVFile('user_event_reviews.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: record.id,
      eventId: parseInt(record.eventId),
      reviewed: record.reviewed === 'true',
      reviewedAt: record.reviewDate ? new Date(record.reviewDate) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('user_event_reviews', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_event_reviews.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} user event reviews`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing user event reviews:', error.message);
      console.error('   First record sample:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importUserVideoWatches() {
    console.log('📥 Importing User Video Watches...');

    const records = await this.loadCSVFile('user_video_watches.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: record.id,
      videoId: parseInt(record.videoId),
      watched: record.watched === 'true',
      watchedAt: record.watchDate ? new Date(record.watchDate) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('user_video_watches', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_video_watches.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} user video watches`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing user video watches:', error.message);
      console.error('   First record sample:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importUserBookReads() {
    console.log('📥 Importing User Book Reads...');

    const records = await this.loadCSVFile('user_book_reads.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: record.id,
      bookId: parseInt(record.bookId),
      read: record.read === 'true',
      readAt: record.readDate ? new Date(record.readDate) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('user_book_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_book_reads.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} user book reads`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing user book reads:', error.message);
      console.error('   First record sample:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importUserChapterReads() {
    console.log('📥 Importing User Chapter Reads...');

    const records = await this.loadCSVFile('user_chapter_reads.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: record.id,
      chapterId: parseInt(record.chapterId),
      read: record.read === 'true',
      readAt: record.readDate ? new Date(record.readDate) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('user_chapter_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_chapter_reads.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} user chapter reads`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing user chapter reads:', error.message);
      console.error('   First record sample:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importUserSectionReads() {
    console.log('📥 Importing User Section Reads...');

    const records = await this.loadCSVFile('user_section_reads.csv');
    if (records.length === 0) return;

    // Transform records to match PostgreSQL schema
    const transformedRecords = records.map(record => ({
      id: record.id,
      sectionId: parseInt(record.sectionId),
      read: record.read === 'true',
      readAt: record.readDate ? new Date(record.readDate) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }));

    const { existing, new: newRecords } = await this.checkExistingRecords('user_section_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_section_reads.createMany({
        data: newRecords,
        skipDuplicates: true
      });

      console.log(`✅ Imported ${result.count} user section reads`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing user section reads:', error.message);
      console.error('   First record sample:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importAll() {
    console.log('🚀 Starting comprehensive History Plus data import...');
    console.log('');
    
    try {
      // Load export summary
      await this.loadExportSummary();
      console.log('');
      
      // Import all data in correct order (respecting foreign key relationships)
      await this.importHistoricalEvents();
      await this.importHistoryVideos();
      await this.importHistoryBooks();
      await this.importHistoryChapters();
      await this.importHistorySections();
      await this.importHistoryChannels();
      
      // Import user tracking data (no user ID required - tables link directly to content)
      await this.importUserEventReviews();
      await this.importUserVideoWatches();
      await this.importUserBookReads();
      await this.importUserChapterReads();
      await this.importUserSectionReads();
      
      console.log('');
      console.log('✅ Import completed!');
      console.log('📊 Import Statistics:');
      console.log(`   Records imported: ${this.stats.imported}`);
      console.log(`   Records skipped (already exist): ${this.stats.skipped}`);
      console.log(`   Errors: ${this.stats.errors}`);
      
      return { success: true, stats: this.stats };
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      return { success: false, error: error.message, stats: this.stats };
    }
  }

  async cleanup() {
    if (this.targetPrisma) {
      await this.targetPrisma.$disconnect();
    }
  }
}

// Main execution
async function main() {
  // Check for custom import directory argument
  const customImportDir = process.argv[2];
  
  const importer = new HistoryPlusDataImporter();
  
  if (customImportDir) {
    importer.importDir = path.resolve(customImportDir);
    console.log(`📁 Using custom import directory: ${importer.importDir}`);
  }
  
  try {
    await importer.initialize();
    
    // Show confirmation prompt
    console.log('');
    console.log('⚠️  IMPORT CONFIRMATION:');
    console.log('   This will import History Plus data to PostgreSQL');
    console.log('   Existing records with matching IDs will be skipped');
    console.log('   No existing data will be modified or deleted');
    console.log(`   Import directory: ${importer.importDir}`);
    console.log('');
    
    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Proceed with import? (y/N): ', async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Import cancelled by user');
        process.exit(0);
      }
      
      console.log('');
      const result = await importer.importAll();
      
      if (result.success) {
        console.log('');
        console.log('🎉 History Plus data import completed successfully!');
        console.log('🌐 You can now access the migrated data in your application');
        process.exit(0);
      } else {
        console.error('💥 Import failed:', result.error);
        console.log('📊 Partial results:', result.stats);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    await importer.cleanup();
  }
}

// Handle interruption gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️  Import interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Import terminated');
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = HistoryPlusDataImporter;