# URGENT: Critical Prisma Connection Fix Applied

## Problem Identified and Fixed
**Root Cause**: The `server/.env` file contained `DATABASE_URL="file:./prisma/dev.db"` which was **overriding** the Docker environment variable, causing Prisma to look for the database in the wrong location.

**Error**: `Error parsing connection string: /app/data/master_order.db`

## Solution Applied
✅ **Fixed** `server/.env` to use correct container path: `file:/app/data/master_order.db`  
✅ **Removed** redundant DATABASE_URL export from `docker-entrypoint.sh`  
✅ **Restored** to working configuration similar to commit `b9f06b9`  

## Deploy This Fix Immediately

### Option 1: Using Your Update Script
```bash
# On your Unraid server
cd /path/to/your/scripts
./update-unraid.sh
```

### Option 2: Manual Update
```bash
# Stop current container
docker stop master-order && docker rm master-order

# Pull the fix
cd /path/to/master-order
git pull origin master

# Rebuild and run
docker build -t master-order:latest .
docker run -d --name master-order -p 3001:3001 \
  -v /mnt/user/appdata/master-order:/app/data \
  master-order:latest
```

## Expected Result
Your container should now start **without any Prisma connection errors** and you should see:

```
🚀 Starting Master Order application...
📊 Setting up database...
🔧 Using DATABASE_URL from environment: file:/app/data/master_order.db
🔄 Applying database migrations...
🔧 Generating Prisma client...
🌟 Starting application server...
Server running on port 3001
Background Plex sync service started
```

## Verify It's Working
1. **Check logs**: `docker logs master-order` - should show no Prisma errors
2. **Access app**: Navigate to `http://YOUR_UNRAID_IP:3001`
3. **Test functionality**: Try loading a TV series to test TVDB fix

## Why This Happened
- `.env` files in Node.js applications take precedence over Docker environment variables
- The development `.env` file was pointing to a local path that doesn't exist in the container
- This created a mismatch between where Prisma expected the database vs where Docker mounted it

**This fix should immediately resolve all Prisma connection issues and get your application running properly.**
