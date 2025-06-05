const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./server/prisma/dev.db');

console.log('🔍 Checking CustomOrderItem table...\n');

// First, let's just select basic fields that should exist
db.all(`
  SELECT id, title, mediaType, comicSeries, comicYear, comicIssue
  FROM CustomOrderItem 
  WHERE mediaType = 'comic'
  ORDER BY id DESC
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('📭 No comic items found in database');
  } else {
    console.log(`📚 Found ${rows.length} comic items (showing first 5):\n`);
    
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.title}`);
      console.log(`   Series: ${row.comicSeries} (${row.comicYear}) #${row.comicIssue}`);
      console.log('   ---\n');
    });
  }
  
  db.close();
});
