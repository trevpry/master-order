const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./master_order.db');

db.all("SELECT name FROM TvdbSeries WHERE name LIKE '%Doctor Who%' ORDER BY name", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Cached Doctor Who series:');
  rows.forEach(row => {
    console.log('- ' + row.name);
  });
  db.close();
});
