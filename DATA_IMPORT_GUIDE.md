# Data Import Guide for Master Order

This guide helps you import data from your hosted PostgreSQL database to both local development (SQLite) and production (Docker PostgreSQL) environments.

## Prerequisites

1. **Source Database Access**: Connection details for your hosted PostgreSQL database
2. **Local Development Environment**: Working Master Order setup with SQLite
3. **Production Environment**: Docker/Unraid setup with PostgreSQL
4. **pg_dump/pg_restore**: PostgreSQL client tools installed

## Import Strategies

### Strategy 1: Full Database Dump (Recommended)
Export entire database structure and data from hosted PostgreSQL and import to target environments.

### Strategy 2: Data-Only Export
Export only data (INSERT statements) for importing into existing schema.

### Strategy 3: Table-by-Table Export
Export specific tables individually for selective data migration.

## Step-by-Step Import Process

### Phase 1: Export from Hosted PostgreSQL

#### 1.1 Full Database Export
```bash
# Export complete database with structure and data
pg_dump -h your-host -U your-username -d your-database-name \
  --clean --if-exists --create --verbose \
  -f master_order_export.sql

# Export data-only (for existing schema)
pg_dump -h your-host -U your-username -d your-database-name \
  --data-only --disable-triggers --verbose \
  -f master_order_data_only.sql
```

#### 1.2 Table-Specific Export (if needed)
```bash
# Export specific tables
pg_dump -h your-host -U your-username -d your-database-name \
  --table=orders --table=episodes --table=movies \
  --data-only --disable-triggers \
  -f master_order_specific_tables.sql
```

### Phase 2: Prepare Target Environments

#### 2.1 Local Development (SQLite)
```bash
# Backup current local database
cp master_order.db master_order_backup_$(date +%Y%m%d_%H%M%S).db

# Reset to fresh schema (if needed)
cd server
npm run setup-schema:sqlite
npx prisma migrate reset --force
npx prisma migrate deploy
```

#### 2.2 Production Docker/Unraid (PostgreSQL)
```bash
# Backup current production database
docker exec master-order-postgres pg_dump -U postgres master_order > \
  master_order_prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Or use the existing backup script
./backup-database.sh
```

### Phase 3: Data Transformation

#### 3.1 Convert PostgreSQL to SQLite (for local development)
```bash
# Use the conversion script (created below)
./scripts/convert-postgres-to-sqlite.sh master_order_export.sql
```

#### 3.2 Schema Compatibility Check
```bash
# Compare schemas to identify differences
./scripts/compare-schemas.sh
```

### Phase 4: Import Data

#### 4.1 Import to Local SQLite
```bash
# Apply converted SQL to SQLite
sqlite3 master_order.db < master_order_sqlite_converted.sql

# Or use Prisma for data seeding
npm run prisma:seed
```

#### 4.2 Import to Production PostgreSQL
```bash
# Method 1: Direct import to running container
docker exec -i master-order-postgres psql -U postgres master_order < master_order_export.sql

# Method 2: Restore using pg_restore (if using custom format)
docker exec -i master-order-postgres pg_restore -U postgres -d master_order master_order_export.dump
```

## Data Import Scripts

### 1. PostgreSQL to SQLite Converter Script
```bash
# File: scripts/convert-postgres-to-sqlite.sh
#!/bin/bash
# This script converts PostgreSQL dump to SQLite compatible format
```

### 2. Schema Comparison Script
```bash
# File: scripts/compare-schemas.sh
#!/bin/bash
# This script compares source and target schemas
```

### 3. Data Validation Script
```bash
# File: scripts/validate-import.sh
#!/bin/bash
# This script validates imported data integrity
```

## Environment Variables Setup

### For Hosted PostgreSQL Source
```bash
# .env.import
IMPORT_DATABASE_URL="postgresql://username:password@host:port/database"
IMPORT_HOST="your-hosted-db-host.com"
IMPORT_USER="your-username"
IMPORT_PASSWORD="your-password"
IMPORT_DATABASE="your-database-name"
IMPORT_PORT="5432"
```

### For Production Target
```bash
# Update docker-compose.yml or .env.production
DATABASE_URL="postgresql://postgres:your-password@postgres:5432/master_order"
```

## Common Issues & Solutions

### Issue 1: Schema Mismatches
**Problem**: Source database schema differs from current Master Order schema
**Solution**: 
1. Export schema separately: `pg_dump --schema-only`
2. Compare with current `schema.prisma`
3. Create migration for missing fields
4. Run `npx prisma migrate dev --name "import-compatibility"`

### Issue 2: Data Type Conflicts
**Problem**: PostgreSQL types don't directly map to SQLite
**Solution**: Use the conversion script to handle:
- `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `BOOLEAN` → `INTEGER` (0/1)
- `TIMESTAMP` → `TEXT` (ISO format)
- `JSON/JSONB` → `TEXT`

### Issue 3: Foreign Key Constraints
**Problem**: Import fails due to constraint violations
**Solution**: 
1. Disable constraints during import
2. Import in correct order (parent tables first)
3. Use `--disable-triggers` flag

### Issue 4: Large Dataset Import
**Problem**: Import times out or fails with large datasets
**Solution**:
1. Split data into smaller chunks
2. Use `COPY` commands instead of INSERT
3. Import tables sequentially
4. Disable indexes during import, rebuild after

## Validation Steps

### 1. Data Integrity Check
```sql
-- Count records in each table
SELECT 'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'episodes', COUNT(*) FROM episodes
UNION ALL
SELECT 'movies', COUNT(*) FROM movies;
```

### 2. Functional Testing
1. Start the application
2. Test core features:
   - Browse movies/TV shows
   - Custom orders
   - Watch tracking
   - Settings persistence

### 3. Performance Validation
```bash
# Check database file sizes
ls -lh master_order.db
docker exec master-order-postgres du -sh /var/lib/postgresql/data
```

## Rollback Plan

### If Import Fails
```bash
# Local SQLite rollback
mv master_order_backup_TIMESTAMP.db master_order.db

# Production PostgreSQL rollback
docker exec -i master-order-postgres psql -U postgres master_order < master_order_prod_backup_TIMESTAMP.sql
```

## Next Steps After Import

1. **Update Configurations**: Verify all API keys and settings
2. **Rebuild Indexes**: For optimal performance
3. **Test All Features**: Ensure nothing is broken
4. **Monitor Performance**: Check for any performance degradation
5. **Setup Regular Backups**: Implement automated backup strategy

## Support

If you encounter issues during import:
1. Check application logs: `docker logs master-order`
2. Check database logs: `docker logs master-order-postgres`
3. Validate schema compatibility
4. Test with small dataset first

---

**Remember**: Always backup your current data before starting the import process!