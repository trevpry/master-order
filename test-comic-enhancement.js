// Test script to add a Flash Comics #24 and verify Komga enhancement
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testComicWithKomgaEnhancement() {
  console.log('🧪 Testing Comic Addition with Komga Enhancement\n');
  
  try {
    // First, let's get a list of custom orders to add to
    console.log('1️⃣ Getting custom orders...');
    const ordersResponse = await axios.get(`${API_BASE}/custom-orders`);
    const orders = ordersResponse.data;
    
    if (orders.length === 0) {
      console.log('❌ No custom orders found. Please create one first.');
      return;
    }
    
    const targetOrder = orders[0]; // Use the first order
    console.log(`   Using order: "${targetOrder.name}" (ID: ${targetOrder.id})`);
    
    // Add a comic that should exist in Komga (Flash Comics #24)
    console.log('\n2️⃣ Adding Flash Comics #24...');
    
    const comicData = {
      mediaType: 'comic',
      title: 'Flash Comics 024 (1941)',
      comicSeries: 'Flash Comics',
      comicIssue: '24',
      comicYear: '1941',
      comicPublisher: 'DC Comics',
      comicVineId: 'test-id',
      comicVineDetailsJson: JSON.stringify({
        series: { name: 'Flash Comics', publisher: { name: 'DC Comics' } },
        issue: { id: 'test-id', cover_date: '1941-12-01' }
      })
    };
    
    const addResponse = await axios.post(`${API_BASE}/custom-orders/${targetOrder.id}/items`, comicData);
    const newItem = addResponse.data;
    
    console.log('✅ Comic added successfully!');
    console.log(`   Item ID: ${newItem.id}`);
    console.log(`   Title: ${newItem.title}`);
    console.log(`   Komga URL: ${newItem.komgaUrl || 'None'}`);
    console.log(`   Komga Series URL: ${newItem.komgaSeriesUrl || 'None'}`);
    console.log(`   Komga Metadata: ${newItem.komgaMetadata ? 'Present' : 'None'}`);
    
    if (newItem.komgaUrl) {
      console.log('\n🎉 SUCCESS: Comic was enhanced with Komga data!');
      console.log(`   You can now click the title in the UI to open: ${newItem.komgaUrl}`);
    } else {
      console.log('\n⚠️  Comic was added but no Komga enhancement found.');
      console.log('   This could mean:');
      console.log('   - The comic doesn\'t exist in your Komga library');
      console.log('   - There was an issue with the Komga search');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  testComicWithKomgaEnhancement().then(() => {
    console.log('\n🎉 Test complete!');
    process.exit(0);
  });
}

module.exports = { testComicWithKomgaEnhancement };
