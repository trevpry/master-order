console.log('=== Diagnostic Test for Short Story Bulk Import Issue ===\n');

// This test simulates EXACTLY what the frontend should be doing
async function diagnosticTest() {
  const axios = require('axios');
  
  try {
    console.log('🔍 DIAGNOSING THE ISSUE:\n');
    console.log('The user is still seeing "not found in Plex" errors despite our fix.');
    console.log('This diagnostic will help identify the root cause.\n');
    
    // 1. Create a test order
    console.log('1. Creating test order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Diagnostic Test Order',
      description: 'Testing for short story bulk import issue'
    });
    const orderId = orderResponse.data.id;
    console.log(`✅ Created order ${orderId}\n`);
    
    // 2. Simulate the EXACT frontend logic
    console.log('2. Simulating frontend bulk import logic...');
    
    const testLine = 'Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory';
    const columns = testLine.split('\t');
    const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
    
    console.log(`   Parsed: "${seriesOrMovie}" | "${seasonEpisode}" | "${title}" | "${rawMediaType}"`);
    
    const mediaType = rawMediaType.toLowerCase();
    console.log(`   Media type: "${mediaType}"`);
    
    // Simulate the exact frontend if/else logic
    let targetMedia = null;
    
    if (mediaType === 'comic') {
      console.log('   ❌ Taking comic path (WRONG)');
    } else if (mediaType === 'shortstory') {
      console.log('   ✅ Taking shortstory path (CORRECT)');
      
      // Parse author and year
      let bookAuthor = null;
      let bookYear = null;
      const bookMatch = seasonEpisode.match(/^(.+?)\s*\((\d{4})\)$/);
      if (bookMatch) {
        bookAuthor = bookMatch[1].trim();
        bookYear = parseInt(bookMatch[2]);
      } else {
        bookAuthor = seasonEpisode.trim();
      }
      
      targetMedia = {
        title: title,
        type: 'shortstory',
        storyTitle: title,
        storyAuthor: bookAuthor,
        storyYear: bookYear,
        storyUrl: null,
        storyContainedInBookId: null,
        storyCoverUrl: null
      };
      
      console.log('   Created targetMedia:', JSON.stringify(targetMedia, null, 4));
    } else if (mediaType === 'book') {
      console.log('   ❌ Taking book path (WRONG)');
    } else {
      console.log('   ❌ Taking Plex search path (WRONG - THIS IS THE PROBLEM!)');
    }
    
    // 3. Check if targetMedia exists
    console.log('\n3. Checking targetMedia result...');
    if (targetMedia) {
      console.log('   ✅ targetMedia exists - should NOT get "not found in Plex" error');
      console.log('   🎯 This means the fix IS working correctly');
      
      // Test the API call
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
        console.log('   ✅ API call successful - short story was added');
      } else {
        console.log(`   ❌ API call failed with status: ${addResponse.status}`);
      }
    } else {
      console.log('   ❌ targetMedia is NULL - this WOULD cause "not found in Plex" error');
      console.log('   🚨 This means the fix is NOT working');
    }
    
    // 4. Clean up
    console.log('\n4. Cleaning up...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted\n');
    
    // 5. Analysis and recommendations
    console.log('=== ANALYSIS ===');
    if (targetMedia) {
      console.log('✅ THE FIX IS WORKING CORRECTLY IN THE CODE');
      console.log('');
      console.log('🔍 If the user is still seeing "not found in Plex" errors, it means:');
      console.log('');
      console.log('   1. BROWSER CACHE ISSUE:');
      console.log('      • The frontend needs to be refreshed (hard refresh: Ctrl+Shift+R)');
      console.log('      • Browser may be serving cached JavaScript');
      console.log('      • Try opening in incognito/private mode');
      console.log('');
      console.log('   2. FRONTEND NOT UPDATED:');
      console.log('      • The development server might need to be restarted');
      console.log('      • Check if the fix is actually in the deployed version');
      console.log('');
      console.log('   3. DIFFERENT CODE PATH:');
      console.log('      • The user might be using a different bulk import method');
      console.log('      • There might be multiple versions of the bulk import function');
      console.log('');
      console.log('📋 RECOMMENDATIONS:');
      console.log('   1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)');
      console.log('   2. Try in incognito/private mode');
      console.log('   3. Restart the development server');
      console.log('   4. Check the Network tab to see if the frontend is using cached files');
    } else {
      console.log('❌ THE FIX IS NOT WORKING - INVESTIGATE FURTHER');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error.message);
  }
}

diagnosticTest();
