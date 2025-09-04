const fetch = require('node-fetch');

async function testDifferentGalleryTypes() {
  console.log('🔍 Testing different Imgur gallery formats...');
  
  const testUrls = [
    'https://imgur.com/gallery/star-wars-wallpapers-W4lOh', // Gallery format
    // Add more test URLs here for different formats when available
  ];
  
  for (const url of testUrls) {
    console.log(`\n📋 Testing URL: ${url}`);
    
    try {
      const response = await fetch('http://localhost:3001/api/backgrounds/gallery-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Success: Found ${result.images.length} images`);
        console.log(`📝 Gallery: ${result.galleryTitle}`);
        
        // Show sample images
        if (result.images.length > 0) {
          console.log(`🖼️ Sample images:`);
          result.images.slice(0, 3).forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.url}`);
          });
        }
      } else {
        const error = await response.json();
        console.log(`❌ Failed: ${error.error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✅ Gallery format testing complete!');
}

testDifferentGalleryTypes();
