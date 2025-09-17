const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReadStatus() {
  console.log('=== Checking Read Status in Unified Books ===');
  
  const books = await prisma.book.findMany({
    include: {
      chapters: {
        include: {
          sections: true
        }
      }
    }
  });
  
  console.log(`Found ${books.length} books`);
  
  for (const book of books) {
    console.log(`\nBook: ${book.title}`);
    console.log(`  - isCompleted: ${book.isCompleted}`);
    console.log(`  - Chapters: ${book.chapters.length}`);
    
    for (const chapter of book.chapters) {
      console.log(`    Chapter: ${chapter.title}`);
      console.log(`      - isCompleted: ${chapter.isCompleted}`);
      console.log(`      - Sections: ${chapter.sections.length}`);
      
      for (const section of chapter.sections) {
        console.log(`        Section: ${section.title} - isCompleted: ${section.isCompleted}`);
      }
    }
  }
  
  await prisma.$disconnect();
}

checkReadStatus().catch(console.error);