const ActivityStatsService = require('./server/services/watchlog/activityStatsService');

async function test() {
  try {
    console.log('Testing Christopher L. Bennett page count after fix...');
    const service = new ActivityStatsService();
    const bookStats = await service.getMediaTypeStats('book');
    
    if (bookStats && bookStats.authorBreakdown) {
      console.log(`Found ${bookStats.authorBreakdown.length} authors`);
      
      const bennettStats = bookStats.authorBreakdown.find(a => 
        a.name.includes('Christopher L. Bennett')
      );
      
      if (bennettStats) {
        console.log('\n=== CHRISTOPHER L. BENNETT STATS (AFTER FIX) ===');
        console.log(`Total pages read: ${bennettStats.totalPagesRead}`);
        console.log(`Book count: ${bennettStats.bookCount}`);
        console.log(`Completed books: ${bennettStats.completedBooks}`);
        console.log('Books:', bennettStats.books.map(b => `"${b.title}"`).join(', '));
        
        if (bennettStats.totalPagesRead === 368) {
          console.log('\n✅ SUCCESS: Page count is now correct (368 pages)!');
        } else if (bennettStats.totalPagesRead === 993) {
          console.log('\n❌ ISSUE: Still showing inflated page count (993 pages)');
        } else {
          console.log(`\n⚠️  UNEXPECTED: Page count is ${bennettStats.totalPagesRead}`);
        }
      } else {
        console.log('\nChristopher L. Bennett not found in author stats');
        console.log('Available authors:', bookStats.authorBreakdown.slice(0, 5).map(a => a.name));
      }
    } else {
      console.log('No book stats or author breakdown found');
    }
  } catch (error) {
    console.error('Error testing stats:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

test();
