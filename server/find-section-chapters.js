const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findSectionChapters() {
  const readSectionIds = [1, 2, 3, 5];
  
  for (const sectionId of readSectionIds) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { chapter: true }
    });
    
    if (section) {
      console.log(`Section ${sectionId} -> Chapter ${section.chapter.id} (${section.chapter.title})`);
    } else {
      console.log(`Section ${sectionId} -> Not found`);
    }
  }
  
  await prisma.$disconnect();
}

findSectionChapters().catch(console.error);