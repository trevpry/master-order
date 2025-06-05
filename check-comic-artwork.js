const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./server/prisma/dev.db');

console.log('🔍 Checking comic artwork caching status...\n');

// Check all comic items and their artwork status
db.all(`  SELECT id, title, mediaType, comicSeries, comicYear, comicIssue, 
         localArtworkPath, originalArtworkUrl, artworkLastCached, artworkMimeType
  FROM CustomOrderItem 
  WHERE mediaType = 'comic'
  ORDER BY id DESC
`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('📭 No comic items found in database');
    db.close();
    return;
  }

  console.log(`📚 Found ${rows.length} comic items:\n`);
    rows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.title}`);
    console.log(`   Series: ${row.comicSeries} (${row.comicYear}) #${row.comicIssue}`);
    console.log(`   Local Artwork: ${row.localArtworkPath || 'none'}`);
    console.log(`   Original URL: ${row.originalArtworkUrl || 'none'}`);
    console.log(`   Last Cached: ${row.artworkLastCached || 'never'}`);
    console.log(`   MIME Type: ${row.artworkMimeType || 'none'}`);
    console.log('   ---\n');
  });
  
  db.close();
});
