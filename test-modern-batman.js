const comicVineService = require('./server/comicVineService');

async function testModernBatmanIssue() {
  console.log('Testing with modern Batman comics that should have character data...\n');
  
  try {
    // Test with Detective Comics which should have better character data
    console.log('1. Searching for Detective Comics series...');
    const series = await comicVineService.searchSeries('Detective Comics');
    
    if (series && series.length > 0) {
      console.log(`Found ${series.length} Detective Comics series:`);
      series.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name} (${s.start_year}) - ID: ${s.id}`);
      });
      
      // Try to find a more recent Detective Comics series
      const modernSeries = series.find(s => s.start_year >= 2011) || series[0];
      console.log(`\n2. Using series: "${modernSeries.name}" (${modernSeries.start_year})`);
      
      // Try a few different issue numbers
      const testIssues = ['1', '27', '100'];
      
      for (const issueNum of testIssues) {
        console.log(`\n--- Testing Issue #${issueNum} ---`);
        const issue = await comicVineService.getIssueByNumber(modernSeries.id, issueNum);
        
        if (issue) {
          console.log(`✓ Issue found: ${issue.name || 'Untitled'}`);
          console.log(`  Issue ID: ${issue.id}`);
          console.log(`  Cover Date: ${issue.cover_date}`);
          
          // Check all fields returned
          console.log('\n  Available fields:', Object.keys(issue).sort().join(', '));
          
          // Specifically check character-related fields
          const characterFields = ['character_credits', 'character_died_in', 'first_appearance_characters'];
          characterFields.forEach(field => {
            if (issue[field] !== undefined) {
              console.log(`  ${field}:`, typeof issue[field], Array.isArray(issue[field]) ? `Array(${issue[field].length})` : issue[field]);
              if (Array.isArray(issue[field]) && issue[field].length > 0) {
                console.log(`    First few items:`, issue[field].slice(0, 3).map(c => c.name || c).join(', '));
              }
            } else {
              console.log(`  ${field}: undefined`);
            }
          });
          
          // If we found character credits, we can stop here
          if (issue.character_credits && Array.isArray(issue.character_credits) && issue.character_credits.length > 0) {
            console.log('\n🎉 SUCCESS: Found character credits!');
            break;
          }
        } else {
          console.log(`✗ Issue #${issueNum} not found`);
        }
      }
      
    } else {
      console.log('No Detective Comics series found');
    }
    
    // Let's also try a single issue API call directly to see the raw response
    console.log('\n3. Testing direct issue API call...');
    
    // Let's try to get a known issue with character data
    // We'll use the Batman series from before but try a different issue
    const batmanSeries = await comicVineService.searchSeries('Batman');
    if (batmanSeries && batmanSeries.length > 1) {
      // Try the second Batman series (1940) which should have more issues
      const classicBatman = batmanSeries.find(s => s.start_year === 1940) || batmanSeries[1];
      console.log(`Trying classic Batman series: ${classicBatman.name} (${classicBatman.start_year}) - ID: ${classicBatman.id}`);
      
      const testIssues = ['1', '404', '700'];
      for (const issueNum of testIssues) {
        console.log(`\nTesting Batman issue #${issueNum}...`);
        const issue = await comicVineService.getIssueByNumber(classicBatman.id, issueNum);
        if (issue) {
          console.log(`Found: ${issue.name || 'Untitled'} (${issue.cover_date})`);
          if (issue.character_credits) {
            console.log(`Character credits: ${Array.isArray(issue.character_credits) ? issue.character_credits.length : typeof issue.character_credits}`);
            if (Array.isArray(issue.character_credits) && issue.character_credits.length > 0) {
              console.log('🎉 SUCCESS: Found character data!');
              issue.character_credits.slice(0, 5).forEach((char, i) => {
                console.log(`  ${i + 1}. ${char.name || 'Unknown'} (ID: ${char.id})`);
              });
              break;
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing character credits:', error);
  }
}

// Run the test
testModernBatmanIssue().then(() => {
  console.log('\nTest completed');
}).catch(error => {
  console.error('Test failed:', error);
});
