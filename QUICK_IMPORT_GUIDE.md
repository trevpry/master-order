# Quick Start: Data Import

## Overview
This guide helps you quickly import data from your hosted PostgreSQL database to Master Order.

## Prerequisites
1. **PostgreSQL Client Tools**: Install `pg_dump` and `pg_restore`
   - Windows: Download from [PostgreSQL.org](https://www.postgresql.org/download/windows/)
   - Add PostgreSQL bin directory to your PATH

2. **Source Database Access**: Connection details for your hosted PostgreSQL

3. **Target Environment**: Either local development or production Docker setup

## Quick Import Steps

### Step 1: Configure Import Settings
```bash
# Copy example configuration
cp .env.import.example .env.import

# Edit with your database details
notepad .env.import  # Windows
# or
nano .env.import     # Linux/Mac
```

### Step 2: Choose Your Import Method

#### Option A: PowerShell (Windows - Recommended)
```powershell
# Import to local development
.\scripts\import-data.ps1 -Target local -Source "postgresql://user:pass@host:5432/db"

# Import to production
.\scripts\import-data.ps1 -Target production -Source "postgresql://user:pass@host:5432/db"

# Import specific tables only
.\scripts\import-data.ps1 -Target local -Source "postgresql://..." -Tables "orders,episodes,movies"
```

#### Option B: Bash Script (Linux/Mac/WSL)
```bash
# Import to local development
./scripts/import-data.sh --target local --source "postgresql://user:pass@host:5432/db"

# Import to production
./scripts/import-data.sh --target production --source "postgresql://user:pass@host:5432/db"

# Import specific tables only
./scripts/import-data.sh --target local --source "postgresql://..." --tables "orders,episodes,movies"
```

### Step 3: Validate Import
```bash
# Run validation script
./scripts/validate-import.sh local      # For local import
./scripts/validate-import.sh production # For production import
```

## Manual Import (If Scripts Don't Work)

### 1. Export from Source
```bash
# Full database export
pg_dump "postgresql://user:pass@host:5432/database" --clean --if-exists > export.sql

# Data-only export
pg_dump "postgresql://user:pass@host:5432/database" --data-only --disable-triggers > export.sql
```

### 2A. Import to Local SQLite
```bash
# Convert PostgreSQL to SQLite (manual steps)
# 1. Replace PostgreSQL types with SQLite equivalents
# 2. Remove PostgreSQL-specific syntax
# 3. Import to SQLite
sqlite3 master_order.db < converted_export.sql
```

### 2B. Import to Production PostgreSQL
```bash
# Import to running Docker container
docker exec -i master-order-postgres psql -U postgres master_order < export.sql
```

## Common Issues & Solutions

### Issue: pg_dump not found
**Solution**: Install PostgreSQL client tools and add to PATH

### Issue: Permission denied on scripts
**Windows**: Run as Administrator or use PowerShell
**Linux/Mac**: `chmod +x scripts/*.sh`

### Issue: Docker container not running
**Solution**: Start your production environment first:
```bash
docker-compose up -d
```

### Issue: SQLite conversion errors
**Solution**: Use the conversion script:
```bash
./scripts/convert-postgres-to-sqlite.sh export.sql converted.sql
```

### Issue: Large database import timeout
**Solution**: Import in chunks or specific tables:
```bash
# Import core tables first
./scripts/import-data.sh --target local --source "..." --tables "orders,episodes,movies"

# Then import remaining tables
./scripts/import-data.sh --target local --source "..." --tables "settings,artwork_cache"
```

## Validation Checklist

After import, verify:
- [ ] Application starts without errors
- [ ] Core features work (browse movies/TV, custom orders)
- [ ] Data counts match source database
- [ ] Watch progress is preserved
- [ ] Settings and API keys are correct
- [ ] Custom orders display properly

## Rollback if Needed

If import fails or causes issues:

### Local Development
```bash
# Restore from backup
cp master_order_backup_TIMESTAMP.db master_order.db
```

### Production
```bash
# Restore from backup
docker exec -i master-order-postgres psql -U postgres master_order < backup.sql
```

## Next Steps

1. **Test Thoroughly**: Verify all features work correctly
2. **Update Settings**: Check API keys and configurations
3. **Setup Backups**: Implement regular backup schedule
4. **Monitor Performance**: Watch for any performance issues
5. **Document Changes**: Note any customizations or differences

## Support

If you encounter issues:
1. Check the detailed [DATA_IMPORT_GUIDE.md](./DATA_IMPORT_GUIDE.md)
2. Run the validation script for detailed diagnostics
3. Check application and database logs
4. Test with a small dataset first

---

**Remember**: Always backup your current data before importing!