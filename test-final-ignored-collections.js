// Final verification test for ignored collections feature
const axios = require('axios');

async function testIgnoredCollectionsEndToEnd() {
  console.log('🎯 IGNORED COLLECTIONS - FINAL END-TO-END TEST');
  console.log('=' .repeat(60));
  
  try {
    // 1. Test that API endpoints are working
    console.log('\n1️⃣  Testing API endpoints...');
    
    // Test settings endpoint
    const settingsResponse = await axios.get('http://localhost:3001/api/settings');
    console.log('✅ Settings API is working');
    console.log('   Current ignored movie collections:', settingsResponse.data.ignoredMovieCollections);
    console.log('   Current ignored TV collections:', settingsResponse.data.ignoredTVCollections);
    
    // Test collections endpoint
    const collectionsResponse = await axios.get('http://localhost:3001/api/plex/collections');
    console.log('✅ Collections API is working');
    console.log(`   Total collections available: ${collectionsResponse.data.length}`);
    
    // Test up_next endpoint
    const upNextResponse = await axios.get('http://localhost:3001/api/up_next');
    console.log('✅ Up Next API is working');
    console.log(`   Selected content: "${upNextResponse.data.title}" (${upNextResponse.data.type})`);
    
    // 2. Test ignored collections filtering
    console.log('\n2️⃣  Testing ignored collections filtering...');
    
    // Check if the selected content is NOT from ignored collections
    const selectedTitle = upNextResponse.data.title;
    const selectedCollections = upNextResponse.data.collections || '';
    const ignoredMovieCollections = settingsResponse.data.ignoredMovieCollections || [];
    const ignoredTVCollections = settingsResponse.data.ignoredTVCollections || [];
    
    console.log(`   Selected title: "${selectedTitle}"`);
    console.log(`   Selected collections: "${selectedCollections}"`);
    
    let isFromIgnoredCollection = false;
    
    if (upNextResponse.data.type === 'movie') {
      isFromIgnoredCollection = ignoredMovieCollections.some(ignored => 
        selectedCollections.toLowerCase().includes(ignored.toLowerCase())
      );
    } else if (upNextResponse.data.type === 'tv') {
      isFromIgnoredCollection = ignoredTVCollections.some(ignored => 
        selectedCollections.toLowerCase().includes(ignored.toLowerCase())
      );
    }
    
    if (isFromIgnoredCollection) {
      console.log('⚠️  WARNING: Selected content is from an ignored collection!');
      console.log('   This might indicate the filtering is not working correctly.');
    } else {
      console.log('✅ Selected content is NOT from ignored collections - filtering works!');
    }
    
    // 3. Test multiple selections to verify consistency
    console.log('\n3️⃣  Testing multiple selections for consistency...');
    
    const selections = [];
    for (let i = 0; i < 5; i++) {
      const response = await axios.get('http://localhost:3001/api/up_next');
      selections.push({
        title: response.data.title,
        type: response.data.type,
        collections: response.data.collections || ''
      });
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('   Multiple selections:');
    selections.forEach((selection, index) => {
      const collections = selection.collections.split(',').map(c => c.trim()).filter(c => c);
      console.log(`   ${index + 1}. "${selection.title}" (${selection.type}) - Collections: [${collections.join(', ')}]`);
    });
    
    // Check if any selections are from ignored collections
    let problemSelections = 0;
    selections.forEach(selection => {
      const isFromIgnored = (selection.type === 'movie' && 
        ignoredMovieCollections.some(ignored => 
          selection.collections.toLowerCase().includes(ignored.toLowerCase())
        )) || (selection.type === 'tv' && 
        ignoredTVCollections.some(ignored => 
          selection.collections.toLowerCase().includes(ignored.toLowerCase())
        ));
      
      if (isFromIgnored) {
        problemSelections++;
      }
    });
    
    console.log(`\n📊 RESULTS:`);
    console.log(`   Total selections tested: ${selections.length}`);
    console.log(`   Selections from ignored collections: ${problemSelections}`);
    console.log(`   Success rate: ${((selections.length - problemSelections) / selections.length * 100).toFixed(1)}%`);
    
    // 4. Final summary
    console.log('\n🎉 FINAL STATUS:');
    if (problemSelections === 0) {
      console.log('✅ IGNORED COLLECTIONS FEATURE IS WORKING PERFECTLY!');
      console.log('   - All API endpoints are functional');
      console.log('   - Filtering logic is working correctly');
      console.log('   - No content from ignored collections was selected');
    } else {
      console.log('⚠️  IGNORED COLLECTIONS FEATURE HAS ISSUES:');
      console.log(`   - ${problemSelections} out of ${selections.length} selections were from ignored collections`);
      console.log('   - This suggests the filtering logic may need adjustment');
    }
    
  } catch (error) {
    console.error('❌ Error during end-to-end test:', error.message);
    console.error('   This indicates there are still issues with the implementation');
  }
}

testIgnoredCollectionsEndToEnd();
