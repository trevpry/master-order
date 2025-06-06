const axios = require('axios');

async function testBatmanAdventuresParsing() {
  console.log('🧪 Testing Batman Adventures comic parsing...\n');
  
  try {
    // Test data in the new format
    const testData = "Batman Adventures (Vol. 1)\tIssue #01\tPenguin's Big Score\tComic";
    
    console.log('📥 Input data:', testData);
    console.log('Expected parsing:');
    console.log('  - Series: "Batman Adventures"');
    console.log('  - Issue: 1');
    console.log('  - Title: "Penguin\'s Big Score"');
    console.log('  - ComicVine search should use: "Batman Adventures" for issue #1\n');
    
    // Parse the data manually to verify our logic
    const columns = testData.split('\t');
    const [seriesOrMovie, seasonEpisode, title, mediaType] = columns.map(col => col.trim());
    
    console.log('📊 Parsed columns:');
    console.log('  - Column 1 (Series):', seriesOrMovie);
    console.log('  - Column 2 (Issue):', seasonEpisode);
    console.log('  - Column 3 (Title):', title);
    console.log('  - Column 4 (Type):', mediaType);
    
    // Test the series name cleaning logic
    let comicSeries = seriesOrMovie;
    let comicYear = null;
    
    const parenthesesMatch = comicSeries.match(/^(.+?)\s*\((.+?)\)(.*)$/);
    if (parenthesesMatch) {
      const beforeParens = parenthesesMatch[1].trim();
      const parenthesesContent = parenthesesMatch[2].trim();
      const afterParens = parenthesesMatch[3].trim();
      
      console.log('\n🔍 Parentheses analysis:');
      console.log('  - Before parentheses:', beforeParens);
      console.log('  - Parentheses content:', parenthesesContent);
      console.log('  - After parentheses:', afterParens);
      
      // Check if parentheses content is a 4-digit year
      const yearMatch = parenthesesContent.match(/^\d{4}$/);
      if (yearMatch) {
        // Keep the year
        comicYear = parseInt(parenthesesContent);
        comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
        console.log('  - Decision: Keep year (4-digit number found)');
      } else {
        // Remove the entire parentheses portion
        comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
        comicYear = null;
        console.log('  - Decision: Remove parentheses (not a 4-digit year)');
      }
    }
    
    // Parse issue number
    const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
    const comicIssue = issueMatch ? parseInt(issueMatch[1]) : null;
    
    console.log('\n✅ Final parsed values:');
    console.log('  - Cleaned series name:', comicSeries);
    console.log('  - Comic year:', comicYear);
    console.log('  - Issue number:', comicIssue);
    console.log('  - Issue title:', title);
    
    // Test the ComicVine search URL that would be generated
    const searchQuery = comicSeries;
    const searchUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(searchQuery)}&issueNumber=${encodeURIComponent(comicIssue)}`;
    
    console.log('\n🔍 ComicVine search details:');
    console.log('  - Search query:', searchQuery);
    console.log('  - Issue number:', comicIssue);
    console.log('  - Full URL:', searchUrl);
    
    // Test if the server is available for the search
    try {
      console.log('\n📡 Testing ComicVine search...');
      const response = await axios.get(searchUrl, { timeout: 10000 });
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ ComicVine search successful: Found ${response.data.length} series with issue #${comicIssue}`);
        
        if (response.data.length > 0) {
          console.log('\n📚 Search results:');
          response.data.forEach((series, index) => {
            console.log(`  ${index + 1}. ${series.name} (${series.start_year || 'unknown year'})`);
            if (series.issueName) {
              console.log(`     Issue #${comicIssue} title: "${series.issueName}"`);
              
              // Test title matching logic
              const seriesIssueTitle = series.issueName.toLowerCase();
              const providedTitle = title.toLowerCase();
              const isMatch = seriesIssueTitle === providedTitle || 
                            seriesIssueTitle.includes(providedTitle) || 
                            providedTitle.includes(seriesIssueTitle);
              
              console.log(`     Title match: ${isMatch ? '✅ YES' : '❌ NO'}`);
            }
          });
        }
      } else {
        console.log('❌ ComicVine search returned unexpected data format');
      }
    } catch (searchError) {
      console.log('❌ ComicVine search failed:', searchError.message);
      if (searchError.response) {
        console.log('   Status:', searchError.response.status);
        console.log('   Data:', searchError.response.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBatmanAdventuresParsing();
