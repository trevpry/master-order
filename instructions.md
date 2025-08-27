# Master Order - Project Architecture & Instructions

## Project Overview
Master Order is a comprehensive full-stack media management application that integrates with multiple media platforms including Plex Media Server, Stash, and Komga. The application provides automated episode selection, custom order management with music playlist integration, background synchronization services, and comprehensive media library management across TV shows, movies, books, comics, and adult content.

### Key Features
- **Multi-Platform Integration**: Plex, Stash, Komga, TVDB, ComicVine APIs
- **Automated Episode Selection**: Random episode recommendations from unwatched series
- **Custom Orders with Music**: Create storytelling orders linked to Plex/custom playlists
- **Background Sync Services**: Automated data synchronization on configurable intervals
- **Comprehensive Media Management**: TV, movies, books, comics, music, and adult content
- **Visual Enhancement**: Rich metadata display with images, statistics, and interactive modals
- **Docker/Unraid Support**: Containerized deployment with volume persistence
- **Multi-Database Support**: SQLite (development) and PostgreSQL (production) with automatic schema management

## Architecture

### Technology Stack
- **Frontend**: React 19.1.0 + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js + WebSocket support
- **Database**: SQLite (development) / PostgreSQL (production) with Prisma ORM
- **External APIs**: 
  - Plex Media Server integration
  - Stash (adult content management) with GraphQL
  - Komga (comic/manga server) integration
  - TVDB API for TV metadata
  - ComicVine API for comic metadata
  - OpenLibrary API for book metadata
- **Background Services**: Automated sync services with configurable intervals
- **Containerization**: Docker support with multi-stage builds
- **Development**: Nodemon for hot reloading, Concurrently for parallel processes

### Database Architecture
The application uses a **three-schema system** to support different deployment environments:

1. **schema.prisma** - Main working schema (defaults to SQLite for development)
2. **schema.sqlite.prisma** - SQLite-specific schema for development/local deployment
3. **schema.postgresql.prisma** - PostgreSQL-specific schema for production/Docker deployment

**⚠️ Critical**: All three schema files must be kept synchronized when making model changes. The `setup-schema.js` script automatically selects the appropriate schema based on environment variables.

### Project Structure
```
master-order/
├── package.json                    # Root package with concurrently scripts
├── start.js                        # Production startup script
├── Dockerfile                      # Multi-stage Docker build
├── Dockerfile.dev                  # Development Docker configuration
├── docker-compose.yml              # Main Docker Compose configuration
├── docker-compose.dev.yml          # Development Docker Compose
├── docker-compose.prod.yml         # Production Docker Compose
├── docker-compose.external-db.yml  # External database configuration
├── setup-schema.js                 # Schema selection and management
├── client/                         # React frontend
│   ├── src/
│   │   ├── App.jsx                 # Main app with React Router
│   │   ├── pages/
│   │   │   ├── index.jsx           # Home page (episode selection)
│   │   │   ├── settings/index.jsx  # Settings page (collection config)
│   │   │   ├── Stash.jsx          # Stash integration with visual enhancements
│   │   │   ├── music/index.jsx    # Music and playlist management
│   │   │   ├── books/index.jsx    # Book library management
│   │   │   └── comics/index.jsx   # Comic library management
│   │   └── components/
│   │       └── Button.jsx         # Reusable button component
│   └── package.json               # Frontend dependencies
└── server/                        # Express backend
    ├── index.js                   # Main server with comprehensive API routes
    ├── getNextEpisode.js          # Core Plex integration logic
    ├── stashSyncService.js        # Stash GraphQL sync with filtering
    ├── stashBackgroundSyncService.js # Background Stash sync service
    ├── plexBackgroundSyncService.js  # Background Plex sync service
    ├── setup-schema.js            # Database schema management
    ├── .env                       # Environment variables
    ├── artwork-cache/             # Cached artwork directory
    └── prisma/
        ├── schema.prisma          # Main working schema
        ├── schema.sqlite.prisma   # SQLite-specific schema
        ├── schema.postgresql.prisma # PostgreSQL-specific schema
        └── migrations/            # Database migration history
```

## Deployment Options

### Development Mode
**Recommended for**: Local development, testing, and experimentation

**Setup**:
```bash
git clone <repository>
cd master-order
npm install
cd client && npm install
cd ../server && npm install
npm run dev  # Runs both client and server with hot reloading
```

**Characteristics**:
- Uses SQLite database (file-based)
- Hot reloading for both frontend and backend
- Automatic schema selection via `setup-schema.js`
- Runs on localhost ports (5173 for client, 3001 for server)
- Manual environment variable configuration required

### Docker/Unraid Deployment
**Recommended for**: Production, NAS deployment, and containerized environments

**Docker Compose**:
```yaml
version: '3.8'
services:
  master-order:
    image: your-registry/master-order:latest
    container_name: master-order
    ports:
      - "3000:3000"
    volumes:
      - /path/to/appdata:/app/data
      - /path/to/artwork:/app/server/artwork-cache
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/masterorder
      - PLEX_TOKEN=your-plex-token
      - PLEX_URL=http://your-plex-server:32400
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=masterorder
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Unraid Template Variables**:
- **Container Port**: 3000
- **Host Port**: 3000 (or your preferred port)
- **Volume Mappings**:
  - `/mnt/user/appdata/master-order:/app/data` (application data)
  - `/mnt/user/appdata/master-order/artwork:/app/server/artwork-cache` (artwork cache)
- **Network Mode**: bridge
- **Auto-restart**: enabled

**Characteristics**:
- Uses PostgreSQL database (containerized or external)
- Persistent volume storage for data and artwork cache
- Automatic schema selection (PostgreSQL detected via DATABASE_URL)
- Single port exposure (3000)
- Environment variable configuration via container/template

## Core Components

### Frontend (React)
- **Routing**: React Router for navigation between pages
- **State Management**: Local state with useState and useEffect hooks
- **Styling**: Tailwind CSS for utility-first styling
- **API Communication**: Fetch API for HTTP requests to backend
- **Real-time Updates**: WebSocket integration for live notifications
- **Pages**:
  - **Home**: Episode selection and recommendation engine
  - **Settings**: Configuration management for all integrations
  - **Stash**: Adult content library with visual enhancements, performer/studio stats
  - **Music**: Playlist management and music library integration
  - **Books**: Book library management with OpenLibrary integration
  - **Comics**: Comic library management with ComicVine integration

### Backend (Express)
- **Port**: 3001 (development) / 3000 (production/Docker)
- **CORS**: Enabled for cross-origin requests
- **WebSocket**: Real-time notifications and updates
- **Background Services**: 
  - Plex sync service (configurable interval, default 12 hours)
  - Stash sync service (configurable interval, default 24 hours)
- **Artwork Caching**: Persistent local storage for images and metadata
- **API Routes**: Comprehensive REST API for all media management features

### Database (Multi-Schema Prisma)
Master Order uses a **three-schema system** to support different deployment environments:

#### Schema Management
1. **schema.prisma** - Main working schema
   - Used by Prisma CLI for migrations and generation
   - Automatically configured by `setup-schema.js` at startup
   - Defaults to SQLite provider for local development

2. **schema.sqlite.prisma** - SQLite-specific schema
   - Used for local development and single-file deployments
   - File-based database for simplicity and portability

3. **schema.postgresql.prisma** - PostgreSQL-specific schema
   - Used for production and containerized deployments
   - Supports advanced features and better concurrent access

#### ⚠️ Critical Schema Synchronization Rules
When making any model changes, **ALL THREE** schema files must be updated:

```bash
# After editing schema.prisma
cp server/prisma/schema.prisma server/prisma/schema.sqlite.prisma
cp server/prisma/schema.prisma server/prisma/schema.postgresql.prisma

# Update PostgreSQL schema provider
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.postgresql.prisma

# Generate client and apply migration
cd server
npx prisma generate
npx prisma migrate dev --name "your_migration_name"
```

#### Database Models
- **Settings**: Application configuration and API keys
- **CustomOrder**: User-created media orders with playlist integration
- **CustomOrderItem**: Items within custom orders
- **Plex Models**: TV shows, movies, episodes, seasons, metadata
- **Stash Models**: Adult content, performers, studios, scenes
- **Book Models**: Books, authors, series with OpenLibrary integration
- **Comic Models**: Comics, series, characters with ComicVine integration
- **Music Models**: Playlists (Plex and custom), tracks, albums
- **External API Models**: TVDB, ComicVine, OpenLibrary cached data

### Plex Integration
- **Authentication**: Uses X-Plex-Token header for all API requests
- **Base URL**: Configurable Plex server URL (default: http://192.168.1.116:32400)
- **Primary Endpoints Used**:
  - `/library/sections` - Get all library sections
  - `/library/sections/{id}/search` - Search within a specific library section
  - `/library/metadata/{id}` - Get detailed metadata for specific items
  - `/library/sections/{id}/collections` - Get collections within a library section
- **Logic**: Selects random unwatched series from configured collection
- **Cross-Collection Check**: Identifies all collections the selected series belongs to (excluding the settings collection)
- **API Documentation**: https://plexapi.dev/api-reference
- **OpenAPI Specification**: https://github.com/LukeHagar/plex-api-spec

#### Plex API Usage Patterns
- **Authentication Header**: All requests require `X-Plex-Token: your-token-here`
- **Response Format**: All responses wrapped in `MediaContainer` object
- **Error Handling**: Returns HTTP status codes (400, 401, etc.) with error details
- **Search Parameters**: 
  - `type=2` for TV Shows
  - `type=1` for Movies
  - `collection=name` for filtering by collection
- **Metadata Structure**: Items contain properties like `ratingKey`, `title`, `leafCount`, `viewedLeafCount`, `Collection[]`

## Environment Variables

### Core Configuration
```env
# Database
DATABASE_URL="file:./master_order.db"  # SQLite (development)
DATABASE_URL="postgresql://user:pass@host:5432/db"  # PostgreSQL (production)

# Plex Integration
PLEX_TOKEN="your-plex-token-here"
PLEX_URL="http://your-plex-server:32400"

# Stash Integration
STASH_URL="http://your-stash-server:9999"
STASH_API_KEY="your-stash-api-key"

# Komga Integration
KOMGA_URL="http://your-komga-server:8080"
KOMGA_API_KEY="your-komga-api-key"

# External APIs
TVDB_API_KEY="your-tvdb-api-key"
COMICVINE_API_KEY="your-comicvine-api-key"

# Application Settings
NODE_ENV="development"  # or "production"
PORT="3000"  # Server port (Docker) or 3001 (development)
```

### Docker-Specific Variables
```env
# Docker deployments automatically detect PostgreSQL via DATABASE_URL
# and switch to the appropriate schema

# Volume Paths (mapped in docker-compose)
ARTWORK_CACHE_PATH="/app/server/artwork-cache"
DATA_PATH="/app/data"
```

### Environment Detection Logic
The application automatically detects the deployment environment:

1. **PostgreSQL Detection**: If `DATABASE_URL` contains `postgresql://`, uses PostgreSQL schema
2. **Docker Detection**: If running in container, expects PostgreSQL and production paths
3. **Development Fallback**: Uses SQLite schema and local development paths

This automatic detection ensures the correct database schema is always loaded without manual configuration.

## Development Commands

### Root Level
```bash
npm run dev        # Start both client and server with hot reloading
npm run client     # Start only React frontend (port 5173)
npm run server     # Start only Express backend (port 3001)
npm start          # Production start (single process, port 3000)
```

### Server Commands
```bash
cd server

# Development
npm run dev        # Start with nodemon and auto-schema selection

# Database Management
npx prisma generate                    # Generate Prisma client
npx prisma migrate dev --name "name"   # Create and apply migration
npx prisma migrate reset              # Reset database (development only)
npx prisma studio                     # Open database GUI
npx prisma db push                    # Push schema changes without migration

# Schema Synchronization (Critical for multi-schema setup)
cp schema.prisma schema.sqlite.prisma
cp schema.prisma schema.postgresql.prisma
# Then manually update PostgreSQL provider in schema.postgresql.prisma
```

### Client Commands
```bash
cd client
npm run dev        # Start Vite dev server (port 5173)
npm run build      # Build for production
npm run preview    # Preview production build
```

### Docker Commands
```bash
# Development with Docker
docker-compose -f docker-compose.dev.yml up --build

# Production deployment
docker-compose up -d

# With external PostgreSQL
docker-compose -f docker-compose.external-db.yml up -d

# Build custom image
docker build -t master-order:latest .
```

### Database Migration Workflow
When making schema changes:

1. **Edit schema.prisma** with your changes
2. **Synchronize schemas**:
   ```bash
   cd server/prisma
   cp schema.prisma schema.sqlite.prisma
   cp schema.prisma schema.postgresql.prisma
   # Update PostgreSQL provider manually
   ```
3. **Generate and migrate**:
   ```bash
   cd server
   npx prisma generate
   npx prisma migrate dev --name "descriptive_name"
   ```
4. **Test both environments** to ensure compatibility

## API Endpoints

### Settings Management
- **GET /api/settings**: Retrieve all application settings
- **POST /api/settings**: Update application settings
  ```json
  {
    "collectionName": "Your Collection Name",
    "selectedPlayer": "plex-player-machine-id",
    "plexToken": "your-plex-token",
    "plexUrl": "http://your-plex-server:32400",
    "stashUrl": "http://your-stash-server:9999",
    "stashApiKey": "your-stash-api-key",
    "plexSyncInterval": 12,
    "stashSyncInterval": 24,
    "timezone": "America/New_York"
  }
  ```

### Plex Integration
- **GET /api/plex/players**: Get all available Plex players/clients
- **GET /api/plex/selected-player**: Get details of currently selected player
- **POST /api/plex/play**: Start playback on selected player
- **POST /api/plex/control/:action**: Control playback (play, pause, stop)
- **GET /api/plex/sync**: Trigger manual Plex library sync
- **GET /api/plex/background-sync/status**: Get background sync service status

### Stash Integration
- **GET /api/stash/data**: Get Stash library data with statistics
- **POST /api/stash/sync**: Trigger manual Stash sync with filtering
- **GET /api/stash/sync/status**: Get Stash sync status
- **GET /api/stash/background-sync/status**: Get background sync service status
- **POST /api/stash/background-sync/force**: Force immediate background sync
- **POST /api/stash/clip-play**: Play random 1-minute clips with automatic generation
- **GET /api/stash/clips/next**: Get next available unwatched clip
- **POST /api/stash/scenes/:id/clips/generate**: Generate clips for a specific scene
- **POST /api/stash/clips/:id/play**: Play a specific clip by ID
- **POST /api/stash/clips/:id/watched**: Mark clip as watched
- **POST /api/stash/clips/reset**: Reset all clips (mark as unwatched)
- **Filtering**: Automatically excludes performers/studios with 0 scenes and scenes with 'zzHide' tag
- **Clip Generation**: Automatically generates 1-minute clips for random scenes when no unwatched clips exist

### Custom Orders & Music Integration
- **GET /api/custom-orders**: Get all custom orders with playlist relations
- **POST /api/custom-orders**: Create new custom order
- **PUT /api/custom-orders/:id**: Update existing custom order
- **DELETE /api/custom-orders/:id**: Delete custom order
- **GET /api/playlists/available**: Get available playlists for linking
- **Custom Order Structure**:
  ```json
  {
    "id": 1,
    "name": "My Story Order",
    "description": "A curated multimedia experience",
    "playlistRatingKey": "12345",  // Plex playlist
    "customPlaylistId": 67,        // Custom playlist
    "items": [...],
    "plexPlaylist": {...},
    "customPlaylist": {...}
  }
  ```

### Books & Comics Integration
- **GET /api/books**: Get book library data
- **POST /api/books/sync**: Sync with external book APIs
- **GET /api/comics**: Get comic library data
- **POST /api/comics/sync**: Sync with ComicVine API

### Background Services
- **GET /api/background-sync/status**: Get status of all background sync services
- **POST /api/background-sync/start**: Start background sync services
- **POST /api/background-sync/stop**: Stop background sync services
- **Configurable Intervals**: Set via settings API for both Plex and Stash sync

### Android Companion App API
- **GET /api/android/stash/next**: Get next clip for Android app playback
  - Returns: `{"type":"PLAY_CLIP","data":{...}}` with URL, title, performers, studio, duration, timing
- **GET /api/android/stash/scene/next**: Get next scene for Android app playback
  - Returns: `{"type":"PLAY_SCENE","data":{...}}` with scene metadata and playback URL
- **POST /api/android/stash/scene/:id/watched**: Mark scene as watched via Android app
  - Returns: `{"type":"SCENE_MARKED_WATCHED","data":{...}}` with success status and timestamp
- **DELETE /api/android/stash/scene/:id**: Delete scene via Android app
  - Optional query parameter: `?deleteFile=true` to also delete the physical file
  - Returns: `{"type":"SCENE_DELETED","data":{...}}` with deletion status

**Note**: These endpoints are specifically designed for the Android companion app and return structured responses with `type` and `data` fields for easy mobile app integration.

### Episode Selection & Media Discovery
- **GET /api/up_next**: Get random episode from configured collection
  - Fetches collection name from database
  - Queries Plex `/library/sections/1/search/?type=2&collection={name}`
  - Filters for unwatched series using watch status logic
  - Gets detailed metadata via `/library/metadata/{ratingKey}`
  - Returns series metadata with cross-collection information
  - **Response Structure**:
    ```json
    {
      "title": "Series Name",
      "ratingKey": "12345",
      "leafCount": 100,
      "viewedLeafCount": 45,
      "otherCollections": [
        {
          "title": "Collection Name",
          "id": "67890",
          "ratingKey": "67890",
          "items": [
            {
              "title": "Movie Title",
              "ratingKey": "11111",
              "libraryType": "movie",
              "sectionKey": "2",
              "sectionTitle": "Movies"
            }
          ]
        }
      ]
    }
    ```

## Key Business Logic

### Episode Selection Algorithm
1. Fetch collection name from Settings table
2. Query Plex API for series in specified collection using `/library/sections/1/search/?type=2&collection={name}`
3. Filter for unwatched series (leafCount !== viewedLeafCount)
4. Recursively select random series until unwatched one is found
5. Get detailed series metadata using `/library/metadata/{ratingKey}` to find all collections
6. Filter out the settings collection and return other collections the series belongs to
7. For each collection, search across all TV and movie library sections
8. Return comprehensive series metadata with detailed collection information

### Background Sync Services
**Plex Background Sync**:
- **Default Interval**: 12 hours (configurable via settings)
- **Function**: Syncs TV shows, movies, episodes, metadata from Plex library
- **Startup**: Auto-starts with server initialization
- **Force Sync**: Available via API endpoint
- **Status Tracking**: Real-time sync status and next run time

**Stash Background Sync**:
- **Default Interval**: 24 hours (configurable via settings)  
- **Function**: Syncs adult content, performers, studios, scenes via GraphQL
- **Filtering**: Automatically excludes performers/studios with 0 scenes
- **Tag Filtering**: Excludes scenes with 'zzHide' tag during sync
- **Cleanup**: Removes filtered content from local database during sync
- **Startup**: Auto-starts with server initialization

### Custom Orders with Music Integration
**Playlist Linking**:
- Link custom orders to Plex playlists (via ratingKey) or custom playlists (via ID)
- Support for both audio and video playlists
- Playlist validation during order creation/update
- Automatic playlist metadata inclusion in order responses

**Multimedia Storytelling**:
- Create curated media experiences combining TV, movies, books, music
- Sequential item ordering with sort positions
- Hierarchical order support (parent/child relationships)
- Cross-media references and containment relationships

### Stash Integration with Visual Enhancements
**Data Processing**:
- GraphQL queries for comprehensive data retrieval
- Real-time statistics calculation (top performers, studios)
- Image caching and optimization for fast loading
- Modal-based detail views with performer/studio information

**Content Filtering**:
- Automatic exclusion during sync: performers with 0 scenes, studios with 0 scenes
- Tag-based filtering: scenes with 'zzHide' tag automatically excluded
- Database cleanup: removes filtered content during sync operations
- Next selection: removes redundant filtering (zzHide already excluded during sync)

### External API Integration Details
**Plex Media Server**:
- **Library Section**: Currently hardcoded to section `1` for initial search
- **Cross-Library Search**: Searches all TV (`type=2`) and movie (`type=1`) sections
- **Authentication**: X-Plex-Token header for all requests
- **Endpoints**: `/library/sections`, `/library/metadata/{id}`, `/library/sections/{id}/search`
- **Collection Discovery**: Extracts `Collection[]` arrays and searches by name

**Stash GraphQL API**:
- **Endpoint**: `{STASH_URL}/graphql`
- **Authentication**: ApiKey header authentication
- **Operations**: findPerformers, findStudios, findScenes, findTags
- **Filtering**: Built-in scene_count filtering and tag exclusion
- **Image Handling**: Direct URL reference with caching

**TVDB API Integration**:
- **Authentication**: Bearer token with automatic renewal
- **Endpoints**: Series search, episode data, artwork retrieval
- **Caching**: Local storage of series and episode metadata
- **Rate Limiting**: Automatic request throttling

**ComicVine API**:
- **Authentication**: API key parameter
- **Endpoints**: Issue search, volume data, character information
- **Caching**: Local comic and series metadata storage
- **Format Support**: Various comic formats and publishers

**OpenLibrary API**:
- **Public API**: No authentication required
- **Endpoints**: Book search, author data, cover images
- **ISBN Support**: Multiple ISBN format handling
- **Metadata Enrichment**: Automatic book data enhancement

## Database Schema Details

### Core Application Models
```prisma
model Settings {
  id                    Int     @id @default(autoincrement())
  collectionName        String?
  plexToken            String?
  plexUrl              String?
  selectedPlayer       String?
  selectedPlexUser     String?
  timezone             String? @default("UTC")
  plexSyncInterval     Int     @default(12)    // hours
  stashSyncInterval    Int     @default(24)    // hours
  stashUrl             String?
  stashApiKey          String?
  komgaUrl             String?
  komgaApiKey          String?
  tvdbApiKey           String?
  comicVineApiKey      String?
  // ... additional settings fields
}

model CustomOrder {
  id                Int               @id @default(autoincrement())
  name              String
  description       String?
  isActive          Boolean           @default(true)
  playlistRatingKey String?           // Plex playlist link
  customPlaylistId  Int?              // Custom playlist link
  
  items             CustomOrderItem[]
  parentOrder       CustomOrder?      @relation("OrderHierarchy")
  subOrders         CustomOrder[]     @relation("OrderHierarchy")
  plexPlaylist      PlexPlaylist?     @relation(fields: [playlistRatingKey])
  customPlaylist    CustomPlaylist?   @relation(fields: [customPlaylistId])
}
```

### Media Library Models
```prisma
// Plex Integration Models
model PlexTVShow {
  id            Int           @id @default(autoincrement())
  ratingKey     String        @unique
  title         String
  summary       String?
  // ... comprehensive TV show metadata
  seasons       PlexSeason[]
}

model PlexMovie {
  id           Int        @id @default(autoincrement())
  ratingKey    String     @unique
  title        String
  // ... comprehensive movie metadata
}

// Stash Integration Models  
model StashPerformer {
  id           Int     @id @default(autoincrement())
  stashId      String  @unique
  name         String
  image        String?
  scene_count  Int     @default(0)
  // ... performer details
}

model StashStudio {
  id           Int     @id @default(autoincrement())
  stashId      String  @unique
  name         String
  image        String?
  scene_count  Int     @default(0)
  // ... studio details
}

// Music Integration Models
model PlexPlaylist {
  ratingKey     String   @id
  title         String
  playlistType  String?  // audio, video
  leafCount     Int?
  customOrders  CustomOrder[]  // Reverse relation
}

model CustomPlaylist {
  id           Int                   @id @default(autoincrement())
  title        String
  description  String?
  tracks       CustomPlaylistTrack[]
  customOrders CustomOrder[]         // Reverse relation
}
```

## Development Notes & Best Practices

### Multi-Schema Development Workflow
**Critical Rule**: Always synchronize all three schemas when making changes

1. **Make changes** to `schema.prisma`
2. **Copy to variants**:
   ```bash
   cp schema.prisma schema.sqlite.prisma
   cp schema.prisma schema.postgresql.prisma
   ```
3. **Update PostgreSQL provider**:
   ```bash
   sed -i 's/provider = "sqlite"/provider = "postgresql"/' schema.postgresql.prisma
   ```
4. **Generate and migrate**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name "descriptive_name"
   ```

### Common Development Issues
- **Schema Mismatch**: Ensure all three schema files are synchronized
- **Environment Variables**: Verify DATABASE_URL format for your environment
- **Port Conflicts**: Development uses 3001, production/Docker uses 3000
- **Docker Volumes**: Ensure persistent storage for data and artwork cache
- **Background Sync**: Services auto-start and may need restart after settings changes

### Code Patterns & Architecture
- **API Consistency**: All endpoints return consistent JSON structures
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **Real-time Updates**: WebSocket integration for live status notifications
- **Caching Strategy**: Local artwork cache with consistency checking
- **Filtering Logic**: Server-side filtering for performance and security
- **Relationship Management**: Complex cross-media relationships with proper foreign keys

### Performance Considerations
- **Database Indexing**: Proper indexes on frequently queried fields (ratingKey, stashId)
- **Image Optimization**: Artwork caching reduces external API calls
- **Background Processing**: Heavy sync operations run in background services
- **Query Optimization**: Use include/select strategically to minimize data transfer
- **Connection Pooling**: Proper database connection management for concurrent access

### Security Considerations
- **API Keys**: All external API keys stored in environment variables
- **Token Management**: Plex tokens require proper security handling
- **CORS Configuration**: Restricted in production, open for development
- **Input Validation**: Comprehensive validation on all API endpoints
- **SQL Injection Prevention**: Prisma ORM provides built-in protection
- **Rate Limiting**: Consider implementing for external API protection

### Docker/Production Deployment Notes
- **Multi-stage Builds**: Optimized Docker images with proper layer caching
- **Volume Persistence**: Critical for database and artwork cache
- **Environment Detection**: Automatic PostgreSQL detection via DATABASE_URL
- **Health Checks**: Container health monitoring for production deployments
- **Log Management**: Proper logging strategy for containerized environments
- **Resource Limits**: Set appropriate CPU/memory limits for containers

## Future Enhancements

### Planned Features
- **Enhanced User Authentication**: Implement proper user accounts with role-based access
- **Advanced Playlist Management**: Drag-and-drop playlist editor with visual organization
- **Smart Recommendation Engine**: Machine learning-based content suggestions
- **Mobile Application**: React Native companion app for remote control
- **Multi-Server Federation**: Support for multiple Plex/Stash server instances
- **Content Rating System**: User-driven rating and review system
- **Advanced Search & Filtering**: Full-text search across all media types
- **Export/Import Capabilities**: Backup and restore custom orders and playlists
- **API Rate Limiting**: Implement comprehensive rate limiting for external APIs
- **Performance Analytics**: Detailed usage statistics and performance monitoring

### Technical Improvements
- **GraphQL API**: Consider migrating to GraphQL for more flexible queries
- **Redis Caching**: Implement Redis for advanced caching strategies
- **Message Queue System**: Background job processing with Bull/Redis
- **Microservices Architecture**: Split services for better scalability
- **WebSocket Enhancements**: Real-time collaborative editing features
- **Progressive Web App**: PWA capabilities for mobile/offline usage
- **Advanced Security**: OAuth2, JWT tokens, API key rotation
- **Monitoring & Alerting**: Comprehensive application monitoring
- **Load Balancing**: Multi-instance deployment support
- **Database Sharding**: Horizontal scaling strategies

### Content Management Features
- **Bulk Operations**: Mass import/export and batch editing capabilities  
- **Content Validation**: Automatic content verification and health checks
- **Metadata Enhancement**: Automated metadata enrichment from multiple sources
- **Collection Templates**: Pre-built collection templates for common use cases
- **Advanced Tagging**: Hierarchical tagging system with auto-suggestions
- **Content Relationships**: Enhanced cross-media relationship mapping
- **Timeline Views**: Chronological content organization and viewing
- **Statistics Dashboard**: Advanced analytics and usage statistics
- **Content Discovery**: Improved recommendation algorithms and discovery features
- **External Integrations**: Additional media server and database integrations

### Deployment & Operations
- **Kubernetes Support**: Helm charts for Kubernetes deployment
- **Auto-scaling**: Dynamic resource scaling based on usage
- **Backup Automation**: Automated database and file backup strategies
- **Disaster Recovery**: Comprehensive disaster recovery procedures
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Environment Management**: Multiple environment support (dev/staging/prod)
- **Configuration Management**: Advanced configuration and feature flags
- **Health Monitoring**: Advanced health checks and alerting systems
- **Log Aggregation**: Centralized logging with search and analysis
- **Performance Optimization**: Advanced caching and performance tuning
