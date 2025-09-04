const fetch = require('node-fetch');

async function testImageAccess() {
  console.log('Testing background image access...');
  
  try {
    // Get all backgrounds
    const listResponse = await fetch('http://localhost:3001/api/backgrounds');
    
    if (!listResponse.ok) {
      console.log('❌ Failed to fetch backgrounds list');
      return;
    }
    
    const backgrounds = await listResponse.json();
    console.log(`📋 Found ${backgrounds.length} background images`);
    
    if (backgrounds.length > 0) {
      const latestBg = backgrounds[backgrounds.length - 1];
      console.log(`🔍 Testing access to background ID ${latestBg.id}...`);
      
      // Test image serving endpoint
      const imageResponse = await fetch(`http://localhost:3001/api/backgrounds/${latestBg.id}/image`);
      
      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get('content-type');
        const contentLength = imageResponse.headers.get('content-length');
        console.log('✅ Image serving works!');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength} bytes`);
        console.log(`   Status: ${imageResponse.status} ${imageResponse.statusText}`);
      } else {
        console.log(`❌ Image serving failed: ${imageResponse.status} ${imageResponse.statusText}`);
      }
    }
    
    // Test deleting one of the test images
    if (backgrounds.length > 1) {
      const bgToDelete = backgrounds[0];
      console.log(`🗑️ Testing delete of background ID ${bgToDelete.id}...`);
      
      const deleteResponse = await fetch(`http://localhost:3001/api/backgrounds/${bgToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (deleteResponse.ok) {
        console.log('✅ Delete operation successful!');
      } else {
        const errorText = await deleteResponse.text();
        console.log(`❌ Delete failed: ${deleteResponse.status} - ${errorText}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testImageAccess();
