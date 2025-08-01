# Quick Fix: Build Docker Image on Unraid

## The Problem
You're getting this error when trying to create the container:
```
Unable to find image 'master-order:latest' locally
docker: Error response from daemon: pull access denied for master-order
```

## The Solution
The Docker image needs to be built **on your Unraid server** before you can create the container.

## Step-by-Step Fix

### 1. SSH into Your Unraid Server
```bash
ssh root@your-unraid-ip
```
Or use the Unraid WebUI Terminal (Tools → Terminal)

### 2. Get the Latest Source Code
```bash
# Navigate to build directory
cd /mnt/user/appdata

# Create directory if it doesn't exist
mkdir -p master-order-build
cd master-order-build

# If you already have the code, update it:
if [ -d "master-order" ]; then
    cd master-order
    git pull origin master
else
    # Clone fresh copy with latest fixes
    git clone https://github.com/trevpry/master-order.git
    cd master-order
fi
```

### 3. Build the Docker Image
```bash
# Verify you're in the right location
pwd  # Should show: /mnt/user/appdata/master-order-build/master-order
ls -la Dockerfile  # Should show the Dockerfile exists

# Make entrypoint script executable
chmod +x docker-entrypoint.sh

# Build the image (this will take several minutes)
docker build -t master-order:latest .
```

### 4. Verify the Image Was Built
```bash
# Check that the image exists
docker images master-order

# You should see output like:
# REPOSITORY     TAG       IMAGE ID       CREATED         SIZE
# master-order   latest    abc123def456   2 minutes ago   XXX MB
```

### 5. Create Data Directories
```bash
# Create persistent data directories
mkdir -p /mnt/user/appdata/master-order/data
mkdir -p /mnt/user/appdata/master-order/artwork-cache
mkdir -p /mnt/user/appdata/master-order/logs

# Set proper permissions
chown -R 99:100 /mnt/user/appdata/master-order/
chmod -R 755 /mnt/user/appdata/master-order/
```

### 6. Now Create Container in Unraid WebUI
Now you can go back to the Unraid WebUI and create the container using:
- **Repository:** `master-order:latest`
- All the other settings as described in the main guide

### 7. Update Path Mappings
⚠️ **Important:** Update your container path mappings to use the persistent directories:

**Data Directory:**
- Container Path: `/app/data`
- Host Path: `/mnt/user/appdata/master-order/data`

**Artwork Cache:**
- Container Path: `/app/server/artwork-cache`
- Host Path: `/mnt/user/appdata/master-order/artwork-cache`

**Logs:**
- Container Path: `/app/logs`
- Host Path: `/mnt/user/appdata/master-order/logs`

## What This Fixes
- ✅ Gets the latest code with the dotenv dependency fix
- ✅ Builds the Docker image locally on Unraid
- ✅ Sets up proper persistent data directories
- ✅ Avoids the "image not found" error

## Next Steps
After the container is created and running:
1. Check logs: `docker logs master-order`
2. Access the app: `http://your-unraid-ip:3001`
3. Configure your Plex settings in the web interface

## If You Still Get Errors
```bash
# Check container logs for any issues
docker logs master-order

# If the container won't start, check the detailed logs
docker logs -f master-order
```
