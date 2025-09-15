const fs = require('fs');
const path = require('path');

async function extractPostgreSQLData() {
  console.log('🔄 Extracting data from PostgreSQL dump...');
  
  const sqlPath = path.join(__dirname, '..', 'history_plus_export.sql');
  const outputDir = path.join(__dirname, '..', 'history-plus-export');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const lines = sqlContent.split('\n');
  
  let currentTable = null;
  let currentColumns = null;
  let currentData = [];
  let processedTables = 0;
  
  const tableMapping = {
    'HistoricalEvent': 'historical_events.csv',
    'Video': 'history_videos.csv',
    'Book': 'history_books.csv', 
    'Chapter': 'history_chapters.csv',
    'Section': 'history_sections.csv',
    'Channel': 'history_channels.csv',
    'user_event_reviews': 'user_event_reviews.csv',
    'user_video_watches': 'user_video_watches.csv',
    'user_book_reads': 'user_book_reads.csv',
    'user_chapter_reads': 'user_chapter_reads.csv',
    'user_section_reads': 'user_section_reads.csv'
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for COPY statements
    const copyMatch = line.match(/^COPY public\."(.+)" \((.+)\) FROM stdin;$/);
    if (copyMatch) {
      // Save previous table if we have one
      if (currentTable && currentData.length > 0) {
        saveTableData(currentTable, currentColumns, currentData, outputDir, tableMapping);
        processedTables++;
      }
      
      currentTable = copyMatch[1];
      currentColumns = copyMatch[2].split(', ');
      currentData = [];
      
      console.log(`   Found table: ${currentTable} with ${currentColumns.length} columns`);
      
      // Read data lines until we hit \.
      i++;
      while (i < lines.length && lines[i].trim() !== '\\.') {
        const dataLine = lines[i].trim();
        if (dataLine) {
          currentData.push(dataLine);
        }
        i++;
      }
      
      console.log(`   Collected ${currentData.length} data rows`);
    }
  }
  
  // Save the last table
  if (currentTable && currentData.length > 0) {
    saveTableData(currentTable, currentColumns, currentData, outputDir, tableMapping);
    processedTables++;
  }
  
  console.log(`✅ Processed ${processedTables} tables`);
}

function saveTableData(tableName, columns, dataLines, outputDir, tableMapping) {
  const csvFileName = tableMapping[tableName];
  if (!csvFileName) {
    console.log(`     Skipping ${tableName} (not in mapping)`);
    return;
  }
  
  console.log(`   Exporting ${tableName} to ${csvFileName}...`);
  
  // Convert PostgreSQL data to CSV format
  const csvContent = [
    columns.join(','),
    ...dataLines.map(line => {
      // Parse PostgreSQL tab-separated format
      const values = line.split('\t');
      return values.map(value => {
        if (value === '\\N') return ''; // PostgreSQL NULL
        // Escape CSV values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    })
  ].join('\n');
  
  const filePath = path.join(outputDir, csvFileName);
  fs.writeFileSync(filePath, csvContent);
  
  console.log(`     ✅ Exported ${dataLines.length} records to ${csvFileName}`);
}

extractPostgreSQLData().catch(console.error);