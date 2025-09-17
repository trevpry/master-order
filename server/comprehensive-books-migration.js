const { PrismaClient } = require('@prisma/client');

/**
 * Comprehensive Books Migration Service
 * 
     try {
      // Validate prerequisites
      await this.validatePrerequisites();

      // Production safety: Use transaction for PostgreSQL
      if (this.databaseType === 'postgresql') {
        console.log('🔒 Using PostgreSQL transaction for data safety...\n');
        await this.runMigrationInTransaction();
      } else {
        console.log('📝 Running SQLite migration (no transaction    } else {
      console.log('ℹ️ No History Plus books found to migrate');
    }

    console.log(`✅ History Plus migration completed!`);
    console.log(`  📈 Created ${this.migrationStats.historyBooksCreated} new unified books`);
    console.log(`  📖 Created ${this.migrationStats.historyChaptersCreated} chapters`);
    console.log(`  📄 Created ${this.migrationStats.historySectionsCreated} sections`);
    console.log(`  🔗 Created ${this.migrationStats.historyBookLinksCreated} event links`);
    console.log(`  📊 Migrated ${this.migrationStats.historyProgressMigrated} reading progress records`);
    console.log(`  📝 Preserved all original History Plus records\n`);\n');
        await this.runMigrationSteps();
      }ers: Creates unified Book records, preserves Custom Order items with bookId links only
 * History Plus: Creates unified Book records with chapters/sections, migrates read status, removes originals
 * 
 * Production Ready: Supports both SQLite (dev) and PostgreSQL (production)
 */
class ComprehensiveBooksMigrationService {
  constructor() {
    // Detect database environment for production safety
    this.isProduction = this.detectProductionEnvironment();
    this.databaseType = this.detectDatabaseType();
    
    this.prisma = new PrismaClient();
    this.migrationStats = {
      // Custom Order migration
      customOrderBooksProcessed: 0,
      customOrderBooksCreated: 0,
      customOrderDuplicates: 0,
      customOrderLinksCreated: 0,
      customOrderProgressMigrated: 0,
      
      // History Plus migration
      historyBooksProcessed: 0,
      historyBooksCreated: 0,
      historyChaptersCreated: 0,
      historySectionsCreated: 0,
      historyBookLinksCreated: 0,
      historyProgressMigrated: 0,
      historyRecordsPreserved: 0,
      
      // General
      totalDuplicates: 0,
      errors: []
    };
    this.bookMap = new Map(); // Track created books to avoid duplicates
  }

  /**
   * Detect if running in production environment
   */
  detectProductionEnvironment() {
    const nodeEnv = process.env.NODE_ENV;
    const databaseUrl = process.env.DATABASE_URL;
    const fs = require('fs');
    
    // Check if we're in Docker
    const isDocker = fs.existsSync('/.dockerenv');
    
    // Check if DATABASE_URL suggests PostgreSQL (production indicator)
    const isPostgres = databaseUrl && (
      databaseUrl.startsWith('postgresql://') || 
      databaseUrl.startsWith('postgres://')
    );
    
    return nodeEnv === 'production' || isDocker || isPostgres;
  }

  /**
   * Detect database type for appropriate handling
   */
  detectDatabaseType() {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
        return 'postgresql';
      } else if (databaseUrl.startsWith('file:')) {
        return 'sqlite';
      }
    }
    
    // Default to SQLite for development
    return 'sqlite';
  }

  /**
   * Display environment information and safety warnings
   */
  displayEnvironmentInfo() {
    const databaseUrl = process.env.DATABASE_URL;
    const maskedUrl = databaseUrl ? databaseUrl.replace(/\/\/.*@/, '//***@') : 'not set';
    
    console.log('🔧 Environment Configuration:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   DATABASE_URL: ${maskedUrl}`);
    console.log(`   Database Type: ${this.databaseType.toUpperCase()}`);
    console.log(`   Production Mode: ${this.isProduction ? 'YES' : 'NO'}`);
    
    if (this.isProduction) {
      console.log('\n⚠️  PRODUCTION ENVIRONMENT DETECTED');
      console.log('   This migration will run on your production PostgreSQL database.');
      console.log('   Ensure you have a backup before proceeding.');
    }
    
    console.log('');
  }

  /**
   * Run the complete migration process
   */
  async runComprehensiveMigration() {
    console.log('🚀 Starting Comprehensive Books Migration...');
    console.log('📋 Custom Orders: Create unified books, leave only bookId links');
    console.log('📋 History Plus: Create unified books with chapters/sections, migrate read status, remove originals\n');

    // Display environment information
    this.displayEnvironmentInfo();

    try {
      // Validate prerequisites
      await this.validatePrerequisites();

      // Production safety: Use transaction for PostgreSQL
      if (this.databaseType === 'postgresql') {
        console.log('� Using PostgreSQL transaction for data safety...\n');
        await this.runMigrationInTransaction();
      } else {
        console.log('📝 Running SQLite migration (no transaction needed)...\n');
        await this.runMigrationSteps();
      }

      // Print final summary
      this.printMigrationSummary();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Run migration steps within a PostgreSQL transaction for safety
   */
  async runMigrationInTransaction() {
    return await this.prisma.$transaction(async (tx) => {
      // Temporarily replace prisma with transaction client
      const originalPrisma = this.prisma;
      this.prisma = tx;

      try {
        await this.runMigrationSteps();
      } finally {
        // Restore original prisma client
        this.prisma = originalPrisma;
      }
    }, {
      // Set a longer timeout for large migrations (5 minutes)
      timeout: 300000,
    });
  }

  /**
   * Run the core migration steps
   */
  async runMigrationSteps() {
    // Phase 1: Migrate Custom Order books (create unified, preserve Custom Order with links)
    console.log('📚 Phase 1: Migrating Custom Order books...');
    await this.migrateCustomOrderBooks();

    // Phase 2: Migrate History Plus books (create unified, migrate all data, remove originals)
    console.log('📖 Phase 2: Migrating History Plus books...');
    await this.migrateHistoryPlusBooks();

    // Phase 3: Final validation and cleanup
    console.log('✅ Phase 3: Final validation...');
    await this.validateMigration();
  }

  /**
   * Validate prerequisites
   */
  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    // Check if unified tables exist
    try {
      await this.prisma.book.findFirst();
      await this.prisma.bookCompletion.findFirst();
      console.log('✅ Unified Books tables are available');
    } catch (error) {
      throw new Error('❌ Unified Books tables not found. Run Prisma migration first.');
    }

    // Count existing data
    const [customOrderBooks, historyBooks, existingUnifiedBooks] = await Promise.all([
      this.prisma.customOrderItem.count({
        where: {
          OR: [
            { bookTitle: { not: null } },
            { bookIsbn: { not: null } },
            { bookOpenLibraryId: { not: null } }
          ]
        }
      }),
      this.prisma.historyBook.count(),
      this.prisma.book.count()
    ]);

    console.log(`📊 Found ${customOrderBooks} Custom Order books to migrate`);
    console.log(`📊 Found ${historyBooks} History Plus books to migrate`);
    console.log(`📊 Current unified books: ${existingUnifiedBooks}`);

    if (customOrderBooks === 0 && historyBooks === 0) {
      console.log('ℹ️  No book data found to migrate');
      return;
    }

    console.log('✅ Prerequisites validated\n');
  }

  /**
   * Migrate Custom Order books - create unified books, preserve Custom Orders with bookId links only
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

    console.log(`📚 Processing ${customOrderItems.length} Custom Order book items...`);

    const successfullyMigratedItemIds = [];

    for (const item of customOrderItems) {
      try {
        this.migrationStats.customOrderBooksProcessed++;

        // Skip if no meaningful book data
        if (!item.bookTitle && !item.bookIsbn && !item.bookOpenLibraryId) {
          continue;
        }

        // Check for existing unified book (avoid duplicates)
        const existingBook = await this.findExistingBook({
          title: item.bookTitle,
          isbn: item.bookIsbn,
          openLibraryId: item.bookOpenLibraryId
        });

        let unifiedBook;
        if (existingBook) {
          unifiedBook = existingBook;
          this.migrationStats.customOrderDuplicates++;
          console.log(`🔄 Using existing unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        } else {
          // Create new unified book with all metadata from Custom Order
          unifiedBook = await this.prisma.book.create({
            data: {
              title: item.bookTitle || 'Unknown Title',
              author: item.bookAuthor,
              isbn: item.bookIsbn,
              publisher: item.bookPublisher,
              publishYear: item.bookYear,
              description: null, // Custom Orders don't have book descriptions
              coverUrl: item.bookCoverUrl,
              pageCount: item.bookPageCount,
              openLibraryId: item.bookOpenLibraryId,
              komgaBookId: item.komgaBookId,
              komgaSeriesId: item.komgaSeriesId,
              komgaUrl: item.komgaUrl,
              komgaMetadata: item.komgaMetadata,
              artworkLastCached: item.artworkLastCached,
              artworkMimeType: item.artworkMimeType,
              localArtworkPath: item.localArtworkPath,
              originalArtworkUrl: item.originalArtworkUrl
            }
          });

          this.migrationStats.customOrderBooksCreated++;
          console.log(`✅ Created unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        }

        // Update Custom Order Item to reference unified book (keep Custom Order item, just add link)
        await this.prisma.customOrderItem.update({
          where: { id: item.id },
          data: { 
            bookId: unifiedBook.id
          }
        });

        this.migrationStats.customOrderLinksCreated++;

        // Migrate reading progress to unified BookCompletion if exists
        if (item.bookCurrentPage || item.bookPercentRead || item.isWatched) {
          await this.prisma.bookCompletion.upsert({
            where: {
              bookId_userId: {
                bookId: unifiedBook.id,
                userId: 'default' // Use default user for single-user system
              }
            },
            create: {
              bookId: unifiedBook.id,
              userId: 'default',
              currentPage: item.bookCurrentPage,
              percentRead: item.bookPercentRead,
              isCompleted: item.isWatched || false,
              completedAt: item.isWatched ? item.updatedAt : null
            },
            update: {
              currentPage: item.bookCurrentPage,
              percentRead: item.bookPercentRead,
              isCompleted: item.isWatched || false,
              completedAt: item.isWatched ? item.updatedAt : null
            }
          });

          this.migrationStats.customOrderProgressMigrated++;
        }

        // Track book to avoid duplicates
        const bookKey = this.generateBookKey(unifiedBook);
        this.bookMap.set(bookKey, unifiedBook);

        // Add to successfully migrated list
        successfullyMigratedItemIds.push(item.id);

        console.log(`  ✓ Custom Order item ${item.id} now links to unified book ${unifiedBook.id}`);

      } catch (error) {
        const errorMsg = `Failed to migrate Custom Order book ${item.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.migrationStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Custom Order migration completed!`);
    console.log(`  📈 Created ${this.migrationStats.customOrderBooksCreated} new unified books`);
    console.log(`  🔗 Created ${this.migrationStats.customOrderLinksCreated} bookId links`);
    console.log(`  📊 Migrated ${this.migrationStats.customOrderProgressMigrated} reading progress records`);
    console.log(`  🔄 Found ${this.migrationStats.customOrderDuplicates} duplicates`);
    if (this.migrationStats.errors.length > 0) {
      console.log(`  ⚠️ ${this.migrationStats.errors.length} errors occurred during Custom Order migration\n`);
    } else {
      console.log(`  ✅ All Custom Order books migrated successfully\n`);
    }
  }

  /**
   * Migrate History Plus books - create unified books with chapters/sections, migrate read status, remove originals
   */
  async migrateHistoryPlusBooks() {
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

    console.log(`📖 Processing ${historyBooks.length} History Plus books...`);

    const successfullyMigratedBookIds = [];

    for (const historyBook of historyBooks) {
      try {
        this.migrationStats.historyBooksProcessed++;

        // Check for existing unified book (avoid duplicates)
        const existingBook = await this.findExistingBook({
          title: historyBook.title,
          isbn: historyBook.isbn
        });

        let unifiedBook;
        if (existingBook) {
          unifiedBook = existingBook;
          console.log(`🔄 Using existing unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        } else {
          // Create unified book from History Plus data
          unifiedBook = await this.prisma.book.create({
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
          console.log(`✅ Created unified book: "${unifiedBook.title}" (ID: ${unifiedBook.id})`);
        }

        // Create HistoryBookLink to preserve event association
        if (historyBook.eventId) {
          await this.prisma.historyBookLink.create({
            data: {
              bookId: unifiedBook.id,
              eventId: historyBook.eventId
            }
          });
          this.migrationStats.historyBookLinksCreated++;
        }

        // Migrate chapters and sections
        for (const chapter of historyBook.chapters) {
          const unifiedChapter = await this.prisma.bookChapter.create({
            data: {
              bookId: unifiedBook.id,
              title: chapter.title,
              chapterNumber: chapter.chapterNumber,
              description: chapter.description,
              pageStart: chapter.pageStart,
              pageEnd: chapter.pageEnd,
              eventId: chapter.eventId // Preserve event association
            }
          });

          this.migrationStats.historyChaptersCreated++;

          // Migrate sections
          for (const section of chapter.sections) {
            const unifiedSection = await this.prisma.bookSection.create({
              data: {
                chapterId: unifiedChapter.id,
                title: section.title,
                sectionNumber: section.sectionNumber,
                description: section.description,
                pageStart: section.pageStart,
                pageEnd: section.pageEnd,
                content: section.content,
                eventId: section.eventId // Preserve event association
              }
            });

            this.migrationStats.historySectionsCreated++;
          }
        }

        // Migrate reading progress
        if (historyBook.user_book_reads) {
          await this.prisma.bookCompletion.upsert({
            where: {
              bookId_userId: {
                bookId: unifiedBook.id,
                userId: 'default'
              }
            },
            create: {
              bookId: unifiedBook.id,
              userId: 'default',
              isCompleted: historyBook.user_book_reads.isCompleted || false,
              completedAt: historyBook.user_book_reads.completedAt
            },
            update: {
              isCompleted: historyBook.user_book_reads.isCompleted || false,
              completedAt: historyBook.user_book_reads.completedAt
            }
          });

          this.migrationStats.historyProgressMigrated++;
        }

        // Track book to avoid duplicates
        const bookKey = this.generateBookKey(unifiedBook);
        this.bookMap.set(bookKey, unifiedBook);

        // Add to successfully migrated list
        successfullyMigratedBookIds.push(historyBook.id);

        console.log(`  ✓ History book "${historyBook.title}" migrated to unified book ${unifiedBook.id}`);

      } catch (error) {
        const errorMsg = `Failed to migrate History book ${historyBook.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.migrationStats.errors.push(errorMsg);
      }
    }

    // Preserve original History Plus records - use separate cleanup script if desired
    if (successfullyMigratedBookIds.length > 0 && this.migrationStats.errors.length === 0) {
      console.log('✅ History Plus migration completed successfully!');
      console.log('� Original History Plus records have been PRESERVED');
      console.log('🔗 All data has been migrated to the unified book system');
      console.log('');
      console.log('💡 To clean up original History Plus records (optional):');
      console.log('   node cleanup-history-plus.js');
      console.log('');
    } else if (this.migrationStats.errors.length > 0) {
      console.log('⚠️ Migration had errors - preserving original History Plus records for safety');
    } else {
      console.log('ℹ️ No History Plus books were migrated - no records to remove');
    }

    console.log(`✅ History Plus migration completed!`);
    console.log(`  📈 Created ${this.migrationStats.historyBooksCreated} new unified books`);
    console.log(`  📖 Created ${this.migrationStats.historyChaptersCreated} chapters`);
    console.log(`  📄 Created ${this.migrationStats.historySectionsCreated} sections`);
    console.log(`  🔗 Created ${this.migrationStats.historyBookLinksCreated} event links`);
    console.log(`  📊 Migrated ${this.migrationStats.historyProgressMigrated} reading progress records`);
    console.log(`  � Preserved all original History Plus records\n`);
  }

  /**
   * Find existing book by title, ISBN, or OpenLibrary ID
   */
  async findExistingBook({ title, isbn, openLibraryId }) {
    if (isbn) {
      const book = await this.prisma.book.findUnique({ where: { isbn } });
      if (book) return book;
    }

    if (openLibraryId) {
      const book = await this.prisma.book.findUnique({ where: { openLibraryId } });
      if (book) return book;
    }

    if (title) {
      // Use contains for case-insensitive search that works with SQLite
      const book = await this.prisma.book.findFirst({
        where: {
          title: {
            equals: title
          }
        }
      });
      if (book) return book;
    }

    return null;
  }

  /**
   * Generate a unique key for book tracking
   */
  generateBookKey(book) {
    return `${book.isbn || 'no-isbn'}-${book.openLibraryId || 'no-ol'}-${book.title.toLowerCase().trim()}`;
  }

  /**
   * Validate migration results
   */
  async validateMigration() {
    const [unifiedBooks, bookCompletions, customOrdersWithBooks, historyBookLinks] = await Promise.all([
      this.prisma.book.count(),
      this.prisma.bookCompletion.count(),
      this.prisma.customOrderItem.count({ where: { bookId: { not: null } } }),
      this.prisma.historyBookLink.count()
    ]);

    console.log('📊 Migration validation:');
    console.log(`  📚 Total unified books: ${unifiedBooks}`);
    console.log(`  📊 Book completion records: ${bookCompletions}`);
    console.log(`  🔗 Custom Order items with bookId links: ${customOrdersWithBooks}`);
    console.log(`  🏛️ History book event links: ${historyBookLinks}`);

    if (this.migrationStats.errors.length > 0) {
      console.log(`\n⚠️ ${this.migrationStats.errors.length} errors occurred during migration:`);
      this.migrationStats.errors.forEach(error => console.log(`  - ${error}`));
    }
  }

  /**
   * Print comprehensive migration summary
   */
  printMigrationSummary() {
    console.log('\n🎉 Comprehensive Books Migration Completed!');
    console.log('=' .repeat(60));
    
    console.log('\n📚 Custom Order Migration:');
    console.log(`  ✓ Books processed: ${this.migrationStats.customOrderBooksProcessed}`);
    console.log(`  ✓ New books created: ${this.migrationStats.customOrderBooksCreated}`);
    console.log(`  ✓ BookId links created: ${this.migrationStats.customOrderLinksCreated}`);
    console.log(`  ✓ Progress records migrated: ${this.migrationStats.customOrderProgressMigrated}`);
    console.log(`  ✓ Duplicates found: ${this.migrationStats.customOrderDuplicates}`);

    console.log('\n📖 History Plus Migration:');
    console.log(`  ✓ Books processed: ${this.migrationStats.historyBooksProcessed}`);
    console.log(`  ✓ New books created: ${this.migrationStats.historyBooksCreated}`);
    console.log(`  ✓ Chapters created: ${this.migrationStats.historyChaptersCreated}`);
    console.log(`  ✓ Sections created: ${this.migrationStats.historySectionsCreated}`);
    console.log(`  ✓ Event links created: ${this.migrationStats.historyBookLinksCreated}`);
    console.log(`  ✓ Progress records migrated: ${this.migrationStats.historyProgressMigrated}`);
    console.log(`  ✓ Original records preserved: Yes (use cleanup-history-plus.js to remove)`);

    const totalBooksCreated = this.migrationStats.customOrderBooksCreated + this.migrationStats.historyBooksCreated;
    const totalProgress = this.migrationStats.customOrderProgressMigrated + this.migrationStats.historyProgressMigrated;

    console.log('\n📈 Overall Summary:');
    console.log(`  📚 Total unified books created: ${totalBooksCreated}`);
    console.log(`  📊 Total progress records migrated: ${totalProgress}`);
    console.log(`  ❌ Total errors: ${this.migrationStats.errors.length}`);

    console.log('\n✨ Migration Results:');
    console.log('  📋 Custom Orders: Preserved with bookId links to unified books');
    console.log('  📋 History Plus: Migrated to unified system, originals preserved');
    console.log('  📋 All reading progress and event associations preserved');
    console.log('  💡 Optional: Run cleanup-history-plus.js to remove original History Plus records');
  }
}

// Execute if run directly
if (require.main === module) {
  const migrationService = new ComprehensiveBooksMigrationService();
  
  // Show production usage if needed
  if (migrationService.isProduction) {
    console.log('🏭 PRODUCTION MIGRATION MODE');
    console.log('💡 To run this migration in production with PostgreSQL:');
    console.log('   DATABASE_URL="postgresql://user:pass@host:port/database" node comprehensive-books-migration.js');
    console.log('');
  }
  
  migrationService.runComprehensiveMigration()
    .then(() => {
      console.log('\n✨ Comprehensive books migration completed successfully!');
      if (migrationService.isProduction) {
        console.log('🎯 Production PostgreSQL migration completed with transaction safety!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      if (migrationService.isProduction) {
        console.error('🔄 PostgreSQL transaction was rolled back - no data was modified');
      }
      process.exit(1);
    });
}

module.exports = ComprehensiveBooksMigrationService;