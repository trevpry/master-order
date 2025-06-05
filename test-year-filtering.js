// Test script to verify year filtering functionality
const axios = require('axios');

async function testYearFiltering() {
  console.log('Testing Year Filtering Functionality...\n');
  
  try {
    // Test 1: Search for Superman movies without year filter
    console.log('Test 1: Searching for Superman movies without year filter');
    const response1 = await axios.get('http://localhost:3001/api/search?query=Superman&type=movie');
    console.log(`Found ${response1.data.length} Superman movies without year filter:`);
    response1.data.forEach(movie => {
      console.log(`  - ${movie.title} (${movie.year})`);
    });
    console.log('');

    // Test 2: Search for Superman movies with year filter (1978)
    console.log('Test 2: Searching for Superman movies with year filter (1978)');
    const response2 = await axios.get('http://localhost:3001/api/search?query=Superman&type=movie&year=1978');
    console.log(`Found ${response2.data.length} Superman movies with year filter 1978:`);
    response2.data.forEach(movie => {
      console.log(`  - ${movie.title} (${movie.year})`);
    });
    console.log('');

    // Test 3: Search for Superman movies with year filter (2013) - Man of Steel
    console.log('Test 3: Searching for Superman movies with year filter (2013)');
    const response3 = await axios.get('http://localhost:3001/api/search?query=Superman&type=movie&year=2013');
    console.log(`Found ${response3.data.length} Superman movies with year filter 2013:`);
    response3.data.forEach(movie => {
      console.log(`  - ${movie.title} (${movie.year})`);
    });
    console.log('');

    // Test 4: Search for TV shows with year filter
    console.log('Test 4: Searching for Breaking Bad with year filter (2008)');
    const response4 = await axios.get('http://localhost:3001/api/search?query=Breaking Bad&type=tv&year=2008');
    console.log(`Found ${response4.data.length} Breaking Bad episodes with year filter 2008:`);
    // Show only first 3 episodes to avoid too much output
    response4.data.slice(0, 3).forEach(episode => {
      console.log(`  - ${episode.grandparentTitle} S${episode.parentIndex}E${episode.index}: ${episode.title} (${episode.year || 'N/A'})`);
    });
    if (response4.data.length > 3) {
      console.log(`  ... and ${response4.data.length - 3} more episodes`);
    }
    console.log('');

    // Test 5: Test invalid year (should be ignored)
    console.log('Test 5: Testing invalid year parameter (abc123)');
    const response5 = await axios.get('http://localhost:3001/api/search?query=Superman&type=movie&year=abc123');
    console.log(`Found ${response5.data.length} Superman movies with invalid year filter (should ignore year filter):`);
    response5.data.forEach(movie => {
      console.log(`  - ${movie.title} (${movie.year})`);
    });
    console.log('');

    console.log('Year filtering tests completed successfully!');

  } catch (error) {
    console.error('Error during testing:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testYearFiltering();
