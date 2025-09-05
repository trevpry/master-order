// Test script to verify bulk import title preservation
async function testBulkImportTitlePreservation() {
  try {
    console.log('🧪 Testing bulk import title preservation...');
    
    // First, create a test custom order
    const createOrderResponse = await fetch('http://localhost:3001/api/custom-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Order for Title Preservation',
        description: 'Testing that imported titles are preserved'
      })
    });
    
    if (!createOrderResponse.ok) {
      throw new Error(`Failed to create test order: ${createOrderResponse.status}`);
    }
    
    const customOrder = await createOrderResponse.json();
    console.log(`✅ Created test custom order: ${customOrder.id}`);
    
    // Test data with a custom title that should be preserved
    const testEpisodeData = {
      mediaType: 'episode',
      title: 'Custom Episode Title from Import',
      seriesTitle: 'Doctor Who',
      seasonNumber: 14,
      episodeNumber: 1
    };
    
    console.log(`📺 Testing episode import with title: "${testEpisodeData.title}"`);
    
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
      
      if (createdItem.title === testEpisodeData.title) {
        console.log('🎉 SUCCESS: Title was preserved from import!');
      } else {
        console.log(`❌ FAILED: Title was changed to "${createdItem.title}" instead of "${testEpisodeData.title}"`);
      }
      
      // Test movie import as well
      console.log('\n🎬 Testing movie import...');
      const testMovieData = {
        mediaType: 'movie',
        title: 'Custom Movie Title from Import'
      };
      
      const movieResponse = await fetch(`http://localhost:3001/api/custom-orders/${customOrder.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMovieData)
      });
      
      if (movieResponse.ok) {
        const createdMovie = await movieResponse.json();
        console.log(`✅ Movie created with title: "${createdMovie.title}"`);
        
        if (createdMovie.title === testMovieData.title) {
          console.log('🎉 SUCCESS: Movie title was preserved from import!');
        } else {
          console.log(`❌ FAILED: Movie title was changed to "${createdMovie.title}" instead of "${testMovieData.title}"`);
        }
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

// Run the test if server is running
if (require.main === module) {
  testBulkImportTitlePreservation();
}

module.exports = { testBulkImportTitlePreservation };
