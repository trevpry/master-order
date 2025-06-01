// Test script to verify the comprehensive Plex sync is working
require('dotenv').config();
const PlexSyncService = require('./plexSyncService');

async function testComprehensiveSync() {
    console.log('=== Testing Comprehensive Plex Sync ===');
    
    const plexSync = new PlexSyncService();
    
    try {
        // Test syncing a single movie to see the additional fields
        console.log('\n1. Testing movie sync with comprehensive fields...');
        const sections = await plexSync.syncLibrarySections();
        const movieSections = sections.filter(s => s.type === 'movie');
        
        if (movieSections.length > 0) {
            console.log(`Found ${movieSections.length} movie section(s)`);
            // Sync just one movie section to test
            const movies = await plexSync.syncMovies(movieSections[0].sectionKey);
            console.log(`Synced ${movies.length} movies with comprehensive fields`);
        }
        
        // Test syncing a single TV show section
        console.log('\n2. Testing TV show sync with comprehensive fields...');
        const tvSections = sections.filter(s => s.type === 'show');
        
        if (tvSections.length > 0) {
            console.log(`Found ${tvSections.length} TV section(s)`);
            // Sync just a few shows to test
            const shows = await plexSync.syncTVShows(tvSections[0].sectionKey);
            console.log(`Synced ${shows.length} TV shows with comprehensive fields`);
        }
        
        console.log('\n✅ Comprehensive sync test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during comprehensive sync test:', error);
        throw error;
    }
}

// Run the test
testComprehensiveSync()
    .then(() => {
        console.log('\n🎉 All tests completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
