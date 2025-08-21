# Development Environment Setup (Volume Mount)

This setup uses Docker with volume mounts to provide instant code updates without container rebuilds.

## 🚀 Quick Start

### Windows (PowerShell):
```powershell
.\start-dev.ps1
```

### Linux/Mac (Bash):
```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Manual Docker Compose:
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

## 📁 Files Created

- **`docker-compose.dev.yml`** - Development configuration with volume mounts
- **`docker-compose.prod.yml`** - Production configuration for Unraid
- **`Dockerfile.dev`** - Development-optimized Dockerfile
- **`start-dev.ps1`** - PowerShell startup script
- **`start-dev.sh`** - Bash startup script

## 💡 How Volume Mount Works

### What Gets Mounted:
- `./client` → `/app/client` (React frontend code)
- `./server` → `/app/server` (Node.js backend code)  
- `./package.json` → `/app/package.json` (Main package file)
- `./start.js` → `/app/start.js` (Application starter)
- `./master_order.db` → `/app/master_order.db` (Database persistence)

### What Stays in Container:
- `node_modules` (for performance, mounted as named volumes)
- Built client assets (rebuilt when needed)

## ⚡ Development Benefits

- ✅ **Instant Updates**: Code changes reflect immediately
- ✅ **No Rebuilds**: Never rebuild containers during development
- ✅ **Hot Reloading**: React and Node.js restart automatically
- ✅ **Database Persistence**: Your data survives container restarts
- ✅ **Performance**: node_modules stay in fast container storage

## 🔧 Development Workflow

1. **Start Environment**: `.\start-dev.ps1`
2. **Make Code Changes**: Edit any file in `client/` or `server/`
3. **See Changes**: They appear instantly at http://localhost:3001
4. **No Restarts Needed**: Hot reloading handles everything

## 📊 Useful Commands

### View Logs:
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Stop Environment:
```bash
docker-compose -f docker-compose.dev.yml down
```

### Restart Just the App (if needed):
```bash
docker-compose -f docker-compose.dev.yml restart
```

### Enter Container Shell:
```bash
docker-compose -f docker-compose.dev.yml exec master-order-dev /bin/sh
```

### Rebuild (if you change package.json):
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

## 🔄 Switching to Production

When ready to deploy to Unraid:

1. **Test Production Build Locally**:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

2. **Deploy to Unraid**: Copy your code and use the production compose file

3. **Use Update Scripts**: The Option 2 scripts you have will still work for production updates

## 🐛 Troubleshooting

### If changes don't appear:
- Check that volumes are properly mounted: `docker-compose -f docker-compose.dev.yml exec master-order-dev ls -la /app`
- Restart the container: `docker-compose -f docker-compose.dev.yml restart`

### If dependencies are missing:
- Rebuild the container: `docker-compose -f docker-compose.dev.yml up --build -d`

### If database issues:
- Check database mount: `docker-compose -f docker-compose.dev.yml exec master-order-dev ls -la /app/master_order.db`

## 🎯 Perfect For

- ✅ **Feature Development** (like your reading progress modal)
- ✅ **Bug Fixes** 
- ✅ **UI Tweaks**
- ✅ **Database Schema Changes** (with migrations)
- ✅ **API Endpoint Changes**

Now you can develop with Docker but get the instant feedback of local development!
