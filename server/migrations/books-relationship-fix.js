const { PrismaClient } = require('@prisma/client');

/**
 * Books Relationship Fix
 * Fixes the missing relationships from the initial migration:
 * 1. Creates HistoryBookLink records to connect books with historical events
 * 2. Ensures CustomOrderItems properly reference unified books
 */
class BooksRelationshipFix {
  constructor() {
    this.prisma = new PrismaClient();
    this.fixStats = {
      historyLinksCreated: 0,
      customOrderItemsUpdated: 0,
      errors: []
    };
  }

  /**
   * Run the relationship fixes
   */
  async runFix() {
    console.log('🔧 Starting Books Relationship Fix...');
    console.log('📋 This will fix missing relationships in the unified Books system\n');

    try {
      // Phase 1: Fix HistoryBook to Book relationships
      console.log('🔗 Phase 1: Creating HistoryBookLink records...');
      await this.fixHistoryBookLinks();

      // Phase 2: Ensure CustomOrderItems point to unified books
      console.log('📚 Phase 2: Updating CustomOrderItem references...');
      await this.fixCustomOrderItemReferences();

      // Phase 3: Validate the fixes
      console.log('✅ Phase 3: Validating fixes...');
      await this.validateFixes();

      console.log('\n🎉 Relationship fixes completed successfully!');
      console.log('📊 Fix Statistics:');
      console.log(`  - History book links created: ${this.fixStats.historyLinksCreated}`);
      console.log(`  - Custom order items updated: ${this.fixStats.customOrderItemsUpdated}`);
      
      if (this.fixStats.errors.length > 0) {
        console.log(`  - Errors encountered: ${this.fixStats.errors.length}`);
        this.fixStats.errors.forEach((error, index) => {
          console.log(`    ${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ Relationship fix failed with error:', error.message);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Create HistoryBookLink records for books that came from HistoryBooks
   * Also link chapters and sections to their historical events
   */
  async fixHistoryBookLinks() {
    // Find all HistoryBooks and their corresponding unified Books
    const historyBooks = await this.prisma.historyBook.findMany({
      include: {
        event: true,
        chapters: {
          include: {
            event: true,
            sections: {
              include: {
                event: true
              }
            }
          }
        }
      }
    });

    console.log(`📖 Found ${historyBooks.length} HistoryBooks to link...`);

    for (const historyBook of historyBooks) {
      try {
        // Find the corresponding unified book by title match
        const unifiedBook = await this.prisma.book.findFirst({
          where: {
            title: historyBook.title
          },
          include: {
            chapters: {
              include: {
                sections: true
              }
            }
          }
        });

        if (!unifiedBook) {
          const errorMsg = `No unified book found for HistoryBook "${historyBook.title}"`;
          console.warn(`⚠️ ${errorMsg}`);
          this.fixStats.errors.push(errorMsg);
          continue;
        }

        // 1. Create book-level link if event exists
        if (historyBook.event) {
          const existingBookLink = await this.prisma.historyBookLink.findUnique({
            where: {
              bookId_eventId: {
                bookId: unifiedBook.id,
                eventId: historyBook.event.id
              }
            }
          });

          if (!existingBookLink) {
            await this.prisma.historyBookLink.create({
              data: {
                bookId: unifiedBook.id,
                eventId: historyBook.event.id
              }
            });
            this.fixStats.historyLinksCreated++;
            console.log(`� Created book link: "${unifiedBook.title}" -> "${historyBook.event.title}"`);
          }
        }

        // 2. Link chapters to their events
        for (const historyChapter of historyBook.chapters) {
          if (historyChapter.event) {
            // Find corresponding unified chapter
            const unifiedChapter = unifiedBook.chapters.find(
              ch => ch.chapterNumber === historyChapter.chapterNumber
            );

            if (unifiedChapter) {
              // Update chapter with eventId
              await this.prisma.bookChapter.update({
                where: { id: unifiedChapter.id },
                data: { eventId: historyChapter.event.id }
              });
              console.log(`📖 Linked chapter "${historyChapter.title}" to event "${historyChapter.event.title}"`);
            }
          }

          // 3. Link sections to their events
          for (const historySection of historyChapter.sections) {
            if (historySection.event) {
              // Find corresponding unified section
              const unifiedChapter = unifiedBook.chapters.find(
                ch => ch.chapterNumber === historyChapter.chapterNumber
              );
              
              if (unifiedChapter) {
                const unifiedSection = unifiedChapter.sections.find(
                  sec => sec.sectionNumber === historySection.sectionNumber
                );

                if (unifiedSection) {
                  // Update section with eventId
                  await this.prisma.bookSection.update({
                    where: { id: unifiedSection.id },
                    data: { eventId: historySection.event.id }
                  });
                  console.log(`📝 Linked section "${historySection.title}" to event "${historySection.event.title}"`);
                }
              }
            }
          }
        }

      } catch (error) {
        const errorMsg = `Failed to create links for HistoryBook ${historyBook.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.fixStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ HistoryBookLink creation completed. Created ${this.fixStats.historyLinksCreated} links\n`);
  }

  /**
   * Ensure CustomOrderItems properly reference unified books
   */
  async fixCustomOrderItemReferences() {
    // Find CustomOrderItems with book data but no bookId reference
    const customOrderBooks = await this.prisma.customOrderItem.findMany({
      where: {
        mediaType: 'book',
        bookId: null,
        bookTitle: { not: null }
      }
    });

    console.log(`📚 Found ${customOrderBooks.length} CustomOrderItems needing book references...`);

    for (const item of customOrderBooks) {
      try {
        // Find the corresponding unified book by title and author match
        const unifiedBook = await this.prisma.book.findFirst({
          where: {
            title: item.bookTitle,
            author: item.bookAuthor || undefined
          }
        });

        if (!unifiedBook) {
          const errorMsg = `No unified book found for CustomOrderItem "${item.bookTitle}" by ${item.bookAuthor || 'Unknown'}`;
          console.warn(`⚠️ ${errorMsg}`);
          this.fixStats.errors.push(errorMsg);
          continue;
        }

        // Update CustomOrderItem to reference the unified book
        await this.prisma.customOrderItem.update({
          where: { id: item.id },
          data: { bookId: unifiedBook.id }
        });

        this.fixStats.customOrderItemsUpdated++;
        console.log(`📖 Updated CustomOrderItem ${item.id} to reference book "${unifiedBook.title}"`);

      } catch (error) {
        const errorMsg = `Failed to update CustomOrderItem ${item.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        this.fixStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ CustomOrderItem reference update completed. Updated ${this.fixStats.customOrderItemsUpdated} items\n`);
  }

  /**
   * Validate the fixes were applied correctly
   */
  async validateFixes() {
    // Count HistoryBookLinks
    const historyLinkCount = await this.prisma.historyBookLink.count();
    console.log(`📊 Total HistoryBookLinks: ${historyLinkCount}`);

    // Count CustomOrderItems with book references
    const customOrderWithBooks = await this.prisma.customOrderItem.count({
      where: {
        mediaType: 'book',
        bookId: { not: null }
      }
    });
    console.log(`📊 CustomOrderItems with book references: ${customOrderWithBooks}`);

    // Count books with history links
    const booksWithHistoryLinks = await this.prisma.book.count({
      where: {
        historyBookLinks: {
          some: {}
        }
      }
    });
    console.log(`📊 Books linked to historical events: ${booksWithHistoryLinks}`);

    // Count chapters linked to events
    const chaptersWithEvents = await this.prisma.bookChapter.count({
      where: {
        eventId: { not: null }
      }
    });
    console.log(`📊 Chapters linked to historical events: ${chaptersWithEvents}`);

    // Count sections linked to events
    const sectionsWithEvents = await this.prisma.bookSection.count({
      where: {
        eventId: { not: null }
      }
    });
    console.log(`📊 Sections linked to historical events: ${sectionsWithEvents}`);

    console.log('✅ Validation completed\n');
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  const fix = new BooksRelationshipFix();
  fix.runFix()
    .then(() => {
      console.log('🎉 Books relationship fix completed successfully!');
      console.log('💡 Books are now properly linked to History Plus events and Custom Orders');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Books relationship fix failed:', error);
      process.exit(1);
    });
}

module.exports = BooksRelationshipFix;