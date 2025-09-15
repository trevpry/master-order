const fs = require('fs');
const path = require('path');

// Simple CSV parser (copied from import script)
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || null;
    });
    records.push(record);
  }

  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      // Check for escaped quote
      if (i + 1 < line.length && line[i + 1] === quoteChar) {
        current += char;
        i++; // Skip next quote
      } else {
        inQuotes = false;
        quoteChar = null;
      }
    } else if (!inQuotes && char === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function compareDateFormats() {
  try {
    console.log('🔍 Comparing date formats between working and failing events...');
    
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'historical_events.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const eventRecords = parseCSV(csvContent);
    
    // Working event: 620
    const workingEvent = eventRecords.find(record => parseInt(record.id) === 620);
    console.log('\n✅ WORKING Event 620:');
    console.log(`   createdAt: "${workingEvent.createdAt}"`);
    console.log(`   updatedAt: "${workingEvent.updatedAt}"`);
    console.log(`   startDate: "${workingEvent.startDate}"`);
    
    // Failing events: 453, 454, 455
    const failingEvents = [453, 454, 455, 456];
    
    failingEvents.forEach(id => {
      const event = eventRecords.find(record => parseInt(record.id) === id);
      if (event) {
        console.log(`\n❌ FAILING Event ${id}:`);
        console.log(`   createdAt: "${event.createdAt}"`);
        console.log(`   updatedAt: "${event.updatedAt}"`);
        console.log(`   startDate: "${event.startDate}"`);
      }
    });
    
    // Check how many events have null/empty dates
    let validDates = 0;
    let invalidDates = 0;
    
    eventRecords.forEach(event => {
      if (event.createdAt && event.createdAt !== 'null' && event.createdAt !== '') {
        validDates++;
      } else {
        invalidDates++;
      }
    });
    
    console.log(`\n📊 Date Statistics:`);
    console.log(`   Events with valid dates: ${validDates}`);
    console.log(`   Events with invalid dates: ${invalidDates}`);
    console.log(`   Total events: ${eventRecords.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareDateFormats();