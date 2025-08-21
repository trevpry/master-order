# Database Configuration Guide

This project is now configured to automatically use the appropriate database based on your environment:

## 🏠 Local Development (SQLite)
- **Database**: SQLite (`master_order.db`)
- **Automatically used when**: 
  - Running locally (not in Docker)
  - `DATABASE_URL` starts with `file:` or is not set
- **Configuration**: Uses `server/prisma/schema.sqlite.prisma`

## 🐳 Production/Docker (PostgreSQL)
- **Database**: PostgreSQL
- **Automatically used when**:
  - Running in Docker container
  - `DATABASE_URL` starts with `postgresql://` or `postgres://`
- **Configuration**: Uses `server/prisma/schema.postgresql.prisma`

## 🔧 How It Works

The application uses a smart schema management system:

1. **Automatic Detection**: The `setup-schema.js` script detects your environment
2. **Schema Selection**: Copies the appropriate schema to `schema.prisma`
3. **Client Generation**: Generates the correct Prisma client for your database

## 📝 Available Scripts

```bash
# Development (automatically uses SQLite)
npm run dev

# Manual schema setup
npm run setup-schema              # Auto-detect environment
npm run setup-schema:sqlite       # Force SQLite
npm run setup-schema:postgresql   # Force PostgreSQL

# Database operations
npm run prisma:generate           # Generate client with correct schema
npm run prisma:migrate           # Run migrations (development)
npm run prisma:deploy            # Deploy migrations (production)
```

## 🎯 ComicVine Integration

The database now includes comprehensive ComicVine fields for enhanced comic metadata:

### New Database Fields

| Field | Type | Description |
|-------|------|-------------|
| `comicVineSeriesId` | Int? | ComicVine series ID |
| `comicVineIssueId` | Int? | ComicVine issue ID |
| `comicIssueName` | String? | Issue title/name |
| `comicDescription` | String? | Issue description |
| `comicCoverDate` | String? | Official cover date |
| `comicStoreDate` | String? | Store release date |
| `comicCreators` | String? | JSON array of creators (writer, artist, etc.) |
| `comicCharacters` | String? | JSON array of characters |
| `comicStoryArcs` | String? | JSON array of story arcs |

### Frontend Display Enhancement

Comics now display rich metadata including:
- ✍️ Creative team (writers, artists, colorists, letterers)
- 🦸 Character appearances
- 📚 Story arc information
- 📅 Cover and store dates
- 📄 Issue descriptions

## 🏃 Quick Start

### Local Development
1. Clone the repository
2. Copy `.env.example` to `.env` (SQLite is pre-configured)
3. Run `npm install && npm run dev`
4. The app automatically uses SQLite

### Docker Production
1. Configure `docker-compose.yml` environment variables
2. Run `docker-compose up`
3. The app automatically uses PostgreSQL

## 🔄 Switching Between Databases

**You never need to manually switch!** The system automatically:
- Uses SQLite when developing locally
- Uses PostgreSQL when running in Docker
- Preserves all data and functionality in both environments

## 🔍 Troubleshooting

### Schema Issues
If you encounter schema errors:
```bash
cd server
node setup-schema.js
npx prisma generate
```

### Force Specific Database
```bash
# Force SQLite setup
npm run setup-schema:sqlite

# Force PostgreSQL setup  
npm run setup-schema:postgresql
```

### Database Connectivity
Check your environment variables:
- **Local**: `DATABASE_URL=file:./master_order.db`
- **Docker**: `DATABASE_URL=postgresql://user:pass@postgres:5432/master_order`

## 📊 Migration Status

The database includes migrations for:
- ✅ Comprehensive ComicVine fields
- ✅ Reading progress tracking
- ✅ Artwork caching system
- ✅ Watch statistics
- ✅ Custom order hierarchies

## 🎉 Benefits

1. **Seamless Development**: Never worry about database switching
2. **Production Ready**: Automatic PostgreSQL in Docker
3. **Enhanced Comics**: Rich ComicVine metadata display
4. **Future Proof**: Full API data preservation
5. **Developer Friendly**: Clear error messages and documentation

---

**Need Help?** Check the logs - the system provides detailed information about which database and schema are being used.
