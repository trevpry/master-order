# Fix Prisma Connection Issues on Unraid

## Problem Summary
The container was failing to start with "Error parsing connection string: /app/data/master_order.db" errors from Prisma. This was caused by overly complex database connection tests in the docker-entrypoint.sh script.

## Solution Applied
1. **Simplified Database Initialization**: Removed complex connection tests that were failing
2. **Fixed DATABASE_URL Format**: Ensure proper SQLite file:// URL format
3. **Graceful Migration Handling**: Continue startup even if migrations have warnings

## Deployment Instructions

### 1. Update Your Container on Unraid

Run your update script (this will backup database first):
```bash
# On your Unraid server
cd /path/to/your/scripts
./update-unraid.sh
```

**OR** manually update the container:

```bash
# Stop the existing container
docker stop master-order
docker rm master-order

# Pull the latest changes
cd /path/to/master-order
git pull origin master

# Build new container
docker build -t master-order:latest .

# Run with proper volume mounting
docker run -d \
  --name master-order \
  -p 3001:3001 \
  -v /mnt/user/appdata/master-order:/app/data \
  -e DATABASE_URL="file:/app/data/master_order.db" \
  master-order:latest
```

### 2. Key Changes Made

**docker-entrypoint.sh improvements:**
- ✅ Create database file before setting DATABASE_URL
- ✅ Simplified migration process without complex tests
- ✅ Proper file permissions handling
- ✅ Continue startup even if migrations have warnings

### 3. What to Expect

**Container startup should now show:**
```
🚀 Starting Master Order application...
🗄️ Creating new database file... (if first run)
🔧 Database URL set to: file:/app/data/master_order.db
🔄 Applying database migrations...
🔧 Generating Prisma client...
🌟 Starting application server...
🔄 Switching to app user for security...
Server running on http://localhost:3001
```

### 4. Verify It's Working

1. **Check container logs:**
   ```bash
   docker logs master-order
   ```

2. **Access the application:**
   - Open http://YOUR_UNRAID_IP:3001
   - Should load without errors

3. **Test TVDB API fix:**
   - Navigate to a TV series page
   - Check if "Unauthorized" errors are gone

### 5. If Still Having Issues

**Check database file permissions:**
```bash
# Inside the container
docker exec -it master-order ls -la /app/data/

# On Unraid host
ls -la /mnt/user/appdata/master-order/
```

**Manual database creation (if needed):**
```bash
# Create empty database file with proper permissions
docker exec -it master-order touch /app/data/master_order.db
docker exec -it master-order chmod 644 /app/data/master_order.db
```

### 6. Next Steps After Fix

Once the container is running properly:

1. **Test TVDB API**: Check if "Unauthorized" errors are resolved
2. **Validate Database Backup**: Ensure the backup system works
3. **Test TV Actor Statistics**: Debug why American Dad shows Arrow actors
4. **Implement Reading Progress**: Return to the original feature request

## Rollback Plan

If this doesn't work, you can restore from backup:
```bash
# Stop container
docker stop master-order

# Restore database from backup
./restore-database.sh

# Use previous container version if needed
```

The simplified approach should eliminate the Prisma connection string parsing errors and get your container running again.
