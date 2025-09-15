const { PrismaClient } = require('@prisma/client');
const HistoryPlusDataImporter = require('./import-history-plus-data');

async function testEventImportOnly() {
  try {
    console.log('🔍 Testing event import only...');
    
    const importer = new HistoryPlusDataImporter({ clearExisting: true });
    await importer.initialize();
    
    // Clear just events first
    console.log('🗑️ Clearing existing events...');
    await importer.targetPrisma.historicalEvent.deleteMany({});
    
    // Import only events
    console.log('📥 Importing events only...');
    await importer.importHistoricalEvents();
    
    // Check results
    const eventCount = await importer.targetPrisma.historicalEvent.count();
    console.log(`✅ Events created: ${eventCount}`);
    
    if (eventCount > 0) {
      const sampleEvents = await importer.targetPrisma.historicalEvent.findMany({
        take: 5,
        select: { id: true, title: true }
      });
      console.log('Sample events:');
      sampleEvents.forEach(event => {
        console.log(`   ${event.id}: ${event.title}`);
      });
      
      // Check for our target events
      const targetEvents = [620, 495, 649, 456];
      for (const id of targetEvents) {
        const event = await importer.targetPrisma.historicalEvent.findUnique({
          where: { id },
          select: { id: true, title: true }
        });
        console.log(`Event ${id}: ${event ? `EXISTS (${event.title})` : 'NOT FOUND'}`);
      }
    }
    
    await importer.targetPrisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEventImportOnly();