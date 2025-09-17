const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

/**
 * History Plus CSV Import Service
 * Imports History Plus books, chapters, sections, and read status from exported CSV files
 */
class HistoryPlusCSVImportService {
  constructor() {
    this.prisma = new PrismaClient();
    this.importStats = {
      booksImported: 0,
      chaptersImported: 0,
      sectionsImported: 0,
      userReadsImported: 0,
      errors: []
    };
  }

  async importAllData() {
    console.log('🔄 Starting History Plus CSV Import...');
    
    try {
      // Get any existing events to use for linking
      const events = await this.prisma.historicalEvent.findMany();
      console.log(`📊 Found ${events.length} existing events for linking`);

      // Phase 1: Import books
      console.log('📚 Phase 1: Importing books...');
      await this.importBooks(events);

      // Phase 2: Import chapters
      console.log('📖 Phase 2: Importing chapters...');
      await this.importChapters(events);

      // Phase 3: Import sections
      console.log('📄 Phase 3: Importing sections...');
      await this.importSections(events);

      // Phase 4: Import user reads
      console.log('👤 Phase 4: Importing user reads...');
      await this.importUserReads();

      this.printSummary();

    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async importBooks(events) {
    const csvPath = path.join(__dirname, '../history-plus-export/history_books.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = this.parseCSVLine(lines[0]);
    
    console.log(`📚 Processing ${lines.length - 1} books...`);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const book = this.mapCSVToObject(headers, values);

        // Find a suitable event if eventId is specified
        let eventId = null;
        if (book.eventId && events.length > 0) {
          // Try to find the specific event, or use the first available event
          const targetEvent = events.find(e => e.id == book.eventId) || events[0];
          eventId = targetEvent.id;
        }

        await this.prisma.historyBook.create({
          data: {
            id: parseInt(book.id),
            title: book.title || 'Unknown Title',
            author: book.author || null,
            isbn: book.isbn || null,
            publisher: book.publisher || null,
            publishYear: book.publishYear ? parseInt(book.publishYear) : null,
            description: book.description || null,
            coverUrl: book.coverUrl || null,
            pageCount: book.pageCount ? parseInt(book.pageCount) : null,
            eventId: eventId,
            createdAt: book.createdAt ? new Date(book.createdAt) : new Date(),
            updatedAt: book.updatedAt ? new Date(book.updatedAt) : new Date()
          }
        });

        this.importStats.booksImported++;
        console.log(`  ✓ Imported book: "${book.title}" (ID: ${book.id})`);

      } catch (error) {
        const errorMsg = `Failed to import book from line ${i}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.importStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Books import completed: ${this.importStats.booksImported} imported\n`);
  }

  async importChapters(events) {
    const csvPath = path.join(__dirname, '../history-plus-export/history_chapters.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = this.parseCSVLine(lines[0]);
    
    console.log(`📖 Processing ${lines.length - 1} chapters...`);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const chapter = this.mapCSVToObject(headers, values);

        // Find a suitable event if eventId is specified
        let eventId = null;
        if (chapter.eventId && events.length > 0) {
          const targetEvent = events.find(e => e.id == chapter.eventId) || events[0];
          eventId = targetEvent.id;
        }

        await this.prisma.historyChapter.create({
          data: {
            id: parseInt(chapter.id),
            title: chapter.title || 'Unknown Chapter',
            chapterNumber: parseInt(chapter.chapterNumber) || 1,
            description: chapter.description || null,
            pageStart: chapter.pageStart ? parseInt(chapter.pageStart) : null,
            pageEnd: chapter.pageEnd ? parseInt(chapter.pageEnd) : null,
            bookId: parseInt(chapter.bookId),
            eventId: eventId,
            createdAt: chapter.createdAt ? new Date(chapter.createdAt) : new Date(),
            updatedAt: chapter.updatedAt ? new Date(chapter.updatedAt) : new Date()
          }
        });

        this.importStats.chaptersImported++;
        console.log(`  ✓ Imported chapter: "${chapter.title}" (ID: ${chapter.id})`);

      } catch (error) {
        const errorMsg = `Failed to import chapter from line ${i}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.importStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Chapters import completed: ${this.importStats.chaptersImported} imported\n`);
  }

  async importSections(events) {
    const csvPath = path.join(__dirname, '../history-plus-export/history_sections.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = this.parseCSVLine(lines[0]);
    
    console.log(`📄 Processing ${lines.length - 1} sections...`);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const section = this.mapCSVToObject(headers, values);

        // Find a suitable event if eventId is specified
        let eventId = null;
        if (section.eventId && events.length > 0) {
          const targetEvent = events.find(e => e.id == section.eventId) || events[0];
          eventId = targetEvent.id;
        }

        await this.prisma.historySection.create({
          data: {
            id: parseInt(section.id),
            title: section.title || 'Unknown Section',
            sectionNumber: parseInt(section.sectionNumber) || 1,
            description: section.description || null,
            pageStart: section.pageStart ? parseInt(section.pageStart) : null,
            pageEnd: section.pageEnd ? parseInt(section.pageEnd) : null,
            content: section.content || null,
            chapterId: parseInt(section.chapterId),
            eventId: eventId,
            createdAt: section.createdAt ? new Date(section.createdAt) : new Date(),
            updatedAt: section.updatedAt ? new Date(section.updatedAt) : new Date()
          }
        });

        this.importStats.sectionsImported++;
        console.log(`  ✓ Imported section: "${section.title}" (ID: ${section.id})`);

      } catch (error) {
        const errorMsg = `Failed to import section from line ${i}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.importStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Sections import completed: ${this.importStats.sectionsImported} imported\n`);
  }

  async importUserReads() {
    const csvPath = path.join(__dirname, '../history-plus-export/user_book_reads.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = this.parseCSVLine(lines[0]);
    
    console.log(`👤 Processing ${lines.length - 1} user reads...`);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const userRead = this.mapCSVToObject(headers, values);

        await this.prisma.user_book_reads.create({
          data: {
            id: userRead.id,
            userId: userRead.userId || null,
            bookId: parseInt(userRead.bookId),
            isCompleted: userRead.read === 'true' || userRead.read === true,
            completedAt: userRead.readDate ? new Date(userRead.readDate) : null,
            createdAt: userRead.createdAt ? new Date(userRead.createdAt) : new Date(),
            updatedAt: userRead.updatedAt ? new Date(userRead.updatedAt) : new Date()
          }
        });

        this.importStats.userReadsImported++;
        console.log(`  ✓ Imported user read for book ${userRead.bookId}`);

      } catch (error) {
        const errorMsg = `Failed to import user read from line ${i}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.importStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ User reads import completed: ${this.importStats.userReadsImported} imported\n`);
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  mapCSVToObject(headers, values) {
    const obj = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/"/g, '');
      const value = values[index] ? values[index].replace(/"/g, '') : null;
      obj[cleanHeader] = value === '' ? null : value;
    });
    return obj;
  }

  printSummary() {
    console.log('\n🎉 History Plus CSV Import Completed!');
    console.log('=' .repeat(50));
    console.log(`📚 Books imported: ${this.importStats.booksImported}`);
    console.log(`📖 Chapters imported: ${this.importStats.chaptersImported}`);
    console.log(`📄 Sections imported: ${this.importStats.sectionsImported}`);
    console.log(`👤 User reads imported: ${this.importStats.userReadsImported}`);
    console.log(`❌ Errors: ${this.importStats.errors.length}`);

    if (this.importStats.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.importStats.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n✨ History Plus data has been restored!');
  }
}

// Execute if run directly
if (require.main === module) {
  const importService = new HistoryPlusCSVImportService();
  importService.importAllData()
    .then(() => {
      console.log('\n✅ History Plus CSV import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = HistoryPlusCSVImportService;