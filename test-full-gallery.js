const fetch = require('node-fetch');

async function testFullGalleryDownload() {
  console.log('🚀 Testing full gallery download functionality...');
  
  const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh';
  
  try {
    // First get the gallery preview to see all images
    const previewResponse = await fetch('http://localhost:3001/api/backgrounds/gallery-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });
    
    const preview = await previewResponse.json();
    console.log(`📊 Found ${preview.images.length} images in gallery`);
    
    // Try downloading first 5 images
    const downloadResults = [];
    for (let i = 0; i < Math.min(5, preview.images.length); i++) {
      try {
        console.log(`📥 Downloading image ${i + 1}/${preview.images.length}...`);
        
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
          const result = await downloadResponse.json();
          downloadResults.push(result);
          console.log(`✅ Downloaded: ${result.filename} (ID: ${result.id}, Size: ${(result.size / 1024).toFixed(1)}KB)`);
        } else {
          const error = await downloadResponse.json();
          console.log(`❌ Failed: ${error.error}`);
        }
      } catch (error) {
        console.log(`❌ Error downloading image ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`\n📈 Download Summary:`);
    console.log(`✅ Successfully downloaded: ${downloadResults.length} images`);
    console.log(`📊 Total size: ${(downloadResults.reduce((sum, img) => sum + img.size, 0) / 1024 / 1024).toFixed(2)}MB`);
    
    // Test bulk download option
    console.log('\n🚀 Testing bulk gallery download...');
    
    const bulkResponse = await fetch('http://localhost:3001/api/backgrounds/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });
    
    if (bulkResponse.ok) {
      const bulkResult = await bulkResponse.json();
      if (bulkResult.results) {
        console.log(`✅ Bulk download completed!`);
        console.log(`📊 Downloaded: ${bulkResult.results.length} images`);
        console.log(`📈 Success rate: ${(bulkResult.results.filter(r => r.success).length / bulkResult.results.length * 100).toFixed(1)}%`);
      } else {
        console.log(`✅ Single image downloaded: ${bulkResult.filename}`);
      }
    } else {
      console.log(`❌ Bulk download failed: ${bulkResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFullGalleryDownload();
