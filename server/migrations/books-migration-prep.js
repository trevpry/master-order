const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

/**
 * Books Migration Preparation Service
 * Validates prerequisites and creates backup before migration
 */
class BooksMigrationPrepService {
  constructor() {
    this.prisma = new PrismaClient();
    this.backupDir = path.join(__dirname, '..', '..', 'backups');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Run complete preparation process
   */
  async runPreparation() {
    console.log('🔍 Books Migration Preparation');
    console.log('===============================\n');

    try {
      // 1. Validate current state
      await this.validateCurrentState();

      // 2. Analyze existing data
      await this.analyzeExistingData();

      // 3. Check for potential issues
      await this.checkForIssues();

      // 4. Create backup
      await this.createBackup();

      // 5. Final recommendations
      this.provideRecommendations();

      console.log('\n✅ Migration preparation completed successfully!');
      console.log('🚀 You can now run the migration with confidence.');

    } catch (error) {
      console.error('❌ Preparation failed:', error.message);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Validate current database state
   */
  async validateCurrentState() {
    console.log('🔍 Validating current database state...');

    // Check if unified tables already exist
    try {
      const existingBooks = await this.prisma.book.count();
      if (existingBooks > 0) {
        throw new Error('Unified Books table already contains data. Migration may have already been run.');
      }
      console.log('✅ Unified Books tables are empty - ready for migration');
    } catch (error) {
      if (error.message.includes('Table') && error.message.includes('doesn\'t exist')) {
        throw new Error('Unified Books tables do not exist. Run Prisma migration first.');
      }
      throw error;
    }

    // Check for required source tables
    try {
      await this.prisma.customOrderItem.findFirst();
      await this.prisma.historyBook.findFirst();
      console.log('✅ Source tables (CustomOrderItem, HistoryBook) are accessible');
    } catch (error) {
      throw new Error('Required source tables are not accessible: ' + error.message);
    }

    console.log('✅ Database state validation passed\n');
  }

  /**
   * Analyze existing book data
   */
  async analyzeExistingData() {
    console.log('📊 Analyzing existing book data...');

    // Analyze CustomOrderItem book data
    const customOrderBooksQuery = await this.prisma.customOrderItem.findMany({
      where: {
        OR: [
          { bookTitle: { not: null } },
          { bookIsbn: { not: null } },
          { bookOpenLibraryId: { not: null } }
        ]
      },
      select: {
        id: true,
        bookTitle: true,
        bookAuthor: true,
        bookIsbn: true,
        bookOpenLibraryId: true,
        bookPageCount: true,
        bookCurrentPage: true,
        bookPercentRead: true,
        isWatched: true
      }
    });

    // Analyze HistoryBook data
    const historyBooksQuery = await this.prisma.historyBook.findMany({
      include: {
        chapters: {
          include: {
            sections: true
          }
        },
        user_book_reads: true
      }
    });

    console.log('📚 CustomOrderItem Book Analysis:');
    console.log(`  - Total items with book data: ${customOrderBooksQuery.length}`);
    console.log(`  - Items with ISBN: ${customOrderBooksQuery.filter(b => b.bookIsbn).length}`);
    console.log(`  - Items with OpenLibraryId: ${customOrderBooksQuery.filter(b => b.bookOpenLibraryId).length}`);
    console.log(`  - Items with reading progress: ${customOrderBooksQuery.filter(b => b.bookCurrentPage || b.bookPercentRead).length}`);
    console.log(`  - Items marked as watched: ${customOrderBooksQuery.filter(b => b.isWatched).length}`);

    console.log('\n📖 HistoryBook Analysis:');
    console.log(`  - Total history books: ${historyBooksQuery.length}`);
    console.log(`  - Books with chapters: ${historyBooksQuery.filter(b => b.chapters.length > 0).length}`);
    console.log(`  - Total chapters: ${historyBooksQuery.reduce((sum, b) => sum + b.chapters.length, 0)}`);
    console.log(`  - Total sections: ${historyBooksQuery.reduce((sum, b) => sum + b.chapters.reduce((chSum, ch) => chSum + ch.sections.length, 0), 0)}`);
    console.log(`  - Books with user reads: ${historyBooksQuery.filter(b => b.user_book_reads).length}`);

    // Store analysis for later use
    this.analysisData = {
      customOrderBooks: customOrderBooksQuery,
      historyBooks: historyBooksQuery
    };

    console.log('✅ Data analysis completed\n');
  }

  /**
   * Check for potential migration issues
   */
  async checkForIssues() {
    console.log('⚠️  Checking for potential issues...');

    const issues = [];
    const warnings = [];

    // Check for duplicate books by ISBN
    const isbnGroups = new Map();
    this.analysisData.customOrderBooks.forEach(book => {
      if (book.bookIsbn) {
        if (!isbnGroups.has(book.bookIsbn)) {
          isbnGroups.set(book.bookIsbn, []);
        }
        isbnGroups.get(book.bookIsbn).push(book);
      }
    });

    const duplicateIsbns = Array.from(isbnGroups.entries()).filter(([isbn, books]) => books.length > 1);
    if (duplicateIsbns.length > 0) {
      warnings.push(`Found ${duplicateIsbns.length} duplicate ISBNs in CustomOrderItems`);
      duplicateIsbns.forEach(([isbn, books]) => {
        console.log(`    📖 ISBN ${isbn}: ${books.length} books (IDs: ${books.map(b => b.id).join(', ')})`);
      });
    }

    // Check for books without titles
    const booksWithoutTitles = this.analysisData.customOrderBooks.filter(b => !b.bookTitle);
    if (booksWithoutTitles.length > 0) {
      warnings.push(`Found ${booksWithoutTitles.length} CustomOrderItems with book data but no title`);
    }

    // Check for HistoryBooks without chapters
    const historyBooksWithoutChapters = this.analysisData.historyBooks.filter(b => b.chapters.length === 0);
    if (historyBooksWithoutChapters.length > 0) {
      warnings.push(`Found ${historyBooksWithoutChapters.length} HistoryBooks without chapters`);
    }

    // Report findings
    if (issues.length > 0) {
      console.log('❌ Critical Issues Found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      throw new Error('Critical issues must be resolved before migration');
    }

    if (warnings.length > 0) {
      console.log('⚠️  Warnings (migration can proceed):');
      warnings.forEach(warning => console.log(`  - ${warning}`));
    } else {
      console.log('✅ No issues detected');
    }

    console.log('✅ Issue check completed\n');
  }

  /**
   * Create backup of critical data
   */
  async createBackup() {
    console.log('💾 Creating backup of existing data...');

    // Ensure backup directory exists
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's ok
    }

    const backupFile = path.join(this.backupDir, `books-migration-backup-${this.timestamp}.json`);

    const backupData = {
      timestamp: new Date().toISOString(),
      customOrderItems: this.analysisData.customOrderBooks,
      historyBooks: this.analysisData.historyBooks,
      metadata: {
        totalCustomOrderBooks: this.analysisData.customOrderBooks.length,
        totalHistoryBooks: this.analysisData.historyBooks.length,
        migrationVersion: '1.0.0'
      }
    };

    try {
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      console.log(`✅ Backup created: ${backupFile}`);
      console.log(`📦 Backup size: ${(await fs.stat(backupFile)).size} bytes`);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }

    console.log('✅ Backup creation completed\n');
  }

  /**
   * Provide final recommendations
   */
  provideRecommendations() {
    console.log('💡 Migration Recommendations:');
    console.log('=============================');
    
    if (this.analysisData.customOrderBooks.length > 0) {
      console.log(`📚 ${this.analysisData.customOrderBooks.length} CustomOrderItem books will be migrated`);
    }
    
    if (this.analysisData.historyBooks.length > 0) {
      console.log(`📖 ${this.analysisData.historyBooks.length} HistoryBooks will be migrated`);
    }

    console.log('\n🔧 Next Steps:');
    console.log('  1. Review the analysis above for any concerns');
    console.log('  2. Ensure you have a recent database backup');
    console.log('  3. Run the migration during low-usage period');
    console.log('  4. Monitor the migration process for errors');
    console.log('  5. Test the application thoroughly after migration');

    console.log('\n🚀 To run the migration:');
    console.log('  node server/migrations/books-migration.js');

    console.log('\n🔄 If rollback is needed:');
    console.log('  node server/migrations/books-migration-rollback.js');
  }
}

/**
 * Main preparation execution
 */
async function runBooksPreparation() {
  const prepService = new BooksMigrationPrepService();
  
  try {
    await prepService.runPreparation();
  } catch (error) {
    console.error('\n💥 Preparation failed:', error.message);
    console.log('🔧 Resolve the issues above before proceeding with migration');
    process.exit(1);
  }
}

// Run preparation if called directly
if (require.main === module) {
  runBooksPreparation();
}

module.exports = { BooksMigrationPrepService, runBooksPreparation };