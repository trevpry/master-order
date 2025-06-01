const axios = require('axios');

async function testComicVineDirectly() {
  console.log('Testing ComicVine API directly...');
  
  const apiKey = 'ecf2430615cbac5b4694db05aaa86909a3001ddc';
  const baseURL = 'https://comicvine.gamespot.com/api';
  
  try {
    console.log('Making direct API call to ComicVine...');
    
    const response = await axios.get(`${baseURL}/search/`, {
      params: {
        api_key: apiKey,
        format: 'json',
        query: 'Batman',
        resources: 'volume',
        limit: 5
      },
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      },
      timeout: 10000
    });
    
    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    console.log('Number of results:', response.data.results?.length || 0);
    
    if (response.data.results && response.data.results.length > 0) {
      console.log('First result:', {
        name: response.data.results[0].name,
        id: response.data.results[0].id,
        publisher: response.data.results[0].publisher?.name
      });
      console.log('✅ ComicVine API is working correctly!');
    } else {
      console.log('⚠️ API call succeeded but no results returned');
    }
    
  } catch (error) {
    console.error('❌ ComicVine API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testComicVineDirectly();
