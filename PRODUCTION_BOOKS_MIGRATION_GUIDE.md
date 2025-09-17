# Production Books Migration Guide

## Overview
The comprehensive books migration system is now production-ready with full PostgreSQL support, transaction safety, and environment detection.

## Migration Features

### Development (SQLite)
- Direct execution without transactions
- Local file database
- Safe for testing and development

### Production (PostgreSQL) 
- **Full transaction safety** - all operations wrapped in PostgreSQL transaction
- **Automatic rollback** - if any step fails, all changes are reverted
- **Environment detection** - automatically detects PostgreSQL vs SQLite
- **Production warnings** - clear safety information and backup recommendations

## Production Deployment

### Prerequisites
1. **Database Backup** (STRONGLY RECOMMENDED)
   ```bash
   # Create backup before migration
   pg_dump "$DATABASE_URL" > books_migration_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Environment Variables**
   ```bash
   # Set PostgreSQL connection
   export DATABASE_URL="postgresql://username:password@host:5432/database"
   
   # Or Windows PowerShell
   $env:DATABASE_URL="postgresql://username:password@host:5432/database"
   ```

### Migration Execution

#### Option 1: Using Production Runner (Recommended)
```bash
# Validate environment and show safety warnings
node run-production-books-migration.js

# Run with force flag after validation
DATABASE_URL="postgresql://user:pass@host:port/db" node run-production-books-migration.js --force
```

#### Option 2: Direct Migration Execution
```bash
# Run migration directly
DATABASE_URL="postgresql://user:pass@host:port/db" node comprehensive-books-migration.js
```

### Docker Deployment
```bash
# In Docker environment with PostgreSQL
docker exec -it master-order-container bash
cd /app/server
node comprehensive-books-migration.js
```

## Migration Process

### Phase 1: Custom Order Books
- ✅ Creates unified Book records from Custom Order book items
- ✅ Preserves Custom Order items with `bookId` links to unified books
- ✅ Migrates reading progress and metadata
- ✅ No Custom Order data is deleted

### Phase 2: History Plus Books
- ✅ Creates unified Book/BookChapter/BookSection records
- ✅ Preserves all event associations (`eventId` fields)
- ✅ Migrates all reading progress and user data
- ⚠️ Deletes original History Plus book records (after successful migration)

### Phase 3: Validation
- ✅ Verifies all unified books created correctly
- ✅ Confirms Custom Order links are intact
- ✅ Validates event associations preserved
- ✅ Reports comprehensive migration statistics

## Safety Features

### PostgreSQL Transaction Safety
```javascript
// All operations wrapped in transaction
await prisma.$transaction(async (tx) => {
  // 1. Migrate Custom Orders
  // 2. Migrate History Plus  
  // 3. Validate results
}, { timeout: 300000 }); // 5 minute timeout
```

### Automatic Rollback
- If **any** step fails, **all** changes are automatically reverted
- Database remains in original state if migration encounters errors
- No partial migrations or corrupted data

### Environment Detection
```javascript
// Automatic detection
const isProduction = detectProductionEnvironment();
const databaseType = detectDatabaseType(); // 'postgresql' or 'sqlite'

// Production indicators:
// - NODE_ENV=production
// - DATABASE_URL starts with postgresql://
// - Docker environment (/.dockerenv exists)
```

## Post-Migration Validation

### Android API Integration
After migration, the Android API will automatically serve enhanced book metadata:

```json
{
  "id": 24,
  "title": "Custom Order Item Title",
  "type": "book",
  "bookId": 27,
  "bookTitle": "Star Trek - The Face of the Unknown",
  "bookAuthor": "Christopher L. Bennett",
  "bookYear": 2016,
  "bookIsbn": "9781501138560",
  "bookPages": 384,
  "bookPublisher": "Pocket Books",
  "chapters": [...],
  "sections": [...],
  "openLibraryData": {...}
}
```

### Unified Book System
- All books available in unified `Book` table
- Chapters and sections with event associations
- Reading progress preserved across migration
- Custom Orders maintain links via `bookId`

## Troubleshooting

### Migration Fails
```bash
# Check environment
node run-production-books-migration.js

# Review error logs
# PostgreSQL transaction automatically rolls back
# Database remains unchanged
```

### Restore from Backup (if needed)
```bash
# Restore PostgreSQL backup
psql "$DATABASE_URL" < books_migration_backup_TIMESTAMP.sql
```

### Verify Results
```sql
-- Check unified books created
SELECT COUNT(*) FROM "Book";

-- Check Custom Order links
SELECT COUNT(*) FROM "CustomOrderItem" WHERE "bookId" IS NOT NULL;

-- Check event associations preserved
SELECT COUNT(*) FROM "BookChapter" WHERE "eventId" IS NOT NULL;
SELECT COUNT(*) FROM "BookSection" WHERE "eventId" IS NOT NULL;
```

## Migration Statistics

The migration provides comprehensive reporting:

```
📚 Custom Order Migration:
  ✓ Books processed: X
  ✓ New books created: X  
  ✓ BookId links created: X
  ✓ Progress records migrated: X

📖 History Plus Migration:
  ✓ Books processed: X
  ✓ New books created: X
  ✓ Chapters created: X
  ✓ Sections created: X
  ✓ Event links created: X
  ✓ Original records deleted: X

📈 Overall Summary:
  📚 Total unified books: X
  🔗 Total event associations: X
  ❌ Total errors: 0
```

## Production Checklist

- [ ] Database backup created
- [ ] DATABASE_URL set to PostgreSQL connection
- [ ] Migration script tested in staging environment
- [ ] Understanding of transaction safety features
- [ ] Post-migration validation plan
- [ ] Rollback procedure understood

## Next Steps

After successful migration:

1. **Verify Android API** - Test enhanced book endpoints
2. **Validate Web Interface** - Confirm unified books display correctly  
3. **Monitor Performance** - Check PostgreSQL query performance
4. **Update Documentation** - Mark migration as completed
5. **Clean Up** - Remove old migration scripts if no longer needed

The books migration system is now production-ready with enterprise-grade safety and reliability features.