const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testCompleteComicWorkflow() {
  console.log('🧪 Testing Complete ComicVine Integration Workflow');
  console.log('='.repeat(60));

  try {
    // 1. Test up_next API to get a comic
    console.log('\n1. Testing up_next API...');
    const upNextResponse = await axios.get(`${API_BASE}/up_next`);
    console.log('✅ up_next API working');
    
    if (upNextResponse.data.type === 'comic') {
      console.log(`📚 Got comic: ${upNextResponse.data.title}`);
      console.log(`📖 Series: ${upNextResponse.data.comicDetails?.seriesName}`);
      console.log(`📅 Year: ${upNextResponse.data.comicDetails?.year}`);
      console.log(`🔢 Issue: ${upNextResponse.data.comicDetails?.issueNumber}`);
      
      if (upNextResponse.data.comicDetails?.coverUrl) {
        console.log('🖼️  Cover URL found');
        
        // 2. Test artwork proxy with the cover URL
        console.log('\n2. Testing artwork proxy...');
        const artworkUrl = `${API_BASE}/comicvine-artwork?url=${encodeURIComponent(upNextResponse.data.comicDetails.coverUrl)}`;
        
        const artworkResponse = await axios.head(artworkUrl);
        
        if (artworkResponse.status === 200) {
          console.log('✅ Artwork proxy working');
          console.log(`📏 Content-Type: ${artworkResponse.headers['content-type']}`);
        } else {
          console.log('❌ Artwork proxy failed');
        }
      } else {
        console.log('⚠️  No cover URL in comic details');
      }
    } else {
      console.log(`⚠️  Got ${upNextResponse.data.type} instead of comic, trying again...`);
      // Try a few more times to get a comic
      for (let i = 0; i < 5; i++) {
        const retryResponse = await axios.get(`${API_BASE}/up_next`);
        if (retryResponse.data.type === 'comic') {
          console.log(`📚 Got comic on retry ${i + 1}: ${retryResponse.data.title}`);
          break;
        }
      }
    }

    // 3. Test ComicVine search functionality
    console.log('\n3. Testing ComicVine search...');
    const searchResponse = await axios.get(`${API_BASE}/comicvine/search?query=Batman`);
    
    if (searchResponse.data && searchResponse.data.length > 0) {
      console.log('✅ ComicVine search working');
      console.log(`📊 Found ${searchResponse.data.length} Batman series results`);
      console.log(`📚 First result: ${searchResponse.data[0].name} (ID: ${searchResponse.data[0].id})`);
    } else {
      console.log('❌ ComicVine search failed or returned no results');
    }

    // 4. Test custom orders list
    console.log('\n4. Testing custom orders API...');
    const ordersResponse = await axios.get(`${API_BASE}/custom-orders`);
    
    if (ordersResponse.data && ordersResponse.data.length > 0) {
      console.log('✅ Custom orders API working');
      console.log(`📋 Found ${ordersResponse.data.length} custom orders`);
      
      // Find orders with comics
      const ordersWithComics = ordersResponse.data.filter(order => 
        order.items && order.items.some(item => item.mediaType === 'comic')
      );
      
      console.log(`📚 Orders with comics: ${ordersWithComics.length}`);
      
      ordersWithComics.forEach(order => {
        const comicCount = order.items.filter(item => item.mediaType === 'comic').length;
        console.log(`  - "${order.name}": ${comicCount} comics`);
      });
    } else {
      console.log('❌ Custom orders API failed or returned no results');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ComicVine Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testCompleteComicWorkflow();
