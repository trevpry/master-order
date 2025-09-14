# History Plus Import in Production

## Overview
The History Plus import functionality now supports both file upload and traditional directory-based import methods.

## Development Environment
- CSV files can be uploaded via the web UI or placed in the local `history-plus-export` directory
- Import button works directly via the web UI with both methods
- No additional setup required

## Production Environment (Docker/Unraid)

### Option 1: File Upload (Recommended)
The simplest method for production - no volume mounts or file copying required:

1. Access the History Plus Timeline page
2. Click "📤 Upload CSV Files" 
3. Select all CSV files at once (use Ctrl/Cmd+click to select multiple)
4. Click "📥 Import Uploaded Files" once upload completes
5. Files are automatically cleaned up after import

**Advantages:**
- No Docker configuration changes needed
- Works with any deployment method
- Automatic file validation and cleanup
- User-friendly interface

### Option 2: Volume Mount (Legacy)
For automated deployments or when CSV files are already on the host:

```yaml
volumes:
  - /mnt/user/appdata/master-order/history-plus-export:/app/history-plus-export:ro
```

**Setup Steps:**
1. Copy CSV files to `/mnt/user/appdata/master-order/history-plus-export/` on host
2. Restart container to mount the volume
3. Use "📁 Import from Directory" button

### Option 3: Docker CP Method
Copy files directly to running container:

```bash
# Copy CSV files to running container
docker cp ./history-plus-export master-order:/app/

# Then use "📁 Import from Directory" button
```

### Option 4: Dedicated Import Script
Use the dedicated Unraid import script:
```bash
./import-history-plus-unraid.sh
```

## File Structure
The system expects these CSV files:
- `export_metadata.csv`
- `historical_events.csv`
- `history_books.csv`
- `history_channels.csv`
- `history_chapters.csv`
- `history_sections.csv`
- `history_videos.csv`
- `user_book_reads.csv`
- `user_chapter_reads.csv`
- `user_event_reviews.csv`
- `user_section_reads.csv`
- `user_video_watches.csv`

## Force Mode
Both upload and directory import support force mode:
- **Normal Mode**: Skips existing records (preserves data)
- **Force Mode**: Updates existing records (useful for testing/corrections)

The web UI automatically detects existing data and offers force mode option.

## File Upload Features
- **Validation**: Only CSV files accepted, validates required file names
- **Multi-select**: Upload all files at once for convenience  
- **Progress**: Real-time upload and import status
- **Cleanup**: Temporary files automatically removed after import
- **Error Handling**: Clear error messages for missing or invalid files