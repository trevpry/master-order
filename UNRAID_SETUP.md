# Master Order - Unraid Setup Guide

## Overview
Master Order is a comprehensive media management application that integrates with Plex to intelligently curate your next entertainment experience. This guide will help you set it up on Unraid.

## Prerequisites
- Unraid server with Docker enabled
- Plex Media Server (can be on the same Unraid server or remote)
- (Optional) TVDB API key for enhanced TV show metadata
- (Optional) ComicVine API key for comic book metadata

## Installation Methods

### Method 1: Using Unraid Template (Recommended)

1. **Download the Template**
   - Copy the contents of `unraid-template.xml` 
   - Save it as `master-order.xml` in `/boot/config/plugins/dockerMan/templates-user/`
   - Refresh your Docker templates in Unraid

2. **Install from Template**
   - Go to Docker tab in Unraid
   - Click "Add Container" 
   - Select "master-order" from the template list
   - Configure the required settings (see Configuration section below)

### Method 2: Manual Docker Setup

1. **Create the Container**
   ```bash
   docker run -d \
     --name master-order \
     --restart unless-stopped \
     -p 3001:3001 \
     -v /mnt/user/appdata/master-order/data:/app/data \
     -v /mnt/user/appdata/master-order/artwork-cache:/app/server/artwork-cache \
     -v /mnt/user/appdata/master-order/logs:/app/logs \
     -e NODE_ENV=production \
     -e DATABASE_URL=file:/app/data/master_order.db \
     -e PORT=3001 \
     master-order:latest
   ```

### Method 3: Docker Compose

1. **Copy docker-compose.yml to your Unraid server**
2. **Customize the environment variables**
3. **Run with docker-compose:**
   ```bash
   docker-compose up -d
   ```

## Configuration

### Required Settings

#### Data Storage
- **App Data**: `/mnt/user/appdata/master-order/data` → `/app/data`
- **Artwork Cache**: `/mnt/user/appdata/master-order/artwork-cache` → `/app/server/artwork-cache`
- **Logs**: `/mnt/user/appdata/master-order/logs` → `/app/logs`

#### Network
- **Port**: `3001:3001` (or your preferred external port)

### Optional Settings

#### Plex Integration
- **PLEX_URL**: Your Plex server URL (e.g., `http://192.168.1.100:32400`)
- **PLEX_TOKEN**: Your Plex authentication token

#### API Keys
- **TVDB_API_KEY**: For enhanced TV show metadata and artwork
- **COMICVINE_API_KEY**: For comic book metadata and covers

#### Media Access (if Plex is on same server)
- **Media Path**: `/mnt/user/Media:/media:ro` (read-only access to your media files)

## Getting API Keys

### Plex Token
1. Follow the official Plex guide: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
2. Or use the web interface method:
   - Log into Plex Web App
   - Open browser dev tools (F12)
   - Look for `X-Plex-Token` in network requests

### TVDB API Key
1. Visit https://thetvdb.com/api-information
2. Create a free account
3. Generate an API v4 key
4. Use the API key in the TVDB_API_KEY field

### ComicVine API Key  
1. Visit https://comicvine.gamespot.com/api/
2. Create a free account
3. Generate an API key
4. Use the API key in the COMICVINE_API_KEY field

## First Run Setup

1. **Access the Web Interface**
   - Navigate to `http://YOUR_UNRAID_IP:3001`
   - The application will create the initial database on first run

2. **Configure Settings**
   - Go to Settings page
   - Enter your Plex URL and token
   - Add API keys for TVDB and ComicVine
   - Configure viewing percentages and sync intervals

3. **Initial Plex Sync**
   - Trigger a full Plex sync to populate your library data
   - This may take several minutes depending on library size

## Directory Structure

After installation, your appdata directory will look like:
```
/mnt/user/appdata/master-order/
├── data/
│   ├── master_order.db          # Main SQLite database
│   └── master_order.db-journal  # Database journal file
├── artwork-cache/               # Cached artwork files
│   ├── season-xxxxx.jpg
│   ├── comic-xxxxx.jpg
│   └── ...
└── logs/                        # Application logs (if needed)
```

## Networking

### Internal Network
- If your Plex server is also on Unraid, use internal Docker network IP
- Find Plex container IP: `docker inspect plex | grep IPAddress`
- Use format: `http://172.17.0.X:32400`

### External Network
- If Plex is on different server, use LAN IP
- Format: `http://192.168.1.100:32400`

## Troubleshooting

### Common Issues

1. **Can't Connect to Plex**
   - Check Plex URL format
   - Verify Plex token is correct
   - Ensure network connectivity between containers

2. **Database Errors**
   - Check data directory permissions
   - Ensure /app/data is writable by container user
   - Check available disk space

3. **Artwork Not Loading**
   - Verify API keys are correct
   - Check network connectivity for external APIs
   - Check artwork-cache directory permissions

4. **Performance Issues**
   - Monitor CPU and RAM usage
   - Consider limiting sync frequency
   - Check for database locks or corruption

### Logs and Debugging

1. **Container Logs**
   ```bash
   docker logs master-order
   ```

2. **Application Logs**
   - Check `/mnt/user/appdata/master-order/logs/` directory
   - Look for error patterns or connection issues

3. **Database Access**
   - SQLite database is at `/mnt/user/appdata/master-order/data/master_order.db`
   - Use SQLite browser tools for direct database inspection

## Updates

### Using Unraid Interface
1. Go to Docker tab
2. Click on master-order container
3. Click "Check for Updates"
4. Follow prompts to update

### Manual Update
```bash
docker pull master-order:latest
docker stop master-order
docker rm master-order
# Recreate container with same settings
```

## Backup

### What to Backup
- **Essential**: `/mnt/user/appdata/master-order/data/` (contains database)
- **Optional**: `/mnt/user/appdata/master-order/artwork-cache/` (can be regenerated)

### Backup Command
```bash
tar -czf master-order-backup-$(date +%Y%m%d).tar.gz \
  /mnt/user/appdata/master-order/data/
```

## Security Considerations

- The application runs as non-root user (app:nodejs)
- Database and cache files are isolated in container
- API keys are stored in environment variables (mask them in Unraid)
- No external ports are exposed except the web interface

## Performance Tuning

### For Large Libraries
- Increase sync interval to reduce CPU usage
- Monitor artwork cache size and clean periodically
- Consider running sync during off-peak hours

### For Limited Resources
- Reduce concurrent sync operations
- Disable unnecessary features like Christmas filtering
- Limit custom order complexity

## Support

For issues and support:
1. Check container logs first
2. Review this documentation
3. Check GitHub issues: [Your Repository URL]
4. Create new issue with logs and configuration details
