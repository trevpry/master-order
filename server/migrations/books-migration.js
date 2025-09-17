const { PrismaClient } = require('@prisma/client');

/**
 * Books Migration Service
 * Migrates all existing book data from CustomOrderItems and HistoryBooks
 * to the new unified Books system.
 */
class BooksMigrationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.migrationStats = {
      customOrderBooksProcessed: 0,
      customOrderBooksCreated: 0,
      historyBooksProcessed: 0,
      historyBooksCreated: 0,
      chaptersCreated: 0,
      sectionsCreated: 0,
      duplicatesFound: 0,
      duplicatesMerged: 0,
      errors: []
    };
    this.bookMap = new Map(); // Track created books to avoid duplicates
  }

  /**
   * Run the complete migration process
   */
  async runFullMigration() {
    console.log('🚀 Starting Books Migration Process...');
    console.log('📋 This will migrate all book data to the unified Books system\n');

    try {
      // Validate prerequisites
      await this.validatePrerequisites();

      // Phase 1: Migrate books from CustomOrderItems
      console.log('📚 Phase 1: Migrating CustomOrderItem books...');
      await this.migrateCustomOrderBooks();

      // Phase 2: Migrate HistoryBooks with chapters/sections
      console.log('📖 Phase 2: Migrating HistoryBooks...');
      await this.migrateHistoryBooks();

      // Phase 3: Handle any remaining duplicates
      console.log('🔄 Phase 3: Consolidating duplicates...');
      await this.consolidateDuplicates();

      // Phase 4: Validate migration
      console.log('✅ Phase 4: Validating migration...');
      await this.validateMigration();

      console.log('\n🎉 Migration completed successfully!');
      console.log('📊 Migration Statistics:');
      console.log(`  - CustomOrder books processed: ${this.migrationStats.customOrderBooksProcessed}`);
      console.log(`  - CustomOrder books created: ${this.migrationStats.customOrderBooksCreated}`);
      console.log(`  - History books processed: ${this.migrationStats.historyBooksProcessed}`);
      console.log(`  - History books created: ${this.migrationStats.historyBooksCreated}`);
      console.log(`  - Chapters created: ${this.migrationStats.chaptersCreated}`);
      console.log(`  - Sections created: ${this.migrationStats.sectionsCreated}`);
      console.log(`  - Duplicates found: ${this.migrationStats.duplicatesFound}`);
      console.log(`  - Duplicates merged: ${this.migrationStats.duplicatesMerged}`);
      
      if (this.migrationStats.errors.length > 0) {
        console.log(`  - Errors encountered: ${this.migrationStats.errors.length}`);
        console.log('⚠️  Review errors below:');
        this.migrationStats.errors.forEach((error, index) => {
          console.log(`    ${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ Migration failed with error:', error.message);
      console.log('🔄 Consider running rollback if needed');
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Validate that prerequisites are met
   */
  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    // Check if new tables exist
    try {
      await this.prisma.book.findFirst();
      console.log('✅ Unified Books tables are available');
    } catch (error) {
      throw new Error('❌ Unified Books tables not found. Run Prisma migration first.');
    }

    // Check for existing data
    const customOrderItemsWithBooks = await this.prisma.customOrderItem.count({
      where: {
        OR: [
          { bookTitle: { not: null } },
          { bookIsbn: { not: null } },
          { bookOpenLibraryId: { not: null } }
        ]
      }
    });

    const historyBooks = await this.prisma.historyBook.count();

    console.log(`📊 Found ${customOrderItemsWithBooks} CustomOrderItems with book data`);
    console.log(`📊 Found ${historyBooks} HistoryBooks to migrate`);

    if (customOrderItemsWithBooks === 0 && historyBooks === 0) {
      console.log('ℹ️  No book data found to migrate');
      return;
    }

    console.log('✅ Prerequisites validated\n');
  }

  /**
   * Migrate books from CustomOrderItems
   */
  async migrateCustomOrderBooks() {
    const customOrderItems = await this.prisma.customOrderItem.findMany({
      where: {
        OR: [
          { bookTitle: { not: null } },
          { bookIsbn: { not: null } },
          { bookOpenLibraryId: { not: null } }
        ]
      },
      include: {
        customOrder: true
      }
    });

    console.log(`📚 Processing ${customOrderItems.length} CustomOrderItems with book data...`);

    for (const item of customOrderItems) {
      try {
        this.migrationStats.customOrderBooksProcessed++;

        // Skip if no meaningful book data
        if (!item.bookTitle && !item.bookIsbn && !item.bookOpenLibraryId) {
          continue;
        }

        // Check for existing book (avoid duplicates)
        const existingBook = await this.findExistingBook({
          title: item.bookTitle,
          isbn: item.bookIsbn,
          openLibraryId: item.bookOpenLibraryId
        });

        let book;
        if (existingBook) {
          book = existingBook;
          this.migrationStats.duplicatesFound++;
          console.log(`🔄 Found existing book: "${book.title}" (ID: ${book.id})`);
        } else {
          // Create new book
          book = await this.prisma.book.create({
            data: {
              title: item.bookTitle || 'Unknown Title',
              author: item.bookAuthor,
              isbn: item.bookIsbn,
              publisher: item.bookPublisher,
              publishYear: item.bookYear,
              coverUrl: item.bookCoverUrl,
              pageCount: item.bookPageCount,
              openLibraryId: item.bookOpenLibraryId,
              komgaBookId: item.komgaBookId,
              komgaMetadata: item.komgaMetadata,
              komgaSeriesId: item.komgaSeriesId,
              komgaUrl: item.komgaUrl,
              artworkLastCached: item.artworkLastCached,
              artworkMimeType: item.artworkMimeType,
              localArtworkPath: item.localArtworkPath,
              originalArtworkUrl: item.originalArtworkUrl
            }
          });

          this.migrationStats.customOrderBooksCreated++;
          console.log(`✅ Created book: "${book.title}" (ID: ${book.id})`);
        }

        // Update CustomOrderItem to reference the book
        await this.prisma.customOrderItem.update({
          where: { id: item.id },
          data: { bookId: book.id }
        });

        // Create BookCompletion record if there's reading progress
        if (item.bookCurrentPage || item.bookPercentRead) {
          await this.prisma.bookCompletion.upsert({
            where: {
              bookId_userId: {
                bookId: book.id,
                userId: null // Single-user system for now
              }
            },
            create: {
              bookId: book.id,
              currentPage: item.bookCurrentPage,
              percentRead: item.bookPercentRead,
              isCompleted: item.isWatched || false
            },
            update: {
              currentPage: item.bookCurrentPage,
              percentRead: item.bookPercentRead,
              isCompleted: item.isWatched || false
            }
          });
        }

        // Track in our map
        const bookKey = this.generateBookKey(book);
        this.bookMap.set(bookKey, book);

      } catch (error) {
        const errorMsg = `Failed to migrate CustomOrderItem ${item.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.migrationStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ CustomOrderItem migration completed. Created ${this.migrationStats.customOrderBooksCreated} books\n`);
  }

  /**
   * Migrate HistoryBooks with chapters and sections
   */
  async migrateHistoryBooks() {
    const historyBooks = await this.prisma.historyBook.findMany({
      include: {
        chapters: {
          include: {
            sections: true
          }
        },
        event: true,
        user_book_reads: true
      }
    });

    console.log(`📖 Processing ${historyBooks.length} HistoryBooks...`);

    for (const historyBook of historyBooks) {
      try {
        this.migrationStats.historyBooksProcessed++;

        // Check for existing book
        const existingBook = await this.findExistingBook({
          title: historyBook.title,
          isbn: historyBook.isbn
        });

        let book;
        if (existingBook) {
          book = existingBook;
          this.migrationStats.duplicatesFound++;
          console.log(`🔄 Found existing book: "${book.title}" (ID: ${book.id})`);
        } else {
          // Create new book
          book = await this.prisma.book.create({
            data: {
              title: historyBook.title,
              author: historyBook.author,
              isbn: historyBook.isbn,
              publisher: historyBook.publisher,
              publishYear: historyBook.publishYear,
              description: historyBook.description,
              coverUrl: historyBook.coverUrl,
              pageCount: historyBook.pageCount
            }
          });

          this.migrationStats.historyBooksCreated++;
          console.log(`✅ Created book: "${book.title}" (ID: ${book.id})`);
        }

        // Create HistoryBookLink if associated with an event
        if (historyBook.eventId) {
          await this.prisma.historyBookLink.create({
            data: {
              bookId: book.id,
              eventId: historyBook.eventId
            }
          });
        }

        // Migrate chapters
        for (const historyChapter of historyBook.chapters) {
          const chapter = await this.prisma.bookChapter.create({
            data: {
              bookId: book.id,
              title: historyChapter.title,
              chapterNumber: historyChapter.chapterNumber,
              description: historyChapter.description,
              pageStart: historyChapter.pageStart,
              pageEnd: historyChapter.pageEnd
            }
          });

          this.migrationStats.chaptersCreated++;

          // Migrate sections
          for (const historySection of historyChapter.sections) {
            await this.prisma.bookSection.create({
              data: {
                chapterId: chapter.id,
                title: historySection.title,
                sectionNumber: historySection.sectionNumber,
                description: historySection.description,
                content: historySection.content,
                pageStart: historySection.pageStart,
                pageEnd: historySection.pageEnd
              }
            });

            this.migrationStats.sectionsCreated++;
          }
        }

        // Migrate user reading data
        if (historyBook.user_book_reads) {
          await this.prisma.bookCompletion.create({
            data: {
              bookId: book.id,
              isCompleted: historyBook.user_book_reads.completed || false,
              completedAt: historyBook.user_book_reads.completed_at
            }
          });
        }

        // CRITICAL: Create HistoryBookLink to maintain connection to historical events
        if (historyBook.event) {
          await this.prisma.historyBookLink.create({
            data: {
              bookId: book.id,
              eventId: historyBook.event.id
            }
          });
          console.log(`🔗 Linked book "${book.title}" to historical event "${historyBook.event.title}"`);
        }

        // Track in our map
        const bookKey = this.generateBookKey(book);
        this.bookMap.set(bookKey, book);

      } catch (error) {
        const errorMsg = `Failed to migrate HistoryBook ${historyBook.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.migrationStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ HistoryBook migration completed. Created ${this.migrationStats.historyBooksCreated} books, ${this.migrationStats.chaptersCreated} chapters, ${this.migrationStats.sectionsCreated} sections\n`);
  }

  /**
   * Find existing book to avoid duplicates
   */
  async findExistingBook({ title, isbn, openLibraryId }) {
    // Check by ISBN first (most reliable)
    if (isbn) {
      const book = await this.prisma.book.findUnique({
        where: { isbn }
      });
      if (book) return book;
    }

    // Check by OpenLibraryId
    if (openLibraryId) {
      const book = await this.prisma.book.findUnique({
        where: { openLibraryId }
      });
      if (book) return book;
    }

    // Check by title (exact match for now)
    if (title) {
      const book = await this.prisma.book.findFirst({
        where: { title }
      });
      if (book) return book;
    }

    return null;
  }

  /**
   * Generate a unique key for book tracking
   */
  generateBookKey(book) {
    return book.isbn || book.openLibraryId || `${book.title}_${book.author}`;
  }

  /**
   * Consolidate any remaining duplicates
   */
  async consolidateDuplicates() {
    // This is a placeholder for more sophisticated duplicate detection
    // Could implement fuzzy matching, etc.
    console.log('📊 Duplicate consolidation completed (basic implementation)');
  }

  /**
   * Validate that migration completed successfully
   */
  async validateMigration() {
    const totalBooks = await this.prisma.book.count();
    const booksWithCustomOrders = await this.prisma.book.count({
      where: {
        customOrderItems: {
          some: {}
        }
      }
    });
    const booksWithHistoryLinks = await this.prisma.book.count({
      where: {
        historyBookLinks: {
          some: {}
        }
      }
    });

    console.log(`📊 Validation Results:`);
    console.log(`  - Total books in unified table: ${totalBooks}`);
    console.log(`  - Books linked to custom orders: ${booksWithCustomOrders}`);
    console.log(`  - Books linked to history events: ${booksWithHistoryLinks}`);

    // Verify no orphaned references
    const orphanedCustomOrderItems = await this.prisma.customOrderItem.count({
      where: {
        AND: [
          { bookTitle: { not: null } },
          { bookId: null }
        ]
      }
    });

    if (orphanedCustomOrderItems > 0) {
      throw new Error(`❌ Found ${orphanedCustomOrderItems} CustomOrderItems with book data but no book reference`);
    }

    console.log('✅ Migration validation passed');
  }
}

/**
 * Main migration execution
 */
async function runBooksMigration() {
  const migrationService = new BooksMigrationService();
  
  try {
    await migrationService.runFullMigration();
    console.log('\n🎉 Books migration completed successfully!');
    console.log('💡 Next steps:');
    console.log('  1. Update application services to use unified Books table');
    console.log('  2. Test all book-related functionality');
    console.log('  3. Remove old book fields from CustomOrderItem (after validation)');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    console.log('🔄 Check the logs above for details');
    console.log('📋 Consider creating a database backup before retrying');
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  runBooksMigration();
}

module.exports = { BooksMigrationService, runBooksMigration };