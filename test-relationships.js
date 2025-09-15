const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('Testing foreign key relationships...');
  
  try {
    // Check video watches with related videos
    const videoWatches = await prisma.user_video_watches.findMany({
      take: 3,
      include: {
        historyVideo: {
          select: { title: true, id: true }
        }
      }
    });
    console.log('Video watches with linked videos:');
    videoWatches.forEach(w => console.log(`  ${w.id}: Video ${w.videoId} - ${w.historyVideo?.title || 'NOT LINKED'}`));
    
    // Check channels
    const channels = await prisma.historyChannel.findMany({
      take: 3,
      select: { id: true, title: true, channelUrl: true }
    });
    console.log('\nChannel URLs:');
    channels.forEach(c => console.log(`  ${c.id}: ${c.title} - ${c.channelUrl}`));
    
    console.log('\nCounts:');
    const counts = {
      videos: await prisma.historyVideo.count(),
      videoWatches: await prisma.user_video_watches.count(),
      channels: await prisma.historyChannel.count(),
      books: await prisma.historyBook.count(),
      chapters: await prisma.historyChapter.count(),
      sections: await prisma.historySection.count()
    };
    console.log(counts);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();