const fs = require('fs');
const path = require('path');

function checkVideoCsvData() {
  try {
    console.log('🔍 Checking video CSV data structure...');
    
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'history_videos.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n');
    
    console.log('CSV lines total:', lines.length);
    console.log('Header:', lines[0]);
    
    // Find video 4515
    const video4515Line = lines.find(line => line.startsWith('4515,'));
    console.log('\nVideo 4515 data:', video4515Line);
    
    // Parse the line to see actual structure
    if (video4515Line) {
      const values = video4515Line.split(',');
      console.log('\nVideo 4515 parsed values:');
      const headers = lines[0].split(',');
      headers.forEach((header, index) => {
        console.log(`  ${header}: ${values[index] || 'EMPTY'}`);
      });
    }
    
    // Check first few videos with eventId
    console.log('\n🔍 Looking for videos with eventId...');
    let found = 0;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const values = line.split(',');
      const eventIdIndex = lines[0].split(',').indexOf('eventId');
      if (values[eventIdIndex] && values[eventIdIndex] !== 'NULL' && values[eventIdIndex] !== '') {
        console.log(`Video ${values[0]} has eventId: ${values[eventIdIndex]}`);
        console.log(`  Title: ${values[1] || 'EMPTY'}`);
        console.log(`  URL: ${values[2] || 'EMPTY'}`);
        console.log(`  Type: ${values[3] || 'EMPTY'}`);
        found++;
        if (found >= 3) break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking CSV:', error.message);
  }
}

checkVideoCsvData();