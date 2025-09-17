const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHistoryReadStatus() {
  console.log('=== Checking History Plus Read Status ===');
  
  // Check BookRead records
  const bookReads = await prisma.user_book_reads.findMany({
    where: { read: true },
    include: {
      book: true
    }
  });
  
  console.log(`\nBooks marked as read in History Plus: ${bookReads.length}`);
  for (const bookRead of bookReads) {
    console.log(`  - "${bookRead.book.title}" (Book ID: ${bookRead.bookId})`);
  }
  
  // Check ChapterRead records
  const chapterReads = await prisma.user_chapter_reads.findMany({
    where: { read: true },
    include: {
      chapter: {
        include: {
          book: true
        }
      }
    }
  });
  
  console.log(`\nChapters marked as read in History Plus: ${chapterReads.length}`);
  for (const chapterRead of chapterReads) {
    console.log(`  - "${chapterRead.chapter.title}" from "${chapterRead.chapter.book.title}"`);
  }
  
  // Check SectionRead records
  const sectionReads = await prisma.user_section_reads.findMany({
    where: { read: true },
    include: {
      section: {
        include: {
          chapter: {
            include: {
              book: true
            }
          }
        }
      }
    }
  });
  
  console.log(`\nSections marked as read in History Plus: ${sectionReads.length}`);
  for (const sectionRead of sectionReads) {
    console.log(`  - "${sectionRead.section.title}" from "${sectionRead.section.chapter.book.title}" > "${sectionRead.section.chapter.title}"`);
  }
  
  // Now check unified books to compare
  console.log('\n=== Checking Unified Books Read Status ===');
  
  const unifiedBooks = await prisma.book.findMany({
    where: { isCompleted: true }
  });
  
  console.log(`\nBooks marked as completed in unified system: ${unifiedBooks.length}`);
  for (const book of unifiedBooks) {
    console.log(`  - "${book.title}" (ID: ${book.id})`);
  }
  
  const unifiedChapters = await prisma.bookChapter.findMany({
    where: { isCompleted: true },
    include: { book: true }
  });
  
  console.log(`\nChapters marked as completed in unified system: ${unifiedChapters.length}`);
  for (const chapter of unifiedChapters) {
    console.log(`  - "${chapter.title}" from "${chapter.book.title}"`);
  }
  
  const unifiedSections = await prisma.bookSection.findMany({
    where: { isCompleted: true },
    include: { 
      chapter: { 
        include: { book: true } 
      } 
    }
  });
  
  console.log(`\nSections marked as completed in unified system: ${unifiedSections.length}`);
  for (const section of unifiedSections) {
    console.log(`  - "${section.title}" from "${section.chapter.book.title}" > "${section.chapter.title}"`);
  }
  
  await prisma.$disconnect();
}

checkHistoryReadStatus().catch(console.error);