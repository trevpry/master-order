const WatchLogService = require('./server/watchLogService');
const prisma = require('./server/prismaClient');

async function testWatchLogging() {
  try {
    const watchLogService = new WatchLogService(prisma);
    
    console.log('=== Testing Watch Log Service ===\n');
    
    // Test logging a TV episode
    const tvLog = await watchLogService.logWatched({
      mediaType: 'tv',
      title: 'The Pilot',
      seriesTitle: 'The X-Files',
      seasonNumber: 1,
      episodeNumber: 1,
      duration: 45
    });
    console.log('TV Episode logged:', tvLog);
    
    // Test logging a movie
    const movieLog = await watchLogService.logWatched({
      mediaType: 'movie',
      title: 'The Matrix',
      duration: 136
    });
    console.log('Movie logged:', movieLog);
    
    // Test getting stats
    const stats = await watchLogService.getWatchStats({
      groupBy: 'day'
    });
    console.log('\nWatch Stats:', stats);
    
    // Test recent activity
    const recentActivity = await watchLogService.getRecentActivity(5);
    console.log('\nRecent Activity:', recentActivity);
    
    // Test formatted time
    console.log('\nFormatted time examples:');
    console.log('45 minutes:', watchLogService.formatWatchTime(45));
    console.log('120 minutes:', watchLogService.formatWatchTime(120));
    console.log('150 minutes:', watchLogService.formatWatchTime(150));
    
  } catch (error) {
    console.error('Error testing watch logging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWatchLogging();
