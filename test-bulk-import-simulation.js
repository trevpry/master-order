// Test script to simulate the bulk import process exactly as it happens in the client
const https = require('https');
const http = require('http');

function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          text: () => Promise.resolve(responseData),
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testBulkImport() {
  console.log('=== TESTING BULK IMPORT PROCESS ===\n');
  
  const testBulkData = `The High Republic Adventures (2022) #7	N/A	The High Republic Adventures (2022) #7	comic
The High Republic Adventures (2022) #8	N/A	The High Republic Adventures (2022) #8	comic`;

  // Parse tab-delimited data (same logic as client)
  const lines = testBulkData.trim().split('\n');
  const items = [];
  const errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    console.log(`Processing line ${i + 1}: "${line}"`);
    
    const columns = line.split('\t');
    console.log('Columns:', columns);
    
    // Validate required columns
    if (columns.length < 4) {
      errors.push(`Line ${i + 1}: Not enough columns (need 4: Series/Movie, Season/Episode, Title, Type)`);
      continue;
    }
    
    const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
    console.log('Parsed values:', { seriesOrMovie, seasonEpisode, title, rawMediaType });
    
    if (!seriesOrMovie || !title || !rawMediaType) {
      errors.push(`Line ${i + 1}: Missing required data (Series/Movie, Title, or Type)`);
      continue;
    }
    
    // Normalize media types
    const mediaType = rawMediaType.toLowerCase() === 'tv series' ? 'episode' : rawMediaType.toLowerCase();
    console.log('Media type:', mediaType);
    
    // Initialize comic-specific fields
    let comicSeries = null;
    let comicYear = null;
    let comicIssue = null;
    
    if (mediaType === 'comic') {
      // Parse comic format: "Series Name (Year) #Issue"
      console.log('Parsing comic format from:', seriesOrMovie);
      const comicMatch = seriesOrMovie.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+)$/);
      console.log('Comic match result:', comicMatch);
      
      if (comicMatch) {
        comicSeries = comicMatch[1].trim();
        comicYear = parseInt(comicMatch[2]);
        comicIssue = parseInt(comicMatch[3]);
        console.log('Parsed comic details:', { comicSeries, comicYear, comicIssue });
      } else {
        errors.push(`Line ${i + 1}: Invalid comic format. Use "Series Name (Year) #Issue" format (e.g., "The Amazing Spider-Man (2018) #1")`);
        continue;
      }
    }
    
    const item = {
      seriesOrMovie,
      seasonNumber: null,
      episodeNumber: null,
      comicSeries,
      comicYear,
      comicIssue,
      title,
      mediaType: mediaType,
      lineNumber: i + 1
    };
    
    console.log('Created item:', item);
    items.push(item);
  }
  
  console.log('\nParsing completed. Items:', items.length, 'Errors:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
    return;
  }
  
  // Process each item (simulate the client's bulk import logic)
  let successCount = 0;
  let failCount = 0;
  const failedItems = [];
  
  for (const item of items) {
    try {
      console.log(`\n--- Processing item: ${item.title} ---`);
      
      let targetMedia = null;
      if (item.mediaType === 'comic') {
        // For comics, create the media object directly since we have all the info
        targetMedia = {
          title: item.title,
          type: 'comic',
          comicSeries: item.comicSeries,
          comicYear: item.comicYear,
          comicIssue: item.comicIssue
        };
        console.log('Created comic targetMedia:', targetMedia);
      }
      
      if (targetMedia) {
        // Simulate handleAddMediaToOrder
        console.log('Simulating handleAddMediaToOrder with:', targetMedia);
        
        const requestBody = {
          mediaType: targetMedia.type,
          title: targetMedia.title
        };

        // Add fields based on media type
        if (targetMedia.type === 'comic') {
          requestBody.comicSeries = targetMedia.comicSeries;
          requestBody.comicYear = targetMedia.comicYear;
          requestBody.comicIssue = targetMedia.comicIssue;
        }
          console.log('Request body being sent:', requestBody);

        const response = await makeRequest('http://localhost:3001/api/custom-orders/1/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }, JSON.stringify(requestBody));

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response text:', responseText);

        if (response.ok) {
          console.log('SUCCESS: Added to order');
          successCount++;
        } else {
          const errorData = JSON.parse(responseText);
          if (response.status === 409) {
            console.log('DUPLICATE: Item already exists');
            failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
          } else {
            console.log('ERROR:', errorData.error);
            failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (error: ${errorData.error})`);
          }
          failCount++;
        }
      } else {
        failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (not found in Plex)`);
        failCount++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error processing item on line ${item.lineNumber}:`, error);
      failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (processing error)`);
      failCount++;
    }
  }
  
  // Show results
  let resultMessage = `Bulk import completed: ${successCount} items added successfully`;
  if (failCount > 0) {
    resultMessage += `, ${failCount} items failed`;
    if (failedItems.length > 0) {
      resultMessage += `:\n${failedItems.join('\n')}`;
    }
  }
  
  console.log('\n=== FINAL RESULTS ===');
  console.log(resultMessage);
}

// Run the test
testBulkImport().catch(console.error);
