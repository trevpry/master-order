/**
 * Test Word Matching Priority in ComicVine Search
 * Tests that series with more matching words from the input get prioritized
 * For example: "Warcraft: Legends" should be prioritized over just "Legends"
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testWordMatchingPriority() {
  console.log('=== Testing Word Matching Priority in ComicVine Search ===\n');
  
  try {
    // Test case: searching for "Warcraft: Legends" should prioritize series with both words
    console.log('Test Case: Searching for "Warcraft: Legends"');
    console.log('Expected: Series with both "Warcraft" and "Legends" should be prioritized over series with just "Legends"\n');
    
    const searchQuery = 'Warcraft: Legends';
    const issueNumber = 1;
    
    console.log(`🔍 Searching ComicVine for: "${searchQuery}" issue #${issueNumber}`);
    
    const response = await axios.get(`${API_BASE_URL}/api/comicvine/search-with-issues`, {
      params: {
        query: searchQuery,
        issueNumber: issueNumber
      }
    });
    
    const results = response.data;
    
    if (results.length === 0) {
      console.log('❌ No results found - cannot test word matching priority');
      return;
    }
    
    console.log(`\n📊 Found ${results.length} series with issue #${issueNumber}:\n`);
    
    // Display all results with word matching analysis
    results.forEach((series, index) => {
      const seriesName = series.name;
      const publisher = series.publisher?.name || 'Unknown';
      const year = series.start_year || 'Unknown';
      
      // Calculate word matching score manually for verification
      const searchWords = searchQuery.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !['the', 'and', 'vol', 'volume'].includes(word));
      
      const seriesNameLower = seriesName.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const matchingWords = searchWords.filter(word => 
        seriesNameLower.includes(word)
      );
      
      const matchRatio = matchingWords.length / Math.max(searchWords.length, 1);
      const bonusForMoreMatches = matchingWords.length * 0.1;
      const wordScore = matchRatio + bonusForMoreMatches;
      
      console.log(`${index + 1}. "${seriesName}" (${year}) - ${publisher}`);
      console.log(`   Search words: [${searchWords.join(', ')}]`);
      console.log(`   Matching words: [${matchingWords.join(', ')}] (${matchingWords.length}/${searchWords.length})`);
      console.log(`   Word Score: ${wordScore.toFixed(3)}`);
      console.log(`   Issue Title: "${series.issueName || 'No title'}"`);
      
      // Check if this is the expected best match
      if (index === 0) {
        if (matchingWords.length >= 2) {
          console.log(`   🎯 CORRECT: This series has multiple matching words and is ranked first!`);
        } else if (matchingWords.length === 1) {
          console.log(`   ⚠️  WARNING: This series only has 1 matching word but is ranked first`);
        }
      }
      console.log('');
    });
    
    // Check if the word matching priority is working correctly
    const topResult = results[0];
    const topResultWords = searchQuery.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'and', 'vol', 'volume'].includes(word))
      .filter(word => topResult.name.toLowerCase().includes(word));
    
    console.log('=== Test Results ===');
    if (topResultWords.length >= 2) {
      console.log('✅ SUCCESS: Word matching priority is working!');
      console.log(`   The top result "${topResult.name}" contains ${topResultWords.length} words from the search query.`);
    } else if (topResultWords.length === 1) {
      console.log('⚠️  PARTIAL: Top result only matches 1 word from the search query.');
      console.log(`   This might be correct if no series with more word matches exist.`);
      console.log(`   Top result: "${topResult.name}"`);
    } else {
      console.log('❌ ISSUE: Top result does not contain expected words from search query.');
      console.log(`   Top result: "${topResult.name}"`);
    }
    
    // Additional test cases for different scenarios
    console.log('\n=== Additional Test Cases ===\n');
    
    const additionalTests = [
      { query: 'Batman Adventures', expectedWords: ['batman', 'adventures'] },
      { query: 'Amazing Spider-Man', expectedWords: ['amazing', 'spider', 'man'] },
      { query: 'X-Men', expectedWords: ['men'] } // Single word test
    ];
    
    for (const test of additionalTests) {
      try {
        console.log(`🔍 Testing: "${test.query}"`);
        
        const testResponse = await axios.get(`${API_BASE_URL}/api/comicvine/search-with-issues`, {
          params: {
            query: test.query,
            issueNumber: 1
          },
          timeout: 5000
        });
        
        if (testResponse.data.length > 0) {
          const topResult = testResponse.data[0];
          const matchingWords = test.expectedWords.filter(word => 
            topResult.name.toLowerCase().includes(word)
          );
          
          console.log(`   Top result: "${topResult.name}"`);
          console.log(`   Matching words: [${matchingWords.join(', ')}] (${matchingWords.length}/${test.expectedWords.length})`);
          
          if (matchingWords.length === test.expectedWords.length) {
            console.log(`   ✅ Perfect match!`);
          } else if (matchingWords.length > 0) {
            console.log(`   ⚠️  Partial match`);
          } else {
            console.log(`   ❌ No word matches`);
          }
        } else {
          console.log(`   ❌ No results found`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing "${test.query}": ${error.message}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testWordMatchingPriority().catch(console.error);
}

module.exports = { testWordMatchingPriority };
