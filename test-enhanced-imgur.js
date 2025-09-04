const fetch = require('node-fetch');

async function testImgurGallery() {
  console.log('🔍 Testing enhanced Imgur gallery extraction...');
  
  const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh';
  
  try {
    const response = await fetch('http://localhost:3001/api/backgrounds/gallery-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('📊 Gallery Preview Results:');
    console.log(`✅ Gallery Title: ${result.galleryTitle}`);
    console.log(`🖼️ Total Images Found: ${result.images.length}`);
    
    if (result.images.length > 0) {
      console.log('\n📋 First 10 images:');
      result.images.slice(0, 10).forEach((img, index) => {
        console.log(`  ${index + 1}. ${img.title || 'Untitled'}`);
        console.log(`     URL: ${img.url}`);
      });
      
      if (result.images.length > 10) {
        console.log(`  ... and ${result.images.length - 10} more images`);
      }
    }
    
    // Test downloading a few images
    if (result.images.length > 0) {
      console.log('\n🚀 Testing download of first 3 images...');
      
      for (let i = 0; i < Math.min(3, result.images.length); i++) {
        const image = result.images[i];
        console.log(`\n📥 Downloading image ${i + 1}: ${image.title || 'Untitled'}`);
        
        try {
          const downloadResponse = await fetch('http://localhost:3001/api/backgrounds/gallery-download-specific', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              url: testUrl,
              imageIndex: i
            })
          });
          
          if (downloadResponse.ok) {
            const downloadResult = await downloadResponse.json();
            console.log(`✅ Downloaded: ID ${downloadResult.id}, File: ${downloadResult.filename}`);
          } else {
            console.log(`❌ Download failed: ${downloadResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ Download error: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImgurGallery();
