const axios = require('axios');

async function testEnhancedComicBulkImport() {
  try {
    console.log('🧪 Testing Enhanced Comic Bulk Import with New Format');
    console.log('='.repeat(60));
    
    // Test data using the new format:
    // Column 1: Series name (with parentheses handling)
    // Column 2: Issue number 
    // Column 3: Comic title
    // Column 4: Type
    const testData = [
      // Test case 1: Series with volume info (should be removed)
      'Batman Adventures (Vol. 1)\tIssue #07\tRaging Lizard\tComic',
      
      // Test case 2: Series with year (should be kept)
      'The Amazing Spider-Man (2018)\tIssue #01\tBack to Basics\tComic',
      
      // Test case 3: Series with complex parentheses (should be removed)
      'X-Men (2nd Series)\tIssue #12\tThe Final Battle\tComic',
      
      // Test case 4: Simple series name (no parentheses)
      'Superman\tIssue #100\tThe Death of Superman\tComic'
    ];
    
    // First, create a test custom order
    console.log('📝 Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Enhanced Comic Test Order',
      description: 'Testing enhanced comic bulk import with new format',
      isActive: true
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✓ Created custom order with ID: ${orderId}`);
    
    // Test the bulk import with the new format
    console.log('\n📚 Testing bulk import with enhanced search...');
    
    for (let i = 0; i < testData.length; i++) {
      const testLine = testData[i];
      console.log(`\n--- Test Case ${i + 1} ---`);
      console.log(`Input: ${testLine}`);
      
      try {
        // Parse the test data manually to see what the frontend would extract
        const [series, issue, title, type] = testLine.split('\t');
        console.log(`Parsed - Series: "${series}", Issue: "${issue}", Title: "${title}", Type: "${type}"`);
        
        // Test the series name cleaning logic
        let cleanedSeries = series;
        let extractedYear = null;
        
        const parenthesesMatch = series.match(/^(.+?)\s*\((.+?)\)(.*)$/);
        if (parenthesesMatch) {
          const beforeParens = parenthesesMatch[1].trim();
          const parenthesesContent = parenthesesMatch[2].trim();
          const afterParens = parenthesesMatch[3].trim();
          
          // Check if parentheses content is a 4-digit year
          const yearMatch = parenthesesContent.match(/^\d{4}$/);
          if (yearMatch) {
            // Keep the year
            extractedYear = parseInt(parenthesesContent);
            cleanedSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
            console.log(`✓ Extracted year: ${extractedYear}, cleaned series: "${cleanedSeries}"`);
          } else {
            // Remove the entire parentheses portion
            cleanedSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
            console.log(`✓ Removed parentheses content: "${parenthesesContent}", cleaned series: "${cleanedSeries}"`);
          }
        } else {
          console.log(`✓ No parentheses found, series unchanged: "${cleanedSeries}"`);
        }
        
        // Extract issue number
        const issueMatch = issue.match(/(?:issue\s*)?#?(\d+)/i);
        const issueNumber = issueMatch ? parseInt(issueMatch[1]) : null;
        console.log(`✓ Extracted issue number: ${issueNumber}`);
        
        // Test the enhanced search query
        let searchQuery = cleanedSeries;
        if (title && title.toLowerCase() !== 'comic') {
          searchQuery += ` ${title}`;
        }
        console.log(`✓ Enhanced search query: "${searchQuery}"`);
        
        // Test the ComicVine search API
        console.log(`🔍 Testing ComicVine search for issue #${issueNumber}...`);
        const searchResponse = await axios.get(`http://localhost:3001/api/comicvine/search-with-issues`, {
          params: {
            query: searchQuery,
            issueNumber: issueNumber
          }
        });
        
        console.log(`✓ Found ${searchResponse.data.length} matching series with issue #${issueNumber}`);
        
        if (searchResponse.data.length > 0) {
          const bestMatch = searchResponse.data[0];
          console.log(`✓ Best match: "${bestMatch.name}" (${bestMatch.start_year})`);
          if (bestMatch.issueName) {
            console.log(`✓ Issue title: "${bestMatch.issueName}"`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error testing case ${i + 1}:`, error.message);
      }
    }
    
    // Now test the actual bulk import API
    console.log('\n🚀 Testing actual bulk import API...');
    
    const bulkImportData = testData.join('\n');
    console.log('Bulk import data:');
    console.log(bulkImportData);
    
    // Simulate the frontend bulk import process
    console.log('\n📤 Simulating frontend bulk import process...');
    
    const lines = bulkImportData.trim().split('\n');
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const [seriesOrMovie, seasonEpisode, title, mediaType] = line.split('\t');
      
      try {
        console.log(`\nProcessing item ${i + 1}: ${title}`);
        
        // Parse comic data using the same logic as the frontend
        let comicSeries = seriesOrMovie;
        let comicYear = null;
        let comicIssue = null;
        
        // Clean series name
        const parenthesesMatch = comicSeries.match(/^(.+?)\s*\((.+?)\)(.*)$/);
        if (parenthesesMatch) {
          const beforeParens = parenthesesMatch[1].trim();
          const parenthesesContent = parenthesesMatch[2].trim();
          const afterParens = parenthesesMatch[3].trim();
          
          const yearMatch = parenthesesContent.match(/^\d{4}$/);
          if (yearMatch) {
            comicYear = parseInt(parenthesesContent);
            comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
          } else {
            comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
          }
        }
        
        // Parse issue number
        const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
        if (issueMatch) {
          comicIssue = parseInt(issueMatch[1]);
        }
        
        // Add to custom order
        const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, {
          mediaType: 'comic',
          title: title,
          comicSeries: comicSeries,
          comicYear: comicYear,
          comicIssue: comicIssue
        });
        
        console.log(`✓ Successfully added: ${title}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to add item ${i + 1}:`, error.response?.data?.error || error.message);
        failCount++;
      }
    }
    
    console.log('\n📊 Bulk Import Results:');
    console.log(`✓ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    // Verify the items were added correctly
    console.log('\n🔍 Verifying added items...');
    const itemsResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}/items`);
    const addedItems = itemsResponse.data;
    
    console.log(`✓ Total items in order: ${addedItems.length}`);
    
    addedItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} - ${item.comicSeries} #${item.comicIssue} (${item.comicYear || 'No year'})`);
    });
    
    // Clean up - delete the test order
    console.log('\n🧹 Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✓ Test order deleted');
    
    console.log('\n🎉 Enhanced Comic Bulk Import Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testEnhancedComicBulkImport();
