const { PrismaClient } = require('@prisma/client');

async function verifyImportedData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Verifying imported user tracking data...\n');
    
    const videoWatches = await prisma.user_video_watches.count();
    const bookReads = await prisma.user_book_reads.count();
    const chapterReads = await prisma.user_chapter_reads.count();
    const sectionReads = await prisma.user_section_reads.count();
    const eventReviews = await prisma.user_event_reviews.count();
    
    console.log('📊 User Tracking Data in Database:');
    console.log(`🎬 Video Watches: ${videoWatches}`);
    console.log(`📚 Book Reads: ${bookReads}`);
    console.log(`📖 Chapter Reads: ${chapterReads}`);
    console.log(`📄 Section Reads: ${sectionReads}`);
    console.log(`📜 Event Reviews: ${eventReviews}`);
    
    // Sample some watched videos
    const watchedVideos = await prisma.user_video_watches.findMany({
      where: { watched: true },
      take: 5,
      include: { video: { select: { title: true } } }
    });
    
    console.log('\n🎬 Sample Watched Videos:');
    for (const watch of watchedVideos) {
      console.log(`  ✅ ${watch.video.title} (watched: ${watch.watchedAt})`);
    }
    
    // Sample read sections
    const readSections = await prisma.user_section_reads.findMany({
      where: { read: true },
      take: 5,
      include: { section: { select: { title: true } } }
    });
    
    console.log('\n📄 Sample Read Sections:');
    for (const read of readSections) {
      console.log(`  ✅ ${read.section.title} (read: ${read.readAt || 'date not set'})`);
    }
    
    // Sample reviewed events
    const reviewedEvents = await prisma.user_event_reviews.findMany({
      where: { reviewed: true },
      take: 5,
      include: { HistoricalEvent: { select: { title: true, startDate: true } } }
    });
    
    console.log('\n📜 Sample Reviewed Events:');
    for (const review of reviewedEvents) {
      console.log(`  ✅ ${review.HistoricalEvent.title} (${review.HistoricalEvent.startDate}) - reviewed: ${review.reviewedAt}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyImportedData();