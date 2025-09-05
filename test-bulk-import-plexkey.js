// Test script to verify bulk import with plexKey
async function testBulkImportWithPlexKey() {
  try {
    console.log('🧪 Testing bulk import with plexKey...');
    
    // First, create a test custom order
    const createOrderResponse = await fetch('http://localhost:3001/api/custom-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Order for PlexKey Title Preservation',
        description: 'Testing that imported titles are preserved even with plexKey'
      })
    });
    
    if (!createOrderResponse.ok) {
      throw new Error(`Failed to create test order: ${createOrderResponse.status}`);
    }
    
    const customOrder = await createOrderResponse.json();
    console.log(`✅ Created test custom order: ${customOrder.id}`);
    
    // Test data with a plexKey and custom title that should be preserved
    const testEpisodeData = {
      mediaType: 'episode',
      title: 'Custom Episode Title from Import (with PlexKey)',
      plexKey: '12345', // This simulates an existing Plex episode
      seriesTitle: 'Test Series',
      seasonNumber: 1,
      episodeNumber: 1
    };
    
    console.log(`📺 Testing episode import with plexKey and title: "${testEpisodeData.title}"`);
    
    // Simulate the bulk import request
    const response = await fetch(`http://localhost:3001/api/custom-orders/${customOrder.id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEpisodeData)
    });
    
    if (response.ok) {
      const createdItem = await response.json();
      console.log(`✅ Item created with title: "${createdItem.title}"`);
      console.log(`✅ Item created with customTitle: "${createdItem.customTitle}"`);
      console.log(`✅ Item created with plexKey: "${createdItem.plexKey}"`);
      
      if (createdItem.title === testEpisodeData.title) {
        console.log('🎉 SUCCESS: Title was preserved from import even with plexKey!');
      } else {
        console.log(`❌ FAILED: Title was changed to "${createdItem.title}" instead of "${testEpisodeData.title}"`);
        console.log('📋 Full item data:', JSON.stringify(createdItem, null, 2));
      }
      
    } else {
      console.log(`❌ Request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
    // Cleanup - delete the test order (this should cascade delete the items)
    const deleteResponse = await fetch(`http://localhost:3001/api/custom-orders/${customOrder.id}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.ok) {
      console.log('🧹 Cleaned up test data');
    } else {
      console.log('⚠️  Failed to cleanup test data - you may need to delete manually');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBulkImportWithPlexKey();

module.exports = { testBulkImportWithPlexKey };
