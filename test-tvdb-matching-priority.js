/**
 * Test TVDB Series Matching Priority
 * Tests that TVDB searches prioritize exact matches over partial matches
 * For example: "Doctor Who" should select "Doctor Who" not "Doctor Who (2005)"
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testTVDBMatchingPriority() {
  console.log('=== Testing TVDB Series Matching Priority ===\n');
  
  try {
    // Test cases for TVDB series matching
    const testCases = [
      {
        name: 'Doctor Who Test',
        series: 'Doctor Who',
        expectedPreference: 'exact match over year-specific version'
      },
      {
        name: 'Star Trek Test',
        series: 'Star Trek',
        expectedPreference: 'exact match over specific series version'
      },
      {
        name: 'The Office Test',
        series: 'The Office',
        expectedPreference: 'exact match over regional version'
      },
      {
        name: 'Sherlock Test',
        series: 'Sherlock',
        expectedPreference: 'exact match over expanded titles'
      }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`${i + 1}. Testing: ${testCase.name}`);
      console.log(`   Series: "${testCase.series}"`);
      console.log(`   Expected: ${testCase.expectedPreference}`);
      
      try {
        // Test TVDB artwork search (which uses the searchSeries function)
        console.log(`   🔍 Testing TVDB artwork search for "${testCase.series}"`);
        
        const artworkResponse = await axios.get(`${API_BASE_URL}/api/tvdb-artwork`, {
          params: {
            series: testCase.series,
            season: 1
          }
        });
        
        if (artworkResponse.status === 200 && artworkResponse.data) {
          const artwork = artworkResponse.data;
          console.log(`   🎨 TVDB artwork found for: "${artwork.seriesName || testCase.series}"`);
          
          // Check if we got the expected behavior
          const seriesName = artwork.seriesName || testCase.series;
          const isExactMatch = seriesName.toLowerCase().trim() === testCase.series.toLowerCase().trim();
          const hasParentheses = seriesName.includes('(');
          
          if (isExactMatch && !hasParentheses) {
            console.log(`   ✅ CORRECT: Selected exact match without extra qualifiers!`);
            console.log(`   📺 Series: "${seriesName}"`);
          } else if (isExactMatch && hasParentheses) {
            console.log(`   ⚠️  Selected exact match but with qualifiers: "${seriesName}"`);
          } else {
            console.log(`   🤔 Selected different series: "${seriesName}"`);
          }
          
          // Display additional info if available
          if (artwork.seasonNumber) {
            console.log(`   🎭 Season: ${artwork.seasonNumber}`);
          }
          if (artwork.url) {
            console.log(`   🖼️  Artwork URL available: Yes`);
          }
          
        } else {
          console.log(`   ❌ No TVDB artwork found or API error`);
        }
        
        // Also test direct TVDB search if available
        try {
          console.log(`   🔍 Testing direct TVDB search API...`);
          const directSearchResponse = await axios.get(`${API_BASE_URL}/api/tvdb/search-series`, {
            params: {
              query: testCase.series
            }
          });
          
          if (directSearchResponse.status === 200 && directSearchResponse.data && directSearchResponse.data.length > 0) {
            const results = directSearchResponse.data;
            console.log(`   📺 Found ${results.length} direct TVDB search results:`);
            
            results.slice(0, 3).forEach((result, index) => {
              const prefix = index === 0 ? '🏆' : '  ';
              console.log(`      ${prefix} ${index + 1}. "${result.name}" (${result.year || 'No year'})`);
            });
            
            const topResult = results[0];
            const isExactMatch = topResult.name.toLowerCase().trim() === testCase.series.toLowerCase().trim();
            const hasParentheses = topResult.name.includes('(');
            
            if (isExactMatch && !hasParentheses) {
              console.log(`   ✅ DIRECT SEARCH: Correctly prioritized exact match!`);
            } else if (isExactMatch && hasParentheses) {
              console.log(`   ⚠️  DIRECT SEARCH: Exact match but with qualifiers`);
            } else {
              console.log(`   🤔 DIRECT SEARCH: Selected "${topResult.name}" instead of exact match`);
              
              // Check if exact match was available
              const exactMatch = results.find(result => 
                result.name.toLowerCase().trim() === testCase.series.toLowerCase().trim()
              );
              
              if (exactMatch) {
                console.log(`   ❌ ISSUE: Exact match "${exactMatch.name}" was available but not prioritized!`);
              } else {
                console.log(`   ℹ️  No exact match available in TVDB results`);
              }
            }
          } else {
            console.log(`   ⚠️  Direct TVDB search API not available or no results`);
          }
        } catch (directSearchError) {
          console.log(`   ℹ️  Direct TVDB search API not available (${directSearchError.response?.status || 'error'})`);
        }
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ⚠️  TVDB API endpoint not available`);
        } else if (error.response?.status === 500) {
          console.log(`   ⚠️  TVDB service error - may indicate no API key configured`);
        } else {
          console.log(`   ❌ Error testing "${testCase.series}": ${error.message}`);
        }
      }
      
      console.log(''); // Empty line between test cases
    }
    
    console.log('=== Test Summary ===');
    console.log('✅ TVDB series matching priority test completed!');
    console.log('📋 Check the results above to ensure exact matches are prioritized.');
    console.log('ℹ️  If TVDB API is not configured, some tests may show warnings.');
    
    // Test the matching algorithm directly
    console.log('\n=== Direct Algorithm Test ===');
    
    const testDirectly = (searchTitle, candidates) => {
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
      
      const scoredCandidates = candidates.map(candidate => ({
        name: candidate,
        score: calculateSeriesMatchScore(searchTitle, candidate)
      }));
      
      scoredCandidates.sort((a, b) => b.score - a.score);
      return scoredCandidates;
    };
    
    const algorithmTests = [
      {
        search: 'Doctor Who',
        candidates: ['Doctor Who', 'Doctor Who (2005)', 'Doctor Who (2023)', 'Doctor Who Confidential']
      },
      {
        search: 'Star Trek',
        candidates: ['Star Trek', 'Star Trek: Discovery', 'Star Trek: The Next Generation', 'Star Trek: Deep Space Nine']
      }
    ];
    
    algorithmTests.forEach(test => {
      console.log(`🧪 Algorithm test for "${test.search}":`);
      const results = testDirectly(test.search, test.candidates);
      results.forEach((result, index) => {
        const prefix = index === 0 ? '🏆' : '  ';
        console.log(`   ${prefix} ${index + 1}. "${result.name}" - ${result.score.toFixed(3)}`);
      });
      console.log('');
    });
    
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
  testTVDBMatchingPriority().catch(console.error);
}

module.exports = { testTVDBMatchingPriority };
