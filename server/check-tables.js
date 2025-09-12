const { PrismaClient } = require('@prisma/client');

async function checkTables() {
  const prisma = new PrismaClient();
  
  try {
    // Check what tables exist
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `;
    
    console.log('📊 All tables in SQLite database:');
    tables.forEach(table => console.log(`   - ${table.name}`));
    
    // Check specifically for History Plus tables
    const historyTables = tables.filter(t => t.name.toLowerCase().includes('history'));
    
    if (historyTables.length > 0) {
      console.log('\n📚 History Plus tables found:');
      historyTables.forEach(table => console.log(`   - ${table.name}`));
      
      // Check if we have data in these tables
      for (const table of historyTables) {
        try {
          const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${table.name}`;
          console.log(`   ${table.name}: ${count[0]?.count || 0} records`);
        } catch (err) {
          console.log(`   ${table.name}: Error counting - ${err.message}`);
        }
      }
    } else {
      console.log('\n❌ No History Plus tables found in SQLite database');
    }
    
  } catch (error) {
    console.error('Error checking database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();