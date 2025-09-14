# History Plus Clear Existing Import - Usage Guide

## Overview
The History Plus import system now supports a **clear existing data** option that will delete all existing History Plus data before importing new data. This is perfect for one-time migrations where you want to ensure ALL CSV data is imported without ID conflicts.

## ⚠️ IMPORTANT WARNING
**The clear existing option will DELETE ALL existing History Plus data from your database before importing. This operation CANNOT be undone. Use with caution!**

## API Usage

### Using File Upload + Clear Existing

```bash
# 1. Upload your CSV files first
curl -X POST http://localhost:3000/api/history-plus/upload-csv \
  -F "historical_events.csv=@/path/to/historical_events.csv" \
  -F "history_videos.csv=@/path/to/history_videos.csv" \
  -F "history_books.csv=@/path/to/history_books.csv" \
  -F "history_chapters.csv=@/path/to/history_chapters.csv" \
  -F "history_sections.csv=@/path/to/history_sections.csv" \
  -F "history_channels.csv=@/path/to/history_channels.csv" \
  -F "user_event_reviews.csv=@/path/to/user_event_reviews.csv" \
  -F "user_video_watches.csv=@/path/to/user_video_watches.csv" \
  -F "user_book_reads.csv=@/path/to/user_book_reads.csv" \
  -F "user_chapter_reads.csv=@/path/to/user_chapter_reads.csv" \
  -F "user_section_reads.csv=@/path/to/user_section_reads.csv"

# 2. Import with clear existing enabled
curl -X POST http://localhost:3000/api/history-plus/import-data \
  -H "Content-Type: application/json" \
  -d '{
    "useUploaded": true,
    "clearExisting": true,
    "force": false
  }'
```

### JavaScript/Frontend Usage

```javascript
// Upload files first (using FormData)
const formData = new FormData();
formData.append('historical_events.csv', eventFile);
formData.append('history_videos.csv', videosFile);
// ... add all CSV files

const uploadResponse = await fetch('/api/history-plus/upload-csv', {
  method: 'POST',
  body: formData
});

// Then import with clear existing
const importResponse = await fetch('/api/history-plus/import-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    useUploaded: true,
    clearExisting: true,  // ← This will delete all existing data first
    force: false
  })
});

const result = await importResponse.json();
console.log('Import completed:', result);
```

## Command Line Usage

```bash
# Clear existing data and import from uploaded files
node server/import-history-plus-data.js server/temp-uploads --clear-existing

# Clear existing data and import from mounted directory  
node server/import-history-plus-data.js /path/to/csv/files --clear-existing

# Combine with force mode if needed
node server/import-history-plus-data.js /path/to/csv/files --clear-existing --force
```

## Expected Behavior

### With clearExisting: true
1. **Delete Phase**: All existing History Plus data is deleted in proper dependency order:
   - User activity records (video watches, chapter reads, section reads, book reads, event reviews)
   - Content records (sections, chapters, books, videos, channels, events)

2. **Import Phase**: Fresh import of all CSV data with clean slate
   - No ID mapping conflicts
   - All user activity data should import successfully
   - New auto-generated IDs for all content

3. **Statistics**: Response includes deletion count
   ```json
   {
     "success": true,
     "clearExisting": true,
     "statistics": {
       "deleted": 850,      // ← Records deleted in clear phase
       "imported": 745,     // ← New records imported 
       "updated": 0,        // ← Should be 0 with clean slate
       "skipped": 0,        // ← Should be 0 with clean slate
       "errors": 0          // ← Hopefully 0!
     }
   }
   ```

### Without clearExisting: false (default)
- Standard import behavior
- Existing records skipped
- Only new records imported
- ID mapping conflicts may prevent user activity import

## Use Cases

### ✅ Perfect for:
- **One-time migration**: Moving data from History Plus to production
- **Clean slate import**: When you want to ensure ALL CSV data is imported
- **Resolving ID conflicts**: When existing data prevents proper import
- **Development/testing**: Reset database to known state

### ❌ Avoid when:
- **Incremental updates**: Adding new data to existing database
- **Production systems**: Where existing data must be preserved
- **Uncertain about data**: When you might need to keep existing records

## Safety Checklist

Before using `clearExisting: true`:

- [ ] **Backup your database** - This operation cannot be undone
- [ ] **Verify CSV completeness** - Ensure all your data is in the CSV files
- [ ] **Test in development** - Try the process in a non-production environment
- [ ] **Confirm intention** - You really want to delete ALL existing History Plus data
- [ ] **Check dependencies** - No other parts of your application depend on existing History Plus data

## Troubleshooting

### Issue: "No uploaded files found"
**Solution**: Upload CSV files first using the `/upload-csv` endpoint

### Issue: "Missing required files"
**Solution**: Ensure all required CSV files are uploaded:
- historical_events.csv
- history_videos.csv  
- history_books.csv
- history_chapters.csv
- history_sections.csv
- history_channels.csv
- user_event_reviews.csv
- user_video_watches.csv
- user_book_reads.csv
- user_chapter_reads.csv
- user_section_reads.csv

### Issue: Still getting ID mapping errors
**Solution**: Check that your CSV files have the expected format and foreign key relationships are correct

### Issue: Import takes a long time
**Expected**: The clear operation deletes potentially thousands of records, and the import process handles large datasets. This is normal for large datasets.

## Example Complete Workflow

```javascript
// Complete workflow for clean slate import
async function performCleanSlateImport(csvFiles) {
  try {
    // 1. Upload all CSV files
    console.log('📤 Uploading CSV files...');
    const formData = new FormData();
    Object.keys(csvFiles).forEach(filename => {
      formData.append(filename, csvFiles[filename]);
    });
    
    const uploadResult = await fetch('/api/history-plus/upload-csv', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResult.ok) {
      throw new Error('Upload failed');
    }
    
    const uploadData = await uploadResult.json();
    console.log('✅ Upload completed:', uploadData.summary);
    
    // 2. Confirm clean slate import
    const confirmed = confirm(
      '⚠️ WARNING: This will DELETE ALL existing History Plus data. Continue?'
    );
    
    if (!confirmed) {
      console.log('❌ Import cancelled by user');
      return;
    }
    
    // 3. Import with clear existing
    console.log('🗑️ Starting clean slate import...');
    const importResult = await fetch('/api/history-plus/import-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useUploaded: true,
        clearExisting: true,
        force: false
      })
    });
    
    const importData = await importResult.json();
    
    if (importData.success) {
      console.log('🎉 Clean slate import completed!');
      console.log('📊 Statistics:', importData.statistics);
    } else {
      console.error('❌ Import failed:', importData.error);
    }
    
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
  }
}
```

## Recovery

If something goes wrong during the clear existing import:

1. **Stop the process** if still running
2. **Restore from backup** if you have one
3. **Re-upload CSV files** and try again
4. **Contact support** if data recovery is needed

Remember: The clear existing option is powerful but destructive. Use it wisely!