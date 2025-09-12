const { PrismaClient } = require('@prisma/client');

async function checkRelationships() {
  const prisma = new PrismaClient();
  
  try {
    const totalVideos = await prisma.historyVideo.count();
    const videosWithEvents = await prisma.historyVideo.count({
      where: { eventId: { not: null } }
    });
    const videosWithChannels = await prisma.historyVideo.count({
      where: { channelId: { not: null } }
    });
    
    console.log('📊 Video Relationship Status:');
    console.log(`📹 Total Videos: ${totalVideos}`);
    console.log(`📜 Videos linked to Events: ${videosWithEvents}/${totalVideos} (${Math.round(videosWithEvents/totalVideos*100)}%)`);
    console.log(`📺 Videos linked to Channels: ${videosWithChannels}/${totalVideos} (${Math.round(videosWithChannels/totalVideos*100)}%)`);
    
    // Sample some videos to see their data
    const sampleVideos = await prisma.historyVideo.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        eventId: true,
        channelId: true,
        url: true
      }
    });
    
    console.log('\n🔍 Sample Videos:');
    sampleVideos.forEach(video => {
      console.log(`  ID: ${video.id}, Title: ${video.title?.substring(0, 50)}..., EventID: ${video.eventId}, ChannelID: ${video.channelId}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRelationships();