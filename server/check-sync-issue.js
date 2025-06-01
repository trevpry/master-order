const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSyncIssue() {
  try {
    console.log('=== Checking Plex Sync Issue ===\n');
    
    // 1. Check if X Files movie exists in database
    console.log('1. Checking X Files movies in database:');
    const xFilesMovies = await prisma.plexMovie.findMany({
      where: {
        OR: [
          { title: { contains: "X Files" } },
          { title: { contains: "X-Files" } }
        ]
      },
      select: {
        title: true,
        ratingKey: true,
        collections: true,
        lastSyncedAt: true
      }
    });
    
    console.log(`Found ${xFilesMovies.length} X Files movies:`);
    xFilesMovies.forEach(movie => {
      console.log(`- ${movie.title} (${movie.ratingKey})`);
      console.log(`  Collections: ${movie.collections || 'null'}`);
      console.log(`  Last synced: ${movie.lastSyncedAt}`);
    });
    console.log('');
    
    // 2. Check some movies that DO have collections
    console.log('2. Checking movies that have collections:');
    const moviesWithCollections = await prisma.plexMovie.findMany({
      where: {
        collections: {
          not: null
        }
      },
      select: {
        title: true,
        collections: true,
        lastSyncedAt: true
      },
      take: 5
    });
    
    moviesWithCollections.forEach(movie => {
      console.log(`- ${movie.title}`);
      console.log(`  Collections: ${movie.collections}`);
      console.log(`  Last synced: ${movie.lastSyncedAt}`);
    });
    console.log('');
    
    // 3. Check when the last sync was
    console.log('3. Checking sync timing:');
    const lastSyncedMovie = await prisma.plexMovie.findFirst({
      orderBy: { lastSyncedAt: 'desc' },
      select: {
        title: true,
        lastSyncedAt: true
      }
    });
    
    console.log(`Most recently synced movie: ${lastSyncedMovie?.title}`);
    console.log(`Last sync time: ${lastSyncedMovie?.lastSyncedAt}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncIssue();
