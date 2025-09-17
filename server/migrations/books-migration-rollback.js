const { PrismaClient } = require('@prisma/client');

/**
 * Books Migration Rollback Service
 * Rolls back the unified books migration if needed
 */
class BooksMigrationRollbackService {
  constructor() {
    this.prisma = new PrismaClient();
    this.rollbackStats = {
      customOrderItemsRestored: 0,
      bookReferencesRemoved: 0,
      booksDeleted: 0,
      chaptersDeleted: 0,
      sectionsDeleted: 0,
      errors: []
    };
  }

  /**
   * Run the complete rollback process
   */
  async runRollback() {
    console.log('🔄 Starting Books Migration Rollback...');
    console.log('⚠️  This will undo the unified books migration\n');

    // Confirm rollback
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = await new Promise((resolve) => {
      rl.question('Are you sure you want to rollback the books migration? (yes/no): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });

    if (!confirm) {
      console.log('❌ Rollback cancelled by user');
      return;
    }

    try {
      // Phase 1: Remove book references from CustomOrderItems
      console.log('📚 Phase 1: Removing book references from CustomOrderItems...');
      await this.removeCustomOrderBookReferences();

      // Phase 2: Delete unified book data
      console.log('🗑️  Phase 2: Deleting unified book data...');
      await this.deleteUnifiedBookData();

      // Phase 3: Validate rollback
      console.log('✅ Phase 3: Validating rollback...');
      await this.validateRollback();

      console.log('\n🎉 Rollback completed successfully!');
      console.log('📊 Rollback Statistics:');
      console.log(`  - CustomOrderItems restored: ${this.rollbackStats.customOrderItemsRestored}`);
      console.log(`  - Book references removed: ${this.rollbackStats.bookReferencesRemoved}`);
      console.log(`  - Books deleted: ${this.rollbackStats.booksDeleted}`);
      console.log(`  - Chapters deleted: ${this.rollbackStats.chaptersDeleted}`);
      console.log(`  - Sections deleted: ${this.rollbackStats.sectionsDeleted}`);

      if (this.rollbackStats.errors.length > 0) {
        console.log(`  - Errors encountered: ${this.rollbackStats.errors.length}`);
        console.log('⚠️  Review errors below:');
        this.rollbackStats.errors.forEach((error, index) => {
          console.log(`    ${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ Rollback failed with error:', error.message);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Remove book references from CustomOrderItems
   */
  async removeCustomOrderBookReferences() {
    const customOrderItemsWithBookRefs = await this.prisma.customOrderItem.findMany({
      where: {
        bookId: { not: null }
      }
    });

    console.log(`📚 Removing book references from ${customOrderItemsWithBookRefs.length} CustomOrderItems...`);

    for (const item of customOrderItemsWithBookRefs) {
      try {
        await this.prisma.customOrderItem.update({
          where: { id: item.id },
          data: { bookId: null }
        });

        this.rollbackStats.bookReferencesRemoved++;
      } catch (error) {
        const errorMsg = `Failed to remove book reference from CustomOrderItem ${item.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.rollbackStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Removed ${this.rollbackStats.bookReferencesRemoved} book references`);
  }

  /**
   * Delete all unified book data
   */
  async deleteUnifiedBookData() {
    try {
      // Delete in correct order due to foreign key constraints

      // 1. Delete section completions
      const sectionCompletions = await this.prisma.sectionCompletion.deleteMany();
      console.log(`🗑️  Deleted ${sectionCompletions.count} section completions`);

      // 2. Delete chapter completions
      const chapterCompletions = await this.prisma.chapterCompletion.deleteMany();
      console.log(`🗑️  Deleted ${chapterCompletions.count} chapter completions`);

      // 3. Delete book completions
      const bookCompletions = await this.prisma.bookCompletion.deleteMany();
      console.log(`🗑️  Deleted ${bookCompletions.count} book completions`);

      // 4. Delete sections
      const sections = await this.prisma.bookSection.deleteMany();
      this.rollbackStats.sectionsDeleted = sections.count;
      console.log(`🗑️  Deleted ${sections.count} book sections`);

      // 5. Delete chapters
      const chapters = await this.prisma.bookChapter.deleteMany();
      this.rollbackStats.chaptersDeleted = chapters.count;
      console.log(`🗑️  Deleted ${chapters.count} book chapters`);

      // 6. Delete history book links
      const historyBookLinks = await this.prisma.historyBookLink.deleteMany();
      console.log(`🗑️  Deleted ${historyBookLinks.count} history book links`);

      // 7. Delete books
      const books = await this.prisma.book.deleteMany();
      this.rollbackStats.booksDeleted = books.count;
      console.log(`🗑️  Deleted ${books.count} books`);

    } catch (error) {
      const errorMsg = `Failed to delete unified book data: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      this.rollbackStats.errors.push(errorMsg);
      throw error;
    }
  }

  /**
   * Validate that rollback completed successfully
   */
  async validateRollback() {
    const remainingBooks = await this.prisma.book.count();
    const remainingChapters = await this.prisma.bookChapter.count();
    const remainingBookRefs = await this.prisma.customOrderItem.count({
      where: { bookId: { not: null } }
    });

    console.log(`📊 Rollback Validation:`);
    console.log(`  - Remaining books: ${remainingBooks}`);
    console.log(`  - Remaining chapters: ${remainingChapters}`);
    console.log(`  - Remaining book references: ${remainingBookRefs}`);

    if (remainingBooks > 0 || remainingChapters > 0 || remainingBookRefs > 0) {
      throw new Error('❌ Rollback incomplete - unified book data still exists');
    }

    console.log('✅ Rollback validation passed - all unified book data removed');
  }
}

/**
 * Main rollback execution
 */
async function runBooksRollback() {
  const rollbackService = new BooksMigrationRollbackService();
  
  try {
    await rollbackService.runRollback();
    console.log('\n🎉 Books migration rollback completed successfully!');
    console.log('💡 The system has been restored to pre-migration state');
    console.log('📋 Original book data in CustomOrderItems and HistoryBooks is preserved');
    
  } catch (error) {
    console.error('\n💥 Rollback failed:', error.message);
    console.log('🚨 Manual intervention may be required');
    console.log('📋 Check database state and restore from backup if necessary');
    process.exit(1);
  }
}

// Run rollback if called directly
if (require.main === module) {
  runBooksRollback();
}

module.exports = { BooksMigrationRollbackService, runBooksRollback };