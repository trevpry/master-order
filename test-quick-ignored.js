// Simple test of the ignored collections
console.log('Starting ignored collections test...');

const { PrismaClient } = require('./server/prismaClient');
const prisma = require('./server/prismaClient');

async function quickTest() {
  try {
    console.log('Getting settings...');
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('Settings found:', !!settings);
    if (settings) {
      console.log('ignoredMovieCollections:', settings.ignoredMovieCollections);
      console.log('ignoredTVCollections:', settings.ignoredTVCollections);
    }
    
    console.log('✅ Test complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  }
}

quickTest();
