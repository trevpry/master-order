# Master Order - Unraid Docker Deployment Guide

## ✅ Current Status: READY FOR DEPLOYMENT

The Master Order application is properly configured for Unraid deployment with the timezone fix included.

## 🗂️ Required Setup

### 1. PostgreSQL Database Setup
First, ensure you have a PostgreSQL database running. You can use the official PostgreSQL Docker container on Unraid:

**PostgreSQL Container Setup:**
- **Repository:** `postgres:15`
- **Container Name:** `master-order-postgres` 
- **Port:** `5432:5432`
- **Environment Variables:**
  - `POSTGRES_DB=master_order`
  - `POSTGRES_USER=master_order_user`
  - `POSTGRES_PASSWORD=your_secure_password_here`
- **Volume Mapping:** `/mnt/user/appdata/postgres:/var/lib/postgresql/data`

### 2. Master Order Container Setup

**Container Configuration:**
- **Repository:** Build from source or use your built image
- **Container Name:** `master-order`
- **Port:** `3001:3001`
- **Environment Variables:**
  ```
  NODE_ENV=production
  DATABASE_URL=postgresql://master_order_user:your_secure_password_here@192.168.1.113:5432/master_order
  POSTGRES_PASSWORD=your_secure_password_here
  PORT=3001
  ```

**Volume Mappings:**
```
/mnt/user/appdata/master-order/data:/app/data
/mnt/user/appdata/master-order/artwork-cache:/app/server/artwork-cache  
/mnt/user/appdata/master-order/logs:/app/logs
```

## 🔧 Key Features Included

### ✅ Timezone Support
- **Settings Page:** Users can select their timezone (EST, PST, GMT, etc.)
- **Today's Activity:** Correctly shows activities for "today" in the selected timezone
- **Date Filtering:** "Today" filter in statistics respects the configured timezone

### ✅ Multi-Database Support  
- **Development:** Uses SQLite (file-based database)
- **Production/Docker:** Automatically switches to PostgreSQL
- **Automatic Detection:** The `setup-schema.js` script detects the environment

### ✅ Comic Artwork Support
- **Dynamic URLs:** Comic artwork uses the correct server IP instead of localhost
- **Mobile Compatible:** Works on mobile devices and desktop browsers
- **Cached Artwork:** Local artwork caching for better performance

## 🚀 Deployment Process

### Method 1: Docker Compose (Recommended)
1. Copy the `docker-compose.yml` to your Unraid system
2. Update the DATABASE_URL with your server IP and password
3. Run: `docker-compose up -d`

### Method 2: Manual Container Creation
1. Build the Docker image: `docker build -t master-order .`
2. Create the PostgreSQL container first
3. Create the Master Order container with the environment variables and volume mappings above

## 🔧 First Time Setup

1. **Access the application:** `http://YOUR_UNRAID_IP:3001`
2. **Configure Settings:**
   - Go to Settings page
   - Select your timezone (e.g., "Eastern Time (New York)")
   - Add your Plex server URL and token
   - Add API keys (TVDB, ComicVine) if needed
   - Save settings
3. **Verify timezone:** Check "Today's Activity" shows correct data for your timezone

## 📋 Important Notes

- **PostgreSQL Required:** The Docker version requires PostgreSQL, not SQLite
- **Schema Auto-Setup:** The application automatically configures the correct database schema
- **Persistent Data:** All data is stored in mapped volumes and survives container updates
- **Health Checks:** Built-in health monitoring for container status
- **Timezone Fix:** The date issue in statistics has been resolved with timezone support

## 🐛 Troubleshooting

If you encounter any issues:
1. **Check logs:** `docker logs master-order`
2. **Verify database connection:** Ensure PostgreSQL is running and accessible
3. **Check volume permissions:** Ensure Unraid can write to the mapped directories
4. **Timezone issues:** Verify the timezone setting in the application settings

## 🔄 Updates

To update the application:
1. Pull the latest code/image
2. Stop the container: `docker stop master-order`
3. Remove the container: `docker rm master-order`
4. Rebuild/restart with same configuration
5. Data will be preserved in the mounted volumes

The application is now production-ready for Unraid deployment with proper timezone support! 🎉
