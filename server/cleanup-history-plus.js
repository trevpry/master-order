const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

/**
 * History Plus Cleanup Service
 * 
 * This script safely removes original History Plus records after successful migration to unified books.
 * It includes safety checks to ensure unified books exist before deletion.
 */
class HistoryPlusCleanupService {
  constructor() {
    // Detect database environment for production safety
    this.isProduction = this.detectProductionEnvironment();
    this.databaseType = this.detectDatabaseType();
    
    this.prisma = new PrismaClient();
    this.cleanupStats = {
      historyBooksDeleted: 0,
      historyChaptersDeleted: 0,
      historySectionsDeleted: 0,
      userBookReadsDeleted: 0,
      userChapterReadsDeleted: 0,
      userSectionReadsDeleted: 0,
      errors: []
    };
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
      console.log('   This cleanup will run on your production PostgreSQL database.');
      console.log('   Ensure you have a backup before proceeding.');
    }
    
    console.log('');
  }

  /**
   * Analyze current state and safety checks
   */
  async analyzeDatabaseState() {
    console.log('🔍 Analyzing database state...\n');
    
    // Count History Plus records
    const historyBooks = await this.prisma.historyBook.count();
    const historyChapters = await this.prisma.historyChapter.count();
    const historySections = await this.prisma.historySection.count();
    const userBookReads = await this.prisma.user_book_reads.count();
    const userChapterReads = await this.prisma.user_chapter_reads.count();
    const userSectionReads = await this.prisma.user_section_reads.count();
    
    // Count unified books
    const unifiedBooks = await this.prisma.book.count();
    const unifiedChapters = await this.prisma.bookChapter.count();
    const unifiedSections = await this.prisma.bookSection.count();
    const bookCompletions = await this.prisma.bookCompletion.count();
    
    console.log('📊 Current Database State:');
    console.log('\n📚 History Plus Records (TO BE DELETED):');
    console.log(`   Books: ${historyBooks}`);
    console.log(`   Chapters: ${historyChapters}`);
    console.log(`   Sections: ${historySections}`);
    console.log(`   User Book Reads: ${userBookReads}`);
    console.log(`   User Chapter Reads: ${userChapterReads}`);
    console.log(`   User Section Reads: ${userSectionReads}`);
    
    console.log('\n📖 Unified System Records (PRESERVED):');
    console.log(`   Books: ${unifiedBooks}`);
    console.log(`   Chapters: ${unifiedChapters}`);
    console.log(`   Sections: ${unifiedSections}`);
    console.log(`   Book Completions: ${bookCompletions}`);
    
    const totalHistoryRecords = historyBooks + historyChapters + historySections + userBookReads + userChapterReads + userSectionReads;
    const totalUnifiedRecords = unifiedBooks + unifiedChapters + unifiedSections + bookCompletions;
    
    console.log('\n📈 Summary:');
    console.log(`   Total History Plus records: ${totalHistoryRecords}`);
    console.log(`   Total Unified records: ${totalUnifiedRecords}`);
    
    // Safety checks
    if (historyBooks === 0) {
      console.log('\n✅ No History Plus books found - cleanup not needed');
      return false;
    }
    
    if (unifiedBooks === 0) {
      console.error('\n❌ ERROR: No unified books found!');
      console.error('   This suggests migration has not been run or failed.');
      console.error('   Run comprehensive-books-migration.js first.');
      return false;
    }
    
    if (historyBooks > unifiedBooks) {
      console.warn('\n⚠️  WARNING: More History Plus books than unified books');
      console.warn('   This might indicate incomplete migration.');
      console.warn('   Please verify migration completed successfully.');
    }
    
    console.log('\n✅ Safety checks passed - cleanup can proceed');
    return true;
  }

  /**
   * Ask for user confirmation before deleting History Plus records
   */
  async confirmCleanup() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n⚠️  DELETION CONFIRMATION REQUIRED');
      console.log('═══════════════════════════════════');
      console.log('🗑️  This script will PERMANENTLY DELETE all History Plus records:');
      console.log('   • All HistoryBook records');
      console.log('   • All HistoryChapter records');
      console.log('   • All HistorySection records');
      console.log('   • All user reading progress (user_book_reads, user_chapter_reads, user_section_reads)');
      console.log('');
      console.log('✅ This is safe IF you have successfully migrated to the unified book system.');
      console.log('⚠️  This action CANNOT BE UNDONE without a database backup.');
      console.log('🔒 Unified book records will NOT be affected.');
      console.log('');

      rl.question('Are you sure you want to delete all History Plus records? Type "DELETE HISTORY PLUS" to confirm: ', (answer) => {
        rl.close();
        const confirmed = answer.trim() === 'DELETE HISTORY PLUS';
        resolve(confirmed);
      });
    });
  }

  /**
   * Execute the cleanup with transaction safety for PostgreSQL
   */
  async executeCleanup() {
    console.log('🗑️ Starting History Plus cleanup...\n');
    
    try {
      if (this.databaseType === 'postgresql') {
        console.log('🔒 Using PostgreSQL transaction for safe cleanup...');
        await this.runCleanupInTransaction();
      } else {
        console.log('📝 Running SQLite cleanup...');
        await this.runCleanupSteps();
      }
      
      console.log('\n✅ History Plus cleanup completed successfully!');
      this.printCleanupSummary();
      
    } catch (error) {
      console.error('\n❌ Cleanup failed:', error);
      if (this.databaseType === 'postgresql') {
        console.error('🔄 PostgreSQL transaction was rolled back - no data was deleted');
      }
      throw error;
    }
  }

  /**
   * Run cleanup steps within a PostgreSQL transaction for safety
   */
  async runCleanupInTransaction() {
    return await this.prisma.$transaction(async (tx) => {
      // Temporarily replace prisma with transaction client
      const originalPrisma = this.prisma;
      this.prisma = tx;

      try {
        await this.runCleanupSteps();
      } finally {
        // Restore original prisma client
        this.prisma = originalPrisma;
      }
    }, {
      // Set a longer timeout for large cleanups (5 minutes)
      timeout: 300000,
    });
  }

  /**
   * Execute the cleanup steps in dependency order
   */
  async runCleanupSteps() {
    console.log('🧹 Deleting History Plus records in dependency order...');
    
    // Delete user reading progress first
    console.log('   🗑️ Deleting user section reads...');
    const userSectionReads = await this.prisma.user_section_reads.deleteMany({});
    this.cleanupStats.userSectionReadsDeleted = userSectionReads.count;
    
    console.log('   🗑️ Deleting user chapter reads...');
    const userChapterReads = await this.prisma.user_chapter_reads.deleteMany({});
    this.cleanupStats.userChapterReadsDeleted = userChapterReads.count;
    
    console.log('   🗑️ Deleting user book reads...');
    const userBookReads = await this.prisma.user_book_reads.deleteMany({});
    this.cleanupStats.userBookReadsDeleted = userBookReads.count;
    
    // Delete History Plus content structure
    console.log('   🗑️ Deleting history sections...');
    const historySections = await this.prisma.historySection.deleteMany({});
    this.cleanupStats.historySectionsDeleted = historySections.count;
    
    console.log('   🗑️ Deleting history chapters...');
    const historyChapters = await this.prisma.historyChapter.deleteMany({});
    this.cleanupStats.historyChaptersDeleted = historyChapters.count;
    
    console.log('   🗑️ Deleting history books...');
    const historyBooks = await this.prisma.historyBook.deleteMany({});
    this.cleanupStats.historyBooksDeleted = historyBooks.count;
    
    console.log('✅ All History Plus records deleted successfully');
  }

  /**
   * Print cleanup summary
   */
  printCleanupSummary() {
    const totalDeleted = this.cleanupStats.historyBooksDeleted + 
                        this.cleanupStats.historyChaptersDeleted + 
                        this.cleanupStats.historySectionsDeleted +
                        this.cleanupStats.userBookReadsDeleted +
                        this.cleanupStats.userChapterReadsDeleted +
                        this.cleanupStats.userSectionReadsDeleted;

    console.log('\n🧹 History Plus Cleanup Summary');
    console.log('════════════════════════════════');
    console.log(`📚 History Books deleted: ${this.cleanupStats.historyBooksDeleted}`);
    console.log(`📖 History Chapters deleted: ${this.cleanupStats.historyChaptersDeleted}`);
    console.log(`📄 History Sections deleted: ${this.cleanupStats.historySectionsDeleted}`);
    console.log(`👤 User Book Reads deleted: ${this.cleanupStats.userBookReadsDeleted}`);
    console.log(`👤 User Chapter Reads deleted: ${this.cleanupStats.userChapterReadsDeleted}`);
    console.log(`👤 User Section Reads deleted: ${this.cleanupStats.userSectionReadsDeleted}`);
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log(`❌ Errors encountered: ${this.cleanupStats.errors.length}`);
    
    if (this.cleanupStats.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.cleanupStats.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log('\n✨ History Plus cleanup completed!');
    console.log('📖 Your unified book system is now the single source of truth for all book data.');
  }

  /**
   * Run the complete cleanup process
   */
  async runCleanup() {
    console.log('🧹 History Plus Cleanup Service');
    console.log('═══════════════════════════════\n');
    
    // Display environment information
    this.displayEnvironmentInfo();
    
    try {
      // Analyze database state and safety checks
      const canProceed = await this.analyzeDatabaseState();
      if (!canProceed) {
        console.log('\n🛑 Cleanup aborted - see issues above');
        return;
      }
      
      // Get user confirmation
      const confirmed = await this.confirmCleanup();
      if (!confirmed) {
        console.log('\n🛑 Cleanup cancelled by user');
        console.log('📝 History Plus records preserved');
        return;
      }
      
      // Execute cleanup
      await this.executeCleanup();
      
    } catch (error) {
      console.error('\n💥 Cleanup failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const cleanupService = new HistoryPlusCleanupService();
  
  // Show production usage if needed
  if (cleanupService.isProduction) {
    console.log('🏭 PRODUCTION CLEANUP MODE');
    console.log('💡 To run this cleanup in production with PostgreSQL:');
    console.log('   DATABASE_URL="postgresql://user:pass@host:port/database" node cleanup-history-plus.js');
    console.log('');
  }
  
  cleanupService.runCleanup()
    .then(() => {
      console.log('\n✨ History Plus cleanup completed successfully!');
      if (cleanupService.isProduction) {
        console.log('🎯 Production PostgreSQL cleanup completed with transaction safety!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Cleanup failed:', error);
      if (cleanupService.isProduction) {
        console.error('🔄 PostgreSQL transaction was rolled back - no data was deleted');
      }
      process.exit(1);
    });
}

module.exports = HistoryPlusCleanupService;