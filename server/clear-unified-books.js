const { PrismaClient } = require('@prisma/client');

/**
 * Clear Unified Book Library Script
 * Completely clears all unified Book and related tables for clean migration testing
 * This will also clear any bookId references in CustomOrderItems
 */
class ClearUnifiedBooksService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async clearAll() {
    console.log('🧹 Starting Complete Unified Books Library Cleanup...');
    console.log('⚠️  This will remove ALL unified book data and reset bookId references\n');

    try {
      console.log('📊 Getting current counts before cleanup...');
      const beforeCounts = await this.getCounts();
      console.log('Current unified library contains:');
      console.log(`  - Books: ${beforeCounts.books}`);
      console.log(`  - BookCompletions: ${beforeCounts.bookCompletions}`);
      console.log(`  - BookChapters: ${beforeCounts.bookChapters}`);
      console.log(`  - BookSections: ${beforeCounts.bookSections}`);
      console.log(`  - ChapterCompletions: ${beforeCounts.chapterCompletions}`);
      console.log(`  - SectionCompletions: ${beforeCounts.sectionCompletions}`);
      console.log(`  - HistoryBookLinks: ${beforeCounts.historyBookLinks}`);
      console.log(`  - CustomOrderItems with bookId: ${beforeCounts.customOrderItemsWithBookId}\n`);

      // Clear in dependency order (children first, then parents)
      console.log('🗑️ Step 1: Clearing section completions...');
      await this.prisma.sectionCompletion.deleteMany({});

      console.log('🗑️ Step 2: Clearing chapter completions...');
      await this.prisma.chapterCompletion.deleteMany({});

      console.log('🗑️ Step 3: Clearing book completions...');
      await this.prisma.bookCompletion.deleteMany({});

      console.log('🗑️ Step 4: Clearing book sections...');
      await this.prisma.bookSection.deleteMany({});

      console.log('🗑️ Step 5: Clearing book chapters...');
      await this.prisma.bookChapter.deleteMany({});

      console.log('🗑️ Step 6: Clearing history book links...');
      await this.prisma.historyBookLink.deleteMany({});

      console.log('🗑️ Step 7: Clearing bookId references in CustomOrderItems...');
      await this.prisma.customOrderItem.updateMany({
        where: {
          bookId: { not: null }
        },
        data: {
          bookId: null
        }
      });

      console.log('🗑️ Step 8: Clearing all unified books...');
      await this.prisma.book.deleteMany({});

      console.log('📊 Verifying cleanup...');
      const afterCounts = await this.getCounts();
      console.log('After cleanup:');
      console.log(`  - Books: ${afterCounts.books}`);
      console.log(`  - BookCompletions: ${afterCounts.bookCompletions}`);
      console.log(`  - BookChapters: ${afterCounts.bookChapters}`);
      console.log(`  - BookSections: ${afterCounts.bookSections}`);
      console.log(`  - ChapterCompletions: ${afterCounts.chapterCompletions}`);
      console.log(`  - SectionCompletions: ${afterCounts.sectionCompletions}`);
      console.log(`  - HistoryBookLinks: ${afterCounts.historyBookLinks}`);
      console.log(`  - CustomOrderItems with bookId: ${afterCounts.customOrderItemsWithBookId}\n`);

      const totalCleared = beforeCounts.books + beforeCounts.bookCompletions + 
                          beforeCounts.bookChapters + beforeCounts.bookSections + 
                          beforeCounts.chapterCompletions + beforeCounts.sectionCompletions + 
                          beforeCounts.historyBookLinks;

      console.log(`✅ Cleanup completed successfully!`);
      console.log(`📈 Total records cleared: ${totalCleared}`);
      console.log(`🔗 CustomOrderItem bookId references cleared: ${beforeCounts.customOrderItemsWithBookId}`);
      console.log('🎯 Unified book library is now completely empty and ready for fresh migration\n');

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getCounts() {
    const [
      books,
      bookCompletions,
      bookChapters,
      bookSections,
      chapterCompletions,
      sectionCompletions,
      historyBookLinks,
      customOrderItemsWithBookId
    ] = await Promise.all([
      this.prisma.book.count(),
      this.prisma.bookCompletion.count(),
      this.prisma.bookChapter.count(),
      this.prisma.bookSection.count(),
      this.prisma.chapterCompletion.count(),
      this.prisma.sectionCompletion.count(),
      this.prisma.historyBookLink.count(),
      this.prisma.customOrderItem.count({
        where: { bookId: { not: null } }
      })
    ]);

    return {
      books,
      bookCompletions,
      bookChapters,
      bookSections,
      chapterCompletions,
      sectionCompletions,
      historyBookLinks,
      customOrderItemsWithBookId
    };
  }
}

// Execute if run directly
if (require.main === module) {
  const clearService = new ClearUnifiedBooksService();
  clearService.clearAll()
    .then(() => {
      console.log('✨ Unified book library cleared successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to clear unified book library:', error);
      process.exit(1);
    });
}

module.exports = ClearUnifiedBooksService;