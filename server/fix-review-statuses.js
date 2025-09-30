const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixIncorrectReviewStatuses() {
  try {
    console.log('🔧 Fixing incorrectly marked review statuses...');
    
    // Find events that are marked as reviewed but have unwatched content
    const events = await prisma.historicalEvent.findMany({
      where: { hidden: false },
      include: {
        user_event_reviews: true,
        videos: {
          include: {
            user_video_watches: true
          }
        },
        bookLinks: {
          include: {
            book: {
              include: {
                bookCompletions: true
              }
            }
          }
        }
      }
    });

    let fixedCount = 0;
    
    for (const event of events) {
      const isMarkedReviewed = event.user_event_reviews && event.user_event_reviews.reviewed;
      
      if (isMarkedReviewed) {
        // Check if this event actually has unwatched content
        let hasUnwatchedContent = false;
        
        // Check videos
        for (const video of event.videos) {
          const watchRecord = video.user_video_watches;
          const unreviewed = !watchRecord || watchRecord.length === 0 || !watchRecord[0]?.watched;
          if (unreviewed) {
            hasUnwatchedContent = true;
            break;
          }
        }
        
        // Check books if no unwatched videos
        if (!hasUnwatchedContent) {
          for (const bookLink of event.bookLinks) {
            const isCompleted = bookLink.book.bookCompletions?.length && bookLink.book.bookCompletions[0]?.isCompleted;
            if (!isCompleted) {
              hasUnwatchedContent = true;
              break;
            }
          }
        }
        
        if (hasUnwatchedContent) {
          console.log(`🔄 Fixing "${event.title}" (${event.startDate}) - marked as reviewed but has unwatched content`);
          
          // Reset the review status
          await prisma.userEventReview.update({
            where: { id: event.user_event_reviews.id },
            data: {
              reviewed: false,
              reviewedAt: null
            }
          });
          
          fixedCount++;
        }
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} incorrectly marked events`);
    
  } catch (error) {
    console.error('Error fixing review statuses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixIncorrectReviewStatuses();