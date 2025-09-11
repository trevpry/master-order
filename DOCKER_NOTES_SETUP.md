# Notes System Setup for Docker/Unraid

The Master Order Notes system includes a comprehensive daily notes feature with calendar integration and templates. This guide explains how to set up default note templates in Docker/Unraid environments.

## Automatic Setup

**The templates are automatically created when the container starts for the first time.** No manual action is required for new installations.

## Manual Setup (if needed)

If you need to manually create the default templates or if the automatic setup failed, you have several options:

### Option 1: Use Docker Exec (Recommended)

```bash
# Find your container name/ID
docker ps

# Run the setup script inside the container
docker exec <container_name_or_id> node server/scripts/setup-note-templates.js
```

### Option 2: Use the Provided Scripts

#### For Linux/macOS/Unraid:
```bash
# Make the script executable
chmod +x setup-note-templates.sh

# Run the script
./setup-note-templates.sh
```

#### For Windows (PowerShell):
```powershell
# Run the PowerShell script
.\setup-note-templates.ps1
```

### Option 3: Manual Container Access

```bash
# Access the container shell
docker exec -it <container_name_or_id> /bin/sh

# Inside the container, run:
cd /app
node server/scripts/setup-note-templates.js
```

## What Gets Created

The setup creates 4 default note templates:

1. **Daily Note Template** - Structured daily journaling with mood, goals, habits, and gratitude
2. **Weekly Review Template** - Weekly planning and review sessions
3. **Meeting Notes Template** - Meeting documentation with agenda and action items
4. **Project Notes Template** - Project tracking and planning

## Verification

After running the setup, you can verify the templates were created by:

1. Accessing your Master Order web interface
2. Going to the Notes section
3. Clicking on "Templates" tab
4. You should see the 4 default templates listed

## Troubleshooting

### Templates Not Showing Up

1. **Check container logs:**
   ```bash
   docker logs <container_name_or_id>
   ```

2. **Verify database connection:**
   - Ensure your PostgreSQL database is accessible
   - Check DATABASE_URL environment variable

3. **Manual verification:**
   ```bash
   docker exec <container_name_or_id> node -e "
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   prisma.noteTemplate.count().then(count => {
     console.log('Template count:', count);
     prisma.$disconnect();
   });
   "
   ```

### Script Fails to Run

1. **Check file permissions:**
   ```bash
   docker exec <container_name_or_id> ls -la server/scripts/
   ```

2. **Verify Prisma is working:**
   ```bash
   docker exec <container_name_or_id> npx prisma --version
   ```

3. **Check database connectivity:**
   ```bash
   docker exec <container_name_or_id> node -e "
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   prisma.$connect().then(() => {
     console.log('Database connected');
     prisma.$disconnect();
   }).catch(err => console.error('Database error:', err));
   "
   ```

## Safe to Run Multiple Times

The setup script is **idempotent** - it's safe to run multiple times. It will:
- Check if templates already exist
- Only create missing templates
- Skip creation if all templates are present

## Unraid Specific Notes

For Unraid users:

1. **Access via Unraid terminal:**
   - Go to your Unraid web interface
   - Navigate to Docker tab
   - Click the terminal icon for your Master Order container
   - Run: `node server/scripts/setup-note-templates.js`

2. **Using Unraid's Docker compose:**
   - The setup runs automatically on container startup
   - Check container logs in Unraid for setup confirmation

## Environment Variables

The script respects these environment variables:
- `NODE_ENV` - Controls logging verbosity
- `DATABASE_URL` - Database connection string (required)

## Files Involved

- `/app/server/scripts/setup-note-templates.js` - Main setup script
- `/app/server/create-default-templates.js` - Legacy script (still works)
- `/app/setup-note-templates.sh` - Linux/macOS helper script
- `/app/setup-note-templates.ps1` - Windows PowerShell helper script
