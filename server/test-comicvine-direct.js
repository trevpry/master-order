const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testComicVineDirectly() {
  try {
    console.log('Testing ComicVine API directly...');
    
    // Get API key from database
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (!settings?.comicVineApiKey) {
      console.error('❌ No ComicVine API key found in database');
      return;
    }
    
    const apiKey = settings.comicVineApiKey;
    console.log(`✅ Found API key: ${apiKey.substring(0, 8)}...`);
    
    // Test basic search endpoint
    console.log('\n📡 Testing search endpoint...');
    const searchUrl = 'https://comicvine.gamespot.com/api/search/';
    const searchParams = {
      api_key: apiKey,
      format: 'json',
      query: 'Batman',
      resources: 'volume',
      limit: 5
    };
    
    console.log(`URL: ${searchUrl}`);
    console.log(`Params:`, searchParams);
      const response = await axios.get(searchUrl, {
      params: searchParams,
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Status Code: ${response.data.status_code}`);
    console.log(`✅ Error: ${response.data.error}`);
    console.log(`✅ Total Results: ${response.data.number_of_total_results}`);
    console.log(`✅ Results in Page: ${response.data.number_of_page_results}`);
    
    if (response.data.results && response.data.results.length > 0) {
      console.log('\n📚 First few results:');
      response.data.results.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (${item.start_year}) - ID: ${item.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing ComicVine API:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else if (error.request) {
      console.error('   No response received:', error.message);
    } else {
      console.error('   Request setup error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testComicVineDirectly();
