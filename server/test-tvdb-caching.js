// Test TVDB caching by making multiple requests to see cache behavior
const tvdbService = require('./tvdbCachedService');

async function testTvdbCaching() {
  console.log('=== Testing TVDB Caching ===\n');
  
  const testSeries = 'The Last of Us';
  
  try {
    console.log('1. First request (should fetch from API and cache):');
    const start1 = Date.now();
    const result1 = await tvdbService.getCurrentSeasonArtwork(testSeries, 2, 4);
    const time1 = Date.now() - start1;
    console.log(`   Time: ${time1}ms`);
    console.log(`   Result: ${result1 ? 'Found artwork' : 'No artwork found'}`);
    if (result1) {
      console.log(`   URL: ${result1.url}`);
      console.log(`   Series ID: ${result1.seriesId}`);
    }
    
    console.log('\n2. Second request (should use cache):');
    const start2 = Date.now();
    const result2 = await tvdbService.getCurrentSeasonArtwork(testSeries, 2, 4);
    const time2 = Date.now() - start2;
    console.log(`   Time: ${time2}ms`);
    console.log(`   Result: ${result2 ? 'Found artwork' : 'No artwork found'}`);
    if (result2) {
      console.log(`   URL: ${result2.url}`);
      console.log(`   Series ID: ${result2.seriesId}`);
    }
    
    console.log('\n3. Third request (should still use cache):');
    const start3 = Date.now();
    const result3 = await tvdbService.getCurrentSeasonArtwork(testSeries, 2, 4);
    const time3 = Date.now() - start3;
    console.log(`   Time: ${time3}ms`);
    console.log(`   Result: ${result3 ? 'Found artwork' : 'No artwork found'}`);
    
    console.log('\n=== Performance Analysis ===');
    console.log(`First request: ${time1}ms (API + caching)`);
    console.log(`Second request: ${time2}ms (cached)`);
    console.log(`Third request: ${time3}ms (cached)`);
    
    if (time2 < time1 && time3 < time1) {
      console.log('✅ Caching is working! Subsequent requests are faster.');
    } else {
      console.log('⚠️  Caching may not be working optimally.');
    }
    
    // Test cleanup
    console.log('\n4. Testing cache cleanup (dry run):');
    await tvdbService.cleanupCache(168); // 7 days
    console.log('   Cache cleanup completed');
    
  } catch (error) {
    console.error('Error during caching test:', error);
  } finally {
    // Close database connection
    if (tvdbService.dbService && tvdbService.dbService.prisma) {
      await tvdbService.dbService.prisma.$disconnect();
    }
    console.log('\n=== Test completed ===');
    process.exit(0);
  }
}

testTvdbCaching();
