# History Plus Export Directory

This directory contains pre-exported History Plus data in CSV format for migration to PostgreSQL.

## Files Structure

- `export_metadata.csv` - Export metadata and summary
- `historical_events.csv` - Historical events data
- `history_videos.csv` - Video content associated with events
- `history_books.csv` - Book content associated with events  
- `history_chapters.csv` - Book chapter data
- `history_sections.csv` - Book section data
- `history_channels.csv` - Channel/source information
- `user_event_reviews.csv` - User review data for events
- `user_video_watches.csv` - User watch tracking for videos
- `user_book_reads.csv` - User read tracking for books
- `user_chapter_reads.csv` - User chapter read tracking
- `user_section_reads.csv` - User section read tracking

## Usage

These CSV files are imported to PostgreSQL during deployment using:

```bash
cd server
node import-history-plus-data.js ../history-plus-export
```

## Data Safety

- Import process only INSERTS new records
- Existing PostgreSQL data is never modified or deleted
- All operations use database transactions for safety
- Duplicate records are automatically skipped based on ID

## Manual Export

To generate fresh CSV files from SQLite:

```bash
cd server
node export-history-plus-data.js
```