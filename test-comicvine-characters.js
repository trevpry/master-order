const comicVineService = require('./server/comicVineService');

async function testCharacterCredits() {
  console.log('Testing ComicVine character credits extraction...\n');
  
  
  try {
    // Test with a specific comic that should have characters
    // Let's use Batman as an example
    console.log('1. Searching for Batman series...');
    const series = await comicVineService.searchSeries('Batman');
    
    if (series && series.length > 0) {
      console.log(`Found ${series.length} Batman series:`);
      series.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name} (${s.start_year}) - ID: ${s.id}`);
      });
      
      // Get first series and check for issue #1
      const firstSeries = series[0];
      console.log(`\n2. Checking for issue #1 in "${firstSeries.name}"...`);
      
      const issue = await comicVineService.getIssueByNumber(firstSeries.id, '1');
      
      if (issue) {
        console.log('\nIssue found!');
        console.log(`Issue ID: ${issue.id}`);
        console.log(`Issue Name: ${issue.name || 'Untitled'}`);
        console.log(`Issue Number: ${issue.issue_number}`);
        console.log(`Cover Date: ${issue.cover_date}`);
        
        console.log('\nCharacter Credits:');
        if (issue.character_credits && Array.isArray(issue.character_credits)) {
          console.log(`Found ${issue.character_credits.length} characters:`);
          issue.character_credits.slice(0, 10).forEach((char, i) => {
            console.log(`  ${i + 1}. ${char.name || 'Unknown'} (ID: ${char.id})`);
          });
          
          if (issue.character_credits.length > 10) {
            console.log(`  ... and ${issue.character_credits.length - 10} more characters`);
          }
        } else {
          console.log('No character credits found or not in array format');
          console.log('character_credits value:', issue.character_credits);
        }
        
        // Also check other credits
        console.log('\nOther Credits:');
        ['person_credits', 'team_credits', 'concept_credits', 'location_credits'].forEach(creditType => {
          if (issue[creditType] && Array.isArray(issue[creditType]) && issue[creditType].length > 0) {
            console.log(`  ${creditType}: ${issue[creditType].length} items`);
          }
        });
        
        // Show raw structure for debugging
        console.log('\nRaw API Response Structure:');
        console.log('Available fields:', Object.keys(issue).join(', '));
        
      } else {
        console.log('No issue #1 found for this series');
      }
      
    } else {
      console.log('No Batman series found');
    }
    
  } catch (error) {
    console.error('Error testing character credits:', error);
  }
}

// Run the test
testCharacterCredits().then(() => {
  console.log('\nTest completed');
}).catch(error => {
  console.error('Test failed:', error);
});
