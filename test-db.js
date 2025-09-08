const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing CustomPlaylist model...');
    const customPlaylists = await prisma.customPlaylist.findMany();
    console.log('CustomPlaylist count:', customPlaylists.length);
    
    console.log('Testing database schema...');
    const result = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%playlist%';`;
    console.log('Playlist tables:', result);
    
  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
