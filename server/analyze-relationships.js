const { PrismaClient } = require('@prisma/client');

async function analyzeRelationships() {
  const prisma = new PrismaClient();
  
  try {
    // Check videos that have events but no channels
    const videosWithEventsNoChannels = await prisma.historyVideo.count({
      where: { 
        eventId: { not: null },
        channelId: null
      }
    });
    
    // Check videos that have channels but no events  
    const videosWithChannelsNoEvents = await prisma.historyVideo.count({
      where: { 
        channelId: { not: null },
        eventId: null
      }
    });
    
    // Check videos that have both
    const videosWithBoth = await prisma.historyVideo.count({
      where: { 
        channelId: { not: null },
        eventId: { not: null }
      }
    });
    
    // Check videos that have neither
    const videosWithNeither = await prisma.historyVideo.count({
      where: { 
        channelId: null,
        eventId: null
      }
    });
    
    console.log('🔍 Detailed Relationship Analysis:');
    console.log(`📜 Videos with Events only: ${videosWithEventsNoChannels}`);
    console.log(`📺 Videos with Channels only: ${videosWithChannelsNoEvents}`);
    console.log(`🎯 Videos with Both: ${videosWithBoth}`);
    console.log(`❌ Videos with Neither: ${videosWithNeither}`);
    
    // Sample some videos with events to see their details
    const videosWithEvents = await prisma.historyVideo.findMany({
      where: { eventId: { not: null } },
      take: 10,
      include: {
        event: {
          select: { id: true, title: true }
        }
      }
    });
    
    console.log('\n📜 Sample Videos with Events:');
    videosWithEvents.forEach(video => {
      console.log(`  "${video.title?.substring(0, 40)}..." → Event: ${video.event?.title?.substring(0, 30)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeRelationships();