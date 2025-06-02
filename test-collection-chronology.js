require('dotenv').config({ path: './server/.env' });
const prisma = require('./server/prismaClient');
const PlexDatabaseService = require('./server/plexDatabaseService');

// Initialize Database Service
const plexDb = new PlexDatabaseService(prisma);

async function testCollectionChronology() {
  console.log('🕐 Testing Collection Chronological Selection Logic');
  console.log('=' .repeat(70));
  
  try {
    // Test 1: Find a collection with both movies and TV shows
    console.log('\n📋 Test 1: Finding Mixed Collections (Movies + TV Shows)');
    console.log('-'.repeat(50));
    
    const tvShows = await plexDb.getAllTVShows();
    const movies = await plexDb.getAllMovies();
    
    // Find TV shows with collections
    const showsWithCollections = tvShows.filter(show => {
      const collections = plexDb.parseCollections(show.collections || '');
      return collections.length > 0;
    });
    
    console.log(`Found ${showsWithCollections.length} TV shows with collections`);
    
    // Find movies with collections
    const moviesWithCollections = movies.filter(movie => {
      const collections = plexDb.parseCollections(movie.collections || '');
      return collections.length > 0;
    });
    
    console.log(`Found ${moviesWithCollections.length} movies with collections`);
    
    // Find overlapping collections
    const showCollections = new Set();
    showsWithCollections.forEach(show => {
      const collections = plexDb.parseCollections(show.collections || '');
      collections.forEach(col => showCollections.add(col.toLowerCase()));
    });
    
    const movieCollections = new Set();
    moviesWithCollections.forEach(movie => {
      const collections = plexDb.parseCollections(movie.collections || '');
      collections.forEach(col => movieCollections.add(col.toLowerCase()));
    });
    
    const sharedCollections = [...showCollections].filter(col => 
      movieCollections.has(col)
    );
    
    console.log(`Found ${sharedCollections.length} shared collections:`, sharedCollections.slice(0, 5));
    
    // Test 2: Analyze originallyAvailableAt field coverage
    console.log('\n📅 Test 2: Analyzing originallyAvailableAt Field Coverage');
    console.log('-'.repeat(50));
    
    // Check TV shows with originallyAvailableAt
    const showsWithDates = tvShows.filter(show => show.originallyAvailableAt);
    console.log(`TV Shows with originallyAvailableAt: ${showsWithDates.length}/${tvShows.length} (${((showsWithDates.length/tvShows.length)*100).toFixed(1)}%)`);
    
    // Check movies with originallyAvailableAt
    const moviesWithDates = movies.filter(movie => movie.originallyAvailableAt);
    console.log(`Movies with originallyAvailableAt: ${moviesWithDates.length}/${movies.length} (${((moviesWithDates.length/movies.length)*100).toFixed(1)}%)`);
    
    // Test 3: Check episode originallyAvailableAt coverage
    console.log('\n📺 Test 3: Episode Air Date Coverage');
    console.log('-'.repeat(50));
    
    const sampleShows = showsWithCollections.slice(0, 3);
    for (const show of sampleShows) {
      console.log(`\nAnalyzing "${show.title}":`);
      
      try {
        const nextEpisode = await plexDb.getNextUnwatchedEpisode(show.ratingKey);
        if (nextEpisode) {
          console.log(`  Next Episode: S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
          console.log(`  Air Date: ${nextEpisode.originallyAvailableAt || 'N/A'}`);
          console.log(`  Series Date: ${show.originallyAvailableAt || show.year || 'N/A'}`);
          
          if (nextEpisode.originallyAvailableAt && show.originallyAvailableAt) {
            const episodeDate = new Date(nextEpisode.originallyAvailableAt);
            const seriesDate = new Date(show.originallyAvailableAt);
            console.log(`  ✓ Episode (${nextEpisode.originallyAvailableAt}) vs Series (${show.originallyAvailableAt})`);
          }
        } else {
          console.log(`  No unwatched episodes found`);
        }
      } catch (error) {
        console.log(`  Error getting episode data: ${error.message}`);
      }
    }
    
    // Test 4: Simulate chronological selection
    console.log('\n🎯 Test 4: Simulating Chronological Selection');
    console.log('-'.repeat(50));
    
    if (sharedCollections.length > 0) {
      const testCollection = sharedCollections[0];
      console.log(`Testing with collection: "${testCollection}"`);
      
      // Get items from this collection
      const collectionMovies = await plexDb.getMoviesByCollection(testCollection);
      const collectionShows = await plexDb.getTVShowsByCollection(testCollection);
      
      console.log(`  Movies in collection: ${collectionMovies.length}`);
      console.log(`  TV Shows in collection: ${collectionShows.length}`);
      
      // Create test items with dates
      const testItems = [];
      
      // Add movies
      collectionMovies.slice(0, 2).forEach(movie => {
        if (movie.originallyAvailableAt || movie.year) {
          testItems.push({
            title: movie.title,
            type: 'movie',
            date: movie.originallyAvailableAt || movie.year,
            sortDate: movie.originallyAvailableAt || movie.year
          });
        }
      });
      
      // Add TV shows with episode dates
      for (const show of collectionShows.slice(0, 2)) {
        try {
          const nextEpisode = await plexDb.getNextUnwatchedEpisode(show.ratingKey);
          if (nextEpisode && nextEpisode.originallyAvailableAt) {
            testItems.push({
              title: `${show.title} (S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber})`,
              type: 'episode',
              date: nextEpisode.originallyAvailableAt,
              sortDate: nextEpisode.originallyAvailableAt,
              episodeTitle: nextEpisode.title
            });
          } else if (show.originallyAvailableAt || show.year) {
            testItems.push({
              title: show.title,
              type: 'series',
              date: show.originallyAvailableAt || show.year,
              sortDate: show.originallyAvailableAt || show.year
            });
          }
        } catch (error) {
          console.log(`    Error processing ${show.title}: ${error.message}`);
        }
      }
      
      // Sort chronologically
      const sortedItems = testItems.sort((a, b) => {
        const dateA = new Date(a.sortDate);
        const dateB = new Date(b.sortDate);
        return dateA - dateB;
      });
      
      console.log('\n  📅 Chronological Order:');
      sortedItems.forEach((item, index) => {
        console.log(`    ${index + 1}. ${item.title} (${item.type}) - ${item.date}`);
      });
      
      if (sortedItems.length > 0) {
        console.log(`\n  🎯 Would select: "${sortedItems[0].title}" (${sortedItems[0].date})`);
      }
    }
    
    console.log('\n✅ Collection Chronology Test Complete!');
    
  } catch (error) {
    console.error('❌ Error during collection chronology test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCollectionChronology().catch(console.error);
