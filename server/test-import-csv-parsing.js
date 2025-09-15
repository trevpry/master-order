const HistoryPlusDataImporter = require('./import-history-plus-data');

async function testImportCsvParsing() {
  try {
    console.log('🔍 Testing import script CSV parsing...');
    
    const importer = new HistoryPlusDataImporter({ clearExisting: false });
    await importer.initialize();
    
    // Use the import script's loadCSVFile method
    const records = await importer.loadCSVFile('historical_events.csv');
    
    console.log(`📄 Loaded ${records.length} records using import script`);
    
    // Find events 453 and 620
    const event453 = records.find(record => parseInt(record.id) === 453);
    const event620 = records.find(record => parseInt(record.id) === 620);
    
    console.log('\n📝 Event 453 from import script:');
    console.log(JSON.stringify(event453, null, 2));
    
    console.log('\n📝 Event 620 from import script:');
    console.log(JSON.stringify(event620, null, 2));
    
    // Test transformation
    console.log('\n🔄 Testing transformation...');
    
    const transformEvent = (record) => ({
      id: parseInt(record.id),
      title: record.title,
      startDate: record.startDate,
      endDate: record.endDate || null,
      details: record.details || null,
      category: record.category,
      hidden: record.hidden === 't' || record.hidden === 'true' || record.hidden === true,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    });
    
    if (event453) {
      console.log('\n🔄 Transformed event 453:');
      const transformed453 = transformEvent(event453);
      console.log(JSON.stringify(transformed453, null, 2));
    }
    
    if (event620) {
      console.log('\n🔄 Transformed event 620:');
      const transformed620 = transformEvent(event620);
      console.log(JSON.stringify(transformed620, null, 2));
    }
    
    await importer.targetPrisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImportCsvParsing();