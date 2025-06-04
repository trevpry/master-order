const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkShortStories() {
  try {
    const stories = await prisma.customOrderItem.findMany({ 
      where: { mediaType: 'shortstory' } 
    });
    console.log('Short stories found:', stories.length);
    stories.forEach(s => console.log(' -', s.storyTitle || s.title));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkShortStories();
