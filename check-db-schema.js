const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./master_order.db');

console.log('🔍 Checking database schema...\n');

// Check all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  console.log('📋 Database tables:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  
  // Find the correct table for custom order items
  const customOrderTables = tables.filter(t => t.name.toLowerCase().includes('order') || t.name.toLowerCase().includes('item'));
  
  if (customOrderTables.length > 0) {
    console.log('\n🎯 Custom order related tables:');
    customOrderTables.forEach(table => {
      console.log(`  - ${table.name}`);
      
      // Get schema for this table
      db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
        if (err) {
          console.error(`❌ Error getting schema for ${table.name}:`, err);
          return;
        }
        
        console.log(`    Columns in ${table.name}:`);
        columns.forEach(col => {
          console.log(`      - ${col.name} (${col.type})`);
        });
        console.log('');
      });
    });
  }
  
  setTimeout(() => db.close(), 2000); // Give time for async operations
});
