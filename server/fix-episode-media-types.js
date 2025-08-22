const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEpisodeMediaTypes() {
  try {
    console.log('🔧 Fixing episode media types in watch logs...');
    
    // Find all watch logs with mediaType 'episode'
    const episodeWatchLogs = await prisma.watchLog.findMany({
      where: {
        mediaType: 'episode'
      },
      select: {
        id: true,
        title: true,
        seriesTitle: true,
        seasonNumber: true,
        episodeNumber: true,
        startTime: true
      }
    });
    
    console.log(`📺 Found ${episodeWatchLogs.length} watch logs with mediaType 'episode'`);
    
    if (episodeWatchLogs.length > 0) {
      // Show some examples
      console.log('📝 Examples of logs to be updated:');
      episodeWatchLogs.slice(0, 5).forEach(log => {
        console.log(`   - "${log.title}" (${log.seriesTitle} S${log.seasonNumber}E${log.episodeNumber}) at ${log.startTime}`);
      });
      
      // Update all episode logs to use 'tv' mediaType
      const updateResult = await prisma.watchLog.updateMany({
        where: {
          mediaType: 'episode'
        },
        data: {
          mediaType: 'tv'
        }
      });
      
      console.log(`✅ Updated ${updateResult.count} watch logs from mediaType 'episode' to 'tv'`);
    } else {
      console.log('✅ No watch logs with mediaType "episode" found - all good!');
    }
    
    // Verify the fix
    const remainingEpisodeLogs = await prisma.watchLog.count({
      where: {
        mediaType: 'episode'
      }
    });
    
    const tvLogs = await prisma.watchLog.count({
      where: {
        mediaType: 'tv'
      }
    });
    
    console.log(`📊 Final count: ${remainingEpisodeLogs} logs with 'episode' mediaType, ${tvLogs} logs with 'tv' mediaType`);
    
  } catch (error) {
    console.error('❌ Error fixing episode media types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixEpisodeMediaTypes();
