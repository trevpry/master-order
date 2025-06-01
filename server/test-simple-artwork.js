// Simple test for the artwork selection logic
const TvdbDatabaseService = require('./tvdbDatabaseService');

console.log('=== Testing Artwork Selection Logic ===');

// Create some mock artwork data to test the selection logic
const mockArtworks = [
  { id: '1', image: '/banners/test1.jpg', language: 'fra', type: 7, width: 680, height: 1000, score: 8.5 },
  { id: '2', image: '/banners/test2.jpg', language: 'eng', type: 7, width: 680, height: 1000, score: 7.8 },
  { id: '3', image: '/banners/test3.jpg', language: null, type: 7, width: 1024, height: 1500, score: 9.2 },
  { id: '4', image: '/banners/test4.jpg', language: 'eng', type: 7, width: 1024, height: 1500, score: 8.9 },
  { id: '5', image: '/banners/test5.jpg', language: 'deu', type: 7, width: 1024, height: 1500, score: 9.5 }
];

console.log('Mock artwork data:');
mockArtworks.forEach(artwork => {
  console.log(`  ID: ${artwork.id}, Language: ${artwork.language || 'null'}, Type: ${artwork.type}, Resolution: ${artwork.width}x${artwork.height}, Score: ${artwork.score}`);
});

const dbService = new TvdbDatabaseService();

try {
  const selectedArtwork = dbService.selectBestArtwork(mockArtworks, 'season');
  console.log(`\nSelected artwork: ${selectedArtwork}`);
    // Expected: Should select id '4' because it's English ('eng') with highest resolution (1024x1500) among English options
  if (selectedArtwork && selectedArtwork.includes('test4.jpg')) {
    console.log('✅ SUCCESS: Artwork selection correctly prioritized explicit English language and highest resolution');
  } else if (selectedArtwork && selectedArtwork.includes('test3.jpg')) {
    console.log('⚠️  PARTIAL: Selected highest resolution artwork with null language (acceptable but not optimal)');
  } else {
    console.log('⚠️  UNEXPECTED: Artwork selection may not be working as expected');
    console.log(`   Expected: test4.jpg (English, high res), Got: ${selectedArtwork}`);
  }
} catch (error) {
  console.error('Error testing artwork selection:', error);
}

console.log('\nTest completed');
