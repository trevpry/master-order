/**
 * Simple Test for TV Series Matching Algorithm
 * Tests the matching logic directly without requiring the full application
 */

// Simulate the matching function we implemented
function calculateSeriesMatchScore(searchTitle, resultTitle) {
  if (!searchTitle || !resultTitle) return 0;
  
  // Normalize titles by removing common variations
  const normalize = (title) => {
    return title.toLowerCase()
      .replace(/\s*\((\d{4})\)\s*/g, ' ') // Remove years like (2005)
      .replace(/\s*\(uk\)\s*/gi, ' ') // Remove (UK)
      .replace(/\s*\(us\)\s*/gi, ' ') // Remove (US)
      .replace(/\s*\(american\)\s*/gi, ' ') // Remove (American)
      .replace(/\s*\(british\)\s*/gi, ' ') // Remove (British)
      .replace(/\s*\(original\)\s*/gi, ' ') // Remove (Original)
      .replace(/\s*\(reboot\)\s*/gi, ' ') // Remove (Reboot)
      .replace(/\s*\(remake\)\s*/gi, ' ') // Remove (Remake)
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };
  
  const normalizedSearch = normalize(searchTitle);
  const normalizedResult = normalize(resultTitle);
  const originalResultLower = resultTitle.toLowerCase().trim();
  const originalSearchLower = searchTitle.toLowerCase().trim();
  
  // Exact match (highest priority)
  if (normalizedSearch === normalizedResult) {
    return 1.0;
  }
  
  // Exact match without normalization (second highest)
  if (originalSearchLower === originalResultLower) {
    return 0.95;
  }
  
  // Partial match where normalized search is contained in normalized result
  if (normalizedResult.includes(normalizedSearch)) {
    // Score higher for shorter result titles (prefer "Doctor Who" over "Doctor Who (2005)")
    const lengthPenalty = (originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, 1);
    return 0.8 - (lengthPenalty * 0.2); // Score between 0.6-0.8
  }
  
  // Partial match where normalized result is contained in normalized search
  if (normalizedSearch.includes(normalizedResult)) {
    return 0.6;
  }
  
  // Bidirectional partial match (fallback)
  if (originalResultLower.includes(originalSearchLower) || originalSearchLower.includes(originalResultLower)) {
    const lengthPenalty = Math.abs(originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, originalSearchLower.length);
    return 0.4 - (lengthPenalty * 0.2); // Score between 0.2-0.4
  }
  
  return 0;
}

function testMatchingAlgorithm() {
  console.log('=== Testing TV Series Matching Algorithm ===\n');
  
  const testCases = [
    {
      name: 'Doctor Who Exact Match Test',
      search: 'Doctor Who',
      candidates: [
        'Doctor Who',
        'Doctor Who (2005)',
        'Doctor Who (2023)',
        'Doctor Who Confidential'
      ],
      expectedWinner: 'Doctor Who'
    },
    {
      name: 'Star Trek Exact Match Test',
      search: 'Star Trek',
      candidates: [
        'Star Trek',
        'Star Trek: The Next Generation',
        'Star Trek: Deep Space Nine',
        'Star Trek: Discovery',
        'Star Trek: Picard'
      ],
      expectedWinner: 'Star Trek'
    },
    {
      name: 'The Office Regional Test',
      search: 'The Office',
      candidates: [
        'The Office (US)',
        'The Office (UK)',
        'The Office'
      ],
      expectedWinner: 'The Office'
    },
    {
      name: 'Sherlock Test',
      search: 'Sherlock',
      candidates: [
        'Sherlock',
        'Sherlock Holmes',
        'Sherlock (2010)',
        'Elementary'
      ],
      expectedWinner: 'Sherlock'
    }
  ];
  
  let allTestsPassed = true;
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Search: "${testCase.search}"`);
    console.log(`   Candidates:`);
    
    // Score each candidate
    const scoredCandidates = testCase.candidates.map(candidate => ({
      title: candidate,
      score: calculateSeriesMatchScore(testCase.search, candidate)
    }));
    
    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // Display results
    scoredCandidates.forEach((candidate, candidateIndex) => {
      const prefix = candidateIndex === 0 ? '🏆' : '  ';
      console.log(`      ${prefix} ${candidateIndex + 1}. "${candidate.title}" - ${candidate.score.toFixed(3)}`);
    });
    
    const winner = scoredCandidates[0];
    const testPassed = winner.title === testCase.expectedWinner;
    
    if (testPassed) {
      console.log(`   ✅ PASSED: Selected "${winner.title}" as expected`);
    } else {
      console.log(`   ❌ FAILED: Expected "${testCase.expectedWinner}", got "${winner.title}"`);
      allTestsPassed = false;
    }
    
    console.log('');
  });
  
  // Overall results
  console.log('=== Overall Results ===');
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✓ Exact matches are prioritized over partial matches');
    console.log('✓ Shorter titles are preferred when multiple partial matches exist');
    console.log('✓ The matching algorithm works as expected');
  } else {
    console.log('❌ Some tests failed. Review the matching algorithm.');
  }
}

// Run the test
if (require.main === module) {
  testMatchingAlgorithm();
}

module.exports = { testMatchingAlgorithm, calculateSeriesMatchScore };
