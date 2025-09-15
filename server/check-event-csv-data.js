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

function checkEventCsvData() {
  try {
    console.log('🔍 Checking event CSV data...');
    
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'historical_events.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const eventRecords = parseCSV(csvContent);
    
    console.log(`Total event records: ${eventRecords.length}`);
    console.log('Headers:', Object.keys(eventRecords[0]));
    
    // Check first few events including target event 620
    const targetEvents = [620, 495, 649, 456];
    
    console.log('\nLooking for target events...');
    targetEvents.forEach(id => {
      const event = eventRecords.find(record => parseInt(record.id) === id);
      if (event) {
        console.log(`\n🎯 Event ${id} found:`);
        console.log(`   Title: ${event.title}`);
        console.log(`   Type: ${event.type}`);
        console.log(`   Description: ${event.description ? event.description.substring(0, 100) + '...' : 'null'}`);
        console.log(`   Raw record keys:`, Object.keys(event));
      } else {
        console.log(`❌ Event ${id} NOT FOUND`);
      }
    });
    
    // Show sample first record
    console.log('\n📝 First record sample:');
    console.log(JSON.stringify(eventRecords[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEventCsvData();