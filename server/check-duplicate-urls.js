const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicateUrls() {
  try {
    console.log('🔍 Checking for duplicate URLs...');
    
    // Check if the specific URL already exists
    const targetUrl = 'https://www.thegreatcoursesplus.com/great-pharaohs-of-ancient-egypt/?lecplay=06';
    
    const existingVideos = await prisma.historyVideo.findMany({
      where: {
        url: targetUrl
      },
      select: {
        id: true,
        title: true,
        url: true,
        eventId: true
      }
    });
    
    console.log(`Videos with URL "${targetUrl}":`);
    console.log(existingVideos);
    
    // Check general duplicate URL statistics
    const allVideos = await prisma.historyVideo.findMany({
      select: {
        id: true,
        url: true,
        eventId: true
      }
    });
    
    console.log(`\n📊 Total videos in database: ${allVideos.length}`);
    
    const urlCount = {};
    allVideos.forEach(video => {
      if (urlCount[video.url]) {
        urlCount[video.url]++;
      } else {
        urlCount[video.url] = 1;
      }
    });
    
    const duplicateUrls = Object.entries(urlCount).filter(([url, count]) => count > 1);
    console.log(`Duplicate URLs found: ${duplicateUrls.length}`);
    
    if (duplicateUrls.length > 0) {
      console.log('\nFirst 5 duplicate URLs:');
      duplicateUrls.slice(0, 5).forEach(([url, count]) => {
        console.log(`  "${url}" appears ${count} times`);
      });
    }
    
    // Check how many videos have eventId
    const videosWithEventId = allVideos.filter(v => v.eventId !== null);
    console.log(`\nVideos with eventId: ${videosWithEventId.length}`);
    console.log(`Videos without eventId: ${allVideos.length - videosWithEventId.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateUrls();