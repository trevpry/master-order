const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Test CSV parsing for specific video
class TestParser {
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current); // Add the last value
    return values;
  }

  parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = this.parseCSVLine(line);
      if (values.length !== headers.length) {
        console.warn(`⚠️  Line ${i + 1}: Column count mismatch`);
        continue;
      }
      
      const record = {};
      headers.forEach((header, index) => {
        let value = values[index];
        
        // Convert empty strings to null
        if (value === '') {
          value = null;
        }
        
        record[header] = value;
      });
      
      records.push(record);
    }
    
    return records;
  }
}

async function testVideoCSV() {
  try {
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'history_videos.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const parser = new TestParser();
    const records = parser.parseCSV(csvContent);
    
    console.log(`Loaded ${records.length} video records`);
    
    // Find video 4515 that should have eventId 620
    const video4515 = records.find(r => r.id === '4515');
    if (video4515) {
      console.log('\n📹 Video 4515 details:');
      console.log(`  ID: ${video4515.id}`);
      console.log(`  Title: ${video4515.title}`);
      console.log(`  EventID: "${video4515.eventId}" (type: ${typeof video4515.eventId})`);
      console.log(`  ChannelID: "${video4515.channelId}" (type: ${typeof video4515.channelId})`);
    }
    
    // Check how many videos have eventId values
    const videosWithEventId = records.filter(r => r.eventId && r.eventId !== null && r.eventId !== '');
    console.log(`\n📊 Videos with eventId: ${videosWithEventId.length}/${records.length}`);
    
    // Show sample videos with eventId
    console.log('\n🔗 Sample videos with eventId:');
    videosWithEventId.slice(0, 5).forEach(v => {
      console.log(`  ID: ${v.id}, Title: ${v.title?.substring(0, 30)}..., EventID: ${v.eventId}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testVideoCSV();