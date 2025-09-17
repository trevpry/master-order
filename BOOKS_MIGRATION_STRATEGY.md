# Books Migration Strategy

## Overview
This document outlines the complete migration strategy for consolidating all existing book data from CustomOrderItems and HistoryBooks into the new unified Books system.

## Current Data Sources

### 1. CustomOrderItem Book Data
```sql
-- Fields to migrate from CustomOrderItem:
bookTitle, bookAuthor, bookYear, bookIsbn, bookPublisher
bookOpenLibraryId, bookCoverUrl, bookPageCount
bookCurrentPage, bookPercentRead
komgaBookId, komgaMetadata, komgaSeriesId, komgaSeriesUrl, komgaUrl
artworkLastCached, artworkMimeType, localArtworkPath, originalArtworkUrl
```

### 2. HistoryBook Data
```sql
-- HistoryBook structure:
HistoryBook -> HistoryChapter -> HistorySection
- Books with chapters/sections hierarchy
- Linked to HistoricalEvents
- User reading tracking tables
```

## Migration Process

### Phase 1: Schema Synchronization
1. Update all three schema files (main, SQLite, PostgreSQL)
2. Generate Prisma client
3. Run schema migration

### Phase 2: Data Migration Scripts

#### Script 1: Migrate CustomOrderItem Books
```javascript
// Migrate unique books from CustomOrderItems
// Handle duplicates by ISBN, OpenLibraryId, or title+author
// Preserve reading progress in BookCompletion table
// Update CustomOrderItem.bookId references
```

#### Script 2: Migrate HistoryBooks
```javascript
// Migrate HistoryBook -> Book
// Migrate HistoryChapter -> BookChapter  
// Migrate HistorySection -> BookSection
// Create HistoryBookLink for event associations
// Migrate user reading data to completion tables
```

#### Script 3: Consolidate Duplicates
```javascript
// Find and merge duplicate books across sources
// Preserve all metadata and relationships
// Update all foreign key references
```

### Phase 3: Validation & Cleanup
1. Verify all data migrated correctly
2. Update application services
3. Remove old book fields from CustomOrderItem
4. Archive old HistoryBook tables

## Migration Scripts

### Main Migration Script
```javascript
const { PrismaClient } = require('@prisma/client');

class BooksMigrationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.migrationStats = {
      customOrderBooks: 0,
      historyBooks: 0,
      duplicatesFound: 0,
      duplicatesMerged: 0,
      errors: []
    };
  }

  async runFullMigration() {
    console.log('🚀 Starting Books Migration...');
    
    try {
      // Phase 1: Migrate CustomOrderItem books
      await this.migrateCustomOrderBooks();
      
      // Phase 2: Migrate HistoryBooks
      await this.migrateHistoryBooks();
      
      // Phase 3: Handle duplicates
      await this.consolidateDuplicates();
      
      // Phase 4: Validation
      await this.validateMigration();
      
      console.log('✅ Migration completed successfully!');
      console.log('📊 Migration Stats:', this.migrationStats);
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}
```

## Data Integrity Considerations

### 1. Duplicate Detection Strategy
- **Primary**: ISBN matching
- **Secondary**: OpenLibraryId matching  
- **Tertiary**: Title + Author fuzzy matching
- **Fallback**: Manual review for edge cases

### 2. Progress Preservation
- CustomOrderItem reading progress → BookCompletion
- HistoryBook user reads → BookCompletion, ChapterCompletion, SectionCompletion
- Maintain all reading session history

### 3. Relationship Preservation
- CustomOrderItem → Book references
- HistoricalEvent → Book links via HistoryBookLink
- Reading sessions maintain book context

## Rollback Strategy

### 1. Pre-Migration Backup
```sql
-- Create backup tables before migration
CREATE TABLE CustomOrderItem_backup AS SELECT * FROM CustomOrderItem;
CREATE TABLE HistoryBook_backup AS SELECT * FROM HistoryBook;
-- etc.
```

### 2. Rollback Scripts
- Restore from backup tables
- Remove new unified tables
- Restore original foreign key relationships

## Testing Strategy

### 1. Migration Testing
- Test on development database copy
- Verify all data preserved
- Check relationship integrity
- Validate reading progress accuracy

### 2. Application Testing
- Test all book-related features
- Verify Android API compatibility
- Check Books page functionality
- Validate reading session tracking

## Post-Migration Tasks

### 1. Application Updates
- Update BookService to use unified tables
- Update Android API endpoints
- Update Books page UI
- Update reading session logic

### 2. Performance Optimization
- Add database indexes
- Optimize frequent queries
- Monitor performance impact

### 3. Documentation Updates
- Update API documentation
- Update database schema docs
- Create migration runbook

## Risk Mitigation

### 1. Data Loss Prevention
- Full database backup before migration
- Incremental validation at each step
- Rollback procedures tested
- Staging environment testing

### 2. Downtime Minimization
- Run migration during low-usage periods
- Prepare rollback scripts in advance
- Monitor application health
- Have support team on standby

### 3. User Communication
- Notify users of maintenance window
- Provide status updates
- Document any temporary limitations
- Prepare user support materials