const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./server/prisma/dev.db');

console.log('🔍 Checking and applying artwork caching columns...\n');

// First check if the columns exist
db.all(`PRAGMA table_info(CustomOrderItem)`, (err, rows) => {
  if (err) {
    console.error('❌ Error checking table info:', err);
    db.close();
    return;
  }

  const columns = rows.map(row => row.name);
  console.log('📋 Current columns:', columns.join(', '));
  
  const artworkColumns = ['localArtworkPath', 'originalArtworkUrl', 'artworkLastCached', 'artworkMimeType'];
  const missingColumns = artworkColumns.filter(col => !columns.includes(col));
  
  if (missingColumns.length === 0) {
    console.log('✅ All artwork caching columns already exist!');
    db.close();
    return;
  }
  
  console.log(`📝 Missing columns: ${missingColumns.join(', ')}`);
  console.log('🔧 Adding missing columns...\n');
  
  // Add missing columns one by one
  const addColumn = (column, type, callback) => {
    const sql = `ALTER TABLE CustomOrderItem ADD COLUMN ${column} ${type}`;
    console.log(`   Adding: ${column}`);
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`   ❌ Error adding ${column}:`, err.message);
      } else {
        console.log(`   ✅ Added: ${column}`);
      }
      callback();
    });
  };
  
  let completed = 0;
  const total = missingColumns.length;
  
  const checkComplete = () => {
    completed++;
    if (completed === total) {
      console.log('\n🎉 Artwork caching columns setup complete!');
      db.close();
    }
  };
  
  // Add each missing column
  missingColumns.forEach(column => {
    const type = column === 'artworkLastCached' ? 'DATETIME' : 'TEXT';
    addColumn(column, type, checkComplete);
  });
});
