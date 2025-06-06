/**
 * Test Backend Title Matching
 * Demonstrates the issue where the backend doesn't implement title matching
 */

const axios = require('axios');

async function testBackendTitleMatching() {
  console.log('🔍 Testing Backend Title Matching Logic...\n');
  
  try {
    // Test the search that should match "Joker's Late Night Lunacy"
    const query = 'Batman Adventures';
    const issueNumber = 3;
    const expectedTitle = "Joker's Late Night Lunacy";
    
    console.log(`Search query: "${query}"`);
    console.log(`Issue number: ${issueNumber}`);
    console.log(`Expected title: "${expectedTitle}"`);
    
    const searchUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(query)}&issueNumber=${encodeURIComponent(issueNumber)}`;
    console.log(`\nFull URL: ${searchUrl}`);
    
    const response = await axios.get(searchUrl);
    const results = response.data;
    
    console.log(`\n✅ Found ${results.length} results:`);
    
    results.forEach((result, index) => {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log(`Series Name: ${result.name}`);
      console.log(`Series ID: ${result.id}`);
      console.log(`Start Year: ${result.start_year}`);
      console.log(`Issue #${issueNumber} Title: "${result.issueName}"`);
      
      // Check if this is our expected match
      if (result.issueName && result.issueName.toLowerCase().trim() === expectedTitle.toLowerCase().trim()) {
        console.log(`🎯 THIS IS THE CORRECT MATCH!`);
      }
    });
    
    // Test title matching logic (what the frontend does)
    console.log(`\n🔍 Frontend Title Matching Logic:`);
    
    // Find exact match
    const exactMatch = results.find(result => {
      if (!result.issueName) return false;
      const issueTitle = result.issueName.toLowerCase().trim();
      const targetTitle = expectedTitle.toLowerCase().trim();
      return issueTitle === targetTitle;
    });
    
    if (exactMatch) {
      console.log(`✅ Found exact title match: "${exactMatch.issueName}" in series "${exactMatch.name}" (ID: ${exactMatch.id})`);
    } else {
      console.log(`❌ No exact title match found`);
    }
    
    // What currently happens (first result selection)
    console.log(`\n⚠️  Current Frontend Behavior (selects first result):`);
    const firstResult = results[0];
    if (firstResult) {
      console.log(`Selected: "${firstResult.name}" (ID: ${firstResult.id})`);
      console.log(`Issue title: "${firstResult.issueName}"`);
      console.log(`This is ${exactMatch && exactMatch.id === firstResult.id ? 'CORRECT' : 'INCORRECT'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

if (require.main === module) {
  testBackendTitleMatching().catch(console.error);
}

module.exports = { testBackendTitleMatching };
