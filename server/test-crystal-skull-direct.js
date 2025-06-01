const { PrismaClient } = require('@prisma/client');
const PlexDatabaseService = require('./plexDatabaseService');
require('dotenv').config();

const prisma = new PrismaClient();
const plexDb = new PlexDatabaseService(prisma);

async function testCrystalSkullDirect() {
  console.log('=== Testing Crystal Skull Collection Selection Logic Directly ===\n');
  
  try {
    // 1. Find Crystal Skull in database
    const crystalSkull = await prisma.plexMovie.findFirst({
      where: {
        title: {
          contains: "Kingdom of the Crystal Skull"
        }
      }
    });
    
    if (!crystalSkull) {
      console.log('❌ Crystal Skull not found');
      return;
    }
    
    console.log('1. Found Crystal Skull:', crystalSkull.title);
    console.log('   Collections:', crystalSkull.collections);
    console.log('   View Count:', crystalSkull.viewCount);
    console.log('');
    
    // 2. Parse the collections
    const movieCollections = plexDb.parseCollections(crystalSkull.collections || '');
    console.log('2. Parsed collections:', movieCollections);
    console.log('');
    
    // 3. For each collection, find all movies and select earliest unplayed
    for (const collectionName of movieCollections) {
      console.log(`3. Processing collection: "${collectionName}"`);
      
      // Get all movies in this collection
      const moviesInCollection = await plexDb.getMoviesByCollection(collectionName);
      console.log(`   Found ${moviesInCollection.length} movies in collection:`);
      
      // Sort by date and show unplayed
      const unplayedMovies = moviesInCollection.filter(m => m.viewCount === 0);
      const sortedMovies = unplayedMovies.sort((a, b) => {
        const dateA = new Date(a.originallyAvailableAt || a.year || '9999');
        const dateB = new Date(b.originallyAvailableAt || b.year || '9999');
        return dateA - dateB;
      });
      
      sortedMovies.forEach((movie, index) => {
        const prefix = index === 0 ? '   🎯 EARLIEST' : '      ';
        console.log(`${prefix} ${movie.title} (${movie.originallyAvailableAt?.split('T')[0] || movie.year})`);
      });
      
      if (sortedMovies.length > 0) {
        const earliestMovie = sortedMovies[0];
        console.log(`\n   ✅ Would select: "${earliestMovie.title}" (${earliestMovie.originallyAvailableAt?.split('T')[0] || earliestMovie.year})`);
      }
      console.log('');
    }
    
    // 4. Now test the actual checkCollections function from getNextMovie.js
    console.log('4. Testing checkCollections function from getNextMovie.js...');
    
    // Import the checkCollections function by reading the file and extracting it
    const fs = require('fs');
    const getNextMovieCode = fs.readFileSync('./getNextMovie.js', 'utf8');
    
    // Create a mock selectedMovie object
    const mockSelectedMovie = {
      ...crystalSkull,
      fromCollection: 'original'
    };
    
    console.log('   Mock movie object created');
    console.log('   Collections in mock:', mockSelectedMovie.collections);
    
    // We would need to extract and test the checkCollections function here
    // But that would require complex code extraction. Instead, let's test the actual API endpoint
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCrystalSkullDirect();
