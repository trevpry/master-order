const axios = require('axios');

async function testComicReselection() {
  try {
    console.log('🔍 Testing comic re-selection artwork caching...\n');
    
    // First, get all custom orders to find one with comics
    console.log('1. Fetching custom orders...');
    const ordersResponse = await axios.get('http://localhost:3001/api/custom-orders');
    const orders = ordersResponse.data;
    
    console.log(`Found ${orders.length} custom orders`);
    
    // Find an order with comics
    let targetOrder = null;
    let targetComic = null;
    
    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        const comic = order.items.find(item => item.mediaType === 'comic');
        if (comic) {
          targetOrder = order;
          targetComic = comic;
          break;
        }
      }
    }
    
    if (!targetComic) {
      console.log('❌ No comic items found in any custom order');
      return;
    }
    
    console.log(`\n2. Found comic to re-select:`);
    console.log(`   Order: "${targetOrder.name}" (ID: ${targetOrder.id})`);
    console.log(`   Comic: "${targetComic.title}"`);
    console.log(`   Series: ${targetComic.comicSeries} (${targetComic.comicYear}) #${targetComic.comicIssue}`);
    console.log(`   Current local artwork: ${targetComic.localArtworkPath || 'none'}`);
    
    // Search for the same comic to get fresh ComicVine data
    console.log(`\n3. Searching for comic series "${targetComic.comicSeries}"...`);
    const searchResponse = await axios.post('http://localhost:3001/api/search-comics', {
      series: targetComic.comicSeries,
      year: targetComic.comicYear,
      issue: targetComic.comicIssue
    });
    
    if (!searchResponse.data || searchResponse.data.length === 0) {
      console.log('❌ No comic series found in search');
      return;
    }
    
    const comicSeries = searchResponse.data[0]; // Use first result
    console.log(`   Found series: "${comicSeries.name}" (ID: ${comicSeries.api_detail_url})`);
    
    // Re-select the comic (this should trigger artwork caching)
    console.log(`\n4. Re-selecting comic to trigger artwork caching...`);
    const updateData = {
      comicVineId: comicSeries.api_detail_url,
      comicVineDetailsJson: JSON.stringify(comicSeries)
    };
    
    const updateResponse = await axios.put(
      `http://localhost:3001/api/custom-orders/${targetOrder.id}/items/${targetComic.id}`, 
      updateData
    );
    
    console.log('✅ Comic re-selection completed');
    console.log('Response:', updateResponse.data);
    
    // Wait a moment for artwork caching to complete
    console.log('\n5. Waiting 3 seconds for artwork caching...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check the updated comic item
    console.log('\n6. Checking updated comic item...');
    const updatedOrderResponse = await axios.get(`http://localhost:3001/api/custom-orders/${targetOrder.id}/items`);
    const updatedComic = updatedOrderResponse.data.items.find(item => item.id === targetComic.id);
    
    if (updatedComic) {
      console.log(`   Updated local artwork: ${updatedComic.localArtworkPath || 'none'}`);
      console.log(`   Original artwork URL: ${updatedComic.originalArtworkUrl || 'none'}`);
      console.log(`   Last cached: ${updatedComic.artworkLastCached || 'never'}`);
      console.log(`   MIME type: ${updatedComic.artworkMimeType || 'none'}`);
      
      if (updatedComic.localArtworkPath) {
        console.log('\n✅ SUCCESS: Artwork was cached!');
      } else {
        console.log('\n❌ ISSUE: Artwork was not cached');
      }
    } else {
      console.log('❌ Could not find updated comic item');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testComicReselection();
