# History Plus Import in Production

## Overview
The History Plus import functionality works differently in development vs production environments.

## Development Environment
- CSV files are located in the local `history-plus-export` directory
- Import button works directly via the web UI
- No additional setup required

## Production Environment (Docker/Unraid)

### Option 1: Volume Mount (Recommended)
The `docker-compose.yml` includes a volume mount for the History Plus export directory:
```yaml
- /mnt/user/appdata/master-order/history-plus-export:/app/history-plus-export:ro
```

**Setup Steps:**
1. Copy your CSV files to `/mnt/user/appdata/master-order/history-plus-export/` on the Unraid host
2. Restart the container to mount the volume
3. Use the import button in the web UI

### Option 2: Docker CP Method
If you don't want to use volume mounts, you can copy files directly:

```bash
# Copy CSV files to running container
docker cp ./history-plus-export master-order:/app/

# Then use the import button in the web UI
```

### Option 3: Dedicated Import Script
Use the dedicated Unraid import script:
```bash
# Run the automated import script
./import-history-plus-unraid.sh
```

## File Structure
The system expects these CSV files in the import directory:
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
In both development and production, the import system supports force mode:
- **Normal Mode**: Skips existing records (preserves data)
- **Force Mode**: Updates existing records (useful for testing/corrections)

The web UI will automatically detect existing data and offer force mode option.