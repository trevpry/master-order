# Fix for "Cannot find module 'dotenv'" Error

## Your Issue
The container is failing to start because the `dotenv` module is missing. This is causing a restart loop where the container tries to start, fails, and then restarts.

## Root Cause
The `dotenv` dependency was missing from the server's `package.json` file, but the code was trying to use it.

## Immediate Fix

### Step 1: Stop the Current Container
```bash
# Stop and remove the failing container
docker stop master-order
docker rm master-order
```

### Step 2: Rebuild the Image
I've fixed the Dockerfile and added the missing dependency. Rebuild with:
```bash
# Navigate to your project directory
cd /mnt/user/appdata/master-order-build/master-order

# Rebuild the image with no cache to ensure fresh dependencies
docker build --no-cache -t master-order:latest .
```

### Step 3: Recreate the Container
Go back to the Unraid WebUI Docker tab and recreate the container using the same settings you had before.

## What Was Fixed

### 1. Added Missing Dependency
Added `"dotenv": "^16.5.0"` to the server's `package.json` dependencies.

### 2. Fixed Dockerfile Build Process
Changed the Dockerfile to install all dependencies (not just production ones) to ensure nothing is missing.

## Verification

After rebuilding and recreating the container, check the logs:
```bash
docker logs -f master-order
```

You should see:
```
🚀 Starting Master Order application...
📊 Checking database schema...
🗄️ Creating new database...
✅ Database created and migrated
🔧 Generating Prisma client...
🌟 Starting application server...
Server running on port 3001
WebSocket server ready for real-time notifications
```

**No more error about missing dotenv module!**

## If You Still Have Issues

1. **Check if the image rebuilt successfully:**
   ```bash
   docker images master-order
   # Should show a recent timestamp
   ```

2. **Verify the container isn't in a restart loop:**
   ```bash
   docker ps -a | grep master-order
   # Should show "Up" status, not "Restarting"
   ```

3. **Test the application:**
   - Navigate to `http://your-unraid-ip:3001`
   - Should load the Master Order interface

## Prevention

This issue happened because:
- The application code used `require('dotenv')` in multiple files
- But `dotenv` wasn't listed as a dependency in `package.json`
- The Docker build couldn't install what wasn't declared

The fix ensures all necessary dependencies are properly declared and installed during the build process.

## Next Steps

Once the container is running without errors:
1. Access the web interface at `http://your-unraid-ip:3001`
2. Go to Settings to configure your Plex connection
3. Run an initial Plex sync
4. Test the core functionality

Your Master Order application should now start successfully!
