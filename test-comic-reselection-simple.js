const fetch = require('node-fetch');

async function testComicReselection() {
  try {
    // First, get existing custom orders to find one with comic items
    console.log('Fetching custom orders...');
    const ordersResponse = await fetch('http://127.0.0.1:3001/api/custom-orders');
    const orders = await ordersResponse.json();
    
    if (orders.length === 0) {
      console.log('No custom orders found');
      return;
    }
    
    // Find an order with comic items
    let targetOrder = null;
    let targetItem = null;
    
    for (const order of orders) {
      const comicItems = order.items.filter(item => item.mediaType === 'comic');
      if (comicItems.length > 0) {
        targetOrder = order;
        targetItem = comicItems[0];
        break;
      }
    }
    
    if (!targetItem) {
      console.log('No comic items found in any order');
      return;
    }
    
    console.log(`Found comic item: ${targetItem.title} (ID: ${targetItem.id})`);
    console.log(`Current comicVineId: ${targetItem.comicVineId}`);
    console.log(`Current comicVineDetailsJson length: ${targetItem.comicVineDetailsJson ? targetItem.comicVineDetailsJson.length : 'null'}`);
    
    // Test updating the comic with ComicVine data
    const updateData = {
      title: "Test Updated Comic Title",
      comicSeries: "Test Series",
      comicYear: 2023,
      comicIssue: "1",
      customTitle: null,
      comicVineId: "https://comicvine.gamespot.com/api/volume/4050-123456/",
      comicVineDetailsJson: JSON.stringify({
        name: "Test Series",
        start_year: "2023",
        api_detail_url: "https://comicvine.gamespot.com/api/volume/4050-123456/",
        image: {
          original_url: "https://example.com/test-cover.jpg"
        }
      })
    };
    
    console.log('\nTesting comic reselection update...');
    const updateResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${targetOrder.id}/items/${targetItem.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('✅ Comic reselection successful!');
      console.log(`Updated item title: ${result.title}`);
      console.log(`Updated comicVineId: ${result.comicVineId}`);
      console.log(`Updated comicVineDetailsJson length: ${result.comicVineDetailsJson ? result.comicVineDetailsJson.length : 'null'}`);
    } else {
      const error = await updateResponse.text();
      console.log('❌ Comic reselection failed:');
      console.log(error);
    }
    
  } catch (error) {
    console.error('Error testing comic reselection:', error);
  }
}

testComicReselection();
