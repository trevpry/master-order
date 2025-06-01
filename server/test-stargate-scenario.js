const { PrismaClient } = require('@prisma/client');
const PlexDatabaseService = require('./plexDatabaseService');
require('dotenv').config();

// Construct the absolute path to the database file
const path = require('path');
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const absoluteDbUrl = `file:${dbPath}`;

console.log(`Using database URL: ${absoluteDbUrl}`); // Log the path for verification

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: absoluteDbUrl,
    },
  },
});
const plexDb = new PlexDatabaseService(prisma);

async function testStargateScenario() {
  console.log('=== Testing Stargate Collection Selection ===\n');
  
  try {
    // 1. Find a Stargate movie (like Stargate Continuum)
    const stargateMovies = await prisma.plexMovie.findMany({
      where: {
        title: {
          contains: "Stargate",
        }
      }
    });
    
    console.log('1. Stargate movies found:');
    stargateMovies.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`   - ${movie.title} (${movie.year}) - Collections: ${collections.join(', ')}`);
    });
    console.log('');
    
    // 2. Find Stargate TV series
    const stargateSeries = await prisma.plexTVShow.findMany({
      where: {
        title: {
          contains: "Stargate",
        }
      }
    });
    
    console.log('2. Stargate TV series found:');
    stargateSeries.forEach(series => {
      const collections = series.collections ? JSON.parse(series.collections) : [];
      console.log(`   - ${series.title} (${series.year}) - Collections: ${collections.join(', ')}`);
      console.log(`     Episodes: ${series.leafCount}, Watched: ${series.viewedLeafCount || 0}`);
    });
    console.log('');
    
    // 3. Look for collection matches
    console.log('3. Analyzing collection relationships:');
    
    for (const movie of stargateMovies) {
      const movieCollections = movie.collections ? JSON.parse(movie.collections) : [];
      
      if (movieCollections.length > 0) {
        console.log(`\n   Movie: ${movie.title}`);
        console.log(`   Collections: ${movieCollections.join(', ')}`);
        
        // Check for matching TV series
        for (const collection of movieCollections) {
          // Create collection search variants
          const searchVariants = [
            collection,
            collection.replace(/ Collection$/, ''),
            `${collection} Collection`
          ];
          
          for (const variant of searchVariants) {
            const matchingSeries = await plexDb.getTVShowsByCollection(variant);
            
            if (matchingSeries.length > 0) {
              console.log(`   ✅ Found ${matchingSeries.length} TV series in "${variant}" collection:`);
              
              for (const series of matchingSeries) {
                console.log(`      - ${series.title} (${series.year})`);
                console.log(`        Episodes: ${series.leafCount}, Watched: ${series.viewedLeafCount || 0}`);
                console.log(`        Date: ${series.originallyAvailableAt || series.year}`);
                
                // Check if series has earlier date than movie
                const movieDate = new Date(movie.originallyAvailableAt || movie.year || '9999');
                const seriesDate = new Date(series.originallyAvailableAt || series.year || '9999');
                
                if (seriesDate < movieDate && series.leafCount > (series.viewedLeafCount || 0)) {
                  console.log(`        🎯 SERIES IS EARLIER AND HAS UNWATCHED EPISODES!`);
                  
                  // Get the next unwatched episode
                  try {
                    const nextEpisode = await plexDb.getNextUnwatchedEpisode(series.ratingKey);
                    if (nextEpisode) {
                      console.log(`        📺 Next episode: S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
                    }
                  } catch (error) {
                    console.log(`        ❌ Error getting next episode: ${error.message}`);
                  }
                } else if (seriesDate >= movieDate) {
                  console.log(`        ⏰ Series date (${series.originallyAvailableAt || series.year}) is not earlier than movie (${movie.originallyAvailableAt || movie.year})`);
                } else if (series.leafCount === (series.viewedLeafCount || 0)) {
                  console.log(`        ✅ All episodes watched`);
                }
              }
              break; // Found matches, no need to try other variants
            }
          }
        }
      }
    }
    
    // 4. Test the actual selection logic with a specific movie
    const testMovie = stargateMovies.find(m => m.title.includes('Continuum')) || stargateMovies[0];
    
    if (testMovie) {
      console.log(`\n4. Testing selection logic with: ${testMovie.title}`);
      
      // Parse the collections
      const movieCollections = plexDb.parseCollections(testMovie.collections || '');
      console.log(`   Movie collections: ${movieCollections.join(', ')}`);
      
      // Simulate the collection checking process
      const allItems = [];
      
      // Add the movie
      allItems.push({
        ...testMovie,
        libraryType: 'movie',
        fromCollection: 'original'
      });
      
      // Add TV series from same collections
      for (const collectionName of movieCollections) {
        const searchTerms = [
          collectionName, // e.g., "Stargate Collection"
          collectionName.replace(/ Collection$/, '') // e.g., "Stargate"
        ];
        const uniqueSearchTerms = [...new Set(searchTerms.filter(term => term))]; // Filter out empty strings if replace results in one

        for (const searchTerm of uniqueSearchTerms) {
          const tvSeries = await plexDb.getTVShowsByCollection(searchTerm);
          
          for (const series of tvSeries) {
            // Ensure not to add duplicates if a series matches multiple search terms (though unlikely here)
            if (!allItems.find(it => it.ratingKey === series.ratingKey && it.libraryType === 'tv')) {
              allItems.push({
                ...series,
                libraryType: 'tv',
                fromCollection: collectionName // Keep original movie's collection name for reference
              });
            }
          }
        }
      }
      
      console.log(`   Found ${allItems.length} total items in collections`);
      
      // Filter to unplayed items
      const unplayedItems = allItems.filter(item => {
        if (item.libraryType === 'movie') {
          return !item.viewCount || item.viewCount === 0;
        } else {
          return item.leafCount > (item.viewedLeafCount || 0);
        }
      });
      
      console.log(`   Found ${unplayedItems.length} unplayed items`);
      
      // Sort by date
      const sortedItems = unplayedItems.sort((a, b) => {
        const dateA = new Date(a.originallyAvailableAt || a.year || '9999');
        const dateB = new Date(b.originallyAvailableAt || b.year || '9999');
        return dateA - dateB;
      });
      
      if (sortedItems.length > 0) {
        const earliest = sortedItems[0];
        console.log(`   🎯 EARLIEST: ${earliest.title} (${earliest.originallyAvailableAt || earliest.year}) - Type: ${earliest.libraryType}`);
        
        if (earliest.libraryType === 'tv') {
          console.log(`   📺 Would select next unwatched episode from: ${earliest.title}`);
          
          try {
            const nextEpisode = await plexDb.getNextUnwatchedEpisode(earliest.ratingKey);
            if (nextEpisode) {
              console.log(`   📺 Specific episode: S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
            }
          } catch (error) {
            console.log(`   ❌ Error getting episode: ${error.message}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStargateScenario();
