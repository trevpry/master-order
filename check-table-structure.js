const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./server/prisma/dev.db');

console.log('🔍 Checking CustomOrderItem table structure...\n');

// Get the schema for CustomOrderItem table
db.all(`PRAGMA table_info(CustomOrderItem)`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  console.log('📋 CustomOrderItem table columns:');
  rows.forEach(column => {
    console.log(`  - ${column.name} (${column.type}${column.notnull ? ' NOT NULL' : ''}${column.dflt_value ? ' DEFAULT ' + column.dflt_value : ''})`);
  });
  
  console.log('\n');
  
  // Also check if there are any comic items
  db.all(`SELECT COUNT(*) as count FROM CustomOrderItem WHERE mediaType = 'comic'`, (err, countRows) => {
    if (err) {
      console.error('❌ Error counting comics:', err);
    } else {
      console.log(`📚 Found ${countRows[0].count} comic items in database`);
    }
    db.close();
  });
});
