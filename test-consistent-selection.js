const { PrismaClient } = require('./server/node_modules/@prisma/client');
const getNextEpisode = require('./server/getNextEpisode');

async function testConsistentSelection() {
  try {
    console.log('🧪 Testing consistent TV selection (looking for Big Bang Theory vs Young Sheldon)...');
    
    // Run the selection multiple times to check for consistency
    const results = [];
    for (let i = 0; i < 5; i++) {
      console.log(`\\n--- Test ${i + 1} ---`);
      const result = await getNextEpisode();
      
      if (result && result.title) {
        console.log(`Selected: ${result.title} (${result.grandparentTitle || result.seriesTitle || 'Unknown Series'})`);
        results.push({
          title: result.title,
          series: result.grandparentTitle || result.seriesTitle || result.title,
          orderType: result.orderType
        });
      } else {
        console.log('No result returned');
        results.push({ error: 'No result' });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\\n📊 Summary of selections:');
    const seriesCounts = {};
    results.forEach((result, index) => {
      if (result.series) {
        seriesCounts[result.series] = (seriesCounts[result.series] || 0) + 1;
        console.log(`${index + 1}. ${result.series}: ${result.title} (${result.orderType})`);
      } else {
        console.log(`${index + 1}. Error or no result`);
      }
    });
    
    console.log('\\n📈 Series selection frequency:');
    Object.keys(seriesCounts).forEach(series => {
      console.log(`- ${series}: ${seriesCounts[series]} times`);
    });
    
    // Check if selection is consistent for TV_GENERAL
    const tvGeneralResults = results.filter(r => r.orderType === 'TV_GENERAL');
    if (tvGeneralResults.length > 1) {
      const uniqueSeries = new Set(tvGeneralResults.map(r => r.series));
      if (uniqueSeries.size === 1) {
        console.log('\\n✅ TV_GENERAL selections are consistent!');
      } else {
        console.log('\\n❌ TV_GENERAL selections are inconsistent - this indicates the tiebreaker fix is needed');
      }
    } else {
      console.log('\\n🔄 Not enough TV_GENERAL results to test consistency (mostly custom orders selected)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConsistentSelection();
