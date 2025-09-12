const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserReads() {
  console.log('=== READ STATUS BREAKDOWN ===');
  const bookReadsTrue = await prisma.user_book_reads.findMany({ where: { read: true } });
  const chapterReadsTrue = await prisma.user_chapter_reads.findMany({ where: { read: true } });
  const sectionReadsTrue = await prisma.user_section_reads.findMany({ where: { read: true } });
  
  console.log('Books marked as read:', bookReadsTrue.length);
  console.log('Chapters marked as read:', chapterReadsTrue.length);
  console.log('Sections marked as read:', sectionReadsTrue.length);
  
  if (chapterReadsTrue.length > 0) {
    console.log('Read chapter ID:', chapterReadsTrue[0].chapterId);
  }
  
  console.log('Read section IDs:', sectionReadsTrue.map(s => s.sectionId));
  
  await prisma.$disconnect();
}

checkUserReads().catch(console.error);