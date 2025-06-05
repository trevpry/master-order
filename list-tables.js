const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./server/prisma/dev.db');

console.log('🔍 Checking database tables...\n');

// List all tables
db.all(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  console.log('📋 Available tables:');
  rows.forEach(row => {
    console.log(`  - ${row.name}`);
  });
  
  console.log('\n');
  db.close();
});
