const fetch = require('node-fetch');

async function testWatchStats() {
  try {
    console.log('=== TESTING BOOK STATS ===');
    const bookResponse = await fetch('http://localhost:3001/api/watch-stats/book?period=all');
    const bookData = await bookResponse.json();
    
    console.log('Book stats response structure:');
    console.log('- totalStats keys:', Object.keys(bookData.totalStats || {}));
    console.log('- authorBreakdown keys:', Object.keys(bookData.totalStats?.authorBreakdown || {}));
    
    if (bookData.totalStats?.authorBreakdown?.byReadTime) {
      console.log('- First author by read time:', bookData.totalStats.authorBreakdown.byReadTime[0]);
    }
    
    console.log('- Total pages read:', bookData.totalStats?.totalPagesRead);
    console.log('- First few logs:', bookData.logs?.slice(0, 2));
    
    console.log('\n=== TESTING COMIC STATS ===');
    const comicResponse = await fetch('http://localhost:3001/api/watch-stats/comic?period=all');
    const comicData = await comicResponse.json();
    
    console.log('Comic stats response structure:');
    console.log('- totalStats keys:', Object.keys(comicData.totalStats || {}));
    console.log('- characterBreakdown keys:', Object.keys(comicData.totalStats?.characterBreakdown || {}));
    
    if (comicData.totalStats?.characterBreakdown?.byReadTime) {
      console.log('- Character breakdown by read time length:', comicData.totalStats.characterBreakdown.byReadTime.length);
      console.log('- First character by read time:', comicData.totalStats.characterBreakdown.byReadTime[0]);
    }
    
    if (comicData.totalStats?.characterBreakdown?.byComicCount) {
      console.log('- Character breakdown by comic count length:', comicData.totalStats.characterBreakdown.byComicCount.length);
      console.log('- First character by comic count:', comicData.totalStats.characterBreakdown.byComicCount[0]);
    }
    
    console.log('- First few comic logs:', comicData.logs?.slice(0, 2).map(log => ({
      title: log.title,
      customOrderItem: log.customOrderItem ? {
        comicCharacters: log.customOrderItem.comicCharacters?.substring(0, 100) + '...'
      } : null
    })));
    
  } catch (error) {
    console.error('Error testing watch stats:', error);
  }
}

testWatchStats();