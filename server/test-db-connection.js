const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🎬 Testing database connection...\n');
    
    // Test basic counts
    const totalVideos = await prisma.historyVideo.count();
    const watchedVideos = await prisma.user_video_watches.count({
      where: { watched: true }
    });
    
    console.log('📊 Database connection successful!');
    console.log(`   Total videos: ${totalVideos}`);
    console.log(`   Watched videos: ${watchedVideos}`);
    console.log(`   Missing watched videos: ${311 - watchedVideos}\n`);
    
    // Get sample videos
    const sampleVideos = await prisma.historyVideo.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        url: true,
        user_video_watches: {
          select: {
            watched: true
          }
        }
      }
    });
    
    console.log('🔍 Sample video data:');
    sampleVideos.forEach(video => {
      const status = video.user_video_watches?.watched ? '✅ Watched' : '⏳ Unwatched';
      console.log(`   ${status} | "${video.title}"`);
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();