# Master Order - Local Development & Production Deployment Guide

## 🏠 Local Development Setup

### Prerequisites
- Node.js 20+ installed locally
- Git configured
- Access to your Unraid server

### Local Development Workflow

1. **Install Dependencies Locally**:
   ```powershell
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server
   npm install
   cd ..
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

2. **Start Local Development**:
   ```powershell
   npm run dev
   ```
   - Backend runs on: http://localhost:5000
   - Frontend runs on: http://localhost:3000
   - Database: Uses local `master_order.db`

3. **Develop Your Features**:
   - Make code changes
   - Test locally at http://localhost:3000
   - Database changes are local only

4. **When Ready to Deploy**:
   ```powershell
   # Commit your changes
   git add .
   git commit -m "Your feature description"
   git push origin master
   
   # Deploy to Unraid (see production section below)
   ```

## 🚀 Production Deployment (Unraid)

### Option A: Automated Update Script (Recommended)
Run this on your Unraid server to pull latest changes:

```bash
# SSH to Unraid, then run:
./update-unraid.sh
```

### Option B: Manual Deployment
```bash
# SSH to your Unraid server
ssh root@192.168.1.252

# Navigate to app directory
cd /mnt/user/appdata/master-order

# Pull latest changes
git pull origin master

# Rebuild and restart container
docker stop master-order
docker rm master-order
docker build -t master-order .
docker run -d --name master-order --restart=unless-stopped \
  -p 3001:3001 \
  -v "$(pwd)/master_order.db:/app/master_order.db" \
  master-order
```

## 🗃️ Database Separation Strategy

### Local Database (`master_order.db` in project root)
- Used for development and testing
- Safe to experiment with
- Can be reset/modified without affecting production

### Production Database (Unraid container volume)
- Lives at `/mnt/user/appdata/master-order/master_order.db` on Unraid
- Mounted into container as volume
- Preserved across container updates
- **Never modified during deployment**

### Database Migrations
- Schema changes are applied via Prisma migrations
- Migrations run automatically when container starts
- Production data is preserved, only schema is updated

## 🔄 Complete Workflow Example

### 1. Local Development
```powershell
# Start development
npm run dev

# Make your changes (e.g., reading progress modal)
# Test at http://localhost:3000

# Database changes are local only
```

### 2. Ready to Deploy
```powershell
# Commit and push
git add .
git commit -m "Add reading progress modal"
git push origin master
```

### 3. Deploy to Production
```bash
# On Unraid server
./update-unraid.sh
```

### 4. Verify Production
- Visit http://192.168.1.252:3001
- Your changes are live
- Production database unchanged (except schema updates via migrations)

## 📁 File Structure
```
master-order/
├── master_order.db          # Local development database
├── client/                  # React frontend
├── server/                  # Node.js backend
├── update-unraid.sh         # Production update script
└── package.json             # Root package file
```

## 🎯 Benefits of This Approach

- ✅ **Fast Local Development**: No Docker overhead
- ✅ **Safe Testing**: Local database for experiments
- ✅ **Production Safety**: Production database never touched
- ✅ **Easy Deployment**: One script updates everything
- ✅ **Data Persistence**: Production data always preserved
- ✅ **Schema Updates**: Automatic via migrations

## 🛠️ Troubleshooting

### Local Development Issues:
```powershell
# Clear node_modules if needed
rm -rf node_modules client/node_modules server/node_modules
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Production Deployment Issues:
```bash
# Check container logs
docker logs master-order

# Restart if needed  
docker restart master-order
```

This gives you the perfect balance of fast local development with safe production deployments!
