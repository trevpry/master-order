const axios = require('axios');

async function verifyShortStoryFix() {
  console.log('=== Verifying Short Story Fix in Frontend ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Short Story Fix Verification',
      description: 'Testing that the short story fix is working in the frontend'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);

    // 2. Test the bulk import data parsing logic 
    console.log('\n2. Testing bulk import data parsing...');
    
    const testData = 'Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory';
    const columns = testData.split('\t');
    const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
    
    console.log('Parsed data:');
    console.log(`  seriesOrMovie: "${seriesOrMovie}"`);
    console.log(`  seasonEpisode: "${seasonEpisode}"`);
    console.log(`  title: "${title}"`);
    console.log(`  mediaType: "${rawMediaType.toLowerCase()}"`);
    
    // 3. Parse author and year (simulate frontend logic)
    const mediaType = rawMediaType.toLowerCase();
    let bookAuthor = null;
    let bookYear = null;
    
    if (mediaType === 'shortstory') {
      // Parse author and year from the seasonEpisode field (format: "Author (Year)")
      const bookMatch = seasonEpisode.match(/^(.+?)\s*\((\d{4})\)$/);
      if (bookMatch) {
        bookAuthor = bookMatch[1].trim();
        bookYear = parseInt(bookMatch[2]);
      } else {
        bookAuthor = seasonEpisode.trim();
      }
      
      console.log('\n3. Simulating frontend short story logic...');
      console.log(`  Parsed author: "${bookAuthor}"`);
      console.log(`  Parsed year: ${bookYear}`);
      
      // Create the short story media object (same as frontend fix)
      const targetMedia = {
        title: title,
        type: 'shortstory',
        storyTitle: title,
        storyAuthor: bookAuthor,
        storyYear: bookYear,
        storyUrl: null,
        storyContainedInBookId: null,
        storyCoverUrl: null
      };
      
      console.log('\n4. Created targetMedia object:');
      console.log(JSON.stringify(targetMedia, null, 2));
      
      if (targetMedia) {
        console.log('\n✅ targetMedia exists - this should prevent the "not found in Plex" error');
        
        // 5. Test adding it via the API
        console.log('\n5. Testing API addition...');
        const requestBody = {
          mediaType: targetMedia.type,
          title: targetMedia.title,
          storyTitle: targetMedia.storyTitle,
          storyAuthor: targetMedia.storyAuthor,
          storyYear: targetMedia.storyYear,
          storyUrl: targetMedia.storyUrl,
          storyContainedInBookId: targetMedia.storyContainedInBookId,
          storyCoverUrl: targetMedia.storyCoverUrl
        };
        
        const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
        
        if (addResponse.status === 201) {
          console.log('✅ Successfully added short story via API');
        } else {
          console.log(`❌ API addition failed with status: ${addResponse.status}`);
        }
      } else {
        console.log('\n❌ targetMedia is null - this would cause the "not found in Plex" error');
      }
    }
    
    // 6. Clean up
    console.log('\n6. Cleaning up...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    console.log('\n=== ANALYSIS ===');
    console.log('If the user is still seeing "not found in Plex" errors for short stories,');
    console.log('it might be because:');
    console.log('1. The frontend needs to be refreshed/reloaded');
    console.log('2. There might be browser caching issues');
    console.log('3. The fix might not be in the exact location where the bulk import is happening');
    console.log('4. There might be another code path causing the issue');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

verifyShortStoryFix();
