const { PrismaClient } = require('@prisma/client');

async function analyzeWatchData() {
  const prisma = new PrismaClient();
  
  try {
    // Get current counts
    const totalVideos = await prisma.historyVideo.count();
    const totalWatchRecords = await prisma.user_video_watches.count();
    const watchedVideos = await prisma.user_video_watches.count({ where: { watched: true } });
    const unwatchedVideos = await prisma.user_video_watches.count({ where: { watched: false } });
    const videosWithoutRecords = totalVideos - totalWatchRecords;
    
    console.log('📊 Current Watch Status Analysis:');
    console.log(`   Total videos: ${totalVideos}`);
    console.log(`   Total watch records: ${totalWatchRecords}`);
    console.log(`   Watched videos: ${watchedVideos}`);
    console.log(`   Unwatched videos: ${unwatchedVideos}`);
    console.log(`   Videos with no record: ${videosWithoutRecords}`);
    console.log('');
    console.log('🎯 Target Status (from original history-plus):');
    console.log(`   Should have watched: 311`);
    console.log(`   Currently have watched: ${watchedVideos}`);
    console.log(`   Missing watched videos: ${311 - watchedVideos}`);
    
    // Check if we have any videos that should be marked as watched
    console.log('\n🔍 Sample videos with user_video_watches records:');
    const sampleWatchedVideos = await prisma.user_video_watches.findMany({
      where: { watched: true },
      include: { video: true },
      take: 5
    });
    
    sampleWatchedVideos.forEach(watch => {
      console.log(`   ✅ "${watch.video.title}" - watched at ${watch.watchedAt}`);
    });
    
    console.log('\n🔍 Sample videos with unwatched records:');
    const sampleUnwatchedVideos = await prisma.user_video_watches.findMany({
      where: { watched: false },
      include: { video: true },
      take: 5
    });
    
    sampleUnwatchedVideos.forEach(watch => {
      console.log(`   ❌ "${watch.video.title}" - marked unwatched`);
    });
    
  } finally {
    await prisma.$disconnect();
  }
}

analyzeWatchData().catch(console.error);