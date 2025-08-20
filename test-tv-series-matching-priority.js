/**
 * Test TV Series Matching Priority in Bulk Import
 * Tests that exact matches are prioritized over partial matches
 * For example: "Doctor Who" should select "Doctor Who" not "Doctor Who (2005)"
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testTVSeriesMatchingPriority() {
  console.log('=== Testing TV Series Matching Priority in Bulk Import ===\n');
  
  try {
    // Test cases for TV series matching
    const testCases = [
      {
        name: 'Doctor Who Test',
        series: 'Doctor Who',
        season: 1,
        episode: 1,
        expectedPreference: 'exact match over year-specific version'
      },
      {
        name: 'The Office Test',
        series: 'The Office',
        season: 1,
        episode: 1,
        expectedPreference: 'exact match over regional version'
      },
      {
        name: 'Star Trek Test',
        series: 'Star Trek',
        season: 1,
        episode: 1,
        expectedPreference: 'exact match over specific series version'
      }
    ];
    
    // Create a test custom order
    console.log('📝 Creating test custom order...');
    const orderResponse = await axios.post(`${API_BASE_URL}/api/custom-orders`, {
      name: 'TV Series Matching Test',
      description: 'Testing TV series exact match priority'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✓ Created test order with ID: ${orderId}\n`);
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`${i + 1}. Testing: ${testCase.name}`);
      console.log(`   Series: "${testCase.series}", S${testCase.season}E${testCase.episode}`);
      console.log(`   Expected: ${testCase.expectedPreference}`);
      
      try {
        // Search for TV episodes using the same API that bulk import uses
        const searchUrl = `${API_BASE_URL}/api/search?query=${encodeURIComponent(testCase.series)}&type=tv`;
        console.log(`   🔍 Searching: ${searchUrl}`);
        
        const searchResponse = await axios.get(searchUrl);
        const results = searchResponse.data;
        
        if (results.length === 0) {
          console.log(`   ❌ No results found for "${testCase.series}"`);
          continue;
        }
        
        console.log(`   📺 Found ${results.length} total results`);
        
        // Filter to episodes matching the season/episode
        const episodeCandidates = results.filter(result => 
          result.type === 'episode' &&
          result.parentIndex === testCase.season &&
          result.index === testCase.episode
        );
        
        console.log(`   📺 Found ${episodeCandidates.length} episodes matching S${testCase.season}E${testCase.episode}`);
        
        if (episodeCandidates.length === 0) {
          console.log(`   ⚠️  No specific episode S${testCase.season}E${testCase.episode} found`);
          continue;
        }
        
        // Show all candidates with their series names
        console.log(`   📋 Episode candidates:`);
        episodeCandidates.forEach((episode, index) => {
          console.log(`      ${index + 1}. "${episode.grandparentTitle}" - "${episode.title}"`);
        });
        
        // Simulate the matching algorithm we just implemented
        const calculateSeriesMatchScore = (searchTitle, resultTitle) => {
          if (!searchTitle || !resultTitle) return 0;
          
          const normalize = (title) => {
            return title.toLowerCase()
              .replace(/\\s*\\((\\d{4})\\)\\s*/g, ' ')
              .replace(/\\s*\\(uk\\)\\s*/gi, ' ')
              .replace(/\\s*\\(us\\)\\s*/gi, ' ')
              .replace(/\\s*\\(american\\)\\s*/gi, ' ')
              .replace(/\\s*\\(british\\)\\s*/gi, ' ')
              .replace(/\\s*\\(original\\)\\s*/gi, ' ')
              .replace(/\\s*\\(reboot\\)\\s*/gi, ' ')
              .replace(/\\s*\\(remake\\)\\s*/gi, ' ')
              .replace(/\\s+/g, ' ')
              .trim();
          };
          
          const normalizedSearch = normalize(searchTitle);
          const normalizedResult = normalize(resultTitle);
          const originalResultLower = resultTitle.toLowerCase().trim();
          const originalSearchLower = searchTitle.toLowerCase().trim();
          
          if (normalizedSearch === normalizedResult) return 1.0;
          if (originalSearchLower === originalResultLower) return 0.95;
          
          if (normalizedResult.includes(normalizedSearch)) {
            const lengthPenalty = (originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, 1);
            return 0.8 - (lengthPenalty * 0.2);
          }
          
          if (normalizedSearch.includes(normalizedResult)) return 0.6;
          
          if (originalResultLower.includes(originalSearchLower) || originalSearchLower.includes(originalResultLower)) {
            const lengthPenalty = Math.abs(originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, originalSearchLower.length);
            return 0.4 - (lengthPenalty * 0.2);
          }
          
          return 0;
        };
        
        // Score each candidate
        const scoredCandidates = episodeCandidates.map(candidate => ({
          ...candidate,
          matchScore: calculateSeriesMatchScore(testCase.series, candidate.grandparentTitle)
        })).filter(candidate => candidate.matchScore > 0);
        
        scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
        
        if (scoredCandidates.length > 0) {
          const bestMatch = scoredCandidates[0];
          console.log(`   🏆 Best match: "${bestMatch.grandparentTitle}" (score: ${bestMatch.matchScore.toFixed(3)})`);
          
          // Check if we got the expected behavior
          const isExactMatch = bestMatch.grandparentTitle.toLowerCase().trim() === testCase.series.toLowerCase().trim();
          const hasParentheses = bestMatch.grandparentTitle.includes('(');
          
          if (isExactMatch && !hasParentheses) {
            console.log(`   ✅ CORRECT: Selected exact match without extra qualifiers!`);
          } else if (isExactMatch && hasParentheses) {
            console.log(`   ⚠️  Selected exact match but with qualifiers: "${bestMatch.grandparentTitle}"`);
          } else {
            console.log(`   🤔 Selected different series: "${bestMatch.grandparentTitle}"`);
            
            // Check if there was an exact match available
            const exactMatch = scoredCandidates.find(candidate => 
              candidate.grandparentTitle.toLowerCase().trim() === testCase.series.toLowerCase().trim()
            );
            
            if (exactMatch) {
              console.log(`   ❌ ISSUE: Exact match "${exactMatch.grandparentTitle}" was available but not selected!`);
              console.log(`      Exact match score: ${exactMatch.matchScore.toFixed(3)}`);
              console.log(`      Selected match score: ${bestMatch.matchScore.toFixed(3)}`);
            } else {
              console.log(`   ℹ️  No exact match was available in the results`);
            }
          }
          
          // Show all scored candidates for debugging
          if (scoredCandidates.length > 1) {
            console.log(`   📊 All scored candidates:`);
            scoredCandidates.forEach((candidate, index) => {
              const prefix = index === 0 ? '🏆' : '  ';
              console.log(`      ${prefix} ${index + 1}. "${candidate.grandparentTitle}" - ${candidate.matchScore.toFixed(3)}`);
            });
          }
          
        } else {
          console.log(`   ❌ No candidates received a matching score > 0`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing "${testCase.series}": ${error.message}`);
      }
      
      console.log(''); // Empty line between test cases
    }
    
    // Clean up
    console.log('🧹 Cleaning up test order...');
    await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    console.log('✓ Test order deleted');
    
    console.log('\n=== Test Summary ===');
    console.log('✅ TV Series matching priority test completed!');
    console.log('📋 Check the results above to ensure exact matches are prioritized over partial matches.');
    
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
  testTVSeriesMatchingPriority().catch(console.error);
}

module.exports = { testTVSeriesMatchingPriority };
