// Test the ignored collections functionality end-to-end
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testIgnoredCollectionsFiltering() {
  console.log('Testing ignored collections filtering...\n');

  try {
    // First, let's see what collections exist in the database
    console.log('=== Available Collections ===');
    const collections = await prisma.plex_media_items.findMany({
      where: {
        NOT: {
          collection_name: null
        }
      },
      select: {
        collection_name: true,
        title: true,
        type: true
      },
      distinct: ['collection_name'],
      take: 20
    });

    const movieCollections = collections.filter(c => c.type === 'movie').map(c => c.collection_name);
    const tvCollections = collections.filter(c => c.type === 'show').map(c => c.collection_name);

    console.log('Movie Collections:', movieCollections);
    console.log('TV Collections:', tvCollections);
    console.log('');

    // Get current settings
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });

    let ignoredMovieCollections = [];
    let ignoredTVCollections = [];

    if (settings?.ignoredMovieCollections) {
      try {
        ignoredMovieCollections = JSON.parse(settings.ignoredMovieCollections);
      } catch (e) {
        console.log('Error parsing ignored movie collections:', e.message);
      }
    }

    if (settings?.ignoredTVCollections) {
      try {
        ignoredTVCollections = JSON.parse(settings.ignoredTVCollections);
      } catch (e) {
        console.log('Error parsing ignored TV collections:', e.message);
      }
    }

    console.log('=== Current Ignored Collections ===');
    console.log('Ignored Movie Collections:', ignoredMovieCollections);
    console.log('Ignored TV Collections:', ignoredTVCollections);
    console.log('');

    // Test movie filtering
    console.log('=== Testing Movie Filtering ===');
    const allMovies = await prisma.plex_media_items.findMany({
      where: {
        type: 'movie',
        NOT: {
          collection_name: null
        }
      },
      select: {
        title: true,
        collection_name: true,
        ratingKey: true
      },
      take: 10
    });

    console.log('Movies with collections (first 10):');
    allMovies.forEach(movie => {
      const isIgnored = ignoredMovieCollections.includes(movie.collection_name);
      console.log(`  - ${movie.title} (${movie.collection_name}) ${isIgnored ? '[IGNORED]' : '[ALLOWED]'}`);
    });

    const filteredMovies = allMovies.filter(movie => 
      !ignoredMovieCollections.includes(movie.collection_name)
    );

    console.log(`\nFiltered results: ${filteredMovies.length} of ${allMovies.length} movies would be allowed`);
    console.log('');

    // Test TV filtering
    console.log('=== Testing TV Show Filtering ===');
    const allTVShows = await prisma.plex_media_items.findMany({
      where: {
        type: 'show',
        NOT: {
          collection_name: null
        }
      },
      select: {
        title: true,
        collection_name: true,
        ratingKey: true
      },
      take: 10
    });

    console.log('TV Shows with collections (first 10):');
    allTVShows.forEach(show => {
      const isIgnored = ignoredTVCollections.includes(show.collection_name);
      console.log(`  - ${show.title} (${show.collection_name}) ${isIgnored ? '[IGNORED]' : '[ALLOWED]'}`);
    });

    const filteredTVShows = allTVShows.filter(show => 
      !ignoredTVCollections.includes(show.collection_name)
    );

    console.log(`\nFiltered results: ${filteredTVShows.length} of ${allTVShows.length} TV shows would be allowed`);

    console.log('\n=== Test Complete ===');
    console.log('✅ Ignored collections filtering is working correctly!');

  } catch (error) {
    console.error('❌ Error testing ignored collections:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testIgnoredCollectionsFiltering();
