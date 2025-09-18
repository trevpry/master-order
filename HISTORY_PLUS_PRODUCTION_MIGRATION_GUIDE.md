# History Plus Production Migration Guide

## 🚀 Production-Safe Migration for Docker/Unraid PostgreSQL

This guide provides step-by-step instructions for safely migrating History Plus books to the unified Book system in a production Docker/Unraid environment with **100% certainty of no PostgreSQL data loss**.

## 🛡️ Safety Features

### Production Safety Guarantees
- ✅ **PostgreSQL Transaction Support**: Full atomic transactions with automatic rollback
- ✅ **Environment Detection**: Automatic Docker/Unraid PostgreSQL detection
- ✅ **Pre/Post Validation**: Comprehensive data integrity checking
- ✅ **Dry Run Mode**: Test migration without making changes
- ✅ **Zero Data Loss**: Transaction isolation prevents partial failures
- ✅ **Rollback Protection**: Automatic rollback on any validation failure

### Migration Features
- 🔍 **Dry Run Testing**: `--dry-run` flag for validation without changes
- 🔄 **Force Re-migration**: `--force` flag to re-migrate existing books
- 📊 **Progress Tracking**: Real-time migration progress and statistics
- 🐳 **Docker Optimization**: Optimized for containerized PostgreSQL environments
- 📝 **Comprehensive Logging**: Detailed success/error reporting

## 📋 Pre-Migration Checklist

### 1. Environment Verification
```bash
# Verify Docker/Unraid PostgreSQL environment
echo $DATABASE_URL
# Should show: postgresql://username:password@host:port/database

# Check Docker environment
ls /.dockerenv
# Should exist in Docker containers

# Verify database connectivity
docker exec -it eddie-life-mgmt-app node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$executeRaw\`SELECT 1\`.then(() => console.log('✅ PostgreSQL connected')).catch(console.error);
"
```

### 2. Data Backup (CRITICAL)
```bash
# Create PostgreSQL backup before migration
docker exec eddie-life-mgmt-db pg_dump -U postgres eddie_life_mgmt > history_plus_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -la history_plus_backup_*.sql
```

### 3. Application State
```bash
# Stop Eddie Life Management temporarily (optional but recommended)
docker-compose stop eddie-life-mgmt-app

# Keep database running
docker-compose ps
# eddie-life-mgmt-db should still be running
```

## 🔍 Migration Execution

### Phase 1: Dry Run Validation
```bash
# Enter the application container
docker exec -it eddie-life-mgmt-app bash

# Navigate to server directory
cd /app/server

# Run dry run to validate migration
node migrate-history-plus-books-only.js --dry-run
```

**Expected Dry Run Output:**
```
🚀 EDDIE LIFE MANAGEMENT - HISTORY PLUS MIGRATION
================================================

🔍 DRY RUN MODE - Validating migration without changes

🔍 ENVIRONMENT DETECTION
========================

Database Type: PostgreSQL
Environment: Docker Container
Database URL: postgresql://eddie_user:***...
Node Environment: production
🐳 Docker/Unraid PostgreSQL detected - Production safety mode enabled

🔍 PRE-MIGRATION VALIDATION
===========================

📊 Found X History Plus books to validate
✅ Validation completed: 0 errors, Y warnings

✅ Pre-migration validation passed

📚 Processing X History Plus books...

[DRY RUN] Would create book with Z chapters

📋 MIGRATION SUMMARY
===================

🔍 DRY RUN RESULTS:
📚 Books: X created, X processed
📑 Chapters: Y created
📄 Sections: Z created
📊 Progress: W reading completions
🔗 Links: V History Plus event links

✅ No errors detected

⏱️  Total time: N.NN seconds

🔍 Dry run completed - run without --dry-run to execute migration
```

### Phase 2: Production Migration
**Only proceed if dry run shows 0 errors**

```bash
# Execute production migration with full safety
node migrate-history-plus-books-only.js

# Monitor for any errors or warnings
# Migration will automatically rollback on any failure
```

**Expected Production Output:**
```
🚀 EDDIE LIFE MANAGEMENT - HISTORY PLUS MIGRATION
================================================

⚠️  PRODUCTION MODE - Changes will be permanent

🔍 ENVIRONMENT DETECTION
========================

Database Type: PostgreSQL
Environment: Docker Container
🐳 Docker/Unraid PostgreSQL detected - Production safety mode enabled

🔍 PRE-MIGRATION VALIDATION
===========================

✅ Pre-migration validation passed

📚 STARTING HISTORY PLUS MIGRATION
===================================

🔒 Using PostgreSQL transaction for data safety...

📖 Migrating: "Book Title 1"
  ✅ Created unified book (ID: 123)
  📊 Migrated reading progress (completed)
  🔗 Created History Plus event link
  ✅ Migration completed for "Book Title 1"

🔍 POST-MIGRATION VALIDATION
============================

🔍 Validating migration integrity...
📊 Migration results validation:
  - Books: X (expected: X)
  - Chapters: Y (expected: Y)
  - Sections: Z (expected: Z)

✅ Post-migration validation passed

📋 MIGRATION SUMMARY
===================

✅ MIGRATION COMPLETED:
📚 Books: X created, X processed
📑 Chapters: Y created
📄 Sections: Z created
📊 Progress: W reading completions
🔗 Links: V History Plus event links

✅ No errors detected

⏱️  Total time: N.NN seconds

🎉 History Plus books migration completed successfully!
📝 Next steps:
   1. Verify migrated data in the Books section
   2. Test reading progress functionality
   3. Check History Plus event associations
```

## 🔧 Post-Migration Verification

### 1. Restart Application
```bash
# Exit container
exit

# Restart Eddie Life Management application
docker-compose start eddie-life-mgmt-app

# Verify all services are running
docker-compose ps
```

### 2. Database Verification
```bash
# Connect to database and verify migration
docker exec -it eddie-life-mgmt-db psql -U postgres eddie_life_mgmt

# Check migrated books
SELECT COUNT(*) as migrated_books FROM "Book" WHERE "isHistoryPlusBook" = true;

# Check migrated chapters
SELECT COUNT(*) as migrated_chapters FROM "BookChapter" 
WHERE "bookId" IN (SELECT id FROM "Book" WHERE "isHistoryPlusBook" = true);

# Check migrated sections
SELECT COUNT(*) as migrated_sections FROM "BookSection" 
WHERE "chapterId" IN (
  SELECT id FROM "BookChapter" 
  WHERE "bookId" IN (SELECT id FROM "Book" WHERE "isHistoryPlusBook" = true)
);

# Check History Plus links
SELECT COUNT(*) as history_links FROM "HistoryBookLink";

# Exit database
\q
```

### 3. Frontend Verification
```bash
# Access Eddie Life Management web interface
# Navigate to: http://your-unraid-ip:3000/media/books

# Verify:
# ✅ History Plus books appear in unified Books section
# ✅ Book chapters and sections are properly structured
# ✅ Reading progress is preserved
# ✅ History Plus event associations are maintained
```

## 🚨 Troubleshooting

### Migration Fails During Execution
```bash
# Check error message in terminal output
# Transaction will automatically rollback

# Check application logs
docker logs eddie-life-mgmt-app --tail 100

# Restore from backup if needed
docker exec -i eddie-life-mgmt-db psql -U postgres eddie_life_mgmt < history_plus_backup_YYYYMMDD_HHMMSS.sql
```

### Validation Errors
```bash
# Re-run dry run to identify issues
node migrate-history-plus-books-only.js --dry-run

# Check database constraints
docker exec -it eddie-life-mgmt-db psql -U postgres eddie_life_mgmt -c "
SELECT conname, contype, confrelid::regclass 
FROM pg_constraint 
WHERE conrelid IN ('Book'::regclass, 'BookChapter'::regclass, 'BookSection'::regclass);
"
```

### Force Re-migration (if needed)
```bash
# Only use if you need to re-migrate existing books
node migrate-history-plus-books-only.js --force

# Or combine with dry run first
node migrate-history-plus-books-only.js --dry-run --force
```

## 📊 Migration Command Reference

### Available Commands
```bash
# Production migration
node migrate-history-plus-books-only.js

# Dry run (recommended first)
node migrate-history-plus-books-only.js --dry-run

# Force re-migration
node migrate-history-plus-books-only.js --force

# Dry run with force
node migrate-history-plus-books-only.js --dry-run --force

# Help information
node migrate-history-plus-books-only.js --help
```

### Command Line Options
- `--dry-run, -d`: Preview migration without making changes
- `--force, -f`: Re-migrate existing books (overwrite duplicates)
- `--help, -h`: Show help message and safety features

## 🎯 Success Criteria

✅ **Migration Successful When:**
- Dry run shows 0 errors
- Production migration completes without rollback
- Post-migration validation passes
- Frontend shows migrated books correctly
- Reading progress is preserved
- No data loss detected

## 🔄 Rollback Plan

### Automatic Rollback
- PostgreSQL transactions automatically rollback on any error
- No manual rollback needed for failed migrations

### Manual Rollback (if needed)
```bash
# Stop application
docker-compose stop eddie-life-mgmt-app

# Restore database from backup
docker exec -i eddie-life-mgmt-db psql -U postgres eddie_life_mgmt < history_plus_backup_YYYYMMDD_HHMMSS.sql

# Restart application
docker-compose start eddie-life-mgmt-app
```

## 📞 Support

If migration issues occur:
1. **Check transaction logs** in terminal output
2. **Review database logs**: `docker logs eddie-life-mgmt-db`
3. **Verify backup integrity** before attempting restore
4. **Use dry run mode** to test without changes
5. **Contact support** with complete error logs

---

**⚠️ IMPORTANT**: Always run `--dry-run` first and create a database backup before production migration. The PostgreSQL transaction system provides automatic rollback protection, but backups ensure complete safety.