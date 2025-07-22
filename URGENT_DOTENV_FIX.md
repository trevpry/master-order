# URGENT: Fix for Persistent Dotenv Error

## The Issue
You're still getting the dotenv error because the container is using the old Docker image. The fixes I made need to be built into a new image.

## Immediate Fix Steps

### Step 1: Stop the Current Container
```bash
# Stop and remove the failing container
docker stop master-order
docker rm master-order
```

### Step 2: Verify You Have the Updated Files
Make sure you have the latest versions of the files with my fixes:

```bash
# Navigate to your project directory
cd /mnt/user/appdata/master-order-build/master-order

# Check if dotenv is in server package.json
grep -A 10 '"dependencies"' server/package.json | grep dotenv
# Should show: "dotenv": "^16.5.0",

# If dotenv is NOT shown, you need to update the file
```

### Step 3: Update server/package.json (if needed)
If dotenv is missing, edit the file:

```bash
# Edit the package.json file
nano server/package.json
```

Find the dependencies section and add dotenv:
```json
  "dependencies": {
    "@prisma/client": "^6.8.2",
    "axios": "^1.9.0",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^4.21.2",
    "multer": "^2.0.1",
    "node-fetch": "^2.7.0",
    "prisma": "^6.8.2",
    "socket.io": "^4.8.1",
    "sqlite3": "^5.1.7",
    "xml2js": "^0.6.2"
  },
```

Save the file (Ctrl+X, then Y, then Enter).

### Step 4: Force Rebuild the Image
```bash
# Remove the old image first
docker rmi master-order:latest

# Rebuild with no cache to force fresh installation
docker build --no-cache -t master-order:latest .
```

### Step 5: Verify the Build Includes Dotenv
```bash
# Check that the build completed successfully
docker images master-order

# Test that dotenv is installed in the new image
docker run --rm master-order:latest sh -c "cd /app/server && npm list dotenv"
# Should show dotenv@16.5.0 or similar
```

### Step 6: Check Data Directory Permissions
```bash
# Ensure the data directory has correct permissions
ls -la /mnt/user/appdata/master-order/data/
chown -R 99:100 /mnt/user/appdata/master-order/
chmod -R 755 /mnt/user/appdata/master-order/
```

### Step 7: Recreate Container in Unraid
Go to the Unraid WebUI → Docker tab and recreate the master-order container with the same settings.

## Alternative: Quick Manual Fix

If the build is still not working, you can manually add dotenv to a running container temporarily:

```bash
# Start the container in interactive mode to test
docker run -it --rm master-order:latest sh

# Inside the container:
cd /app/server
npm install dotenv
exit
```

Then commit this change to a new image:
```bash
# Get the container ID from the last run
docker ps -a | head -2

# Commit the changes to the image
docker commit <container-id> master-order:latest
```

## What Should Happen

After rebuilding, the container should start successfully with logs like:
```
🚀 Starting Master Order application...
📊 Checking database schema...
✅ Database created and migrated
🔧 Generating Prisma client...
🌟 Starting application server...
Server running on port 3001
WebSocket server ready for real-time notifications
```

**No more dotenv errors!**

## If You're Still Having Issues

1. **Double-check the package.json file:**
   ```bash
   cat server/package.json | grep -A 15 dependencies
   ```

2. **Make sure you're in the right directory:**
   ```bash
   pwd  # Should show the project root with Dockerfile
   ls -la Dockerfile
   ```

3. **Try a completely clean build:**
   ```bash
   docker system prune -f
   docker build --no-cache -t master-order:latest .
   ```

The key is making sure the Docker image is rebuilt with the updated package.json that includes dotenv!
