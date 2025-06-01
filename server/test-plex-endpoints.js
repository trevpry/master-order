const fetch = require('node-fetch');
require('dotenv').config();

async function testPlexEndpoints() {
  try {
    console.log('=== Testing Plex Endpoints for Collection Data ===\n');
    
    const plexUrl = process.env.PLEX_URL || 'http://localhost:32400';
    const plexToken = process.env.PLEX_TOKEN;
    
    // Test the bulk endpoint (what sync uses)
    console.log('1. Testing bulk endpoint (what sync currently uses):');
    const bulkUrl = `${plexUrl}/library/sections/1/all?type=1&X-Plex-Token=${plexToken}`;
    console.log('URL:', bulkUrl);
    
    const bulkResponse = await fetch(bulkUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    const bulkData = await bulkResponse.json();
    const bulkMovies = bulkData.MediaContainer?.Metadata || [];
    
    // Find X Files movie in bulk data
    const xFilesInBulk = bulkMovies.find(m => m.title?.includes('X Files'));
    
    console.log('X Files movie in bulk data:');
    console.log('- Title:', xFilesInBulk?.title);
    console.log('- Rating Key:', xFilesInBulk?.ratingKey);
    console.log('- Collections:', xFilesInBulk?.Collection);
    console.log('- Has Collection property:', 'Collection' in (xFilesInBulk || {}));
    console.log('');
    
    // Test the individual endpoint
    console.log('2. Testing individual endpoint:');
    const individualUrl = `${plexUrl}/library/metadata/${xFilesInBulk?.ratingKey}?X-Plex-Token=${plexToken}`;
    console.log('URL:', individualUrl);
    
    const individualResponse = await fetch(individualUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    const individualData = await individualResponse.json();
    const individualMovie = individualData.MediaContainer?.Metadata?.[0];
    
    console.log('X Files movie in individual data:');
    console.log('- Title:', individualMovie?.title);
    console.log('- Rating Key:', individualMovie?.ratingKey);
    console.log('- Collections:', individualMovie?.Collection);
    console.log('- Has Collection property:', 'Collection' in (individualMovie || {}));
    console.log('');
    
    // Test a few more movies from bulk to see if it's a general issue
    console.log('3. Testing first 3 movies from bulk endpoint for Collection property:');
    bulkMovies.slice(0, 3).forEach((movie, index) => {
      console.log(`Movie ${index + 1}:`);
      console.log(`- Title: ${movie.title}`);
      console.log(`- Has Collection: ${'Collection' in movie}`);
      console.log(`- Collections: ${movie.Collection || 'undefined'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPlexEndpoints();
