const axios = require('axios');
const prisma = require('./server/prismaClient');

async function testIssueDetailAPI() {
  console.log('Testing ComicVine issue detail API...\n');
  
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
    
    console.log('API key loaded, testing issue detail endpoint...');
    
    // First, let's get a known issue ID from the issues list
    const volumeId = 796; // Batman (1940) series
    const issueNumber = '404'; // A famous Batman issue
    
    console.log(`\n1. Getting issue list to find issue ID...`);
    
    const listResponse = await axios.get('https://comicvine.gamespot.com/api/issues/', {
      params: {
        api_key: apiKey,
        format: 'json',
        filter: `volume:${volumeId},issue_number:${issueNumber}`,
        limit: 1,
        field_list: 'id,name,issue_number'
      },
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      }
    });
    
    if (listResponse.data.results && listResponse.data.results.length > 0) {
      const issueId = listResponse.data.results[0].id;
      console.log(`Found issue ID: ${issueId}`);
      
      // Now use the issue detail endpoint
      console.log(`\n2. Getting full issue details using /issue/${issueId} endpoint...`);
      
      const detailResponse = await axios.get(`https://comicvine.gamespot.com/api/issue/4000-${issueId}/`, {
        params: {
          api_key: apiKey,
          format: 'json',
          field_list: 'id,name,issue_number,character_credits,person_credits,team_credits,concept_credits,location_credits,object_credits,story_arc_credits,character_died_in,first_appearance_characters'
        },
        headers: {
          'User-Agent': 'MasterOrder/1.0'
        }
      });
      
      console.log('Detail API Response Status:', detailResponse.status);
      console.log('Detail API Response Status Code:', detailResponse.data.status_code);
      console.log('Detail API Response Error:', detailResponse.data.error);
      
      if (detailResponse.data.results) {
        const issue = detailResponse.data.results;
        console.log('\nIssue Details:');
        console.log('ID:', issue.id);
        console.log('Name:', issue.name);
        console.log('Issue Number:', issue.issue_number);
        console.log('Available fields:', Object.keys(issue).sort().join(', '));
        
        // Check all character-related fields
        const characterFields = [
          'character_credits',
          'character_died_in', 
          'first_appearance_characters',
          'person_credits',
          'team_credits',
          'concept_credits',
          'location_credits',
          'object_credits',
          'story_arc_credits'
        ];
        
        console.log('\nCharacter and Credit Fields:');
        characterFields.forEach(field => {
          if (issue[field] !== undefined) {
            console.log(`${field}: ${typeof issue[field]}, ${Array.isArray(issue[field]) ? `Array(${issue[field].length})` : issue[field]}`);
            if (Array.isArray(issue[field]) && issue[field].length > 0) {
              console.log(`  First few:`, issue[field].slice(0, 3).map(item => item.name || item).join(', '));
            }
          } else {
            console.log(`${field}: undefined`);
          }
        });
        
        // If still no character credits, let's try without field_list to see ALL available fields
        console.log(`\n3. Getting ALL fields (no field_list restriction)...`);
        
        const allFieldsResponse = await axios.get(`https://comicvine.gamespot.com/api/issue/4000-${issueId}/`, {
          params: {
            api_key: apiKey,
            format: 'json'
            // No field_list - get everything
          },
          headers: {
            'User-Agent': 'MasterOrder/1.0'
          }
        });
        
        if (allFieldsResponse.data.results) {
          const allFieldsIssue = allFieldsResponse.data.results;
          console.log('\nALL Available Fields:');
          console.log(Object.keys(allFieldsIssue).sort().join(', '));
          
          // Look specifically for character-related data
          Object.keys(allFieldsIssue).forEach(key => {
            if (key.toLowerCase().includes('character') || key.toLowerCase().includes('credit')) {
              console.log(`\n${key}:`, typeof allFieldsIssue[key]);
              if (Array.isArray(allFieldsIssue[key]) && allFieldsIssue[key].length > 0) {
                console.log(`  Length: ${allFieldsIssue[key].length}`);
                console.log(`  First item:`, allFieldsIssue[key][0]);
              } else if (allFieldsIssue[key]) {
                console.log(`  Value:`, allFieldsIssue[key]);
              }
            }
          });
        }
        
      } else {
        console.log('No results in detail response');
      }
      
    } else {
      console.log('Could not find issue in list response');
    }
    
  } catch (error) {
    console.error('Error testing issue detail API:', error);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Run the test
testIssueDetailAPI().then(() => {
  console.log('\nIssue detail API test completed');
}).catch(error => {
  console.error('Issue detail API test failed:', error);
});
