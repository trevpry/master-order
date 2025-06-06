/**
 * Test Updated Backend Title Matching
 * Tests the new backend title matching functionality
 */

const axios = require('axios');

async function testUpdatedBackendTitleMatching() {
  console.log('🔍 Testing Updated Backend Title Matching...\n');
  
  try {
    // Test the search that should now match "Joker's Late Night Lunacy" first
    const query = 'Batman Adventures';
    const issueNumber = 3;
    const issueTitle = "Joker's Late Night Lunacy";
    
    console.log(`Search query: "${query}"`);
    console.log(`Issue number: ${issueNumber}`);
    console.log(`Issue title: "${issueTitle}"`);
    
    const searchUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(query)}&issueNumber=${encodeURIComponent(issueNumber)}&issueTitle=${encodeURIComponent(issueTitle)}`;
    console.log(`\nFull URL: ${searchUrl}`);
    
    const response = await axios.get(searchUrl, { timeout: 30000 });
    const results = response.data;
    
    console.log(`\n✅ Found ${results.length} results:`);
    
    results.forEach((result, index) => {
      console.log(`\n--- Result ${index + 1} ${index === 0 ? '(FIRST - WILL BE SELECTED)' : ''} ---`);
      console.log(`Series Name: ${result.name}`);
      console.log(`Series ID: ${result.id}`);
      console.log(`Start Year: ${result.start_year}`);
      console.log(`Issue #${issueNumber} Title: "${result.issueName}"`);
      
      // Check if this matches our expected title
      if (result.issueName && result.issueName.toLowerCase().trim() === issueTitle.toLowerCase().trim()) {
        console.log(`🎯 THIS MATCHES THE EXPECTED TITLE!`);
      }
    });
    
    // Check if the first result is now the correct one
    console.log(`\n🎯 VERIFICATION:`);
    const firstResult = results[0];
    if (firstResult) {
      const isCorrectMatch = firstResult.issueName && 
                            firstResult.issueName.toLowerCase().trim() === issueTitle.toLowerCase().trim();
      
      console.log(`First result: "${firstResult.name}" (ID: ${firstResult.id})`);
      console.log(`Issue title: "${firstResult.issueName}"`);
      console.log(`Is correct match: ${isCorrectMatch ? '✅ YES' : '❌ NO'}`);
      
      if (isCorrectMatch) {
        console.log(`\n🎉 SUCCESS! Backend now correctly prioritizes title matches!`);
      } else {
        console.log(`\n❌ FAILED: Backend still not prioritizing title matches correctly.`);
      }
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
  testUpdatedBackendTitleMatching().catch(console.error);
}

module.exports = { testUpdatedBackendTitleMatching };
