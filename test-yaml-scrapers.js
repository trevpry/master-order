/**
 * Test YAML Scraper System
 * 
 * Quick test to verify YAML-based scrapers load and work correctly
 */

const ScraperRegistry = require('./server/services/scrapers/ScraperRegistry');

console.log('🧪 Testing YAML Scraper System\n');

// Initialize registry
const registry = new ScraperRegistry();

console.log('\n📋 Available Scrapers:');
registry.getAllScrapers().forEach((scraper, index) => {
  console.log(`${index + 1}. ${scraper.siteName}`);
  if (scraper.sceneUrlPatterns) {
    console.log(`   - Patterns: ${scraper.sceneUrlPatterns.length}`);
    console.log(`   - Sample: ${scraper.sceneUrlPatterns[0]}`);
  }
});

// Test URL detection
console.log('\n🔍 Testing URL Detection:');

const testUrls = [
  'https://www.crunchboy.com/en/videos/detail/45784',
  'https://www.menoboy.com/en/videos/detail/12345',
  'https://www.example.com/video/123',
  'https://gayeroticvideoindex.com/episode/123'
];

testUrls.forEach(url => {
  const scraper = registry.getScraperForUrl(url);
  console.log(`\n  URL: ${url}`);
  console.log(`  Scraper: ${scraper ? scraper.siteName : 'None found'}`);
});

console.log('\n✅ Test complete!');
