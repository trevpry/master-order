# Master Order - Unraid Quick Setup Card

## 🚀 Essential Steps (TL;DR)

### 1. Build Image
```bash
# SSH to Unraid, then:
cd /mnt/user/appdata && mkdir master-order-build && cd master-order-build
# Transfer your project files here
docker build -t master-order:latest .
```

### 2. Create Data Directories
```bash
mkdir -p /mnt/user/appdata/master-order/{data,artwork-cache,logs}
chown -R 99:100 /mnt/user/appdata/master-order/
```

### 3. Get Plex Token
- Open Plex Web App → F12 → Network tab → Find `X-Plex-Token` in any request

### 4. Unraid Docker Setup
**Basic Settings:**
- Name: `master-order`
- Repository: `master-order:latest`
- Network: `bridge`

**Port:** `3001:3001`

**Paths:**
- `/app/data` → `/mnt/user/appdata/master-order/data`
- `/app/server/artwork-cache` → `/mnt/user/appdata/master-order/artwork-cache`
- `/app/logs` → `/mnt/user/appdata/master-order/logs`

**Environment Variables:**
- `NODE_ENV=production`
- `DATABASE_URL=file:/app/data/master_order.db`
- `PORT=3001`
- `PLEX_URL=http://your-plex-ip:32400`
- `PLEX_TOKEN=your-token-here`

### 5. Launch & Configure
- Apply container settings
- Access `http://unraid-ip:3001`
- Go to Settings → Run Plex Sync
- Done! 🎉

---

## 📋 Required Information Checklist

Before starting, gather:
- [ ] Unraid server IP address
- [ ] Plex server IP/URL
- [ ] Plex authentication token
- [ ] TVDB API key (optional)
- [ ] ComicVine API key (optional)

---

## 🔧 Quick Troubleshooting

**Container won't start:**
```bash
docker logs master-order
# Check permissions: chown -R 99:100 /mnt/user/appdata/master-order/
```

**Can't access web interface:**
- Check port mapping (3001:3001)
- Verify container is running: `docker ps`

**Plex connection fails:**
```bash
# Test from inside container:
docker exec -it master-order sh
curl "http://plex-ip:32400/identity?X-Plex-Token=your-token"
```

---

## 🎯 Success Indicators

✅ Container shows "healthy" status  
✅ Web interface loads at http://unraid-ip:3001  
✅ Settings page shows Plex connection successful  
✅ Home page returns "Next Episode/Movie" results  
✅ Custom orders can be created and managed  

---

## 📁 Key File Locations

- **Database:** `/mnt/user/appdata/master-order/data/master_order.db`
- **Artwork Cache:** `/mnt/user/appdata/master-order/artwork-cache/`
- **Container Logs:** `docker logs master-order`
- **App Config:** Web interface → Settings

---

## 🔄 Common Commands

```bash
# View logs
docker logs -f master-order

# Restart container
docker restart master-order

# Container shell access
docker exec -it master-order sh

# Check container status
docker ps | grep master-order

# View image info
docker images master-order
```
