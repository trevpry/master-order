const axios = require('axios');
const prisma = require('./server/prismaClient');

async function testDirectComicVineAPI() {
  console.log('Testing ComicVine API directly...\n');
  
  try {
    // Load API key from database
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    const apiKey = settings?.comicVineApiKey;
    if (!apiKey) {
      console.log('No ComicVine API key found in settings');
      return;
    }
    
    console.log('API key loaded, testing direct API call...');
    
    // Test direct API call to get a known Batman issue
    const volumeId = 796; // Batman (1940) series
    const issueNumber = '404'; // A famous Batman issue
    
    console.log(`\n1. Testing issue #${issueNumber} from volume ${volumeId}...`);
    
    const response = await axios.get('https://comicvine.gamespot.com/api/issues/', {
      params: {
        api_key: apiKey,
        format: 'json',
        filter: `volume:${volumeId},issue_number:${issueNumber}`,
        limit: 1,
        field_list: 'id,name,issue_number,character_credits,person_credits,team_credits'
      },
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Status Code:', response.data.status_code);
    console.log('API Response Error:', response.data.error);
    console.log('Number of results:', response.data.number_of_page_results);
    
    if (response.data.results && response.data.results.length > 0) {
      const issue = response.data.results[0];
      console.log('\nIssue Details:');
      console.log('ID:', issue.id);
      console.log('Name:', issue.name);
      console.log('Issue Number:', issue.issue_number);
      console.log('Available fields:', Object.keys(issue).sort().join(', '));
      
      console.log('\nCharacter Credits:');
      console.log('Type:', typeof issue.character_credits);
      console.log('Value:', issue.character_credits);
      
      if (Array.isArray(issue.character_credits)) {
        console.log('Array length:', issue.character_credits.length);
        if (issue.character_credits.length > 0) {
          console.log('First few characters:');
          issue.character_credits.slice(0, 5).forEach((char, i) => {
            console.log(`  ${i + 1}. Name: ${char.name}, ID: ${char.id}`);
          });
        }
      }
      
      console.log('\nPerson Credits:');
      console.log('Type:', typeof issue.person_credits);
      if (Array.isArray(issue.person_credits)) {
        console.log('Array length:', issue.person_credits.length);
      }
      
      console.log('\nTeam Credits:');
      console.log('Type:', typeof issue.team_credits);
      if (Array.isArray(issue.team_credits)) {
        console.log('Array length:', issue.team_credits.length);
      }
    } else {
      console.log('No results found');
    }
    
    // Test with a different known issue that might have character data
    console.log('\n\n2. Testing with a different issue that should definitely have character data...');
    
    // Try Superman #1 which should definitely have Superman in it
    console.log('Searching for Superman series...');
    const supermanResponse = await axios.get('https://comicvine.gamespot.com/api/search/', {
      params: {
        api_key: apiKey,
        format: 'json',
        query: 'Superman',
        resources: 'volume',
        limit: 5
      },
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      }
    });
    
    if (supermanResponse.data.results && supermanResponse.data.results.length > 0) {
      const supermanSeries = supermanResponse.data.results.find(s => s.name === 'Superman' && s.start_year >= 1986) || supermanResponse.data.results[0];
      console.log(`Found Superman series: ${supermanSeries.name} (${supermanSeries.start_year}) - ID: ${supermanSeries.id}`);
      
      // Get Superman issue #1
      const supermanIssueResponse = await axios.get('https://comicvine.gamespot.com/api/issues/', {
        params: {
          api_key: apiKey,
          format: 'json',
          filter: `volume:${supermanSeries.id},issue_number:1`,
          limit: 1,
          field_list: 'id,name,issue_number,character_credits,person_credits,team_credits,cover_date'
        },
        headers: {
          'User-Agent': 'MasterOrder/1.0'
        }
      });
      
      if (supermanIssueResponse.data.results && supermanIssueResponse.data.results.length > 0) {
        const supermanIssue = supermanIssueResponse.data.results[0];
        console.log(`\nSuperman Issue #1 Details:`);
        console.log('Name:', supermanIssue.name);
        console.log('Cover Date:', supermanIssue.cover_date);
        console.log('Available fields:', Object.keys(supermanIssue).sort().join(', '));
        
        if (supermanIssue.character_credits) {
          console.log('\n✓ CHARACTER CREDITS FOUND!');
          console.log('Type:', typeof supermanIssue.character_credits);
          console.log('Is Array:', Array.isArray(supermanIssue.character_credits));
          if (Array.isArray(supermanIssue.character_credits)) {
            console.log('Length:', supermanIssue.character_credits.length);
            supermanIssue.character_credits.slice(0, 5).forEach((char, i) => {
              console.log(`  ${i + 1}. ${char.name} (ID: ${char.id})`);
            });
          }
        } else {
          console.log('\n✗ No character credits found');
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing direct API:', error);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Run the test
testDirectComicVineAPI().then(() => {
  console.log('\nDirect API test completed');
}).catch(error => {
  console.error('Direct API test failed:', error);
});
