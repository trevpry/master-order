const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function findTestContent() {
  try {
    console.log('=== Finding Available Test Content ===\n');
    
    // Look for movies with collections
    const moviesWithCollections = await prisma.plexMovie.findMany({
      where: {
        collections: {
          not: null
        }
      },
      take: 10
    });
    
    console.log('Movies with collections:');
    moviesWithCollections.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`- ${movie.title} (${movie.year}) - Collections: ${collections.join(', ')}`);
    });
    console.log('');
    
    // Look for TV shows with collections
    const showsWithCollections = await prisma.plexTVShow.findMany({
      where: {
        collections: {
          not: null
        }
      },
      take: 10
    });
    
    console.log('TV shows with collections:');
    showsWithCollections.forEach(show => {
      const collections = show.collections ? JSON.parse(show.collections) : [];
      console.log(`- ${show.title} (${show.year}) - Collections: ${collections.join(', ')}`);
    });
    console.log('');
    
    // Look for common collection names
    const allCollections = new Set();
    
    moviesWithCollections.forEach(movie => {
      if (movie.collections) {
        const collections = JSON.parse(movie.collections);
        collections.forEach(c => allCollections.add(c));
      }
    });
    
    showsWithCollections.forEach(show => {
      if (show.collections) {
        const collections = JSON.parse(show.collections);
        collections.forEach(c => allCollections.add(c));
      }
    });
    
    console.log('All unique collections:');
    Array.from(allCollections).sort().forEach(collection => {
      console.log(`- ${collection}`);
    });
    
    // Look for collections that might have both movies and TV shows
    console.log('\n=== Looking for Collections with Both Movies and TV ===');
    
    for (const collection of allCollections) {
      const moviesInCollection = moviesWithCollections.filter(movie => {
        const collections = movie.collections ? JSON.parse(movie.collections) : [];
        return collections.includes(collection);
      });
      
      const showsInCollection = showsWithCollections.filter(show => {
        const collections = show.collections ? JSON.parse(show.collections) : [];
        return collections.includes(collection);
      });
      
      if (moviesInCollection.length > 0 && showsInCollection.length > 0) {
        console.log(`\n📂 Collection: "${collection}"`);
        console.log(`   Movies (${moviesInCollection.length}):`);
        moviesInCollection.forEach(movie => {
          console.log(`   - ${movie.title} (${movie.originallyAvailableAt?.split('T')[0] || movie.year})`);
        });
        console.log(`   TV Shows (${showsInCollection.length}):`);
        showsInCollection.forEach(show => {
          console.log(`   - ${show.title} (${show.originallyAvailableAt?.split('T')[0] || show.year})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTestContent();
