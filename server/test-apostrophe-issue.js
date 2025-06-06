/**
 * Test apostrophe handling in ComicVine search
 * Specifically test the "Penguin's Big Score" title matching
 */

const axios = require('axios');

async function testApostropheHandling() {
  console.log('🧪 Testing apostrophe handling in ComicVine search...\n');
  
  try {
    // Test the backend API directly
    const query = 'Batman Adventures';
    const issueNumber = 1;
    const issueTitle = "Penguin's Big Score";
    
    console.log(`🔍 Testing backend API:`);
    console.log(`   Query: "${query}"`);
    console.log(`   Issue: #${issueNumber}`);
    console.log(`   Title: "${issueTitle}"`);
    
    // Test URL encoding
    const encodedTitle = encodeURIComponent(issueTitle);
    console.log(`   Encoded title: "${encodedTitle}"`);
    
    // Make the API call
    const searchUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(query)}&issueNumber=${encodeURIComponent(issueNumber)}&issueTitle=${encodedTitle}`;
    console.log(`   Full URL: ${searchUrl}`);
    
    const response = await axios.get(searchUrl);
    const results = response.data;
    
    console.log(`\n📚 Found ${results.length} results:`);
    
    results.forEach((result, index) => {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log(`Series: ${result.name}`);
      console.log(`Year: ${result.start_year}`);
      console.log(`Issue Title: "${result.issueName}"`);
      
      // Test title matching logic
      if (result.issueName) {
        const resultTitle = result.issueName.toLowerCase().trim();
        const targetTitle = issueTitle.toLowerCase().trim();
        
        const exactMatch = resultTitle === targetTitle;
        const partialMatch = resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle);
        
        console.log(`Exact match: ${exactMatch ? '✅' : '❌'}`);
        console.log(`Partial match: ${partialMatch ? '✅' : '❌'}`);
        
        // Check apostrophe handling specifically
        const resultApostrophe = resultTitle.includes("'");
        const targetApostrophe = targetTitle.includes("'");
        console.log(`Result has apostrophe: ${resultApostrophe}`);
        console.log(`Target has apostrophe: ${targetApostrophe}`);
        
        if (resultApostrophe && targetApostrophe) {
          console.log(`Both have apostrophes - should match properly`);
        }
      }
    });
    
    // Test the frontend logic
    console.log(`\n🎯 Testing frontend selection logic:`);
    
    if (results.length > 0) {
      const firstResult = results[0];
      console.log(`Frontend would select: "${firstResult.name}" with issue title: "${firstResult.issueName}"`);
      
      // Check if this is the expected result
      const expectedSeries = "The Batman Adventures";
      const isCorrectSeries = firstResult.name.includes(expectedSeries) || firstResult.name.includes("Batman Adventures");
      
      console.log(`Is correct series selection: ${isCorrectSeries ? '✅' : '❌'}`);
      
      if (firstResult.issueName && issueTitle) {
        const titleMatches = firstResult.issueName.toLowerCase().includes(issueTitle.toLowerCase());
        console.log(`Title matches: ${titleMatches ? '✅' : '❌'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testApostropheHandling();
