const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserReads() {
  console.log('=== USER BOOK READS ===');
  const bookReads = await prisma.user_book_reads.findMany();
  console.log('Total user_book_reads:', bookReads.length);
  console.log('Sample records:', bookReads.slice(0, 3));
  
  console.log('\n=== USER CHAPTER READS ===');
  const chapterReads = await prisma.user_chapter_reads.findMany();
  console.log('Total user_chapter_reads:', chapterReads.length);
  console.log('Sample records:', chapterReads.slice(0, 3));
  
  console.log('\n=== USER SECTION READS ===');
  const sectionReads = await prisma.user_section_reads.findMany();
  console.log('Total user_section_reads:', sectionReads.length);
  console.log('Sample records:', sectionReads.slice(0, 3));

  // Check specifically for read=true records
  console.log('\n=== READ STATUS BREAKDOWN ===');
  const bookReadsTrue = await prisma.user_book_reads.findMany({ where: { read: true } });
  const chapterReadsTrue = await prisma.user_chapter_reads.findMany({ where: { read: true } });
  const sectionReadsTrue = await prisma.user_section_reads.findMany({ where: { read: true } });
  
  console.log('Books marked as read:', bookReadsTrue.length);
  console.log('Chapters marked as read:', chapterReadsTrue.length);
  console.log('Sections marked as read:', sectionReadsTrue.length);
  
  if (bookReadsTrue.length > 0) {
    console.log('Sample read books:', bookReadsTrue.slice(0, 3));
  }
  
  await prisma.$disconnect();
}

checkUserReads().catch(console.error);