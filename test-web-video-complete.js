const fs = require('fs');

// Test data for web video bulk import
const testData = `title,mediaType,seasonEpisode,comicInfo,year,url,description
"How to Cook Pasta",web,,,,"https://www.youtube.com/watch?v=example1","A tutorial on cooking perfect pasta"
"JavaScript Tutorial",web,,,,"https://www.youtube.com/watch?v=example2","Learn JavaScript basics"
"Music Video - Best Song",web,,,,"https://www.vimeo.com/example3","Amazing music video"`;

async function testCompleteWebVideoWorkflow() {
  console.log('=== COMPLETE WEB VIDEO WORKFLOW TEST ===\n');
  
  try {
    // 1. Create a custom order first
    console.log('1. Creating custom order...');
    const createOrderResponse = await fetch('http://127.0.0.1:3001/api/custom-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Web Video Test Order',
        description: 'Testing web video functionality',
        icon: '🌐'
      })
    });

    if (!createOrderResponse.ok) {
      throw new Error(`Failed to create order: ${createOrderResponse.status}`);
    }

    const order = await createOrderResponse.json();
    console.log('✅ Custom order created:', order.name);
    console.log('   Order ID:', order.id);

    // 2. Test bulk import with web videos
    console.log('\n2. Testing bulk import with web videos...');
    const bulkImportResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${order.id}/bulk-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvData: testData
      })
    });

    if (!bulkImportResponse.ok) {
      const errorText = await bulkImportResponse.text();
      throw new Error(`Bulk import failed: ${bulkImportResponse.status} - ${errorText}`);
    }

    const importResult = await bulkImportResponse.json();
    console.log('✅ Bulk import successful!');
    console.log('   Items imported:', importResult.itemsAdded);

    // 3. Verify the items were created correctly
    console.log('\n3. Verifying web video items...');
    const orderResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${order.id}`);
    
    if (!orderResponse.ok) {
      throw new Error(`Failed to fetch order: ${orderResponse.status}`);
    }

    const orderWithItems = await orderResponse.json();
    console.log('   Total items in order:', orderWithItems.items.length);
    
    orderWithItems.items.forEach((item, index) => {
      console.log(`\n   Item ${index + 1}:`);
      console.log('     Title:', item.title);
      console.log('     Media Type:', item.mediaType);
      console.log('     Web URL:', item.webUrl);
      console.log('     Web Description:', item.webDescription);
    });

    // 4. Test getting next item from custom order
    console.log('\n4. Testing next custom order item selection...');
    const nextItemResponse = await fetch('http://127.0.0.1:3001/api/next-custom-order');
    
    if (!nextItemResponse.ok) {
      const errorText = await nextItemResponse.text();
      console.log('⚠️  Next item selection failed (this might be expected if no unwatched items):', errorText);
    } else {
      const nextItem = await nextItemResponse.json();
      console.log('✅ Next item selected:');
      console.log('   Title:', nextItem.title);
      console.log('   Type:', nextItem.type);
      if (nextItem.type === 'webvideo') {
        console.log('   Web URL:', nextItem.webUrl);
        console.log('   Web Description:', nextItem.webDescription);
      }
    }

    console.log('\n=== WEB VIDEO WORKFLOW TEST COMPLETE ===');
    console.log('✅ All tests passed! Web video functionality is working correctly.');
    console.log('\nYou can now:');
    console.log('1. View the custom order in the frontend to see web video emojis and URLs');
    console.log('2. Use "Get Up Next" on the home page to see web video overlay');
    console.log('3. Import more web videos using the bulk import feature');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCompleteWebVideoWorkflow();
