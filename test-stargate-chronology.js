// Test Stargate collection chronology specifically
require('dotenv').config();
const getNextEpisode = require('./server/getNextEpisode');

console.log('🚀 Starting Stargate chronology test...');

async function testStargateChronology() {
  console.log('🧪 Testing Stargate Collection Chronology');
  console.log('=' .repeat(50));
  
  try {
    // We'll manually run TV General logic multiple times until we get Stargate
    for (let i = 1; i <= 10; i++) {
      console.log(`\n🔄 Test Attempt #${i}`);
      console.log('-'.repeat(30));
      
      const result = await getNextEpisode();
      
      if (result.orderType === 'TV_GENERAL' && result.title && result.title.includes('Stargate')) {
        console.log('✅ Stargate TV Selection Result:');
        console.log(`   Title: ${result.title}`);
        console.log(`   Type: ${result.libraryType || 'tv'}`);
        console.log(`   Originally Available At: ${result.originallyAvailableAt || result.year || 'N/A'}`);
        
        if (result.currentSeason && result.currentEpisode) {
          console.log(`   Next Episode: S${result.currentSeason}E${result.currentEpisode} - ${result.nextEpisodeTitle}`);
        }
        
        if (result.otherCollections && result.otherCollections.length > 0) {
          console.log(`   Other Collections Found: ${result.otherCollections.length}`);
          result.otherCollections.forEach(collection => {
            console.log(`     - ${collection.title} (${collection.items.length} items)`);
          });
        }
        
        console.log('\n🎯 CHRONOLOGY CHECK:');
        console.log('   Expected order: SG-1 (2001-02-02) should come before Atlantis (2004-07-15)');
        
        if (result.title === 'Stargate SG-1') {
          console.log('   ✅ CORRECT: SG-1 was selected (earliest episode date)');
        } else if (result.title === 'Stargate Atlantis') {
          console.log('   ❌ INCORRECT: Atlantis was selected instead of SG-1');
        } else {
          console.log(`   ℹ️  OTHER: ${result.title} was selected`);
        }
        
        break;
      } else if (result.orderType === 'TV_GENERAL') {
        console.log(`🔀 Got TV General "${result.title || 'Unknown'}" instead, trying again...`);
      } else {
        console.log(`🔀 Got ${result.orderType} instead, trying again...`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testStargateChronology();
