#!/usr/bin/env node

/**
 * Import PostgreSQL dump to SQLite and export CSV with proper relationships
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PostgreSQLToCsvExporter {
  constructor() {
    this.tempDbPath = path.join(__dirname, 'temp_history_plus.db');
    this.outputDir = path.join(__dirname, '..', 'history-plus-export');
    this.sqlDumpPath = path.join(__dirname, '..', 'history_plus_export.sql');
    this.prisma = null;
  }

  async initialize() {
    console.log('🔄 Initializing PostgreSQL to CSV export...');
    
    // Remove temp db if it exists
    if (fs.existsSync(this.tempDbPath)) {
      fs.unlinkSync(this.tempDbPath);
      console.log('   Removed existing temp database');
    }

    // Check if SQL dump exists
    if (!fs.existsSync(this.sqlDumpPath)) {
      throw new Error(`❌ SQL dump not found at: ${this.sqlDumpPath}`);
    }

    console.log(`📁 SQL dump found: ${this.sqlDumpPath}`);
    console.log(`📁 Output directory: ${this.outputDir}`);
  }

  async convertPostgresToSqlite() {
    console.log('🔄 Converting PostgreSQL dump to SQLite...');
    
    try {
      // Read the PostgreSQL dump
      let sqlContent = fs.readFileSync(this.sqlDumpPath, 'utf8');
      
      // Convert PostgreSQL syntax to SQLite
      console.log('   Converting SQL syntax...');
      
      // Remove PostgreSQL-specific commands
      sqlContent = sqlContent.replace(/\\restrict.*$/gm, '');
      sqlContent = sqlContent.replace(/SET .*$/gm, '');
      sqlContent = sqlContent.replace(/SELECT pg_catalog\..*$/gm, '');
      
      // Convert data types
      sqlContent = sqlContent.replace(/character varying/g, 'TEXT');
      sqlContent = sqlContent.replace(/timestamp with time zone/g, 'DATETIME');
      sqlContent = sqlContent.replace(/timestamp without time zone/g, 'DATETIME');
      sqlContent = sqlContent.replace(/boolean/g, 'BOOLEAN');
      sqlContent = sqlContent.replace(/integer/g, 'INTEGER');
      sqlContent = sqlContent.replace(/text/g, 'TEXT');
      
      // Remove schema prefixes
      sqlContent = sqlContent.replace(/public\./g, '');
      sqlContent = sqlContent.replace(/ONLY /g, '');
      
      // Convert COPY statements to INSERT statements (simplified approach)
      // For now, let's try to extract the essential table creation and see if we can work with it
      
      // Extract table creation statements
      const tableCreations = [];
      const createTableRegex = /CREATE TABLE[^;]+;/gs;
      const matches = sqlContent.match(createTableRegex);
      
      if (matches) {
        tableCreations.push(...matches);
        console.log(`   Found ${matches.length} table creation statements`);
      }
      
      // Write simplified SQLite schema
      const sqliteSchema = tableCreations.join('\\n\\n');
      const tempSqlPath = path.join(__dirname, 'temp_schema.sql');
      fs.writeFileSync(tempSqlPath, sqliteSchema);
      
      console.log('   Schema conversion completed');
      return tempSqlPath;
      
    } catch (error) {
      console.error('❌ Error converting PostgreSQL dump:', error);
      throw error;
    }
  }

  async setupDatabase() {
    console.log('🔄 Setting up temporary database...');
    
    // Initialize Prisma with temp database
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.tempDbPath}`
        }
      }
    });

    console.log('   Database connection established');
  }

  async exportToCSV() {
    console.log('🔄 Exporting data to CSV files...');
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    try {
      // Export all tables we need with proper relationships
      await this.exportTable('historicalEvent', 'historical_events.csv');
      await this.exportTable('Video', 'history_videos.csv'); // This should have eventId
      await this.exportTable('Book', 'history_books.csv'); // This should have eventId
      await this.exportTable('Chapter', 'history_chapters.csv'); // This should have eventId
      await this.exportTable('Section', 'history_sections.csv'); // This should have eventId
      await this.exportTable('Channel', 'history_channels.csv');
      
      // Export user relationship tables
      await this.exportTable('user_event_reviews', 'user_event_reviews.csv');
      await this.exportTable('user_video_watches', 'user_video_watches.csv');
      await this.exportTable('user_book_reads', 'user_book_reads.csv');
      await this.exportTable('user_chapter_reads', 'user_chapter_reads.csv');
      await this.exportTable('user_section_reads', 'user_section_reads.csv');
      
      console.log('✅ CSV export completed successfully');
      
    } catch (error) {
      console.error('❌ Error exporting CSV:', error);
      throw error;
    }
  }

  async exportTable(tableName, filename) {
    try {
      console.log(`   Exporting ${tableName}...`);
      
      // Get all records from table
      const records = await this.prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
      
      if (records.length === 0) {
        console.log(`     No records found in ${tableName}`);
        return;
      }

      // Convert to CSV
      const headers = Object.keys(records[0]);
      const csvContent = [
        headers.join(','),
        ...records.map(record => 
          headers.map(header => {
            const value = record[header];
            if (value === null) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\\n');

      const filePath = path.join(this.outputDir, filename);
      fs.writeFileSync(filePath, csvContent);
      
      console.log(`     ✅ Exported ${records.length} records to ${filename}`);
      
    } catch (error) {
      console.log(`     ⚠️  Could not export ${tableName}: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    
    // Remove temp files
    const tempFiles = [
      this.tempDbPath,
      path.join(__dirname, 'temp_schema.sql')
    ];
    
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`   Removed ${file}`);
      }
    });
  }

  async run() {
    try {
      await this.initialize();
      
      // For now, let's try a different approach - check if we can use pg_dump output more directly
      console.log('🔄 Attempting to extract data from PostgreSQL dump...');
      
      // Let's create a simpler approach - read the SQL file and extract INSERT/COPY data
      await this.extractDataFromSqlDump();
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async extractDataFromSqlDump() {
    console.log('🔄 Extracting data directly from SQL dump...');
    
    const sqlContent = fs.readFileSync(this.sqlDumpPath, 'utf8');
    const lines = sqlContent.split('\\n');
    
    let currentTable = null;
    let currentColumns = null;
    let currentData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for COPY statements (PostgreSQL's bulk insert format)
      const copyMatch = line.match(/^COPY public\."(.+)" \((.+)\) FROM stdin;$/);
      if (copyMatch) {
        currentTable = copyMatch[1];
        currentColumns = copyMatch[2].split(', ');
        currentData = [];
        
        console.log(`   Found table: ${currentTable} with columns: ${currentColumns.join(', ')}`);
        
        // Read data lines until we hit \.
        i++;
        while (i < lines.length && lines[i].trim() !== '\\.') {
          if (lines[i].trim()) {
            currentData.push(lines[i]);
          }
          i++;
        }
        
        // Export this table data
        await this.exportTableData(currentTable, currentColumns, currentData);
      }
    }
  }

  async exportTableData(tableName, columns, dataLines) {
    if (dataLines.length === 0) return;
    
    console.log(`   Processing ${tableName}: ${dataLines.length} records`);
    
    // Map table names to our CSV file names
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
    
    const csvFileName = tableMapping[tableName];
    if (!csvFileName) {
      console.log(`     Skipping ${tableName} (not in mapping)`);
      return;
    }
    
    // Convert PostgreSQL data to CSV format
    const csvContent = [
      columns.join(','),
      ...dataLines.map(line => {
        // Parse PostgreSQL tab-separated format and convert to CSV
        const values = line.split('\\t');
        return values.map(value => {
          if (value === '\\\\N') return ''; // PostgreSQL NULL
          if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',');
      })
    ].join('\\n');
    
    const filePath = path.join(this.outputDir, csvFileName);
    fs.writeFileSync(filePath, csvContent);
    
    console.log(`     ✅ Exported to ${csvFileName}`);
  }
}

// Run the export
const exporter = new PostgreSQLToCsvExporter();
exporter.run().catch(console.error);