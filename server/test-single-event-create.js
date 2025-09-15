const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Copy parseCSV functions from import script
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

async function testSingleEventCreate() {
  try {
    console.log('🔍 Testing single event creation...');
    
    // Load and parse CSV
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'historical_events.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const eventRecords = parseCSV(csvContent);
    
    // Find event 620
    const event620Raw = eventRecords.find(record => parseInt(record.id) === 620);
    
    if (!event620Raw) {
      console.log('❌ Event 620 not found in CSV');
      return;
    }
    
    console.log('📝 Raw event 620 data:');
    console.log(JSON.stringify(event620Raw, null, 2));
    
    // Apply exact transformation from import script
    const transformedEvent = {
      id: parseInt(event620Raw.id),
      title: event620Raw.title,
      startDate: event620Raw.startDate,
      endDate: event620Raw.endDate || null,
      details: event620Raw.details || null,
      category: event620Raw.category,
      hidden: event620Raw.hidden === 't' || event620Raw.hidden === 'true' || event620Raw.hidden === true,
      createdAt: new Date(event620Raw.createdAt),
      updatedAt: new Date(event620Raw.updatedAt)
    };
    
    console.log('\n🔄 Transformed event 620 data:');
    console.log(JSON.stringify(transformedEvent, null, 2));
    
    // Try to create the event
    console.log('\n🔬 Attempting to create event 620...');
    
    const createdEvent = await prisma.historicalEvent.create({
      data: transformedEvent
    });
    
    console.log('✅ SUCCESS! Event created:');
    console.log(JSON.stringify(createdEvent, null, 2));
    
    // Clean up
    await prisma.historicalEvent.delete({
      where: { id: 620 }
    });
    console.log('🧹 Test event cleaned up');
    
  } catch (error) {
    console.error('❌ Error creating event:', error.message);
    console.error('Error code:', error.code);
    if (error.meta) {
      console.error('Error meta:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSingleEventCreate();