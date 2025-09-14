#!/usr/bin/env node

/**
 * History Plus Data Import Script
 * Imports History Plus data from CSV files to SQLite or PostgreSQL (environment-aware)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class HistoryPlusDataImporter {
  constructor(options = {}) {
    this.targetPrisma = null;
    this.importDir = options.importDir || path.join(__dirname, '..', 'history-plus-export');
    this.importLog = [];
    this.databaseType = null;
    this.forceImport = options.force || false;
    this.clearExisting = options.clearExisting || false;
    this.stats = {
      imported: 0,
      skipped: 0,
      errors: 0,
      updated: 0,
      deleted: 0
    };
    
    // ID mapping tables to match exported IDs with production IDs
    this.idMappings = {
      videos: new Map(),      // oldId -> newId
      chapters: new Map(),    // oldId -> newId
      sections: new Map(),    // oldId -> newId
      books: new Map(),       // oldId -> newId
      events: new Map()       // oldId -> newId
    };
  }

  detectDatabaseType() {
    const databaseUrl = process.env.DATABASE_URL;
    const isDocker = fs.existsSync('/.dockerenv');
    
    // Check if DATABASE_URL suggests PostgreSQL
    const isPostgres = databaseUrl && (
      databaseUrl.startsWith('postgresql://') || 
      databaseUrl.startsWith('postgres://')
    );
    
    // Check if DATABASE_URL suggests SQLite
    const isSqlite = databaseUrl && databaseUrl.startsWith('file:');
    
    // Decision logic: same as setup-schema.js
    if (isDocker || isPostgres) {
      return 'postgresql';
    } else {
      return 'sqlite';
    }
  }

  async initialize() {
    console.log('📥 Initializing History Plus Data Import...');
    
    // Detect database type
    this.databaseType = this.detectDatabaseType();
    console.log(`🔍 Detected database type: ${this.databaseType.toUpperCase()}`);
    
    // Check if export directory exists
    if (!fs.existsSync(this.importDir)) {
      throw new Error(`❌ Export directory not found: ${this.importDir}`);
    }
    
    // Initialize database connection
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ DATABASE_URL environment variable not set');
    }
    
    this.targetPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });
    
    // Test connection with database-specific query
    try {
      if (this.databaseType === 'postgresql') {
        await this.targetPrisma.$executeRaw`SELECT 1`;
      } else {
        // For SQLite, use a simpler query that doesn't return results
        await this.targetPrisma.$queryRaw`SELECT 1`;
      }
      console.log(`✅ Connected to ${this.databaseType.toUpperCase()} database`);
    } catch (error) {
      throw new Error(`❌ Database connection failed: ${error.message}`);
    }
    
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

  async clearExistingHistoryPlusData() {
    console.log('🗑️  Clearing all existing History Plus data...');
    
    try {
      // Delete in reverse order of foreign key dependencies
      console.log('   Deleting user activity records...');
      const userSectionReads = await this.targetPrisma.user_section_reads.deleteMany({});
      const userChapterReads = await this.targetPrisma.user_chapter_reads.deleteMany({});
      const userVideoWatches = await this.targetPrisma.user_video_watches.deleteMany({});
      const userBookReads = await this.targetPrisma.user_book_reads.deleteMany({});
      const userEventReviews = await this.targetPrisma.user_event_reviews.deleteMany({});
      
      console.log('   Deleting content records...');
      const historySections = await this.targetPrisma.historySection.deleteMany({});
      const historyChapters = await this.targetPrisma.historyChapter.deleteMany({});
      const historyBooks = await this.targetPrisma.historyBook.deleteMany({});
      const historyVideos = await this.targetPrisma.historyVideo.deleteMany({});
      const historyChannels = await this.targetPrisma.historyChannel.deleteMany({});
      const historicalEvents = await this.targetPrisma.historicalEvent.deleteMany({});
      
      const totalDeleted = (
        userSectionReads.count + userChapterReads.count + userVideoWatches.count + 
        userBookReads.count + userEventReviews.count + historySections.count + 
        historyChapters.count + historyBooks.count + historyVideos.count + 
        historyChannels.count + historicalEvents.count
      );
      
      console.log(`✅ Deleted ${totalDeleted} existing records`);
      console.log(`   User section reads: ${userSectionReads.count}`);
      console.log(`   User chapter reads: ${userChapterReads.count}`);
      console.log(`   User video watches: ${userVideoWatches.count}`);
      console.log(`   User book reads: ${userBookReads.count}`);
      console.log(`   User event reviews: ${userEventReviews.count}`);
      console.log(`   History sections: ${historySections.count}`);
      console.log(`   History chapters: ${historyChapters.count}`);
      console.log(`   History books: ${historyBooks.count}`);
      console.log(`   History videos: ${historyVideos.count}`);
      console.log(`   History channels: ${historyChannels.count}`);
      console.log(`   Historical events: ${historicalEvents.count}`);
      
      this.stats.deleted = totalDeleted;
      
    } catch (error) {
      console.error('❌ Error clearing existing data:', error.message);
      throw error;
    }
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
      
      if (this.forceImport) {
        console.log(`   Found ${existing.length} existing (will update), ${newRecords.length} new records`);
      } else {
        console.log(`   Found ${existing.length} existing (will skip), ${newRecords.length} new records`);
      }
      return { existing, new: newRecords };
    } catch (error) {
      console.error(`❌ Error checking existing records for ${tableName}:`, error.message);
      return { existing: [], new: records };
    }
  }

  // ==========================================
  // ID MAPPING METHODS
  // ==========================================

  async buildVideoIdMapping(records) {
    console.log('🔄 Building video ID mapping...');
    
    for (const record of records) {
      const oldId = parseInt(record.id);
      
      // Try to find existing video by unique identifiers
      let existingVideo = null;
      
      // First try by exact title and URL match
      if (record.title && record.videoUrl) {
        existingVideo = await this.targetPrisma.historyVideo.findFirst({
          where: {
            title: record.title,
            videoUrl: record.videoUrl
          }
        });
      }
      
      // If not found, try by title and channelId
      if (!existingVideo && record.title && record.channelId) {
        existingVideo = await this.targetPrisma.historyVideo.findFirst({
          where: {
            title: record.title,
            channelId: parseInt(record.channelId)
          }
        });
      }
      
      // If not found, try by just title (less reliable)
      if (!existingVideo && record.title) {
        existingVideo = await this.targetPrisma.historyVideo.findFirst({
          where: {
            title: record.title
          }
        });
      }
      
      if (existingVideo) {
        this.idMappings.videos.set(oldId, existingVideo.id);
        console.log(`   Mapped video ${oldId} -> ${existingVideo.id} (${record.title})`);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.videos.size} existing videos`);
  }

  async updateVideoIdMappingAfterImport(newRecords) {
    console.log('🔄 Updating video ID mapping for newly imported records...');
    
    for (const record of newRecords) {
      const oldId = parseInt(record.id);
      
      // Find the newly created record
      const newVideo = await this.targetPrisma.historyVideo.findFirst({
        where: {
          title: record.title,
          videoUrl: record.videoUrl || undefined
        }
      });
      
      if (newVideo) {
        this.idMappings.videos.set(oldId, newVideo.id);
        console.log(`   Mapped new video ${oldId} -> ${newVideo.id} (${record.title})`);
      }
    }
  }

  async buildChapterIdMapping(records) {
    console.log('🔄 Building chapter ID mapping...');
    
    for (const record of records) {
      const oldId = parseInt(record.id);
      
      // Try to find existing chapter by unique identifiers
      let existingChapter = null;
      
      // Try by title and bookId
      if (record.title && record.bookId) {
        const mappedBookId = this.idMappings.books.get(parseInt(record.bookId));
        if (mappedBookId) {
          existingChapter = await this.targetPrisma.historyChapter.findFirst({
            where: {
              title: record.title,
              bookId: mappedBookId
            }
          });
        }
      }
      
      if (existingChapter) {
        this.idMappings.chapters.set(oldId, existingChapter.id);
        console.log(`   Mapped chapter ${oldId} -> ${existingChapter.id} (${record.title})`);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.chapters.size} existing chapters`);
  }

  async updateChapterIdMappingAfterImport(newRecords) {
    console.log('🔄 Updating chapter ID mapping for newly imported records...');
    
    for (const record of newRecords) {
      const oldId = parseInt(record.id);
      
      // Find the newly created record
      const mappedBookId = this.idMappings.books.get(parseInt(record.bookId));
      if (mappedBookId) {
        const newChapter = await this.targetPrisma.historyChapter.findFirst({
          where: {
            title: record.title,
            bookId: mappedBookId
          }
        });
        
        if (newChapter) {
          this.idMappings.chapters.set(oldId, newChapter.id);
          console.log(`   Mapped new chapter ${oldId} -> ${newChapter.id} (${record.title})`);
        }
      }
    }
  }

  async buildSectionIdMapping(records) {
    console.log('🔄 Building section ID mapping...');
    
    for (const record of records) {
      const oldId = parseInt(record.id);
      
      // Try to find existing section by unique identifiers
      let existingSection = null;
      
      // Try by title and chapterId
      if (record.title && record.chapterId) {
        const mappedChapterId = this.idMappings.chapters.get(parseInt(record.chapterId));
        if (mappedChapterId) {
          existingSection = await this.targetPrisma.historySection.findFirst({
            where: {
              title: record.title,
              chapterId: mappedChapterId
            }
          });
        }
      }
      
      if (existingSection) {
        this.idMappings.sections.set(oldId, existingSection.id);
        console.log(`   Mapped section ${oldId} -> ${existingSection.id} (${record.title})`);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.sections.size} existing sections`);
  }

  async updateSectionIdMappingAfterImport(newRecords) {
    console.log('🔄 Updating section ID mapping for newly imported records...');
    
    for (const record of newRecords) {
      const oldId = parseInt(record.id);
      
      // Find the newly created record
      const mappedChapterId = this.idMappings.chapters.get(parseInt(record.chapterId));
      if (mappedChapterId) {
        const newSection = await this.targetPrisma.historySection.findFirst({
          where: {
            title: record.title,
            chapterId: mappedChapterId
          }
        });
        
        if (newSection) {
          this.idMappings.sections.set(oldId, newSection.id);
          console.log(`   Mapped new section ${oldId} -> ${newSection.id} (${record.title})`);
        }
      }
    }
  }

  async buildBookIdMapping(records) {
    console.log('🔄 Building book ID mapping...');
    
    for (const record of records) {
      const oldId = parseInt(record.id);
      
      // Try to find existing book by unique identifiers
      let existingBook = null;
      
      // Try by title
      if (record.title) {
        existingBook = await this.targetPrisma.historyBook.findFirst({
          where: {
            title: record.title
          }
        });
      }
      
      if (existingBook) {
        this.idMappings.books.set(oldId, existingBook.id);
        console.log(`   Mapped book ${oldId} -> ${existingBook.id} (${record.title})`);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.books.size} existing books`);
  }

  async updateBookIdMappingAfterImport(newRecords) {
    console.log('🔄 Updating book ID mapping for newly imported records...');
    
    for (const record of newRecords) {
      const oldId = parseInt(record.id);
      
      // Find the newly created record
      const newBook = await this.targetPrisma.historyBook.findFirst({
        where: {
          title: record.title
        }
      });
      
      if (newBook) {
        this.idMappings.books.set(oldId, newBook.id);
        console.log(`   Mapped new book ${oldId} -> ${newBook.id} (${record.title})`);
      }
    }
  }

  // ==========================================
  // IMPORT METHODS
  // ==========================================

  // Helper method to create proper options for createMany
  getCreateManyOptions() {
    const options = {};
    
    // Only use skipDuplicates if we're not clearing existing data
    if (!this.clearExisting) {
      options.skipDuplicates = true;
    }
    
    return options;
  }

  async importWithUpsert(tableName, records, existing) {
    try {
      let imported = 0;
      let updated = 0;
      let skipped = 0;

      // Handle new records (create)
      if (records.length > 0) {
        const result = await this.targetPrisma[tableName].createMany({
          data: records,
          ...this.getCreateManyOptions()
        });
        imported = result.count;
        console.log(`   Created ${imported} new records`);
      }

      // Handle existing records based on force flag
      if (existing.length > 0) {
        if (this.forceImport) {
          // Update existing records one by one
          for (const record of existing) {
            try {
              await this.targetPrisma[tableName].update({
                where: { id: record.id },
                data: record
              });
              updated++;
            } catch (error) {
              console.warn(`   Failed to update record ${record.id}: ${error.message}`);
            }
          }
          console.log(`   Updated ${updated} existing records`);
        } else {
          skipped = existing.length;
          console.log(`   Skipped ${skipped} existing records`);
        }
      }

      this.stats.imported += imported;
      this.stats.updated += updated;
      this.stats.skipped += skipped;

    } catch (error) {
      console.error(`❌ Error importing ${tableName}:`, error.message);
      this.stats.errors += records.length + existing.length;
    }
  }

  async importHistoricalEvents() {
    console.log('📥 Importing Historical Events...');

    const records = await this.loadCSVFile('historical_events.csv');
    if (records.length === 0) return;

    // Transform records to match database schema
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

    if (newRecords.length === 0 && existing.length === 0) {
      console.log('   No records to process');
      return;
    }

    if (newRecords.length === 0 && !this.forceImport) {
      console.log('   All records already exist, skipping (use --force to update)');
      this.stats.skipped += existing.length;
      return;
    }

    await this.importWithUpsert('historicalEvent', newRecords, existing);
    console.log(`✅ Processed historical events`);
  }

  async importHistoryVideos() {
    console.log('📥 Importing History Videos...');
    
    const records = await this.loadCSVFile('history_videos.csv');
    if (records.length === 0) return;
    
    console.log(`📄 Loaded ${records.length} records from history_videos.csv`);
    
    // Transform records with proper field mapping
    const transformedRecords = records.map(record => {
      return {
        ...record,
        id: parseInt(record.id),
        // Map CSV fields to schema fields
        eventId: record.historicalEventId ? parseInt(record.historicalEventId) : null,
        thumbnailUrl: record.thumbnail || null,
        // Remove the old field names
        historicalEventId: undefined,
        thumbnail: undefined,
        watchedProgress: undefined,
        isWatched: undefined,
        source: undefined,
        sourceId: undefined
      };
    });
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyVideo', transformedRecords);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      
      // Build mapping for existing videos
      console.log('🔄 Building video mappings for existing records...');
      for (const record of transformedRecords) {
        const oldId = parseInt(record.id);
        const existingVideo = await this.targetPrisma.historyVideo.findUnique({
          where: { id: oldId }
        });
        
        if (existingVideo) {
          this.idMappings.videos.set(oldId, existingVideo.id);
        }
      }
      console.log(`✅ Built mapping for ${this.idMappings.videos.size} videos`);
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyVideo.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });
      
      console.log(`✅ Imported ${result.count} history videos`);
      
      // Build mapping for all records (existing + newly imported)
      console.log('🔄 Building video mappings after import...');
      for (const record of transformedRecords) {
        const oldId = parseInt(record.id);
        const existingVideo = await this.targetPrisma.historyVideo.findUnique({
          where: { id: oldId }
        });
        
        if (existingVideo) {
          this.idMappings.videos.set(oldId, existingVideo.id);
        }
      }
      console.log(`✅ Built mapping for ${this.idMappings.videos.size} videos`);
      
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history videos:', error.message);
      console.error('   Full error:', error);
      console.error('   Sample record that failed:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importHistoryBooks() {
    console.log('📥 Importing History Books...');
    
    const records = await this.loadCSVFile('history_books.csv');
    if (records.length === 0) return;
    
    // Build mapping for books based on unique identifiers
    await this.buildBookIdMapping(records);
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyBook', records);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyBook.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });
      
      console.log(`✅ Imported ${result.count} history books`);
      
      // Update mappings for newly imported records
      await this.updateBookIdMappingAfterImport(newRecords);
      
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
    
    console.log(`📄 Loaded ${records.length} records from history_chapters.csv`);
    
    // Transform records with proper type conversion and field mapping
    const typedRecords = records.map(record => {
      return {
        ...record,
        id: parseInt(record.id),
        bookId: parseInt(record.bookId),
        chapterNumber: parseInt(record.chapterNumber),
        // Map CSV fields to schema fields
        pageStart: record.startPage ? parseInt(record.startPage) : null,
        pageEnd: record.endPage ? parseInt(record.endPage) : null,
        // Remove the old field names
        startPage: undefined,
        endPage: undefined
      };
    });
    
    console.log('🔄 Book ID mappings available:', Array.from(this.idMappings.books.entries()));
    
    // Update chapters with mapped book IDs
    const transformedRecords = typedRecords.map(record => {
      const mappedBookId = this.idMappings.books.get(record.bookId);
      if (mappedBookId) {
        console.log(`   Chapter ${record.id}: mapping bookId ${record.bookId} -> ${mappedBookId}`);
        return { ...record, bookId: mappedBookId };
      } else {
        console.log(`   ⚠️  Chapter ${record.id}: no mapping found for bookId ${record.bookId}`);
        return record;
      }
    });
    
    // Build mapping for chapters based on unique identifiers
    console.log('🔄 Building chapter mappings after import...');
    
    // For chapters, since they already exist (skipped = 445), build mappings from existing data
    for (const record of typedRecords) {
      const oldId = record.id;
      // Try to find the chapter by the original ID first
      const existingChapter = await this.targetPrisma.historyChapter.findUnique({
        where: { id: oldId }
      });
      
      if (existingChapter) {
        this.idMappings.chapters.set(oldId, existingChapter.id);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.chapters.size} chapters`);
    
    await this.buildChapterIdMapping(transformedRecords);
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historyChapter', transformedRecords);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historyChapter.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });
      
      console.log(`✅ Imported ${result.count} history chapters`);
      
      // Update mappings for newly imported records
      await this.updateChapterIdMappingAfterImport(newRecords);
      
      this.stats.imported += result.count;
      this.stats.skipped += existing.length;
    } catch (error) {
      console.error('❌ Error importing history chapters:', error.message);
      console.error('   Full error:', error);
      console.error('   Sample record that failed:', JSON.stringify(newRecords[0], null, 2));
      this.stats.errors += newRecords.length;
    }
  }

  async importHistorySections() {
    console.log('📥 Importing History Sections...');
    
    const records = await this.loadCSVFile('history_sections.csv');
    if (records.length === 0) return;
    
    // Transform records with proper type conversion
    const transformedRecords = records.map(record => {
      return {
        ...record,
        id: parseInt(record.id),
        chapterId: parseInt(record.chapterId), // Convert string to int
        sectionNumber: parseInt(record.sectionNumber)
      };
    });
    
    // Update sections with mapped chapter IDs if available
    const mappedRecords = transformedRecords.map(record => {
      const mappedChapterId = this.idMappings.chapters.get(record.chapterId);
      if (mappedChapterId) {
        return { ...record, chapterId: mappedChapterId };
      }
      return record;
    });
    
    // Build mapping for sections based on unique identifiers
    console.log('🔄 Building section mappings after import...');
    
    // For sections, since they already exist, build mappings from existing data
    for (const record of transformedRecords) {
      const oldId = record.id;
      // Try to find the section by the original ID first
      const existingSection = await this.targetPrisma.historySection.findUnique({
        where: { id: oldId }
      });
      
      if (existingSection) {
        this.idMappings.sections.set(oldId, existingSection.id);
      }
    }
    
    console.log(`✅ Built mapping for ${this.idMappings.sections.size} sections`);
    
    await this.buildSectionIdMapping(mappedRecords);
    
    const { existing, new: newRecords } = await this.checkExistingRecords('historySection', mappedRecords);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      const result = await this.targetPrisma.historySection.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });
      
      console.log(`✅ Imported ${result.count} history sections`);
      
      // Update mappings for newly imported records
      await this.updateSectionIdMappingAfterImport(newRecords);
      
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
        ...this.getCreateManyOptions()
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

    // Transform records to match database schema (remove userId field)
    const transformedRecords = records.map(record => {
      const { userId, ...cleanRecord } = record; // Remove userId field
      return {
        id: cleanRecord.id,
        eventId: parseInt(cleanRecord.eventId),
        reviewed: cleanRecord.reviewed === 'true',
        reviewedAt: cleanRecord.reviewDate ? new Date(cleanRecord.reviewDate) : null,
        createdAt: new Date(cleanRecord.createdAt),
        updatedAt: new Date(cleanRecord.updatedAt)
      };
    });

    const { existing, new: newRecords } = await this.checkExistingRecords('user_event_reviews', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_event_reviews.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
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

    // Transform records to match database schema and use mapped video IDs
    const transformedRecords = [];
    const skippedRecords = [];
    
    for (const record of records) {
      const { userId, ...cleanRecord } = record; // Remove userId field
      const oldVideoId = parseInt(cleanRecord.videoId);
      const mappedVideoId = this.idMappings.videos.get(oldVideoId);
      
      if (mappedVideoId) {
        transformedRecords.push({
          id: cleanRecord.id,
          videoId: mappedVideoId,
          watched: cleanRecord.watched === 'true',
          watchedAt: cleanRecord.watchDate ? new Date(cleanRecord.watchDate) : null,
          createdAt: new Date(cleanRecord.createdAt),
          updatedAt: new Date(cleanRecord.updatedAt)
        });
      } else {
        skippedRecords.push({
          id: cleanRecord.id,
          oldVideoId: oldVideoId,
          reason: 'Video not found in target database'
        });
      }
    }

    console.log(`   Mapped ${transformedRecords.length} video watches, skipped ${skippedRecords.length} (unmappable videos)`);
    
    if (skippedRecords.length > 0) {
      console.log(`   ⚠️  Skipped video watches for missing videos: ${skippedRecords.slice(0, 5).map(r => r.oldVideoId).join(', ')}${skippedRecords.length > 5 ? '...' : ''}`);
    }

    if (transformedRecords.length === 0) {
      console.log('   No mappable video watches to import');
      this.stats.skipped += records.length;
      return;
    }

    const { existing, new: newRecords } = await this.checkExistingRecords('user_video_watches', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_video_watches.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });

      console.log(`✅ Imported ${result.count} user video watches`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length + skippedRecords.length;
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

    // Transform records to match database schema (remove userId field)
    const transformedRecords = records.map(record => {
      const { userId, ...cleanRecord } = record; // Remove userId field
      return {
        id: cleanRecord.id,
        bookId: parseInt(cleanRecord.bookId),
        read: cleanRecord.read === 'true',
        readAt: cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
        createdAt: new Date(cleanRecord.createdAt),
        updatedAt: new Date(cleanRecord.updatedAt)
      };
    });

    const { existing, new: newRecords } = await this.checkExistingRecords('user_book_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_book_reads.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
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

    // Transform records to match database schema and use mapped chapter IDs
    const transformedRecords = [];
    const skippedRecords = [];
    
    for (const record of records) {
      const { userId, ...cleanRecord } = record; // Remove userId field
      const oldChapterId = parseInt(cleanRecord.chapterId);
      const mappedChapterId = this.idMappings.chapters.get(oldChapterId);
      
      if (mappedChapterId) {
        transformedRecords.push({
          id: cleanRecord.id,
          chapterId: mappedChapterId,
          read: cleanRecord.read === 'true',
          readAt: cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
          createdAt: new Date(cleanRecord.createdAt),
          updatedAt: new Date(cleanRecord.updatedAt)
        });
      } else {
        skippedRecords.push({
          id: cleanRecord.id,
          oldChapterId: oldChapterId,
          reason: 'Chapter not found in target database'
        });
      }
    }

    console.log(`   Mapped ${transformedRecords.length} chapter reads, skipped ${skippedRecords.length} (unmappable chapters)`);
    
    if (skippedRecords.length > 0) {
      console.log(`   ⚠️  Skipped chapter reads for missing chapters: ${skippedRecords.slice(0, 5).map(r => r.oldChapterId).join(', ')}${skippedRecords.length > 5 ? '...' : ''}`);
    }

    if (transformedRecords.length === 0) {
      console.log('   No mappable chapter reads to import');
      this.stats.skipped += records.length;
      return;
    }

    const { existing, new: newRecords } = await this.checkExistingRecords('user_chapter_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_chapter_reads.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });

      console.log(`✅ Imported ${result.count} user chapter reads`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length + skippedRecords.length;
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

    // Transform records to match database schema and use mapped section IDs
    const transformedRecords = [];
    const skippedRecords = [];
    
    for (const record of records) {
      const { userId, ...cleanRecord } = record; // Remove userId field
      const oldSectionId = parseInt(cleanRecord.sectionId);
      const mappedSectionId = this.idMappings.sections.get(oldSectionId);
      
      if (mappedSectionId) {
        transformedRecords.push({
          id: cleanRecord.id,
          sectionId: mappedSectionId,
          read: cleanRecord.read === 'true',
          readAt: cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
          createdAt: new Date(cleanRecord.createdAt),
          updatedAt: new Date(cleanRecord.updatedAt)
        });
      } else {
        skippedRecords.push({
          id: cleanRecord.id,
          oldSectionId: oldSectionId,
          reason: 'Section not found in target database'
        });
      }
    }

    console.log(`   Mapped ${transformedRecords.length} section reads, skipped ${skippedRecords.length} (unmappable sections)`);
    
    if (skippedRecords.length > 0) {
      console.log(`   ⚠️  Skipped section reads for missing sections: ${skippedRecords.slice(0, 5).map(r => r.oldSectionId).join(', ')}${skippedRecords.length > 5 ? '...' : ''}`);
    }

    if (transformedRecords.length === 0) {
      console.log('   No mappable section reads to import');
      this.stats.skipped += records.length;
      return;
    }

    const { existing, new: newRecords } = await this.checkExistingRecords('user_section_reads', transformedRecords);

    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }

    try {
      const result = await this.targetPrisma.user_section_reads.createMany({
        data: newRecords,
        ...this.getCreateManyOptions()
      });

      console.log(`✅ Imported ${result.count} user section reads`);
      this.stats.imported += result.count;
      this.stats.skipped += existing.length + skippedRecords.length;
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
      // Clear existing data if requested
      if (this.clearExisting) {
        await this.clearExistingHistoryPlusData();
        console.log('');
      }
      
      // Load export summary
      await this.loadExportSummary();
      console.log('');
      
      // Import all data in correct order (respecting foreign key relationships)
      await this.importHistoricalEvents();
      await this.importHistoryChannels();    // Import channels BEFORE videos (FK dependency)
      await this.importHistoryVideos();
      await this.importHistoryBooks();
      await this.importHistoryChapters();
      await this.importHistorySections();
      
      // Import user tracking data (no user ID required - tables link directly to content)
      await this.importUserEventReviews();
      await this.importUserVideoWatches();
      await this.importUserBookReads();
      await this.importUserChapterReads();
      await this.importUserSectionReads();
      
      console.log('');
      console.log('✅ Import completed!');
      console.log('📊 Import Statistics:');
      if (this.stats.deleted > 0) {
        console.log(`   Records deleted: ${this.stats.deleted}`);
      }
      console.log(`   Records imported: ${this.stats.imported}`);
      console.log(`   Records updated: ${this.stats.updated}`);
      console.log(`   Records skipped (already exist): ${this.stats.skipped}`);
      console.log(`   Errors: ${this.stats.errors}`);
      console.log('');
      console.log('🔗 ID Mapping Statistics:');
      console.log(`   Videos mapped: ${this.idMappings.videos.size}`);
      console.log(`   Books mapped: ${this.idMappings.books.size}`);
      console.log(`   Chapters mapped: ${this.idMappings.chapters.size}`);
      console.log(`   Sections mapped: ${this.idMappings.sections.size}`);
      
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
  // Parse command line arguments
  const args = process.argv.slice(2);
  const customImportDir = args.find(arg => !arg.startsWith('--'));
  const forceImport = args.includes('--force');
  const clearExisting = args.includes('--clear-existing');
  
  const options = { force: forceImport, clearExisting: clearExisting };
  if (customImportDir) {
    options.importDir = path.resolve(customImportDir);
  }
  
  const importer = new HistoryPlusDataImporter(options);
  
  if (customImportDir) {
    console.log(`📁 Using custom import directory: ${importer.importDir}`);
  }
  
  if (forceImport) {
    console.log('🔄 Force mode enabled: Will update existing records');
  }
  
  if (clearExisting) {
    console.log('🗑️  Clear existing data enabled: Will delete all existing History Plus data first');
  }
  
  try {
    await importer.initialize();
    
    // Show confirmation prompt
    console.log('');
    console.log('⚠️  IMPORT CONFIRMATION:');
    console.log(`   This will import History Plus data to ${importer.databaseType.toUpperCase()}`);
    if (clearExisting) {
      console.log('   🗑️  ALL EXISTING HISTORY PLUS DATA WILL BE DELETED FIRST');
      console.log('   This is a destructive operation that cannot be undone');
    } else {
      console.log('   Existing records with matching IDs will be skipped');
      console.log('   No existing data will be modified or deleted');
    }
    console.log(`   Import directory: ${importer.importDir}`);
    console.log('');
    
    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('Proceed with import? (y/N): ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Import cancelled by user');
      await importer.cleanup();
      process.exit(0);
    }
    
    console.log('');
    const result = await importer.importAll();
    
    if (result.success) {
      console.log('');
      console.log('🎉 History Plus data import completed successfully!');
      console.log('🌐 You can now access the migrated data in your application');
      await importer.cleanup();
      process.exit(0);
    } else {
      console.error('💥 Import failed:', result.error);
      console.log('📊 Partial results:', result.stats);
      await importer.cleanup();
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    await importer.cleanup();
    process.exit(1);
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
