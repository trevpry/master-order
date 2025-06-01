// Test the X Files collection matching by directly calling getNextMovie
const getNextMovie = require('./getNextMovie');

async function testXFilesSelection() {
  try {
    console.log('=== Testing X Files Movie Selection ===\n');
    
    // Call getNextMovie multiple times to see if we can get an X Files movie
    for (let i = 1; i <= 10; i++) {
      console.log(`Test ${i}:`);
      const result = await getNextMovie();
      
      console.log(`- Title: ${result.title}`);
      console.log(`- Collections: ${result.collections ? JSON.parse(result.collections).join(', ') : 'none'}`);
      console.log(`- Other Collections: ${result.otherCollections ? result.otherCollections.join(', ') : 'none'}`);
      
      // Check if this is an X Files movie
      if (result.title?.toLowerCase().includes('x files') || result.title?.toLowerCase().includes('x-files')) {
        console.log('🎯 Found X Files movie!');
        
        // If it has collections, it should find related content
        if (result.collections) {
          const collections = JSON.parse(result.collections);
          console.log(`✅ This movie belongs to collections: ${collections.join(', ')}`);
          console.log(`📺 Should find content from these collections: ${result.otherCollections.join(', ')}`);
        }
      }
      
      console.log('');
      
      // Stop if we found an X Files movie
      if (result.title?.toLowerCase().includes('x files') || result.title?.toLowerCase().includes('x-files')) {
        break;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testXFilesSelection();
