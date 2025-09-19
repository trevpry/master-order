#!/usr/bin/env node

/**
 * History Plus Data Import Script
 * Imports History Plus data from CSV files to SQLite or PostgreSQL (environment-aware)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import unified book service for integration
const BookService = require('./services/BookService');
const BookCompletionService = require('./services/BookCompletionService');

class HistoryPlusDataImporter {
  constructor(options = {}) {
    this.targetPrisma = null;
    this.bookService = null; // Will be initialized after Prisma connection
    this.completionService = null; // Will be initialized after Prisma connection
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
    
    // Initialize BookService with the Prisma client
    this.bookService = new BookService(this.targetPrisma);
    this.completionService = new BookCompletionService(this.targetPrisma);
    
    // Test connection with database-specific query
    try {
      if (this.databaseType === 'postgresql') {
        await this.targetPrisma.$executeRaw`SELECT 1`;
      } else {
        // For SQLite, use a simpler query that doesn't return results
        await this.targetPrisma.$queryRaw`SELECT 1`;
      }
      console.log(`✅ Connected to ${this.databaseType.toUpperCase()} database`);
      console.log(`📚 Unified BookService initialized for books integration`);
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
    
    const headers = this.parseCSVLine(lines[0]).map(header => {
      // Strip quotes from header field names
      return header.replace(/^["']|["']$/g, '');
    });
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
        // Clean text encoding issues for string values
        else if (typeof value === 'string') {
          value = this.cleanTextEncoding(value);
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

  // Clean text encoding issues common in CSV exports
  cleanTextEncoding(text) {
    if (typeof text !== 'string') return text;
    
    return text
      // Fix UTF-8 encoding issues for smart quotes
      .replace(/ΓÇ£/g, '"')  // Left double quote
      .replace(/ΓÇ¥/g, '"')  // Right double quote
      .replace(/ΓÇÖ/g, "'")  // Left single quote  
      .replace(/ΓÇÖ/g, "'")  // Right single quote
      .replace(/ΓÇô/g, '–')  // En dash
      .replace(/ΓÇö/g, '—')  // Em dash
      .replace(/ΓÇª/g, '…')  // Ellipsis
      // Additional common encoding fixes
      .replace(/Γäî/g, 'ä')
      .replace(/Γ¼/g, 'ü')
      .replace(/Γ¶/g, 'ö')
      .replace(/ΓëÇ/g, 'é')
      .replace(/Γä¢/g, 'â');
  }

  cleanRecord(record) {
    const cleanedRecord = {};
    for (const key in record) {
      const newKey = key.replace(/^"|"$/g, '');
      let value = record[key];
      if (typeof value === 'string') {
        value = value.replace(/^"|"$/g, '');
      }
      cleanedRecord[newKey] = value;
    }
    return cleanedRecord;
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

      // Handle new records (create) - Use individual creates to preserve IDs
      if (records.length > 0) {
        console.log(`   Creating ${records.length} records individually to preserve IDs...`);
        for (const record of records) {
          try {
            await this.targetPrisma[tableName].create({
              data: record
            });
            imported++;
            if (imported <= 3) {
              console.log(`   ✅ Successfully created record ${record.id}: ${record.title || record.name || 'N/A'}`);
              if (record.eventId) {
                console.log(`      🔗 With eventId: ${record.eventId}`);
              }
            }
          } catch (error) {
            if (error.code === 'P2002') {
              // Unique constraint violation - record already exists
              console.log(`   ⚠️  Skipped duplicate record: ${record.id}`);
              skipped++;
            } else {
              console.error(`   ❌ Failed to create record ${record.id}:`, error.message);
              if (record.eventId) {
                console.error(`      � Record had eventId: ${record.eventId}`);
              }
              console.error(`   �📝 Record data:`, JSON.stringify(record, null, 2));
              this.stats.errors++;
              if (this.stats.errors > 10) {
                console.error(`   🛑 Too many errors, stopping this table import`);
                break;
              }
            }
          }
        }
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
      hidden: record.hidden === 't' || record.hidden === 'true' || record.hidden === true,
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
    
    // Debug: Show the structure of the first record
    if (records.length > 0) {
      console.log('🔍 First video record structure:', Object.keys(records[0]));
      console.log('🔍 Sample video record eventId/channelId:', {
        eventId: records[0].eventId,
        channelId: records[0].channelId,
        historicalEventId: records[0].historicalEventId
      });
    }
    
    // Get existing event and channel IDs to validate foreign keys
    console.log('🔍 Checking existing events and channels for foreign key validation...');
    const existingEvents = await this.targetPrisma.historicalEvent.findMany({ select: { id: true } });
    const existingChannels = await this.targetPrisma.historyChannel.findMany({ select: { id: true } });
    const validEventIds = new Set(existingEvents.map(e => e.id));
    const validChannelIds = new Set(existingChannels.map(c => c.id));
    
    console.log(`   Found ${validEventIds.size} events and ${validChannelIds.size} channels for validation`);
    
    // Transform records with proper field mapping and foreign key validation
    const transformedRecords = records.map(record => {
      // Determine video type based on URL
      let videoType = 'video'; // default fallback
      if (record.url) {
        if (record.url.includes('youtube.com') || record.url.includes('youtu.be')) {
          videoType = 'youtube';
        } else if (record.url.includes('greatcoursesplus') || record.url.includes('thegreatcourses')) {
          videoType = 'greatcoursesplus';
        }
      }
      
      // Validate foreign keys
      const eventId = record.eventId && record.eventId.trim() !== '' ? parseInt(record.eventId) : null;
      const channelId = record.channelId && record.channelId.trim() !== '' ? parseInt(record.channelId) : null;
      
      // Debug: Log the first few records to see what we're working with
      if (parseInt(record.id) <= 3) {
        console.log(`🔍 Debug video ${record.id}: eventId="${record.eventId}", channelId="${record.channelId}", historicalEventId="${record.historicalEventId}"`);
      }
      
      // Only use foreign keys if they exist in the database
      const validEventId = eventId && validEventIds.has(eventId) ? eventId : null;
      const validChannelId = channelId && validChannelIds.has(channelId) ? channelId : null;
      
      if (eventId && !validEventId) {
        console.log(`   ⚠️  Video ${record.id} references non-existent eventId ${eventId}, setting to null`);
      }
      if (channelId && !validChannelId) {
        console.log(`   ⚠️  Video ${record.id} references non-existent channelId ${channelId}, setting to null`);
      }
      
      return {
        ...record,
        id: parseInt(record.id),
        // Map CSV fields to schema fields with validated foreign keys
        eventId: validEventId,
        thumbnailUrl: record.thumbnail || record.thumbnailUrl || null,
        channelId: validChannelId,
        // Add required type field based on URL detection
        type: record.type || videoType,
        // Convert date strings to Date objects (same as events)
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        // Convert boolean fields (same pattern as events)
        assignLater: record.assignLater === 't' || record.assignLater === 'true' || record.assignLater === true,
        lectureNumber: record.lectureNumber && record.lectureNumber.trim() !== '' && !isNaN(parseInt(record.lectureNumber)) ? parseInt(record.lectureNumber, 10) : null,
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
    
    console.log('🔄 Building video mappings for all records...');
    
    // Build mappings for existing records first
    if (existing.length > 0) {
      for (const record of existing) {
        const oldId = parseInt(record.id);
        this.idMappings.videos.set(oldId, oldId); // For existing records, mapping is 1:1
        console.log(`   📍 Mapped existing video ${oldId} -> ${oldId} (${record.title})`);
      }
    }
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping import');
      this.stats.skipped += existing.length;
      console.log(`✅ Built mapping for ${this.idMappings.videos.size} videos`);
      return;
    }
    
    try {
      console.log(`🔄 Creating ${newRecords.length} video records individually...`);
      let successCount = 0;
      
      for (const record of newRecords) {
        try {
          const result = await this.targetPrisma.historyVideo.create({
            data: {
              id: record.id,
              ...record
            }
          });
          
          // Build mapping for successfully created record
          const oldId = parseInt(record.id);
          this.idMappings.videos.set(oldId, oldId);
          successCount++;
          
        } catch (createError) {
          console.error(`❌ Failed to create video ${record.id}:`, createError.message);
          console.error('   Record data:', JSON.stringify(record, null, 2));
          this.stats.errors++;
        }
      }
      
      console.log(`✅ Videos created: ${successCount}`);
      this.stats.imported += successCount;
      this.stats.skipped += existing.length;
      
      console.log(`✅ Built mapping for ${this.idMappings.videos.size} videos`);
    } catch (error) {
      console.error('❌ Error importing history videos:', error.message);
      console.error('   Full error:', error);
      if (newRecords && newRecords.length > 0) {
        console.error('   Sample record that failed:', JSON.stringify(newRecords[0], null, 2));
      }
    }
  }

  async importHistoryBooks() {
    console.log('📥 Importing Books to Unified Books System...');
    
    const records = await this.loadCSVFile('history_books.csv');
    if (records.length === 0) return;
    
    // Validate existing events for foreign key validation
    console.log('🔍 Checking existing events for foreign key validation...');
    const existingEvents = await this.targetPrisma.historicalEvent.findMany({ select: { id: true } });
    const validEventIds = new Set(existingEvents.map(e => e.id));
    console.log(`   Found ${validEventIds.size} events for validation`);
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Validate eventId foreign key
        const eventId = cleanRecord.eventId && cleanRecord.eventId.trim() !== '' ? parseInt(cleanRecord.eventId) : null;
        const validEventId = eventId && validEventIds.has(eventId) ? eventId : null;
        
        if (eventId && !validEventId) {
          console.log(`   ⚠️  Book ${cleanRecord.id} references non-existent eventId ${eventId}, will create without event link`);
        }
        
        // Check if book already exists in unified system
        const existingBook = await this.targetPrisma.book.findFirst({
          where: {
            OR: [
              cleanRecord.isbn ? { isbn: cleanRecord.isbn } : {},
              { title: cleanRecord.title, author: cleanRecord.author }
            ].filter(condition => Object.keys(condition).length > 0)
          }
        });
        
        if (existingBook && !this.forceImport) {
          console.log(`   ⏭️  Book already exists in unified system: "${cleanRecord.title}" (ID: ${existingBook.id})`);
          // Map the old History Plus book ID to the existing unified book ID
          this.idMappings.books.set(parseInt(cleanRecord.id), existingBook.id);
          skippedCount++;
          continue;
        }
        
        // Prepare book data for unified system
        const bookData = {
          title: cleanRecord.title || 'Unknown Title',
          author: cleanRecord.author || null,
          isbn: cleanRecord.isbn || null,
          publisher: cleanRecord.publisher || null,
          publishYear: cleanRecord.publishYear && cleanRecord.publishYear.trim() !== '' ? parseInt(cleanRecord.publishYear) : null,
          description: cleanRecord.description || null,
          coverUrl: cleanRecord.coverUrl || null,
          pageCount: cleanRecord.pageCount && cleanRecord.pageCount.trim() !== '' ? parseInt(cleanRecord.pageCount) : null,
          isHistoryPlusBook: true, // Mark as History Plus book
          originalHistoryBookId: parseInt(cleanRecord.id), // Preserve original ID for reference
          source: 'history-plus-import'
        };
        
        let unifiedBook;
        if (existingBook && this.forceImport) {
          // Update existing book
          unifiedBook = await this.bookService.updateBook(existingBook.id, bookData);
          console.log(`   🔄 Updated unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        } else {
          // Create new unified book
          unifiedBook = await this.bookService.createBook(bookData);
          console.log(`   ✅ Created unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        }
        
        // Map the old History Plus book ID to the new unified book ID
        this.idMappings.books.set(parseInt(cleanRecord.id), unifiedBook.id);
        
        // Create link to historical event if needed
        if (validEventId) {
          try {
            await this.targetPrisma.historyBookLink.create({
              data: {
                bookId: unifiedBook.id,
                eventId: validEventId,
                linkType: 'FEATURED_IN', // Default link type
                createdAt: new Date()
              }
            });
            console.log(`      🔗 Linked to historical event: ${validEventId}`);
          } catch (linkError) {
            console.warn(`   ⚠️  Failed to link book ${unifiedBook.id} to event ${validEventId}:`, linkError.message);
          }
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import book from record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Books Import Complete:`);
    console.log(`   📚 Created/Updated: ${successCount} books`);
    console.log(`   ⏭️  Skipped: ${skippedCount} books`);
    console.log(`   ❌ Errors: ${errorCount} books`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
  }

  async importHistoryChapters() {
    console.log('📥 Importing Chapters to Unified Books System...');
    
    const records = await this.loadCSVFile('history_chapters.csv');
    if (records.length === 0) return;
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Get the mapped unified book ID
        const originalBookId = parseInt(cleanRecord.bookId);
        const unifiedBookId = this.idMappings.books.get(originalBookId);
        
        if (!unifiedBookId) {
          console.warn(`   ⚠️  Chapter ${cleanRecord.id} references unmapped bookId ${originalBookId}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if chapter already exists in unified system
        const existingChapter = await this.targetPrisma.bookChapter.findFirst({
          where: {
            bookId: unifiedBookId,
            chapterNumber: parseInt(cleanRecord.chapterNumber)
          }
        });
        
        if (existingChapter && !this.forceImport) {
          console.log(`   ⏭️  Chapter already exists: "${cleanRecord.title}" (Book ID: ${unifiedBookId})`);
          this.idMappings.chapters.set(parseInt(cleanRecord.id), existingChapter.id);
          skippedCount++;
          continue;
        }
        
        // Prepare chapter data for unified system
        const chapterData = {
          title: cleanRecord.title || `Chapter ${cleanRecord.chapterNumber}`,
          chapterNumber: parseInt(cleanRecord.chapterNumber),
          description: cleanRecord.description || null,
          pageStart: cleanRecord.pageStart && cleanRecord.pageStart.trim() !== '' ? parseInt(cleanRecord.pageStart) : null,
          pageEnd: cleanRecord.pageEnd && cleanRecord.pageEnd.trim() !== '' ? parseInt(cleanRecord.pageEnd) : null,
          bookId: unifiedBookId
        };
        
        let unifiedChapter;
        if (existingChapter && this.forceImport) {
          // Update existing chapter
          unifiedChapter = await this.targetPrisma.bookChapter.update({
            where: { id: existingChapter.id },
            data: chapterData
          });
          console.log(`   🔄 Updated chapter: "${unifiedChapter.title}" (ID: ${unifiedChapter.id})`);
        } else {
          // Create new chapter
          unifiedChapter = await this.targetPrisma.bookChapter.create({
            data: chapterData
          });
          console.log(`   ✅ Created chapter: "${unifiedChapter.title}" (ID: ${unifiedChapter.id})`);
        }
        
        // Map the old chapter ID to the new unified chapter ID
        this.idMappings.chapters.set(parseInt(cleanRecord.id), unifiedChapter.id);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import chapter from record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Chapters Import Complete:`);
    console.log(`   📖 Created/Updated: ${successCount} chapters`);
    console.log(`   ⏭️  Skipped: ${skippedCount} chapters`);
    console.log(`   ❌ Errors: ${errorCount} chapters`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
  }

  async importHistorySections() {
    console.log('📥 Importing Sections to Unified Books System...');
    
    const records = await this.loadCSVFile('history_sections.csv');
    if (records.length === 0) return;

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Get the mapped unified chapter ID
        const originalChapterId = parseInt(cleanRecord.chapterId);
        const unifiedChapterId = this.idMappings.chapters.get(originalChapterId);
        
        if (!unifiedChapterId) {
          console.warn(`   ⚠️  Section ${cleanRecord.id} references unmapped chapterId ${originalChapterId}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if section already exists in unified system
        const existingSection = await this.targetPrisma.bookSection.findFirst({
          where: {
            chapterId: unifiedChapterId,
            sectionNumber: parseInt(cleanRecord.sectionNumber)
          }
        });
        
        if (existingSection && !this.forceImport) {
          console.log(`   ⏭️  Section already exists: "${cleanRecord.title}" (Chapter ID: ${unifiedChapterId})`);
          this.idMappings.sections.set(parseInt(cleanRecord.id), existingSection.id);
          skippedCount++;
          continue;
        }
        
        // Prepare section data for unified system
        const sectionData = {
          title: cleanRecord.title || `Section ${cleanRecord.sectionNumber}`,
          sectionNumber: parseInt(cleanRecord.sectionNumber),
          description: cleanRecord.description || null,
          pageStart: cleanRecord.pageStart && cleanRecord.pageStart.trim() !== '' ? parseInt(cleanRecord.pageStart) : null,
          pageEnd: cleanRecord.pageEnd && cleanRecord.pageEnd.trim() !== '' ? parseInt(cleanRecord.pageEnd) : null,
          content: cleanRecord.content || null,
          chapterId: unifiedChapterId
        };
        
        let unifiedSection;
        if (existingSection && this.forceImport) {
          // Update existing section
          unifiedSection = await this.targetPrisma.bookSection.update({
            where: { id: existingSection.id },
            data: sectionData
          });
          console.log(`   🔄 Updated section: "${unifiedSection.title}" (ID: ${unifiedSection.id})`);
        } else {
          // Create new section
          unifiedSection = await this.targetPrisma.bookSection.create({
            data: sectionData
          });
          console.log(`   ✅ Created section: "${unifiedSection.title}" (ID: ${unifiedSection.id})`);
        }
        
        // Map the old section ID to the new unified section ID
        this.idMappings.sections.set(parseInt(cleanRecord.id), unifiedSection.id);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import section from record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Sections Import Complete:`);
    console.log(`   📄 Created/Updated: ${successCount} sections`);
    console.log(`   ⏭️  Skipped: ${skippedCount} sections`);
    console.log(`   ❌ Errors: ${errorCount} sections`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
  }

  async importHistoryChannels() {
    console.log('📥 Importing History Channels...');
    
    // Debug: Check if targetPrisma is initialized
    if (!this.targetPrisma) {
      console.error('❌ targetPrisma is null! Cannot import channels.');
      return;
    }
    
    const records = await this.loadCSVFile('history_channels.csv');
    if (records.length === 0) return;

    console.log(`📄 Loaded ${records.length} records from history_channels.csv`);
    
    // Debug: Show the first few records to understand the structure
    if (records.length > 0) {
      console.log('🔍 First channel record structure:', Object.keys(records[0]));
      console.log('🔍 First channel record:', JSON.stringify(records[0], null, 2));
    }
    
    // Transform records with proper field mapping
    const transformedRecords = records.map(record => {
      // Check for various possible URL field names
      let channelUrl = record.url || record.channelUrl || record.link || record.channelLink;
      
      // If no URL found, generate fallback
      if (!channelUrl) {
        channelUrl = `https://channel-${record.id}`;
        console.log(`⚠️  No URL found for channel ${record.id} (${record.title || record.name}), using fallback: ${channelUrl}`);
      }
      
      return {
        id: parseInt(record.id),
        name: record.name,
        handle: record.handle || null,
        channelUrl: channelUrl,
        description: record.description || null,
        subscriberCount: record.subscriberCount ? parseInt(record.subscriberCount) : null,
        verified: record.verified === 't' || record.verified === 'true',
        createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
        updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
      };
    });

    const { existing, new: newRecords } = await this.checkExistingRecords('historyChannel', transformedRecords);
    
    if (newRecords.length === 0) {
      console.log('   All records already exist, skipping');
      this.stats.skipped += existing.length;
      return;
    }
    
    try {
      // Use individual creates to preserve IDs (like videos and events)
      let successCount = 0;
      console.log(`   Creating ${newRecords.length} channels individually to preserve IDs...`);
      
      for (const record of newRecords) {
        try {
          await this.targetPrisma.historyChannel.create({
            data: record
          });
          successCount++;
          if (successCount <= 3) {
            console.log(`   ✅ Successfully created channel ${record.id}: ${record.name}`);
          }
        } catch (createError) {
          console.error(`❌ Failed to create channel ${record.id}:`, createError.message);
          console.error('   Record data:', JSON.stringify(record, null, 2));
          this.stats.errors++;
        }
      }
      
      console.log(`✅ Imported ${successCount} history channels`);
      this.stats.imported += successCount;
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
        reviewed: cleanRecord.reviewed === true || cleanRecord.reviewed === 'true',
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

    // Use consistent import approach
    await this.importWithUpsert('user_event_reviews', newRecords, existing);
    
    // Update the reviewed field on historical events based on user reviews
    await this.updateEventReviewStatus();
    
    console.log(`✅ Processed user event reviews`);
  }

  async updateEventReviewStatus() {
    console.log('🔄 Updating event review status...');
    
    try {
      // Get all user event reviews
      const reviews = await this.targetPrisma.user_event_reviews.findMany({
        where: { reviewed: true },
        select: { eventId: true }
      });
      
      if (reviews.length === 0) {
        console.log('   No reviewed events found');
        return;
      }
      
      const eventIds = reviews.map(r => r.eventId);
      
      // Update the reviewed field on historical events
      const updateResult = await this.targetPrisma.historicalEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { reviewed: true }
      });
      
      console.log(`✅ Updated ${updateResult.count} events as reviewed`);
    } catch (error) {
      console.error('❌ Error updating event review status:', error.message);
    }
  }

  async importUserVideoWatches() {
    console.log('📥 Importing User Video Watches...');

    const records = await this.loadCSVFile('user_video_watches.csv');
    if (records.length === 0) return;

    console.log(`🔗 Debug: Video mappings available: ${this.idMappings.videos.size}`);
    if (this.idMappings.videos.size > 0) {
      const firstFew = Array.from(this.idMappings.videos.entries()).slice(0, 3);
      console.log(`   First few mappings: ${firstFew.map(([k,v]) => `${k}->${v}`).join(', ')}`);
    }

    // Transform records to match database schema and use mapped video IDs
    const transformedRecords = [];
    const skippedRecords = [];
    
    console.log(`🔍 Debug: Processing ${records.length} video watch records...`);
    if (records.length > 0) {
      console.log(`   Sample record: ${JSON.stringify(records[0])}`);
    }
    
    for (const record of records) {
      const { userId, ...cleanRecord } = record; // Remove userId field
      const oldVideoId = parseInt(cleanRecord.videoId);
      const mappedVideoId = this.idMappings.videos.get(oldVideoId);
      
      // Convert watched field (handles both boolean and string values)
      const isWatched = cleanRecord.watched === true || cleanRecord.watched === 'true';
      
      if (mappedVideoId) {
        transformedRecords.push({
          id: cleanRecord.id,
          videoId: mappedVideoId,
          watched: isWatched,
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
    console.log('📥 Importing Book Reading Progress to Unified System...');

    const records = await this.loadCSVFile('user_book_reads.csv');
    if (records.length === 0) return;

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Get the mapped unified book ID
        const originalBookId = parseInt(cleanRecord.bookId);
        const unifiedBookId = this.idMappings.books.get(originalBookId);
        
        if (!unifiedBookId) {
          console.warn(`   ⚠️  Book read record references unmapped bookId ${originalBookId}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if completion already exists
        const existingCompletion = await this.targetPrisma.bookCompletion.findFirst({
          where: {
            bookId: unifiedBookId
          }
        });
        
        const isCompleted = cleanRecord.read === true || cleanRecord.read === 'true';
        
        if (existingCompletion && !this.forceImport) {
          console.log(`   ⏭️  Book completion already exists for book ID ${unifiedBookId}`);
          skippedCount++;
          continue;
        }
        
        // Prepare completion data
        const completionData = {
          bookId: unifiedBookId,
          isCompleted: isCompleted,
          completedAt: isCompleted && cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
          progressPercentage: isCompleted ? 100.0 : 0.0
        };
        
        if (existingCompletion && this.forceImport) {
          // Update existing completion
          await this.targetPrisma.bookCompletion.update({
            where: { id: existingCompletion.id },
            data: completionData
          });
          console.log(`   🔄 Updated book completion for book ID ${unifiedBookId} (completed: ${isCompleted})`);
        } else {
          // Create new completion
          await this.targetPrisma.bookCompletion.create({
            data: completionData
          });
          console.log(`   ✅ Created book completion for book ID ${unifiedBookId} (completed: ${isCompleted})`);
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import book read record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Book Completions Import Complete:`);
    console.log(`   📊 Created/Updated: ${successCount} completions`);
    console.log(`   ⏭️  Skipped: ${skippedCount} completions`);
    console.log(`   ❌ Errors: ${errorCount} completions`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
  }

  async importUserChapterReads() {
    console.log('📥 Importing Chapter Reading Progress to Unified System...');

    const records = await this.loadCSVFile('user_chapter_reads.csv');
    if (records.length === 0) return;

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Get the mapped unified chapter ID
        const originalChapterId = parseInt(cleanRecord.chapterId);
        const unifiedChapterId = this.idMappings.chapters.get(originalChapterId);
        
        if (!unifiedChapterId) {
          console.warn(`   ⚠️  Chapter read record references unmapped chapterId ${originalChapterId}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if completion already exists
        const existingCompletion = await this.targetPrisma.bookCompletion.findFirst({
          where: {
            chapterId: unifiedChapterId
          }
        });
        
        const isCompleted = cleanRecord.read === true || cleanRecord.read === 'true';
        
        if (existingCompletion && !this.forceImport) {
          console.log(`   ⏭️  Chapter completion already exists for chapter ID ${unifiedChapterId}`);
          skippedCount++;
          continue;
        }
        
        // Get the book ID for this chapter to ensure proper completion tracking
        const chapter = await this.targetPrisma.bookChapter.findUnique({
          where: { id: unifiedChapterId },
          select: { bookId: true }
        });
        
        if (!chapter) {
          console.warn(`   ⚠️  Chapter ${unifiedChapterId} not found in unified system, skipping`);
          skippedCount++;
          continue;
        }
        
        // Prepare completion data
        const completionData = {
          bookId: chapter.bookId,
          chapterId: unifiedChapterId,
          isCompleted: isCompleted,
          completedAt: isCompleted && cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
          progressPercentage: isCompleted ? 100.0 : 0.0
        };
        
        if (existingCompletion && this.forceImport) {
          // Update existing completion
          await this.targetPrisma.bookCompletion.update({
            where: { id: existingCompletion.id },
            data: completionData
          });
          console.log(`   🔄 Updated chapter completion for chapter ID ${unifiedChapterId} (completed: ${isCompleted})`);
        } else {
          // Create new completion
          await this.targetPrisma.bookCompletion.create({
            data: completionData
          });
          console.log(`   ✅ Created chapter completion for chapter ID ${unifiedChapterId} (completed: ${isCompleted})`);
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import chapter read record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Chapter Completions Import Complete:`);
    console.log(`   📊 Created/Updated: ${successCount} completions`);
    console.log(`   ⏭️  Skipped: ${skippedCount} completions`);
    console.log(`   ❌ Errors: ${errorCount} completions`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
  }

  async importUserSectionReads() {
    console.log('📥 Importing Section Reading Progress to Unified System...');

    const records = await this.loadCSVFile('user_section_reads.csv');
    if (records.length === 0) return;

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        const cleanRecord = this.cleanRecord(record);
        
        // Get the mapped unified section ID
        const originalSectionId = parseInt(cleanRecord.sectionId);
        const unifiedSectionId = this.idMappings.sections.get(originalSectionId);
        
        if (!unifiedSectionId) {
          console.warn(`   ⚠️  Section read record references unmapped sectionId ${originalSectionId}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if completion already exists
        const existingCompletion = await this.targetPrisma.bookCompletion.findFirst({
          where: {
            sectionId: unifiedSectionId
          }
        });
        
        const isCompleted = cleanRecord.read === true || cleanRecord.read === 'true';
        
        if (existingCompletion && !this.forceImport) {
          console.log(`   ⏭️  Section completion already exists for section ID ${unifiedSectionId}`);
          skippedCount++;
          continue;
        }
        
        // Get the book and chapter IDs for this section to ensure proper completion tracking
        const section = await this.targetPrisma.bookSection.findUnique({
          where: { id: unifiedSectionId },
          include: {
            chapter: {
              select: { bookId: true }
            }
          }
        });
        
        if (!section || !section.chapter) {
          console.warn(`   ⚠️  Section ${unifiedSectionId} or its chapter not found in unified system, skipping`);
          skippedCount++;
          continue;
        }
        
        // Prepare completion data
        const completionData = {
          bookId: section.chapter.bookId,
          chapterId: section.chapterId,
          sectionId: unifiedSectionId,
          isCompleted: isCompleted,
          completedAt: isCompleted && cleanRecord.readDate ? new Date(cleanRecord.readDate) : null,
          progressPercentage: isCompleted ? 100.0 : 0.0
        };
        
        if (existingCompletion && this.forceImport) {
          // Update existing completion
          await this.targetPrisma.bookCompletion.update({
            where: { id: existingCompletion.id },
            data: completionData
          });
          console.log(`   🔄 Updated section completion for section ID ${unifiedSectionId} (completed: ${isCompleted})`);
        } else {
          // Create new completion
          await this.targetPrisma.bookCompletion.create({
            data: completionData
          });
          console.log(`   ✅ Created section completion for section ID ${unifiedSectionId} (completed: ${isCompleted})`);
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to import section read record:`, error.message);
        console.error('   Record data:', JSON.stringify(record, null, 2));
        errorCount++;
      }
    }
    
    console.log(`✅ Unified Section Completions Import Complete:`);
    console.log(`   📊 Created/Updated: ${successCount} completions`);
    console.log(`   ⏭️  Skipped: ${skippedCount} completions`);
    console.log(`   ❌ Errors: ${errorCount} completions`);
    
    this.stats.imported += successCount;
    this.stats.skipped += skippedCount;
    this.stats.errors += errorCount;
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
      console.log('🔄 Starting import of Historical Events...');
      await this.importHistoricalEvents();
      console.log('✅ Historical Events import completed');
      
      console.log('🔄 Starting import of History Channels...');
      await this.importHistoryChannels();    // Import channels BEFORE videos (FK dependency)
      console.log('✅ History Channels import completed');
      
      console.log('🔄 Starting import of History Videos...');
      await this.importHistoryVideos();
      console.log('✅ History Videos import completed');
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
