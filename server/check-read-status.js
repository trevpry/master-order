const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReadStructure() {
  console.log('=== CHECKING READ STATUS STRUCTURE ===');
  
  try {
    // Check if books have read field
    const sampleBook = await prisma.historyBook.findFirst();
    console.log('Sample book fields:', Object.keys(sampleBook || {}));
    
    // Check user book reads
    const bookReads = await prisma.user_book_reads.findMany({
      take: 3
    });
    console.log('Book reads sample:', bookReads);
    
    // Check user chapter reads  
    const chapterReads = await prisma.user_chapter_reads.findMany({
      take: 3
    });
    console.log('Chapter reads sample:', chapterReads);
    
    // Check user section reads
    const sectionReads = await prisma.user_section_reads.findMany({
      take: 3
    });
    console.log('Section reads sample:', sectionReads);
    
    // Check total counts
    const bookReadCount = await prisma.user_book_reads.count({ where: { read: true } });
    const chapterReadCount = await prisma.user_chapter_reads.count({ where: { read: true } });
    const sectionReadCount = await prisma.user_section_reads.count({ where: { read: true } });
    
    console.log('\n=== READ STATUS COUNTS ===');
    console.log(`Books marked as read: ${bookReadCount}`);
    console.log(`Chapters marked as read: ${chapterReadCount}`);
    console.log(`Sections marked as read: ${sectionReadCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReadStructure();