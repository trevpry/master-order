/**
 * Test exact frontend simulation for Batman Adventures bulk import
 * This simulates exactly what the frontend does including URL encoding
 */

const axios = require('axios');

async function testFrontendSimulation() {
  console.log('🧪 Testing exact frontend simulation for Batman Adventures...\n');
  
  try {
    // Simulate the exact frontend parsing logic
    const testData = "Batman Adventures (Vol. 1)\tIssue #01\tPenguin's Big Score\tComic";
    console.log(`📥 Input data: ${testData}`);
    
    // Parse exactly like the frontend does
    const columns = testData.split('\t');
    const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
    const mediaType = rawMediaType.toLowerCase();
    
    console.log('\n📊 Parsed columns:');
    console.log(`  - seriesOrMovie: "${seriesOrMovie}"`);
    console.log(`  - seasonEpisode: "${seasonEpisode}"`);
    console.log(`  - title: "${title}"`);
    console.log(`  - mediaType: "${mediaType}"`);
    
    // Apply frontend comic parsing logic
    let comicSeries = seriesOrMovie;
    let comicYear = null;
    let comicIssue = null;
    
    // Clean the series name according to frontend rules
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
        comicYear = null;
      }
    }
    
    // Parse issue number
    const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
    if (issueMatch) {
      comicIssue = parseInt(issueMatch[1]);
    }
    
    console.log('\n✅ Parsed comic data:');
    console.log(`  - comicSeries: "${comicSeries}"`);
    console.log(`  - comicYear: ${comicYear}`);
    console.log(`  - comicIssue: ${comicIssue}`);
    console.log(`  - title: "${title}"`);
    
    // Create the exact URL the frontend would create
    const frontendUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(comicSeries)}&issueNumber=${encodeURIComponent(comicIssue)}&issueTitle=${encodeURIComponent(title)}`;
    
    console.log('\n🌐 Frontend URL:');
    console.log(`  ${frontendUrl}`);
    
    // Test URL encoding specifically for apostrophes
    console.log('\n🔍 URL encoding check:');
    console.log(`  Original title: "${title}"`);
    console.log(`  Encoded title: "${encodeURIComponent(title)}"`);
    console.log(`  Title contains apostrophe: ${title.includes("'")}`);
    
    // Make the API call exactly like the frontend
    console.log('\n📡 Making API call...');
    const response = await axios.get(frontendUrl);
    const searchResults = response.data;
    
    console.log(`\n📚 Found ${searchResults.length} comic series with issue #${comicIssue}`);
    
    if (searchResults.length > 0) {
      const selectedSeries = searchResults[0]; // Frontend uses first result
      
      console.log('\n🎯 Frontend would select:');
      console.log(`  - Series: "${selectedSeries.name}"`);
      console.log(`  - Year: ${selectedSeries.start_year}`);
      console.log(`  - Issue Title: "${selectedSeries.issueName}"`);
      
      // Test if this matches what we expect
      const expectedSeries = "The Batman Adventures";
      const expectedTitle = "Penguin's Big Score";
      
      const seriesMatch = selectedSeries.name.includes(expectedSeries) || selectedSeries.name.includes("Batman Adventures");
      const titleMatch = selectedSeries.issueName && selectedSeries.issueName.toLowerCase().includes(expectedTitle.toLowerCase());
      
      console.log('\n✅ Results validation:');
      console.log(`  - Correct series: ${seriesMatch ? '✅ YES' : '❌ NO'}`);
      console.log(`  - Correct title: ${titleMatch ? '✅ YES' : '❌ NO'}`);
      
      if (seriesMatch && titleMatch) {
        console.log('\n🎉 SUCCESS: Frontend simulation would select the correct comic!');
      } else {
        console.log('\n❌ ISSUE: Frontend simulation would select the wrong comic.');
        console.log('This suggests there may be a problem in the actual app.');
      }
      
      // Show all results for debugging
      console.log('\n📖 All search results (for debugging):');
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.start_year}) - "${result.issueName}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testFrontendSimulation();
