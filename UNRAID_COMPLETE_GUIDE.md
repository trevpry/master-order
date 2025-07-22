# Complete Step-by-Step Guide: Running Master Order on Unraid

## Overview
This guide will walk you through getting the Master Order media management application running on your Unraid server. We'll cover building the Docker image, setting up the container, and configuring all the necessary integrations.

## Prerequisites

### What You'll Need
- Unraid server with Docker enabled
- SSH access to your Unraid server (or use the built-in terminal)
- Plex Media Server (can be on the same Unraid server or remote)
- Basic knowledge of Docker and Unraid interface

### Optional (but recommended)
- TVDB API account for enhanced TV show metadata
- ComicVine API account for comic book integration

---

## Phase 1: Preparation

### Step 1: Access Your Unraid Server
1. **Enable SSH (if not already enabled)**
   - Go to Unraid WebUI → Settings → SSH
   - Enable SSH and set a root password
   - Apply changes

2. **Connect via SSH**
   ```bash
   ssh root@your-unraid-ip
   ```
   Or use the Unraid terminal from the WebUI (Tools → Terminal)

### Step 2: Create Project Directory
```bash
# Navigate to a convenient location
cd /mnt/user/appdata

# Create project directory
mkdir master-order-build
cd master-order-build
```

---

## Phase 2: Get the Source Code

### Step 3: Download/Transfer Source Code

**Option A: Using Git (if available)**
```bash
# Install git if not available
opkg update
opkg install git

# Clone the repository
git clone https://github.com/your-username/master-order.git .
```

**Option B: Manual Transfer**
1. Zip your entire `master-order` project on your development machine
2. Transfer it to Unraid using:
   - Unraid shares (copy to `\\your-unraid-ip\appdata\master-order-build\`)
   - SCP: `scp master-order.zip root@your-unraid-ip:/mnt/user/appdata/master-order-build/`
   - Unraid WebUI file manager

3. If you uploaded a zip file:
   ```bash
   cd /mnt/user/appdata/master-order-build
   unzip master-order.zip
   cd master-order  # or whatever the extracted folder is named
   ```

---

## Phase 3: Build the Docker Image

### Step 4: Verify Files Are Present
```bash
# Check that all necessary files exist
ls -la
# You should see: Dockerfile, docker-compose.yml, package.json, server/, client/, etc.

# Check the Docker files specifically
ls -la Dockerfile docker-entrypoint.sh
```

### Step 5: Make Scripts Executable
```bash
# Make the entrypoint script executable
chmod +x docker-entrypoint.sh

# Make build script executable (if you transferred it)
chmod +x build-docker.sh
```

### Step 6: Build the Docker Image
```bash
# Build the image (this will take several minutes)
docker build -t master-order:latest .

# Monitor the build progress - you should see:
# - Dependencies being installed
# - Client being built
# - Server being prepared
# - Final image being created
```

**Expected output:**
```
Step 1/XX : FROM node:18-alpine AS build
 ---> [hash]
Step 2/XX : RUN apk add --no-cache python3 make g++
...
Successfully built [hash]
Successfully tagged master-order:latest
```

### Step 7: Verify Image Was Built
```bash
# List Docker images to confirm
docker images master-order

# You should see something like:
# REPOSITORY     TAG       IMAGE ID       CREATED         SIZE
# master-order   latest    abc123def456   2 minutes ago   XXX MB
```

---

## Phase 4: Create Persistent Data Directories

### Step 8: Set Up Application Data Folders
```bash
# Create the main appdata directory
mkdir -p /mnt/user/appdata/master-order

# Create subdirectories for persistent data
mkdir -p /mnt/user/appdata/master-order/data
mkdir -p /mnt/user/appdata/master-order/artwork-cache
mkdir -p /mnt/user/appdata/master-order/logs

# Set proper permissions (99:100 are default Unraid user:group)
chown -R 99:100 /mnt/user/appdata/master-order/
chmod -R 755 /mnt/user/appdata/master-order/
```

---

## Phase 5: Get Required API Keys

### Step 9: Obtain Plex Token
1. **Method 1: Web Browser Method**
   - Open Plex Web App in browser
   - Log in to your account
   - Press F12 to open Developer Tools
   - Go to Network tab
   - Refresh the page
   - Look for any request and find `X-Plex-Token` in the headers
   - Copy this token

2. **Method 2: URL Method**
   - Visit: `https://plex.tv/pms/servers.xml`
   - Log in if prompted
   - Look for `token="your-token-here"` in the XML
   - Copy the token value

### Step 10: Get TVDB API Key (Optional but Recommended)
1. Go to https://thetvdb.com/
2. Create a free account
3. Go to https://thetvdb.com/api-information
4. Click "Create API Key"
5. Fill out the form (personal use is fine)
6. Save the API Key v4

### Step 11: Get ComicVine API Key (Optional)
1. Go to https://comicvine.gamespot.com/api/
2. Create a free account
3. Generate an API key
4. Save the API key

---

## Phase 6: Deploy Container via Unraid WebUI

### Step 12: Access Docker Management
1. Open Unraid WebUI in your browser
2. Go to the **Docker** tab
3. Click **Add Container**

### Step 13: Configure Basic Settings
1. **Container Name:** `master-order`
2. **Repository:** `master-order:latest` (the image we just built)
3. **Network Type:** `bridge`
4. **Console shell command:** `sh`

### Step 14: Configure Port Mapping
Click **Add another Path, Port, Variable, Label or Device**
- **Config Type:** Port
- **Name:** WebUI Port
- **Container Port:** 3001
- **Host Port:** 3001 (or any available port you prefer)
- **Connection Type:** TCP

### Step 15: Configure Path Mappings

**Data Directory:**
- **Config Type:** Path
- **Name:** App Data
- **Container Path:** `/app/data`
- **Host Path:** `/mnt/user/appdata/master-order/data`
- **Access Mode:** Read/Write

**Artwork Cache:**
- **Config Type:** Path
- **Name:** Artwork Cache  
- **Container Path:** `/app/server/artwork-cache`
- **Host Path:** `/mnt/user/appdata/master-order/artwork-cache`
- **Access Mode:** Read/Write

**Logs:**
- **Config Type:** Path
- **Name:** Logs
- **Container Path:** `/app/logs`
- **Host Path:** `/mnt/user/appdata/master-order/logs`
- **Access Mode:** Read/Write

**Optional - Media Access (if Plex is on same server):**
- **Config Type:** Path
- **Name:** Media (Optional)
- **Container Path:** `/media`
- **Host Path:** `/mnt/user/Media` (adjust to your media path)
- **Access Mode:** Read Only

### Step 16: Configure Environment Variables

**Required Variables:**
- **Variable:** `NODE_ENV` **Value:** `production`
- **Variable:** `DATABASE_URL` **Value:** `file:/app/data/master_order.db`
- **Variable:** `PORT` **Value:** `3001`

**Plex Configuration:**
- **Variable:** `PLEX_URL` **Value:** `http://your-plex-server-ip:32400`
  - If Plex is on the same Unraid server, use the Docker internal IP or `http://172.17.0.X:32400`
  - To find Plex Docker IP: `docker inspect plex | grep IPAddress`
- **Variable:** `PLEX_TOKEN` **Value:** `your-plex-token-from-step-9`

**Optional API Keys:**
- **Variable:** `TVDB_API_KEY` **Value:** `your-tvdb-api-key`
- **Variable:** `COMICVINE_API_KEY` **Value:** `your-comicvine-api-key`

**Optional System Variables:**
- **Variable:** `TZ` **Value:** `America/New_York` (your timezone)
- **Variable:** `PUID` **Value:** `99`
- **Variable:** `PGID` **Value:** `100`

### Step 17: Advanced Settings (Optional)
- **Extra Parameters:** `--restart=unless-stopped`
- **Privileged:** No
- **CPU Pinning:** Leave blank (unless you have specific requirements)

---

## Phase 7: Launch and Verify

### Step 18: Create and Start Container
1. Click **Apply** to create the container
2. Wait for the container to be created and started
3. You should see it appear in your Docker containers list

### Step 19: Monitor Startup
```bash
# Watch the container logs to ensure it starts properly
docker logs -f master-order

# You should see output like:
# 🚀 Starting Master Order application...
# 📊 Checking database schema...
# 🗄️ Creating new database... (on first run)
# ✅ Database created and migrated
# 🔧 Generating Prisma client...
# 🌟 Starting application server...
# Server running on port 3001
# WebSocket server ready for real-time notifications
```

### Step 20: Access the Application
1. Open your web browser
2. Navigate to `http://your-unraid-ip:3001`
3. You should see the Master Order interface

---

## Phase 8: Initial Configuration

### Step 21: Configure Application Settings
1. In the Master Order web interface, go to **Settings**
2. **Basic Settings:**
   - Collection Name: Enter the name of your Plex collection for TV shows
   - Configure viewing percentages (TV/Movies/Custom Orders)

3. **Plex Settings:** (if not set via environment variables)
   - Plex URL: Your Plex server address
   - Plex Token: Your authentication token

4. **API Settings:**
   - TVDB API Key: For enhanced TV metadata
   - ComicVine API Key: For comic book integration

### Step 22: Initial Plex Sync
1. In the Settings page, find the **Plex Sync** section
2. Click **Sync Plex Library** 
3. Wait for the initial sync to complete (may take several minutes)
4. Monitor the sync progress in the interface

---

## Phase 9: Testing and Verification

### Step 23: Test Core Functionality
1. **Home Page Test:**
   - Go to the home page
   - Click "Get Next Episode/Movie"
   - Verify content is returned

2. **Search Test:**
   - Try searching for content in your library
   - Verify results appear correctly

3. **Custom Orders Test:**
   - Create a test custom order
   - Add some items to it
   - Verify it appears in the interface

### Step 24: Test API Integrations
1. **TVDB Test:**
   - Look for TV show artwork loading
   - Check if show details are enhanced

2. **ComicVine Test:**
   - Add a comic to a custom order
   - Verify comic metadata loads

---

## Phase 10: Ongoing Management

### Step 25: Backup Your Configuration
```bash
# Create a backup of your data
cd /mnt/user/appdata
tar -czf master-order-backup-$(date +%Y%m%d).tar.gz master-order/data/

# Store the backup safely
mv master-order-backup-*.tar.gz /mnt/user/backups/ # or your preferred backup location
```

### Step 26: Set Up Automatic Backups (Optional)
Create a backup script in `/boot/config/plugins/user.scripts/scripts/`:

```bash
#!/bin/bash
# Master Order Backup Script
BACKUP_DIR="/mnt/user/backups/master-order"
mkdir -p "$BACKUP_DIR"
cd /mnt/user/appdata
tar -czf "$BACKUP_DIR/master-order-backup-$(date +%Y%m%d-%H%M).tar.gz" master-order/data/
# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "master-order-backup-*.tar.gz" -mtime +7 -delete
```

---

## Troubleshooting

### Common Issues and Solutions

**Container won't start:**
```bash
# Check container logs
docker logs master-order

# Common fixes:
# 1. Verify image was built successfully
docker images master-order

# 2. Check file permissions
ls -la /mnt/user/appdata/master-order/
chown -R 99:100 /mnt/user/appdata/master-order/

# 3. Verify Docker daemon is running
systemctl status docker
```

**Can't connect to Plex:**
```bash
# Test Plex connectivity from container
docker exec -it master-order sh
# Then inside container:
curl -I http://your-plex-ip:32400/identity

# Check Plex token validity
curl "http://your-plex-ip:32400/identity?X-Plex-Token=your-token"
```

**Database issues:**
```bash
# Check database file permissions
ls -la /mnt/user/appdata/master-order/data/

# Reset database if needed (WARNING: loses data)
docker stop master-order
rm /mnt/user/appdata/master-order/data/master_order.db*
docker start master-order
```

**Web interface not accessible:**
- Verify port mapping is correct in container settings
- Check Unraid firewall settings
- Verify container is running: `docker ps | grep master-order`

---

## Maintenance

### Updating the Application
```bash
# Stop the container
docker stop master-order
docker rm master-order

# Rebuild with latest code
cd /mnt/user/appdata/master-order-build/master-order
git pull  # if using git
docker build -t master-order:latest .

# Recreate container using same settings in Unraid WebUI
```

### Monitor Resource Usage
```bash
# Check container resource usage
docker stats master-order

# Check disk usage
du -sh /mnt/user/appdata/master-order/
```

---

## Success Checklist

- [ ] Docker image built successfully
- [ ] Container starts without errors
- [ ] Web interface accessible on configured port
- [ ] Plex connection working
- [ ] Database created and migrations applied
- [ ] Initial Plex sync completed
- [ ] Custom orders can be created
- [ ] Artwork caching working
- [ ] API integrations functional (if configured)
- [ ] Backup strategy in place

---

## Need Help?

If you encounter issues:
1. Check the container logs: `docker logs master-order`
2. Verify all paths and permissions
3. Test network connectivity to Plex and external APIs
4. Check the application's built-in health endpoint: `http://your-unraid-ip:3001/api/health`

Your Master Order application should now be running successfully on Unraid!
