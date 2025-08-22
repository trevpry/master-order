# Docker Setup Summary for Master Order

## Files Created

### Core Docker Files
- `Dockerfile` - Multi-stage build for production deployment
- `docker-compose.yml` - Complete docker-compose setup
- `.dockerignore` - Excludes unnecessary files from build context
- `docker-entrypoint.sh` - Database initialization and startup script

### Unraid Specific
- `unraid-template.xml` - Complete Unraid Community Applications template
- `UNRAID_SETUP.md` - Comprehensive setup guide for Unraid users

### Build Scripts
- `build-docker.sh` - Linux/macOS build script
- `build-docker.bat` - Windows build script

### Configuration
- `.env.example` - Environment variables template

## Quick Start Commands

### Build the Image
```bash
# Linux/macOS
chmod +x build-docker.sh
./build-docker.sh

# Windows
build-docker.bat

# Or manually
docker build -t master-order:latest .
```

### Run with Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Run Manually
```bash
docker run -d \
  --name master-order \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ./data:/app/data \
  -v ./artwork-cache:/app/server/artwork-cache \
  -v ./logs:/app/logs \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/master_order.db \
  -e PLEX_URL=http://your-plex-server:32400 \
  -e PLEX_TOKEN=your-plex-token \
  -e TVDB_API_KEY=your-tvdb-key \
  -e COMICVINE_API_KEY=your-comicvine-key \
  master-order:latest
```

## Key Features

### Docker Image Features
- **Multi-stage build** - Optimized production image
- **Non-root user** - Runs as app:nodejs for security
- **Health checks** - Built-in health monitoring
- **Automatic migrations** - Database schema handled on startup
- **Static file serving** - Single container serves both API and frontend

### Persistent Data Volumes ⚠️ IMPORTANT
The following directories **MUST** be mounted as persistent volumes to prevent data loss:

- **`/app/data`** - Contains the SQLite database with all your custom orders, settings, and watch logs
- **`/app/server/artwork-cache`** - Contains cached artwork files to avoid re-downloading
- **`/app/logs`** - Contains application logs for troubleshooting

**Without proper volume mounts, you will lose all your data when updating the container!**

Example volume configuration:
```bash
# Unraid paths (recommended)
/mnt/user/appdata/master-order/data:/app/data
/mnt/user/appdata/master-order/artwork-cache:/app/server/artwork-cache
/mnt/user/appdata/master-order/logs:/app/logs

# Local development paths
./data:/app/data
./artwork-cache:/app/server/artwork-cache
./logs:/app/logs
```

### Unraid Integration
- **Complete template** - Ready-to-use Community Applications template
- **Persistent storage** - Data, artwork cache, and logs preserved
- **Environment variables** - All configuration through Unraid UI
- **Port mapping** - Customizable port configuration
- **Media mounting** - Optional direct media access

#### Critical Unraid Setup ⚠️
**Before first install or any update, verify these volume mappings:**

```
Container Volume: /app/data
Host Path: /mnt/user/appdata/master-order/data
Access Mode: Read/Write

Container Volume: /app/server/artwork-cache
Host Path: /mnt/user/appdata/master-order/artwork-cache
Access Mode: Read/Write

Container Volume: /app/logs
Host Path: /mnt/user/appdata/master-order/logs
Access Mode: Read/Write
```

**Without these mappings, all your data will be lost on container updates!**

#### Artwork Cache Recovery 🔧
If thumbnails disappear after a Docker rebuild (common issue):

1. **Automatic cleanup** - The system now automatically detects and cleans up missing artwork references on startup
2. **Check health** - Visit `http://your-server:3001/api/artwork-cache/health` to see cache status
3. **Manual repair** - Use `http://your-server:3001/api/artwork-cache/repair` (POST request) to attempt re-caching
4. **Items will re-cache** - Thumbnails will automatically re-download when accessed

The system is now self-healing and will recover from Docker rebuilds automatically!

### Production Ready
- **Database migrations** - Automatic Prisma schema updates
- **Graceful shutdown** - Proper signal handling
- **Error handling** - Comprehensive error recovery
- **Caching** - Efficient artwork and metadata caching
- **Background sync** - Non-blocking Plex synchronization

## Directory Structure

```
master-order/
├── Dockerfile                  # Main container definition
├── docker-compose.yml         # Compose configuration
├── docker-entrypoint.sh       # Initialization script
├── .dockerignore              # Build exclusions
├── unraid-template.xml        # Unraid template
├── UNRAID_SETUP.md           # Unraid documentation
├── build-docker.sh           # Linux build script
├── build-docker.bat          # Windows build script
├── .env.example              # Environment template
├── server/                   # Backend application
│   ├── prisma/              # Database schema & migrations
│   ├── index.js             # Main server file (updated)
│   └── ...                  # Other server files
├── client/                  # Frontend application
│   └── ...                  # React application files
└── data/                    # Runtime data (created by container)
    ├── master_order.db      # SQLite database
    ├── artwork-cache/       # Cached images
    └── logs/               # Application logs
```

## Environment Variables

### Required
- `NODE_ENV=production`
- `DATABASE_URL=file:/app/data/master_order.db`
- `PORT=3001`

### Optional
- `PLEX_URL` - Your Plex server URL
- `PLEX_TOKEN` - Plex authentication token
- `TVDB_API_KEY` - TVDB API key for TV metadata
- `COMICVINE_API_KEY` - ComicVine API key for comics
- `TZ` - Container timezone
- `PUID/PGID` - User/Group IDs for file permissions

## What Was Modified

### Server Code Changes
1. **Added path import** for serving static files
2. **Added health check endpoint** (`/api/health`)
3. **Added static file middleware** for production
4. **Added catch-all route** to serve React app

### Build Process
1. **Multi-stage Docker build** - Separate build and runtime stages
2. **Prisma client generation** during build
3. **React app build** included in image
4. **Database initialization** on container startup

## Next Steps

1. **Build the image** using provided scripts
2. **Test locally** with docker-compose
3. **Deploy to Unraid** using the template
4. **Configure your APIs** (Plex, TVDB, ComicVine)
5. **Run initial sync** to populate your library data

The application will be accessible at `http://your-server-ip:3001` once running.
