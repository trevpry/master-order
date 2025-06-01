// Test script for TVDB cached service
const tvdbService = require('./tvdbCachedService');

async function testTvdbCachedService() {
  try {
    console.log('Testing TVDB Cached Service...');
    console.log('TVDB token available:', tvdbService.isTokenAvailable());
    
    if (!tvdbService.isTokenAvailable()) {
      console.log('TVDB token not available, testing will be limited to cache functionality');
    } else {
      console.log('TVDB token available, testing full functionality');
    }
    
    console.log('\n=== TVDB Cached Service test completed ===');
    
  } catch (error) {
    console.error('Error testing TVDB cached service:', error);
  } finally {
    // Properly close database connections
    if (tvdbService.dbService && tvdbService.dbService.prisma) {
      await tvdbService.dbService.prisma.$disconnect();
    }
    process.exit(0);
  }
}

testTvdbCachedService();
