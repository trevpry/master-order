# Master Order - Project Architecture & Instructions

## Project Overview
Master Order is a full-stack application designed to integrate with Plex Media Server for automated episode selection. The app allows users to configure collection settings and get random episode recommendations from unwatched series.

## Architecture

### Technology Stack
- **Frontend**: React 19.1.0 + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Database**: SQLite with Prisma ORM
- **External API**: Plex Media Server integration
- **Development**: Nodemon for hot reloading

### Project Structure
```
master-order/
├── package.json                 # Root package with concurrently scripts
├── start.js                     # Production startup script
├── client/                      # React frontend
│   ├── src/
│   │   ├── App.jsx             # Main app with React Router
│   │   ├── pages/
│   │   │   ├── index.jsx       # Home page (episode selection)
│   │   │   └── settings/index.jsx # Settings page (collection config)
│   │   └── components/
│   │       └── Button.jsx      # Reusable button component
│   └── package.json            # Frontend dependencies
└── server/                      # Express backend
    ├── index.js                # Main server file with API routes
    ├── getNextEpisode.js       # Core Plex integration logic
    ├── .env                    # Environment variables
    └── prisma/
        ├── schema.prisma       # Database schema
        └── dev.db             # SQLite database file
```

## Core Components

### Frontend (React)
- **Routing**: Uses React Router for navigation between Home and Settings pages
- **State Management**: Local state with useState and useEffect hooks
- **Styling**: Tailwind CSS for utility-first styling
- **API Communication**: Fetch API for HTTP requests to backend

### Backend (Express)
- **Port**: Runs on port 3001
- **CORS**: Enabled for cross-origin requests from frontend
- **Routes**:
  - `GET /api/up_next` - Get next episode recommendation
  - `GET /api/settings` - Fetch current settings
  - `POST /api/settings` - Save collection settings
  - Full CRUD operations for orders (legacy functionality)

### Database (SQLite + Prisma)
- **Settings Model**: Stores Plex collection configuration
- **Order Model**: Legacy order management functionality
- **Migration**: Tracked via Prisma migrations

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
```
DATABASE_URL="file:./dev.db"
PLEX_TOKEN="your-plex-token-here"
PLEX_URL="http://your-plex-server:32400"
```

## Development Commands

### Root Level
```bash
npm run dev        # Start both client and server concurrently
npm run client     # Start only React frontend (port 5173)
npm run server     # Start only Express backend (port 3001)
npm start          # Production start
```

### Server
```bash
cd server
npm run dev        # Start with nodemon
npx prisma migrate dev --name "migration_name"  # Create/apply migrations
npx prisma studio  # Open database GUI
```

### Client
```bash
cd client
npm run dev        # Start Vite dev server
npm run build      # Build for production
```

## API Endpoints

### Settings Management
- **GET /api/settings**: Retrieve current collection name setting
- **POST /api/settings**: Save collection name
  ```json
  {
    "collectionName": "Your Collection Name"
  }
  ```

### Episode Selection
- **GET /api/up_next**: Get random episode from configured collection
  - Fetches collection name from database
  - Queries Plex `/library/sections/1/search/?type=2&collection={name}`
  - Filters for unwatched series using watch status logic
  - Gets detailed metadata via `/library/metadata/{ratingKey}`
  - Returns series metadata with collection information
  - **Response Structure**:
    ```json    {
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
            },
            {
              "title": "Another Series",
              "ratingKey": "22222", 
              "libraryType": "tv",
              "sectionKey": "1",
              "sectionTitle": "TV Shows"
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
5. Get detailed series metadata using `/library/metadata/{ratingKey}` to find all collections it belongs to
6. Filter out the settings collection and return other collections the series is part of
7. For each other collection, search across all TV and movie library sections by collection name
8. Return series metadata with detailed collection information including all items in each collection

### Plex API Integration Details
- **Library Section**: Currently hardcoded to section `1` (typically TV Shows) for initial search
- **Cross-Library Search**: Searches all TV (`type=2`) and movie (`type=1`) sections for collections
- **Search Type**: `type=2` for TV series searches, `type=1` for movie searches
- **Collection Filtering**: Uses collection name parameter to filter results across libraries
- **Metadata Fetching**: Uses `ratingKey` to get detailed item information
- **Watch Status**: Determined by comparing `leafCount` (total episodes) vs `viewedLeafCount` (watched episodes)
- **Collection Discovery**: Extracts `Collection[]` array from detailed metadata and searches by name

### Error Handling
- API errors return JSON error objects
- Frontend displays user-friendly error messages
- Server logs detailed error information

## Database Schema

### Settings Table
```sql
id             INTEGER PRIMARY KEY (default: 1)
collectionName TEXT (nullable)
createdAt      DATETIME (auto)
updatedAt      DATETIME (auto)
```

### Orders Table (Legacy)
```sql
id           INTEGER PRIMARY KEY (auto-increment)
customerName TEXT
orderDate    DATETIME (default: now)
status       TEXT
createdAt    DATETIME (auto)
updatedAt    DATETIME (auto)
```

## Development Notes

### Common Issues
- **Blank Page**: Check if App.jsx has proper return statement
- **useState Errors**: Ensure hooks are called inside React components
- **JSON Parse Errors**: Verify API returns valid JSON objects
- **CORS Errors**: Ensure server has CORS middleware enabled

### Code Patterns
- Use controlled components for forms
- Implement loading states for async operations
- Use useEffect for API calls on component mount
- Return consistent JSON structure from API endpoints

### Security Considerations
- **Plex Token**: Stored in environment variables (.env file)
- **Token Format**: X-Plex-Token header required for all Plex API requests
- **Token Security**: Should be kept secret and not committed to version control
- **API Access**: Token provides full access to Plex server based on user permissions
- **No Authentication**: Currently no user authentication implemented for the web app
- **CORS**: Allows all origins (development only - should be restricted in production)
- **Environment**: .env file should be added to .gitignore

## Future Enhancements
- **User authentication** - Implement proper user accounts and session management
- **Multiple collection support** - Allow users to configure multiple collections
- **Episode history tracking** - Track what episodes have been recommended
- **Advanced filtering options** - Filter by genre, year, rating, etc.
- **Dynamic library detection** - Auto-detect library sections instead of hardcoding
- **Collection management** - CRUD operations for Plex collections
- **Watch progress integration** - Sync with Plex watch status in real-time
- **Multi-server support** - Support multiple Plex servers
- **Smart collection support** - Enhanced support for Plex smart collections
- **Docker containerization** - Package application for easy deployment
- **Production deployment configuration** - Environment-specific configs
- **Rate limiting** - Implement API rate limiting for Plex requests
- **Caching** - Cache Plex API responses to reduce server load
