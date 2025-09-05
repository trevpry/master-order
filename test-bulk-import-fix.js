// Test script to verify the bulk import title preservation fix
async function testBulkImportFix() {
  try {
    console.log('🧪 Testing bulk import title preservation fix...');
    
    // First, let's check if the Batman episode still has the wrong title
    const dcOrderResponse = await fetch('http://localhost:3001/api/custom-orders/1');
    const dcOrder = await dcOrderResponse.json();
    
    const batmanEpisode = dcOrder.items.find(item => 
      item.seriesTitle === 'Batman: The Animated Series' && 
      item.seasonNumber === 1 && 
      item.episodeNumber === 11
    );
    
    if (batmanEpisode) {
      console.log(`Found existing Batman S01E11 with title: "${batmanEpisode.title}"`);
      
      // Delete it so we can test the fix
      const deleteResponse = await fetch(`http://localhost:3001/api/custom-orders/1/items/${batmanEpisode.id}`, {
        method: 'DELETE'
      });
      
      if (deleteResponse.ok) {
        console.log('✅ Deleted existing Batman episode to test fix');
      }
    }
    
    // Now test with a direct API call to simulate what the frontend will do
    const testEpisodeData = {
      mediaType: 'episode',
      title: 'Two Face, Part II',  // The title we want to preserve
      seriesTitle: 'Batman: The Animated Series',
      seasonNumber: 1,
      episodeNumber: 11,
      plexKey: '3219'  // The same plexKey but with our custom title
    };
    
    console.log(`📺 Testing episode import with preserved title: "${testEpisodeData.title}"`);
    
    const response = await fetch('http://localhost:3001/api/custom-orders/1/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEpisodeData)
    });
    
    if (response.ok) {
      const createdItem = await response.json();
      console.log(`✅ Item created with title: "${createdItem.title}"`);
      
      if (createdItem.title === testEpisodeData.title) {
        console.log('🎉 SUCCESS: Direct API call preserves title correctly!');
        console.log('Now you can test the frontend bulk import with the same data.');
      } else {
        console.log(`❌ FAILED: Title was changed to "${createdItem.title}" instead of "${testEpisodeData.title}"`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Request failed: ${response.status} ${response.statusText}`);
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBulkImportFix();
