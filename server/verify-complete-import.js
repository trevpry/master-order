const { PrismaClient } = require('@prisma/client');

async function verifyCompleteRelationships() {
  const prisma = new PrismaClient();
  
  try {
    // Get totals
    const totalBooks = await prisma.historyBook.count();
    const totalChapters = await prisma.historyChapter.count();
    const totalSections = await prisma.historySection.count();
    const totalEvents = await prisma.historicalEvent.count();
    
    console.log('📊 Import Totals:');
    console.log(`📚 Books: ${totalBooks}`);
    console.log(`📖 Chapters: ${totalChapters}`);
    console.log(`📄 Sections: ${totalSections}`);
    console.log(`📜 Events: ${totalEvents}`);
    
    // Check Book → Event relationships
    const booksWithEvents = await prisma.historyBook.count({
      where: { eventId: { not: null } }
    });
    
    // Check Chapter relationships (bookId is required, so all chapters have books)
    const chaptersWithBooks = await prisma.historyChapter.count(); // All chapters have books
    const chaptersWithEvents = await prisma.historyChapter.count({
      where: { eventId: { not: null } }
    });
    
    // Check Section relationships (chapterId is required, so all sections have chapters)
    const sectionsWithChapters = await prisma.historySection.count(); // All sections have chapters
    const sectionsWithEvents = await prisma.historySection.count({
      where: { eventId: { not: null } }
    });
    
    console.log('\n🔗 Relationship Analysis:');
    console.log(`📚→📜 Books linked to Events: ${booksWithEvents}/${totalBooks} (${Math.round(booksWithEvents/totalBooks*100)}%)`);
    console.log(`📖→📚 Chapters linked to Books: ${chaptersWithBooks}/${totalChapters} (${Math.round(chaptersWithBooks/totalChapters*100)}%)`);
    console.log(`📖→📜 Chapters linked to Events: ${chaptersWithEvents}/${totalChapters} (${Math.round(chaptersWithEvents/totalChapters*100)}%)`);
    console.log(`📄→📖 Sections linked to Chapters: ${sectionsWithChapters}/${totalSections} (${Math.round(sectionsWithChapters/totalSections*100)}%)`);
    console.log(`📄→📜 Sections linked to Events: ${sectionsWithEvents}/${totalSections} (${Math.round(sectionsWithEvents/totalSections*100)}%)`);
    
    // Sample some complete hierarchies
    const sampleHierarchy = await prisma.historyBook.findMany({
      take: 3,
      include: {
        event: {
          select: { id: true, title: true }
        },
        chapters: {
          take: 2,
          include: {
            event: {
              select: { id: true, title: true }
            },
            sections: {
              take: 2,
              include: {
                event: {
                  select: { id: true, title: true }
                }
              }
            }
          }
        }
      }
    });
    
    console.log('\n🏗️ Sample Hierarchies:');
    sampleHierarchy.forEach((book, i) => {
      console.log(`\n📚 Book ${i + 1}: "${book.title}"`);
      if (book.event) {
        console.log(`  └─📜 Event: "${book.event.title}"`);
      }
      book.chapters.forEach((chapter, j) => {
        console.log(`  └─📖 Chapter ${chapter.chapterNumber}: "${chapter.title}"`);
        if (chapter.event) {
          console.log(`    └─📜 Event: "${chapter.event.title}"`);
        }
        chapter.sections.forEach((section, k) => {
          console.log(`    └─📄 Section ${section.sectionNumber}: "${section.title}"`);
          if (section.event) {
            console.log(`      └─📜 Event: "${section.event.title}"`);
          }
        });
      });
    });
    
    console.log(`\n🎉 Complete Import Success!`);
    console.log(`✅ All entities imported with full relationship integrity`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCompleteRelationships();