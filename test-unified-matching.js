/**
 * Test all three matching systems to verify consistent exact match prioritization:
 * 1. ComicVine comic series matching
 * 2. Plex TV series matching  
 * 3. TVDB series matching
 */

// Mock TVDB services with the new scoring logic
function createTVDBMatcher() {
  const calculateSeriesMatchScore = (searchTitle, resultTitle) => {
    if (!searchTitle || !resultTitle) return 0;
    
    const originalSearchLower = searchTitle.toLowerCase().trim();
    const originalResultLower = resultTitle.toLowerCase().trim();
    
    // Exact match without any normalization (highest priority)
    if (originalSearchLower === originalResultLower) {
      return 1.0;
    }
    
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
    
    // Exact match after normalization (second highest priority)
    if (normalizedSearch === normalizedResult) {
      // Give a slight penalty based on how much normalization was needed
      const originalLength = originalResultLower.length;
      const normalizedLength = normalizedResult.length;
      const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
      return 0.95 - normalizationPenalty; // Score between 0.85-0.95
    }
    
    // Partial match where normalized search is contained in normalized result
    if (normalizedResult.includes(normalizedSearch)) {
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
  };

  return { calculateSeriesMatchScore };
}

// Mock ComicVine word matching scoring with exact match priority
function calculateWordMatchingScore(seriesName, searchQuery) {
  if (!seriesName || !searchQuery) return 0;
  
  const originalSearchLower = searchQuery.toLowerCase().trim();
  const originalSeriesLower = seriesName.toLowerCase().trim();
  
  // Exact match without any normalization (highest priority)
  if (originalSearchLower === originalSeriesLower) {
    return 1.0;
  }
  
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
  
  const normalizedSearch = normalize(searchQuery);
  const normalizedSeries = normalize(seriesName);
  
  // Exact match after normalization (second highest priority)
  if (normalizedSearch === normalizedSeries) {
    // Give a slight penalty based on how much normalization was needed
    const originalLength = originalSeriesLower.length;
    const normalizedLength = normalizedSeries.length;
    const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
    return 0.95 - normalizationPenalty; // Score between 0.85-0.95
  }
  
  // Word matching logic (lower priority than exact matches)
  // Clean and split search query into words (ignore common words)
  const searchWords = normalizedSearch
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !['the', 'and', 'vol', 'volume'].includes(word));
  
  // Clean series name
  const seriesNameNormalized = normalizedSeries
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Count how many search words appear in the series name
  const matchingWords = searchWords.filter(word => 
    seriesNameNormalized.includes(word)
  );
  
  // Calculate score: (matching words / total search words) with bonus for more matches
  const matchRatio = matchingWords.length / Math.max(searchWords.length, 1);
  const bonusForMoreMatches = matchingWords.length * 0.05; // Small bonus for absolute number of matches
  
  // Scale word matching score to be lower than exact matches (0.1-0.8)
  return 0.1 + (matchRatio * 0.6) + bonusForMoreMatches;
}

// Test cases
const testCases = [
  {
    name: "Doctor Who exact match test",
    searchTitle: "Doctor Who",
    candidates: [
      "Doctor Who (2005)",
      "Doctor Who"
    ],
    expectedWinner: "Doctor Who"
  },
  {
    name: "Warcraft exact match test", 
    searchTitle: "Warcraft: Legends",
    candidates: [
      "Legends",
      "Warcraft: Legends"
    ],
    expectedWinner: "Warcraft: Legends"
  },
  {
    name: "Star Wars exact match test",
    searchTitle: "Star Wars",
    candidates: [
      "Star Wars: The Clone Wars",
      "Star Wars"
    ],
    expectedWinner: "Star Wars"
  },
  {
    name: "Lost exact match test",
    searchTitle: "Lost",
    candidates: [
      "Lost (2004)",
      "Lost"
    ],
    expectedWinner: "Lost"
  }
];

console.log("=== UNIFIED MATCHING ALGORITHM TEST ===\n");

const tvdbMatcher = createTVDBMatcher();

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Search: "${testCase.searchTitle}"`);
  console.log("Candidates:");
  
  // Test TVDB matching
  const tvdbResults = testCase.candidates.map(candidate => ({
    title: candidate,
    score: tvdbMatcher.calculateSeriesMatchScore(testCase.searchTitle, candidate)
  })).sort((a, b) => b.score - a.score);
  
  // Test ComicVine word matching (for comic scenarios)
  const comicResults = testCase.candidates.map(candidate => ({
    title: candidate,
    score: calculateWordMatchingScore(testCase.searchTitle, candidate)
  })).sort((a, b) => b.score - a.score);
  
  console.log("\nTVDB/Plex Matching Results:");
  tvdbResults.forEach((result, idx) => {
    const winner = idx === 0 ? " ← SELECTED" : "";
    console.log(`  ${idx + 1}. "${result.title}" - Score: ${result.score.toFixed(3)}${winner}`);
  });
  
  console.log("\nComicVine Word Matching Results:");
  comicResults.forEach((result, idx) => {
    const winner = idx === 0 ? " ← SELECTED" : "";
    console.log(`  ${idx + 1}. "${result.title}" - Score: ${result.score.toFixed(3)}${winner}`);
  });
  
  // Check if both systems select the expected winner
  const tvdbWinner = tvdbResults[0].title;
  const comicWinner = comicResults[0].title;
  
  console.log(`\nExpected Winner: "${testCase.expectedWinner}"`);
  console.log(`TVDB/Plex Selected: "${tvdbWinner}" ${tvdbWinner === testCase.expectedWinner ? "✅" : "❌"}`);
  console.log(`ComicVine Selected: "${comicWinner}" ${comicWinner === testCase.expectedWinner ? "✅" : "❌"}`);
  
  if (tvdbWinner === testCase.expectedWinner && comicWinner === testCase.expectedWinner) {
    console.log("✅ BOTH SYSTEMS PASS");
  } else {
    console.log("❌ SYSTEM MISMATCH");
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
});

// Detailed Doctor Who scoring breakdown
console.log("=== DETAILED DOCTOR WHO SCORING BREAKDOWN ===");
const searchTitle = "Doctor Who";
const candidates = ["Doctor Who (2005)", "Doctor Who"];

candidates.forEach(candidate => {
  const originalSearchLower = searchTitle.toLowerCase().trim();
  const originalResultLower = candidate.toLowerCase().trim();
  
  console.log(`\nCandidate: "${candidate}"`);
  console.log(`Original search: "${originalSearchLower}"`);
  console.log(`Original result: "${originalResultLower}"`);
  console.log(`Exact match check: ${originalSearchLower === originalResultLower}`);
  
  if (originalSearchLower === originalResultLower) {
    console.log("Score: 1.000 (exact match without normalization)");
  } else {
    // Show normalization process
    const normalize = (title) => {
      return title.toLowerCase()
        .replace(/\s*\((\d{4})\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedSearch = normalize(searchTitle);
    const normalizedResult = normalize(candidate);
    
    console.log(`Normalized search: "${normalizedSearch}"`);
    console.log(`Normalized result: "${normalizedResult}"`);
    console.log(`Normalized match: ${normalizedSearch === normalizedResult}`);
    
    if (normalizedSearch === normalizedResult) {
      const originalLength = originalResultLower.length;
      const normalizedLength = normalizedResult.length;
      const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
      const score = 0.95 - normalizationPenalty;
      console.log(`Original length: ${originalLength}, Normalized length: ${normalizedLength}`);
      console.log(`Normalization penalty: ${normalizationPenalty.toFixed(3)}`);
      console.log(`Score: ${score.toFixed(3)} (normalized exact match with penalty)`);
    }
  }
});
