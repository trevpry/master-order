const { PrismaClient } = require('@prisma/client');

/**
 * Read Status Migration Fix
 * Fixes the missing read status migration from History Plus to unified Books system.
 * Creates proper completion records for chapters and sections that were marked as read.
 */
class ReadStatusMigrationFix {
  constructor() {
    this.prisma = new PrismaClient();
    this.stats = {
      booksProcessed: 0,
      chaptersProcessed: 0,
      sectionsProcessed: 0,
      bookCompletionsCreated: 0,
      chapterCompletionsCreated: 0,
      sectionCompletionsCreated: 0,
      errors: []
    };
  }

  async runFix() {
    console.log('🔧 Starting Read Status Migration Fix...');
    console.log('📋 This will migrate read status from History Plus to completion records\n');

    try {
      // Fix book read status
      await this.fixBookReadStatus();
      
      // Fix chapter read status  
      await this.fixChapterReadStatus();
      
      // Fix section read status
      await this.fixSectionReadStatus();
      
      // Validate the fix
      await this.validateFix();
      
      console.log('\n🎉 Read Status Migration Fix completed successfully!');
      this.printStats();
      
    } catch (error) {
      console.error('❌ Read Status Migration Fix failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async fixBookReadStatus() {
    console.log('📚 Fixing book read status...');
    
    // Get books marked as read in History Plus
    const readBooks = await this.prisma.user_book_reads.findMany({
      where: { read: true },
      include: { book: true }
    });
    
    console.log(`Found ${readBooks.length} books marked as read in History Plus`);
    
    for (const readBook of readBooks) {
      try {
        // Find the corresponding unified book
        const unifiedBook = await this.prisma.book.findFirst({
          where: {
            OR: [
              { title: readBook.book.title },
              { isbn: readBook.book.isbn }
            ]
          }
        });
        
        if (unifiedBook) {
          // Check if completion record already exists
          const existingCompletion = await this.prisma.bookCompletion.findFirst({
            where: { bookId: unifiedBook.id }
          });
          
          if (!existingCompletion) {
            await this.prisma.bookCompletion.create({
              data: {
                bookId: unifiedBook.id,
                isCompleted: true,
                completedAt: readBook.readAt || readBook.updatedAt
              }
            });
            this.stats.bookCompletionsCreated++;
            console.log(`  ✅ Created book completion for "${unifiedBook.title}"`);
          } else {
            // Update existing completion if not already completed
            if (!existingCompletion.isCompleted) {
              await this.prisma.bookCompletion.update({
                where: { id: existingCompletion.id },
                data: {
                  isCompleted: true,
                  completedAt: readBook.readAt || readBook.updatedAt
                }
              });
              console.log(`  ✅ Updated book completion for "${unifiedBook.title}"`);
            }
          }
        } else {
          console.log(`  ⚠️  Could not find unified book for "${readBook.book.title}"`);
        }
        
        this.stats.booksProcessed++;
        
      } catch (error) {
        const errorMsg = `Failed to fix book read status for ${readBook.book.title}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }
  }

  async fixChapterReadStatus() {
    console.log('\n📖 Fixing chapter read status...');
    
    // Get chapters marked as read in History Plus
    const readChapters = await this.prisma.user_chapter_reads.findMany({
      where: { read: true },
      include: {
        chapter: {
          include: { book: true }
        }
      }
    });
    
    console.log(`Found ${readChapters.length} chapters marked as read in History Plus`);
    
    for (const readChapter of readChapters) {
      try {
        // Find the corresponding unified book first
        const unifiedBook = await this.prisma.book.findFirst({
          where: {
            OR: [
              { title: readChapter.chapter.book.title },
              { isbn: readChapter.chapter.book.isbn }
            ]
          }
        });
        
        if (unifiedBook) {
          // Find the corresponding unified chapter
          const unifiedChapter = await this.prisma.bookChapter.findFirst({
            where: {
              bookId: unifiedBook.id,
              title: readChapter.chapter.title
            }
          });
          
          if (unifiedChapter) {
            // Check if completion record already exists
            const existingCompletion = await this.prisma.chapterCompletion.findFirst({
              where: { chapterId: unifiedChapter.id }
            });
            
            if (!existingCompletion) {
              await this.prisma.chapterCompletion.create({
                data: {
                  chapterId: unifiedChapter.id,
                  isCompleted: true,
                  completedAt: readChapter.readAt || readChapter.updatedAt
                }
              });
              this.stats.chapterCompletionsCreated++;
              console.log(`  ✅ Created chapter completion for "${unifiedChapter.title}" in "${unifiedBook.title}"`);
            } else {
              // Update existing completion if not already completed
              if (!existingCompletion.isCompleted) {
                await this.prisma.chapterCompletion.update({
                  where: { id: existingCompletion.id },
                  data: {
                    isCompleted: true,
                    completedAt: readChapter.readAt || readChapter.updatedAt
                  }
                });
                console.log(`  ✅ Updated chapter completion for "${unifiedChapter.title}"`);
              }
            }
          } else {
            console.log(`  ⚠️  Could not find unified chapter "${readChapter.chapter.title}" in "${unifiedBook.title}"`);
          }
        } else {
          console.log(`  ⚠️  Could not find unified book for "${readChapter.chapter.book.title}"`);
        }
        
        this.stats.chaptersProcessed++;
        
      } catch (error) {
        const errorMsg = `Failed to fix chapter read status for ${readChapter.chapter.title}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }
  }

  async fixSectionReadStatus() {
    console.log('\n📄 Fixing section read status...');
    
    // Get sections marked as read in History Plus
    const readSections = await this.prisma.user_section_reads.findMany({
      where: { read: true },
      include: {
        section: {
          include: {
            chapter: {
              include: { book: true }
            }
          }
        }
      }
    });
    
    console.log(`Found ${readSections.length} sections marked as read in History Plus`);
    
    for (const readSection of readSections) {
      try {
        // Find the corresponding unified book first
        const unifiedBook = await this.prisma.book.findFirst({
          where: {
            OR: [
              { title: readSection.section.chapter.book.title },
              { isbn: readSection.section.chapter.book.isbn }
            ]
          }
        });
        
        if (unifiedBook) {
          // Find the corresponding unified chapter
          const unifiedChapter = await this.prisma.bookChapter.findFirst({
            where: {
              bookId: unifiedBook.id,
              title: readSection.section.chapter.title
            }
          });
          
          if (unifiedChapter) {
            // Find the corresponding unified section
            const unifiedSection = await this.prisma.bookSection.findFirst({
              where: {
                chapterId: unifiedChapter.id,
                title: readSection.section.title
              }
            });
            
            if (unifiedSection) {
              // Check if completion record already exists
              const existingCompletion = await this.prisma.sectionCompletion.findFirst({
                where: { sectionId: unifiedSection.id }
              });
              
              if (!existingCompletion) {
                await this.prisma.sectionCompletion.create({
                  data: {
                    sectionId: unifiedSection.id,
                    isCompleted: true,
                    completedAt: readSection.readAt || readSection.updatedAt
                  }
                });
                this.stats.sectionCompletionsCreated++;
                console.log(`  ✅ Created section completion for "${unifiedSection.title}" in "${unifiedChapter.title}" > "${unifiedBook.title}"`);
              } else {
                // Update existing completion if not already completed
                if (!existingCompletion.isCompleted) {
                  await this.prisma.sectionCompletion.update({
                    where: { id: existingCompletion.id },
                    data: {
                      isCompleted: true,
                      completedAt: readSection.readAt || readSection.updatedAt
                    }
                  });
                  console.log(`  ✅ Updated section completion for "${unifiedSection.title}"`);
                }
              }
            } else {
              console.log(`  ⚠️  Could not find unified section "${readSection.section.title}" in "${unifiedChapter.title}"`);
            }
          } else {
            console.log(`  ⚠️  Could not find unified chapter "${readSection.section.chapter.title}" in "${unifiedBook.title}"`);
          }
        } else {
          console.log(`  ⚠️  Could not find unified book for "${readSection.section.chapter.book.title}"`);
        }
        
        this.stats.sectionsProcessed++;
        
      } catch (error) {
        const errorMsg = `Failed to fix section read status for ${readSection.section.title}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }
  }

  async validateFix() {
    console.log('\n✅ Validating read status migration fix...');
    
    const bookCompletions = await this.prisma.bookCompletion.count({
      where: { isCompleted: true }
    });
    
    const chapterCompletions = await this.prisma.chapterCompletion.count({
      where: { isCompleted: true }
    });
    
    const sectionCompletions = await this.prisma.sectionCompletion.count({
      where: { isCompleted: true }
    });
    
    console.log(`📊 Current completion counts:`);
    console.log(`   - Books completed: ${bookCompletions}`);
    console.log(`   - Chapters completed: ${chapterCompletions}`);
    console.log(`   - Sections completed: ${sectionCompletions}`);
  }

  printStats() {
    console.log('\n📊 Read Status Migration Fix Statistics:');
    console.log(`   📚 Books processed: ${this.stats.booksProcessed}`);
    console.log(`   📖 Chapters processed: ${this.stats.chaptersProcessed}`);
    console.log(`   📄 Sections processed: ${this.stats.sectionsProcessed}`);
    console.log(`   ✅ Book completions created: ${this.stats.bookCompletionsCreated}`);
    console.log(`   ✅ Chapter completions created: ${this.stats.chapterCompletionsCreated}`);
    console.log(`   ✅ Section completions created: ${this.stats.sectionCompletionsCreated}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`   ❌ Errors encountered: ${this.stats.errors.length}`);
      this.stats.errors.forEach(error => console.log(`      - ${error}`));
    }
  }
}

// Run the fix if called directly
if (require.main === module) {
  const migrationFix = new ReadStatusMigrationFix();
  migrationFix.runFix().catch(console.error);
}

module.exports = ReadStatusMigrationFix;