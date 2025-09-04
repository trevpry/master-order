const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testAndroidUpNext() {
  console.log('🧪 Testing Android up-next endpoint with custom order playlist/gallery info...');
  
  try {
    // Test the Android up-next endpoint
    console.log('\n1. Testing /api/android/up-next endpoint...');
    const response = await fetch(`${API_BASE_URL}/api/android/up-next`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('\n📱 Android up-next response:', JSON.stringify(data, null, 2));
    
    // Check if it's a custom order item and has the new fields
    if (data.type === 'PLAY_CUSTOM_ORDER_ITEM') {
      console.log('\n✅ Custom order item detected!');
      console.log(`📋 Order Name: ${data.data.orderName}`);
      console.log(`🎵 Playlist Name: ${data.data.playlistName || 'None'}`);
      console.log(`🎵 Playlist Type: ${data.data.playlistType || 'None'}`);
      console.log(`🖼️ Background Gallery Name: ${data.data.backgroundGalleryName || 'None'}`);
      console.log(`🖼️ Background Gallery ID: ${data.data.backgroundGalleryId || 'None'}`);
      
      if (data.data.playlistName || data.data.backgroundGalleryName) {
        console.log('\n🎉 SUCCESS: Additional custom order information is included!');
      } else {
        console.log('\n⚠️ Custom order found but no playlist/gallery associated');
      }
    } else {
      console.log(`\n📺 Non-custom order item: ${data.type}`);
      console.log('💡 To test custom order features, make sure a custom order with playlist/gallery is active');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure the development server is running with: npm run dev');
    }
  }
}

// Run the test
testAndroidUpNext();
