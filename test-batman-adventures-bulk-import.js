const axios = require('axios');

async function testBatmanAdventuresBulkImport() {
  console.log('🧪 Testing Batman Adventures bulk import workflow...\n');
  
  try {
    // First, get a list of custom orders to use for testing
    console.log('📋 Fetching custom orders...');
    const ordersResponse = await axios.get('http://localhost:3001/api/custom-orders');
    
    if (!ordersResponse.data || ordersResponse.data.length === 0) {
      console.log('❌ No custom orders found. Creating a test order...');
      
      const newOrderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
        name: 'Comic Test Order',
        description: 'Test order for Batman Adventures bulk import',
        icon: '<svg viewBox="0 0 24 24"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>'
      });
      
      if (newOrderResponse.status !== 201) {
        throw new Error('Failed to create test order');
      }
      
      console.log(`✅ Created test order: ${newOrderResponse.data.name} (ID: ${newOrderResponse.data.id})`);
      var orderId = newOrderResponse.data.id;
    } else {
      var orderId = ordersResponse.data[0].id;
      console.log(`✅ Using existing order: ${ordersResponse.data[0].name} (ID: ${orderId})`);
    }
      // Test data in the new format
    const testData = `Batman Adventures (Vol. 1)\tIssue #02\tCatwoman's Killer Caper\tComic`;
    
    console.log('\n📥 Test bulk import data:');
    console.log(testData);
    
    console.log('\n🔄 Simulating frontend bulk import process...');
    
    // Parse the data like the frontend does
    const lines = testData.trim().split('\n');
    const items = [];
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split('\t');
      
      if (columns.length < 4) {
        errors.push(`Line ${i + 1}: Not enough columns`);
        continue;
      }
      
      const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
      const mediaType = rawMediaType.toLowerCase();
      
      if (mediaType === 'comic' && seasonEpisode && seasonEpisode.toLowerCase().includes('issue')) {
        // Parse using new format logic
        let comicSeries = seriesOrMovie;
        let comicYear = null;
        
        // Clean the series name according to new rules
        const parenthesesMatch = comicSeries.match(/^(.+?)\s*\((.+?)\)(.*)$/);
        if (parenthesesMatch) {
          const beforeParens = parenthesesMatch[1].trim();
          const parenthesesContent = parenthesesMatch[2].trim();
          const afterParens = parenthesesMatch[3].trim();
          
          // Check if parentheses content is a 4-digit year
          const yearMatch = parenthesesContent.match(/^\d{4}$/);
          if (yearMatch) {
            comicYear = parseInt(parenthesesContent);
            comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
          } else {
            comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
            comicYear = null;
          }
        }
        
        // Parse issue number
        const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
        const comicIssue = issueMatch ? parseInt(issueMatch[1]) : null;
        
        if (!comicIssue) {
          errors.push(`Line ${i + 1}: Invalid issue format`);
          continue;
        }
        
        items.push({
          lineNumber: i + 1,
          mediaType: 'comic',
          comicSeries,
          comicYear,
          comicIssue,
          title,
          originalSeries: seriesOrMovie
        });
        
        console.log(`\n📝 Parsed line ${i + 1}:`);
        console.log(`   Original: "${seriesOrMovie}"`);
        console.log(`   Cleaned series: "${comicSeries}"`);
        console.log(`   Issue: #${comicIssue}`);
        console.log(`   Title: "${title}"`);
      }
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Parsing errors:', errors);
      return;
    }
    
    console.log(`\n✅ Successfully parsed ${items.length} comic items`);
    
    // Process each item through the API like the frontend does
    let successCount = 0;
    let failCount = 0;
    
    for (const item of items) {
      try {
        console.log(`\n🔍 Processing comic: ${item.comicSeries} #${item.comicIssue} - ${item.title}`);
        
        // Search ComicVine first
        const searchUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(item.comicSeries)}&issueNumber=${encodeURIComponent(item.comicIssue)}`;
        console.log(`   ComicVine search: ${searchUrl}`);
        
        const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
        
        let targetMedia = null;
        
        if (searchResponse.data && Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
          const searchResults = searchResponse.data;
          console.log(`   Found ${searchResults.length} series with issue #${item.comicIssue}`);
          
          // Find the best match based on issue title
          let selectedSeries = searchResults.find(series => {
            if (!series.issueName || !item.title) return false;
            const seriesIssueTitle = series.issueName.toLowerCase().trim();
            const providedTitle = item.title.toLowerCase().trim();
            return seriesIssueTitle === providedTitle;
          });
          
          // If no exact match, try partial matches
          if (!selectedSeries) {
            selectedSeries = searchResults.find(series => {
              if (!series.issueName || !item.title) return false;
              const seriesIssueTitle = series.issueName.toLowerCase().trim();
              const providedTitle = item.title.toLowerCase().trim();
              return seriesIssueTitle.includes(providedTitle) || 
                     providedTitle.includes(seriesIssueTitle);
            });
          }
          
          // If still no match, use the first result
          if (!selectedSeries) {
            selectedSeries = searchResults[0];
            console.log(`   ⚠️  No issue title match found, using first result: ${selectedSeries.name}`);
          } else {
            console.log(`   ✅ Found matching issue: "${selectedSeries.issueName}" in series: ${selectedSeries.name}`);
          }
          
          targetMedia = {
            mediaType: 'comic',
            title: item.title,
            comicSeries: selectedSeries.name,
            comicYear: item.comicYear || selectedSeries.start_year,
            comicIssue: item.comicIssue,
            comicVineId: selectedSeries.api_detail_url,
            comicVineDetailsJson: JSON.stringify(selectedSeries)
          };
        } else {
          console.log(`   ⚠️  No ComicVine results found, using original data`);
          targetMedia = {
            mediaType: 'comic',
            title: item.title,
            comicSeries: item.comicSeries,
            comicYear: item.comicYear,
            comicIssue: item.comicIssue
          };
        }
        
        // Add to custom order
        console.log(`   📤 Adding to custom order ${orderId}...`);
        const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, targetMedia);
        
        if (addResponse.status === 201) {
          console.log(`   ✅ Successfully added: ${targetMedia.comicSeries} #${targetMedia.comicIssue}`);
          successCount++;
        } else {
          console.log(`   ❌ Failed to add (status ${addResponse.status})`);
          failCount++;
        }
        
      } catch (error) {
        console.log(`   ❌ Error processing item: ${error.message}`);
        if (error.response && error.response.status === 409) {
          console.log(`   ℹ️  Item already exists in order (duplicate)`);
        }
        failCount++;
      }
    }
    
    console.log(`\n📊 Bulk import summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${items.length}`);
    
    // Verify items were added to the order
    console.log(`\n🔍 Verifying items in custom order ${orderId}...`);
    const orderResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    
    if (orderResponse.data && orderResponse.data.items) {
      const comicItems = orderResponse.data.items.filter(item => item.mediaType === 'comic');
      console.log(`📚 Found ${comicItems.length} comic items in the order:`);
      
      comicItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.comicSeries} #${item.comicIssue} - ${item.title}`);
        if (item.comicVineDetailsJson) {
          const details = JSON.parse(item.comicVineDetailsJson);
          console.log(`      ComicVine: ${details.name} (${details.start_year || 'unknown year'})`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run the test
testBatmanAdventuresBulkImport();
