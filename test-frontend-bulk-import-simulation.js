// Test to simulate the exact frontend bulk import process
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Simple fetch polyfill using Node.js built-in modules
function fetch(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });
    
    req.on('error', reject);
  });
}

async function testFrontendBulkImportSimulation() {
  console.log('🧪 Testing Frontend Bulk Import Simulation...');
  
  // Simulate the exact data format from frontend bulk import
  const bulkImportLine = "Batman Adventures (Vol. 1)\tIssue #01\tPenguin's Big Score\tComic";
  console.log('📝 Input line:', bulkImportLine);
  
  // Parse exactly like the frontend does
  const columns = bulkImportLine.split('\t');
  const [rawSeries, , title, type] = columns;
  
  console.log('📋 Parsed columns:');
  console.log('  - Raw series:', rawSeries);
  console.log('  - Title:', title);
  console.log('  - Type:', type);
  
  // Clean series name exactly like frontend
  let comicSeries = rawSeries;
  
  // Remove volume indicators like "(Vol. 1)" but keep years like "(2018)"
  comicSeries = comicSeries.replace(/\s*\([Vv]ol\.\s*\d+\)$/i, '');
  comicSeries = comicSeries.replace(/\s*\([Vv]olume\s*\d+\)$/i, '');
  
  console.log('🧹 Cleaned series:', comicSeries);
  
  // Extract issue number exactly like frontend
  let comicIssue = '1'; // Default for this test
  
  console.log('🔢 Issue number:', comicIssue);
  console.log('📖 Issue title:', title);
  
  // Make the exact API call that frontend makes
  const apiUrl = `http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(comicSeries)}&issueNumber=${encodeURIComponent(comicIssue)}&issueTitle=${encodeURIComponent(title)}`;
  console.log('🌐 API URL:', apiUrl);
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Found ${data.length} results:`);
    
    if (data.length > 0) {
      // Simulate frontend selection (takes first result)
      const selectedSeries = data[0];
      
      console.log('\n--- SELECTED SERIES (First Result) ---');
      console.log('Series Name:', selectedSeries.name);
      console.log('Series ID:', selectedSeries.id);
      console.log('Start Year:', selectedSeries.start_year);
      console.log('Issue Title:', selectedSeries.issueName || 'null');
      
      // Check if this matches our expected result
      const expectedTitle = "Penguin's Big Score";
      const actualTitle = selectedSeries.issueName;
      
      console.log('\n🎯 VERIFICATION:');
      console.log('Expected title:', expectedTitle);
      console.log('Actual title:', actualTitle);
      console.log('Is correct match:', actualTitle === expectedTitle ? '✅ YES' : '❌ NO');
      
      if (actualTitle === expectedTitle) {
        console.log('🎉 SUCCESS! Frontend simulation selects correct comic!');
      } else {
        console.log('❌ ISSUE! Frontend simulation selects wrong comic!');
        console.log('\n📊 All results for debugging:');
        data.forEach((series, index) => {
          console.log(`--- Result ${index + 1} ---`);
          console.log('Series Name:', series.name);
          console.log('Series ID:', series.id);
          console.log('Start Year:', series.start_year);
          console.log('Issue Title:', series.issueName || 'null');
          if (series.issueName === expectedTitle) {
            console.log('🎯 THIS IS THE CORRECT MATCH!');
          }
        });
      }
    } else {
      console.log('❌ No results found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendBulkImportSimulation();
