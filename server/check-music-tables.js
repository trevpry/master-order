const { PrismaClient } = require('@prisma/client');

async function checkMusicTables() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking music-related tables...');
    
    // Check if musicStats table exists
    try {
      const musicStatsCount = await prisma.musicStats.count();
      console.log('✅ musicStats table exists, count:', musicStatsCount);
    } catch (error) {
      console.log('❌ musicStats table error:', error.message);
    }
    
    // Check if plexCollection table exists and has music collections
    try {
      const collectionsCount = await prisma.plexCollection.count();
      console.log('✅ plexCollection table exists, total count:', collectionsCount);
      
      const musicCollections = await prisma.plexCollection.findMany({
        where: {
          plexLibrarySection: {
            type: 'artist'
          }
        },
        include: {
          plexLibrarySection: true
        }
      });
      console.log('✅ Music collections count:', musicCollections.length);
    } catch (error) {
      console.log('❌ plexCollection music query error:', error.message);
    }
    
    // Check what tables exist
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%music%' OR name LIKE '%collection%' OR name LIKE '%library%';`;
    console.log('📋 Relevant tables found:', tables);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMusicTables();
