const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

async function checkVideoUrls() {
  try {
    console.log('🔍 Checking sample video URLs in Eddie database...\n');
    
    // Get a few sample videos
    const videos = await prisma.video.findMany({
      take: 10,
      select: {
        id: true,
        title: true,
        url: true
      }
    });
    
    console.log('📹 Sample videos from Eddie database:');
    videos.forEach(video => {
      console.log(`   ID: ${video.id} | Title: "${video.title}" | URL: ${video.url}`);
    });
    
    // Check if any YouTube URLs exist
    const youtubeVideos = await prisma.video.count({
      where: {
        url: {
          contains: 'youtube.com'
        }
      }
    });
    
    console.log(`\n📊 Total YouTube videos in Eddie: ${youtubeVideos}`);
    
    // Check if any thegreatcoursesplus URLs exist
    const greatCoursesVideos = await prisma.video.count({
      where: {
        url: {
          contains: 'thegreatcoursesplus.com'
        }
      }
    });
    
    console.log(`📊 Total Great Courses videos in Eddie: ${greatCoursesVideos}`);
    
    // Check the total number of videos
    const totalVideos = await prisma.video.count();
    console.log(`📊 Total videos in Eddie: ${totalVideos}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVideoUrls();