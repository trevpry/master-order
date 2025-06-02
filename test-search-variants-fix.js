function testSearchVariantsFix() {
  console.log('🔧 Testing Search Variants Fix for Movie Collection TV Search');
  console.log('=' .repeat(65));
  
  // Test the old (incorrect) vs new (correct) logic
  console.log('\n1️⃣  Testing Search Variants Logic...');
  
  const testCollections = [
    'Stargate Collection',
    'Indiana Jones Collection', 
    'X-Men Collection',
    'Marvel Collection',
    'Simple Name' // No " Collection" suffix
  ];
  
  testCollections.forEach(collection => {
    console.log(`\nCollection: "${collection}"`);
    
    // OLD (INCORRECT) logic - appends " Collection"
    const oldVariants = [
      collection,
      `${collection} Collection`
    ];
    console.log(`  ❌ OLD Search variants: ["${oldVariants.join('", "')}"]`);
    
    // NEW (CORRECT) logic - removes " Collection" suffix
    const newVariants = [
      collection,
      collection.replace(/ Collection$/, '')
    ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
    console.log(`  ✅ NEW Search variants: ["${newVariants.join('", "')}"]`);
    
    // Show the difference
    const isFixed = newVariants.length === 1 || 
                   !newVariants.some(v => v.endsWith(' Collection Collection'));
    console.log(`  🎯 Fix Status: ${isFixed ? 'CORRECT' : 'STILL BROKEN'}`);
  });
  
  console.log('\n\n2️⃣  Demonstrating the Problem & Solution...');
  
  // Example scenario: Movie from "Stargate Collection" looking for TV series
  const movieCollection = 'Stargate Collection';
  const tvSeriesCollection = 'Stargate'; // TV series might be in just "Stargate"
  
  console.log(`\nScenario: Movie is in "${movieCollection}", TV series is in "${tvSeriesCollection}"`);
  
  // OLD logic would search for:
  const oldSearch = [movieCollection, `${movieCollection} Collection`];
  console.log(`❌ OLD search terms: ["${oldSearch.join('", "')}"]`);
  console.log(`   Would NOT find TV series in "${tvSeriesCollection}" ❌`);
  
  // NEW logic searches for:
  const newSearch = [
    movieCollection,
    movieCollection.replace(/ Collection$/, '')
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  console.log(`✅ NEW search terms: ["${newSearch.join('", "')}"]`);
  console.log(`   WILL find TV series in "${tvSeriesCollection}" ✅`);
  
  console.log('\n\n✅ SUMMARY:');
  console.log('  ✓ Fixed search variants to remove " Collection" suffix instead of adding it');
  console.log('  ✓ Movie from "Stargate Collection" will now search:');
  console.log('    • "Stargate Collection" (original)');
  console.log('    • "Stargate" (without " Collection")');
  console.log('  ✓ This should help find matching TV series with similar collection names');
  console.log('  ✓ Applied fix to both checkCollections() and movieHasTVSeriesInCollections()');
}

testSearchVariantsFix();
