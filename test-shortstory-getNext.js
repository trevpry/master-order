const { getNextCustomOrder } = require('./server/getNextCustomOrder');

async function testShortStorySupport() {
  try {
    console.log('Testing short story support in getNextCustomOrder...');
    
    // This will test if the function can handle short stories without crashing
    const result = await getNextCustomOrder();
    
    console.log('Result type:', result.orderType || 'unknown');
    console.log('Media type:', result.customOrderMediaType || result.type || 'unknown');
    
    if (result.customOrderMediaType === 'shortstory') {
      console.log('✅ Short story successfully processed!');
      console.log('Story title:', result.storyTitle);
      console.log('Story author:', result.storyAuthor);
      console.log('Story URL:', result.storyUrl);
    } else {
      console.log('ℹ️  No short story found, but function executed without errors');
    }
    
  } catch (error) {
    console.error('❌ Error testing short story support:', error.message);
    console.error(error.stack);
  }
}

testShortStorySupport();
