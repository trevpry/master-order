# YAML Scraper Feature - Deployment Checklist

## ✅ Pre-Deployment Verification (Completed)

### Database Schema Safety
- ✅ **All 3 schema files synchronized**: 
  - `schema.prisma` (active)
  - `schema.sqlite.prisma` (dev)
  - `schema.postgresql.prisma` (production)
  
- ✅ **New fields added to StashStudio model**:
  ```prisma
  geviUrl      String?        // GEVI company URL (existing)
  scraperName  String?        // YAML scraper name (e.g., "GuyBone") - NEW
  notes        String?        // Custom notes about the studio - NEW
  ```

### Migration Safety
- ✅ **Safe migrations created**:
  - `20251023114436_add_scraper_name_to_studio` - Adds `scraperName` column
  - `20251023114500_add_notes_to_studio` - Adds `notes` column
  
- ✅ **Migration type**: `ALTER TABLE ... ADD COLUMN` (100% safe, no data loss)
- ✅ **All fields are nullable**: No NOT NULL constraints = zero data risk
- ✅ **No breaking changes**: Existing data remains untouched
- ✅ **Migrations applied locally**: 107 migrations confirmed in sync

### Backend Changes
- ✅ **Routes updated** (`server/routes/stash.js`):
  - Studio GET endpoint includes `scraperName` and `notes`
  - Studio PUT endpoint accepts and saves `scraperName` and `notes`
  - Scene GET endpoint includes studio's `scraperName` and `notes`
  - Available scrapers endpoint includes studio's YAML scraper
  - New endpoints for YAML scraper search (performers & title)

- ✅ **Services created/updated**:
  - `YamlScraperService.js` - Core YAML scraper functionality
  - `searchScenes(performers)` - Search by performers with alias support
  - `searchByTitle(title)` - Search by title with URL pattern support
  
- ✅ **YAML Configuration** (`GuyBone.yml`):
  - Configurable URL patterns for performer and title search
  - Separate scrapers for different search types
  - All patterns externalized to YAML (no hardcoded URLs)

### Frontend Changes
- ✅ **Studio management** (`StudioDetail.jsx`):
  - Scraper selection modal
  - Fetches available scrapers
  - Saves scraper to database
  
- ✅ **Scene detail** (`SceneDetail.jsx`):
  - YAML scraper buttons in modal
  - Search by Performers (with alias support)
  - Search by Title (with URL pattern support)
  - Dynamic scraper buttons include studio scraper
  - Proper handling of object vs string for studio/performers display

## 🚀 Deployment Steps

### 1. Production Database Migration (PostgreSQL)
```bash
# SSH into production/Unraid server
cd /path/to/master-order/server

# Verify environment uses PostgreSQL
cat .env | grep DATABASE_URL
# Should show: postgresql://...

# Check migration status
npx prisma migrate status

# Apply pending migrations (safe, adds nullable columns only)
npx prisma migrate deploy

# Verify schema is up to date
npx prisma migrate status
```

### 2. Data Safety Verification
```bash
# Before deployment - backup production database
pg_dump your_database > backup_before_yaml_scraper_$(date +%Y%m%d).sql

# After migration - verify columns exist
psql your_database -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'StashStudio' AND column_name IN ('scraperName', 'notes');"

# Should show:
#  column_name | data_type | is_nullable
# -------------+-----------+-------------
#  scraperName | text      | YES
#  notes       | text      | YES
```

### 3. Application Deployment
```bash
# Pull latest code
git pull origin master

# Rebuild Docker container (if using Docker)
docker-compose build
docker-compose up -d

# Or restart PM2/systemd service
pm2 restart master-order
# OR
systemctl restart master-order
```

### 4. Post-Deployment Verification

#### A. Database Check
```sql
-- Verify StashStudio table has new columns
SELECT id, name, "scraperName", notes FROM "StashStudio" LIMIT 5;

-- Should return rows with scraperName and notes columns (values will be NULL initially)
```

#### B. API Endpoint Verification
```bash
# Test Studio GET (should include scraperName & notes)
curl http://localhost:3001/api/stash/studios/{studio_id}

# Test Scene GET (should include studio.scraperName & studio.notes)
curl http://localhost:3001/api/stash/scenes/{scene_id}

# Test Available Scrapers (should include studio scraper if configured)
curl http://localhost:3001/api/stash/scenes/{scene_id}/available-scrapers
```

#### C. Frontend Verification
1. Navigate to a Studio page
2. Verify "Scraper" section shows dropdown with available YAML scrapers
3. Select a scraper (e.g., GuyBone) and save
4. Refresh page - scraper should persist
5. Navigate to a Scene for that Studio
6. Verify scraper button appears in dynamic scraper list
7. Click scraper button - modal should open
8. Verify "Search by Performers" button appears (if 1+ performers)
9. Verify "Search by Title" button shows scraper name
10. Test both search functions

## 🔒 Data Safety Guarantees

### Zero Data Loss Risk
- ✅ All new fields are **nullable** (no NOT NULL constraints)
- ✅ Migrations use **ADD COLUMN** only (no DROP, no ALTER existing)
- ✅ Existing rows remain completely unchanged
- ✅ No foreign key constraints added
- ✅ No indexes on new columns (can be added later if needed)

### Rollback Safety
```sql
-- If needed, rollback is simple (but not necessary):
ALTER TABLE "StashStudio" DROP COLUMN "scraperName";
ALTER TABLE "StashStudio" DROP COLUMN "notes";
```

### Backward Compatibility
- ✅ Old frontend code will ignore new fields
- ✅ New backend sends fields even if frontend doesn't use them
- ✅ API responses include fields with `null` values for existing data
- ✅ No breaking changes to existing endpoints

## 📋 Feature Summary

### What's New
1. **Studio Scraper Configuration**
   - Link studios to YAML scrapers (e.g., GuyBone studio → GuyBone scraper)
   - Saved to database, persists across restarts
   - Managed via Studio detail page

2. **YAML Scraper Search**
   - **By Performers**: Search performer pages, filter scenes with ALL performers
   - **By Title**: Direct scene URL or studio page filtering
   - **Alias Support**: Tries all performer aliases automatically
   - **Configurable URLs**: All URL patterns in YAML files

3. **Dynamic Scraper Buttons**
   - Studio's YAML scraper appears on all scenes for that studio
   - Independent of episode URLs or file paths
   - Opens modal with search functionality

### Configuration Files
- `server/services/scrapers/configs/GuyBone.yml` - Example configuration
- Add more YAML scrapers by creating similar files

### New Database Fields
- `StashStudio.scraperName` - Name of YAML scraper (e.g., "GuyBone")
- `StashStudio.notes` - Custom notes about studio (future use)

## ✅ Production Ready
- All migrations are safe (ADD COLUMN only)
- All code changes are backward compatible
- Zero risk of data loss
- Can be deployed to production PostgreSQL database with confidence

## 🐛 Troubleshooting

### If scraper doesn't appear after saving
1. Check browser console for errors
2. Refresh page (ensure GET endpoint returns scraperName)
3. Verify migration applied: `npx prisma migrate status`
4. Check database directly: `SELECT "scraperName" FROM "StashStudio" WHERE id = 'xxx';`

### If search returns no results
1. Check server logs for detailed search output
2. Verify performer aliases are set correctly
3. Check YAML configuration URL patterns
4. Ensure scraper name matches exactly (case-sensitive)

### If Prisma Client errors occur
1. Regenerate client: `npx prisma generate`
2. Restart server
3. Check schema.prisma is correct
4. Verify DATABASE_URL points to correct database

## 📝 Notes
- This feature is production-ready for deployment
- All changes maintain 100% data safety
- No manual database modifications needed
- Migrations will run automatically on `prisma migrate deploy`
