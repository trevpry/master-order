const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Simple CSV parser
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].replace(/"/g, '') : null;
    });
    records.push(record);
  }
  
  return records;
}

async function testEventsImport() {
  const prisma = new PrismaClient();
  
  try {
    // Load events CSV
    const csvPath = path.join(__dirname, '..', 'history-plus-export', 'historical_events.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(csvContent);
    
    console.log('📄 Loaded events CSV:');
    console.log(`   Records: ${records.length}`);
    console.log(`   Sample record:`, records[0]);
    
    // Transform first record
    const firstRecord = records[0];
    const transformedRecord = {
      id: parseInt(firstRecord.id),
      title: firstRecord.title,
      startDate: firstRecord.startDate,
      endDate: firstRecord.endDate || null,
      details: firstRecord.details || null,
      category: firstRecord.category,
      hidden: firstRecord.hidden === 'true',
      createdAt: new Date(firstRecord.createdAt),
      updatedAt: new Date(firstRecord.updatedAt)
    };
    
    console.log('📝 Transformed record:');
    console.log(JSON.stringify(transformedRecord, null, 2));
    
    // Try to create the first record
    console.log('💾 Attempting to create record...');
    const result = await prisma.historicalEvent.create({
      data: transformedRecord
    });
    
    console.log('✅ Success! Created record:', result.id);
    
    // Delete it for cleanup
    await prisma.historicalEvent.delete({ where: { id: result.id } });
    console.log('🧹 Cleaned up test record');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📋 Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEventsImport();