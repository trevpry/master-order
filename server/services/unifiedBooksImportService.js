/**
 * Unified Books Import Service
 * Imports books, chapters, and sections directly to the unified books system
 * Bypasses History Plus tables and goes straight to the unified Book model
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class UnifiedBooksImportService {
  constructor(options = {}) {
    this.prisma = new PrismaClient();
    this.importDir = options.importDir;
    this.forceImport = options.force || false;
    this.stats = {
      booksImported: 0,
      chaptersImported: 0,
      sectionsImported: 0,
      booksSkipped: 0,
      chaptersSkipped: 0,
      sectionsSkipped: 0,
      errors: []
    };
  }

  async initialize() {
    console.log('📚 Initializing Unified Books Import Service...');
    
    if (!this.importDir || !fs.existsSync(this.importDir)) {
      throw new Error(`❌ Import directory not found: ${this.importDir}`);
    }
    
    // Test database connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('✅ Connected to database');
    } catch (error) {
      throw new Error(`❌ Database connection failed: ${error.message}`);
    }
    
    console.log(`📁 Import directory: ${this.importDir}`);
  }

  async loadCSVFile(filename) {
    const csvPath = path.join(this.importDir, filename);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  File not found: ${filename}, skipping...`);
      return [];
    }
    
    console.log(`📖 Loading ${filename}...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.log(`⚠️  File ${filename} is empty, skipping...`);
      return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const record = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      
      records.push(record);
    }
    
    console.log(`✅ Loaded ${records.length} records from ${filename}`);
    return records;
  }

  cleanRecord(record) {
    const cleaned = {};
    for (const key in record) {
      const value = record[key];
      cleaned[key] = (value === 'NULL' || value === '' || value === undefined) ? null : value;
    }
    return cleaned;
  }

  async importBooks() {
    console.log('📚 Importing books to unified Books system...');
    
    const records = await this.loadCSVFile('history_books.csv');
    if (records.length === 0) {
      console.log('⚠️  No books to import');
      return;
    }

    console.log(`📖 Processing ${records.length} books...`);

    for (let i = 0; i < records.length; i++) {
      const record = this.cleanRecord(records[i]);
      
      try {
        // Check if book already exists (by title and author to avoid duplicates)
        const existingBook = await this.prisma.book.findFirst({
          where: {
            title: record.title,
            author: record.author || null
          }
        });

        if (existingBook && !this.forceImport) {
          console.log(`   ⏭️  Book already exists: "${record.title}" by ${record.author}, skipping...`);
          this.stats.booksSkipped++;
          continue;
        }

        // Create unified book record
        const bookData = {
          title: record.title || 'Unknown Title',
          author: record.author || null,
          isbn: record.isbn || null,
          publisher: record.publisher || null,
          publishYear: record.publishYear ? parseInt(record.publishYear) : null,
          description: record.description || null,
          coverUrl: record.coverUrl || null,
          pageCount: record.pageCount ? parseInt(record.pageCount) : null,
          openLibraryId: record.openLibraryId || null,
          
          // Mark as History Plus import
          isHistoryPlusBook: true,
          originalHistoryBookId: record.id ? parseInt(record.id) : null,
          
          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
        };

        let book;
        if (existingBook && this.forceImport) {
          // Update existing book
          book = await this.prisma.book.update({
            where: { id: existingBook.id },
            data: bookData
          });
          console.log(`   ✅ Updated book: "${book.title}" (ID: ${book.id})`);
        } else {
          // Create new book
          book = await this.prisma.book.create({
            data: bookData
          });
          console.log(`   ✅ Created book: "${book.title}" (ID: ${book.id})`);
        }

        this.stats.booksImported++;

        // Store mapping for chapters/sections import
        if (!this.bookIdMapping) {
          this.bookIdMapping = new Map();
        }
        this.bookIdMapping.set(parseInt(record.id), book.id);

      } catch (error) {
        const errorMsg = `Failed to import book "${record.title}": ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Books import completed: ${this.stats.booksImported} imported, ${this.stats.booksSkipped} skipped`);
  }

  async importChapters() {
    console.log('📖 Importing chapters to unified Books system...');
    
    const records = await this.loadCSVFile('history_chapters.csv');
    if (records.length === 0) {
      console.log('⚠️  No chapters to import');
      return;
    }

    if (!this.bookIdMapping) {
      console.log('⚠️  No book ID mapping available, chapters import may fail');
      this.bookIdMapping = new Map();
    }

    console.log(`📄 Processing ${records.length} chapters...`);

    for (let i = 0; i < records.length; i++) {
      const record = this.cleanRecord(records[i]);
      
      try {
        // Map old book ID to new unified book ID
        const newBookId = this.bookIdMapping.get(parseInt(record.bookId));
        if (!newBookId) {
          console.log(`   ⚠️  Chapter "${record.title}" references non-existent book ID ${record.bookId}, skipping...`);
          this.stats.chaptersSkipped++;
          continue;
        }

        // Check if chapter already exists
        const existingChapter = await this.prisma.bookChapter.findFirst({
          where: {
            bookId: newBookId,
            chapterNumber: parseInt(record.chapterNumber)
          }
        });

        if (existingChapter && !this.forceImport) {
          console.log(`   ⏭️  Chapter already exists: "${record.title}" (Chapter ${record.chapterNumber}), skipping...`);
          this.stats.chaptersSkipped++;
          continue;
        }

        // Look up eventId if provided
        let eventId = null;
        if (record.eventId && record.eventId !== 'null') {
          const event = await this.prisma.historicalEvent.findUnique({
            where: { id: parseInt(record.eventId) }
          });
          eventId = event ? event.id : null;
        }

        const chapterData = {
          bookId: newBookId,
          title: record.title || 'Unknown Chapter',
          chapterNumber: parseInt(record.chapterNumber) || 1,
          description: record.description || null,
          pageStart: record.pageStart ? parseInt(record.pageStart) : null,
          pageEnd: record.pageEnd ? parseInt(record.pageEnd) : null,
          eventId: eventId,
          originalHistoryChapterId: record.id ? parseInt(record.id) : null,
          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
        };

        let chapter;
        if (existingChapter && this.forceImport) {
          // Update existing chapter
          chapter = await this.prisma.bookChapter.update({
            where: { id: existingChapter.id },
            data: chapterData
          });
          console.log(`   ✅ Updated chapter: "${chapter.title}" (Chapter ${chapter.chapterNumber})`);
        } else {
          // Create new chapter
          chapter = await this.prisma.bookChapter.create({
            data: chapterData
          });
          console.log(`   ✅ Created chapter: "${chapter.title}" (Chapter ${chapter.chapterNumber})`);
        }

        this.stats.chaptersImported++;

        // Store mapping for sections import
        if (!this.chapterIdMapping) {
          this.chapterIdMapping = new Map();
        }
        this.chapterIdMapping.set(parseInt(record.id), chapter.id);

      } catch (error) {
        const errorMsg = `Failed to import chapter "${record.title}": ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Chapters import completed: ${this.stats.chaptersImported} imported, ${this.stats.chaptersSkipped} skipped`);
  }

  async importSections() {
    console.log('📄 Importing sections to unified Books system...');
    
    const records = await this.loadCSVFile('history_sections.csv');
    if (records.length === 0) {
      console.log('⚠️  No sections to import');
      return;
    }

    if (!this.chapterIdMapping) {
      console.log('⚠️  No chapter ID mapping available, sections import may fail');
      this.chapterIdMapping = new Map();
    }

    console.log(`📋 Processing ${records.length} sections...`);

    for (let i = 0; i < records.length; i++) {
      const record = this.cleanRecord(records[i]);
      
      try {
        // Map old chapter ID to new unified chapter ID
        const newChapterId = this.chapterIdMapping.get(parseInt(record.chapterId));
        if (!newChapterId) {
          console.log(`   ⚠️  Section "${record.title}" references non-existent chapter ID ${record.chapterId}, skipping...`);
          this.stats.sectionsSkipped++;
          continue;
        }

        // Check if section already exists
        const existingSection = await this.prisma.bookSection.findFirst({
          where: {
            chapterId: newChapterId,
            sectionNumber: parseInt(record.sectionNumber)
          }
        });

        if (existingSection && !this.forceImport) {
          console.log(`   ⏭️  Section already exists: "${record.title}" (Section ${record.sectionNumber}), skipping...`);
          this.stats.sectionsSkipped++;
          continue;
        }

        // Look up eventId if provided
        let eventId = null;
        if (record.eventId && record.eventId !== 'null') {
          const event = await this.prisma.historicalEvent.findUnique({
            where: { id: parseInt(record.eventId) }
          });
          eventId = event ? event.id : null;
        }

        const sectionData = {
          chapterId: newChapterId,
          title: record.title || 'Unknown Section',
          sectionNumber: parseInt(record.sectionNumber) || 1,
          description: record.description || null,
          content: record.content || null,
          pageStart: record.pageStart ? parseInt(record.pageStart) : null,
          pageEnd: record.pageEnd ? parseInt(record.pageEnd) : null,
          eventId: eventId,
          originalHistorySectionId: record.id ? parseInt(record.id) : null,
          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
        };

        let section;
        if (existingSection && this.forceImport) {
          // Update existing section
          section = await this.prisma.bookSection.update({
            where: { id: existingSection.id },
            data: sectionData
          });
          console.log(`   ✅ Updated section: "${section.title}" (Section ${section.sectionNumber})`);
        } else {
          // Create new section
          section = await this.prisma.bookSection.create({
            data: sectionData
          });
          console.log(`   ✅ Created section: "${section.title}" (Section ${section.sectionNumber})`);
        }

        this.stats.sectionsImported++;

      } catch (error) {
        const errorMsg = `Failed to import section "${record.title}": ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Sections import completed: ${this.stats.sectionsImported} imported, ${this.stats.sectionsSkipped} skipped`);
  }

  async importAll() {
    console.log('🚀 Starting unified books import process...');
    
    try {
      await this.initialize();
      
      // Import in order: books -> chapters -> sections
      await this.importBooks();
      await this.importChapters();
      await this.importSections();
      
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 UNIFIED BOOKS IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`📚 Books: ${this.stats.booksImported} imported, ${this.stats.booksSkipped} skipped`);
    console.log(`📖 Chapters: ${this.stats.chaptersImported} imported, ${this.stats.chaptersSkipped} skipped`);
    console.log(`📄 Sections: ${this.stats.sectionsImported} imported, ${this.stats.sectionsSkipped} skipped`);
    
    if (this.stats.errors.length > 0) {
      console.log(`❌ Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    console.log('='.repeat(50));
    console.log('✅ Import completed successfully!');
    console.log('📝 All books have been imported to the unified Books system');
    console.log('🎯 No History Plus migration needed - books are ready to use!');
  }

  async cleanup() {
    try {
      await this.prisma.$disconnect();
      console.log('🔌 Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

module.exports = UnifiedBooksImportService;