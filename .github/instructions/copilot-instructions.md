# Eddie Life Management - Copilot Instructions

## Project Overview
Eddie Life Management is a modular full-stack life management platform evolved from Master Order. The system emphasizes **modularity, reusability, and clean separation of concerns** across all components.

## Core Architecture Principles
- **MODULAR FIRST**: All code must be organized into reusable, self-contained modules
- **CLEAN SEPARATION**: Frontend/backend/database layers must remain independent
- **ROUTE MODULARITY**: API routes are extracted into `server/routes/` files by domain
- **SERVICE LAYER**: Business logic encapsulated in dedicated service classes
- **SCHEMA SYNCHRONIZATION**: Three schema files must stay synchronized (SQLite/PostgreSQL/main)

## Technology Stack
- **Frontend**: React 19.1.0 + Vite + Tailwind CSS
- **Backend**: Express.js + Prisma ORM + WebSocket
- **Database**: SQLite (dev) / PostgreSQL (prod) with automatic detection
- **APIs**: Plex, Stash, Komga, TVDB, ComicVine, OpenLibrary

## Coding Standards
- Do not open the web browser. You are not able to interact with it.
- Follow React and Express best practices for modular code and reusable components.

## Critical File Structure
```
server/
├── index.js                    # Main server (MINIMAL - routes mounted here)
├── routes/                     # MODULAR route handlers by domain
│   ├── plex.js                # Plex integration routes
│   ├── stash.js               # Stash integration routes
│   ├── settings.js            # Settings management
│   ├── artwork.js             # Artwork proxy/serving
│   ├── customOrders.js        # Custom order management
│   └── ...                    # Other domain-specific routes
├── services/                   # Business logic services
├── prisma/
│   ├── schema.prisma          # Main schema (auto-selected by environment)
│   ├── schema.sqlite.prisma   # SQLite-specific schema
│   └── schema.postgresql.prisma # PostgreSQL-specific schema
└── getNextEpisode.js          # Core episode selection logic
```

## Development Rules

### 1. MODULARITY REQUIREMENTS
- **Route Extraction**: New functionality goes in `server/routes/` files, NOT in main `index.js`
- **Service Classes**: Business logic must be in dedicated service files
- **Reusable Components**: Frontend components must be modular and reusable
- **Single Responsibility**: Each module handles ONE domain/responsibility

### 2. Schema Management
**CRITICAL**: When modifying database schema, ALL THREE files must be updated:
```bash
# 1. Edit schema.prisma
# 2. Synchronize schemas (run from server folder)
cp prisma/schema.prisma prisma/schema.sqlite.prisma
cp prisma/schema.prisma prisma/schema.postgresql.prisma
# 3. Update PostgreSQL provider
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.postgresql.prisma
# 4. Generate Prisma client and migrate (MUST run from server folder)
npx prisma generate && npx prisma migrate dev --name "description"
```

### 3. API Route Patterns
```javascript
// server/routes/domain.js template
const express = require('express');
const router = express.Router();
const DomainService = require('../services/domainService');

const domainService = new DomainService();

// GET /api/domain
router.get('/', async (req, res) => {
  try {
    const result = await domainService.getData();
    res.json(result);
  } catch (error) {
    console.error('Error in domain route:', error);
    res.status(500).json({ error: 'Failed to get domain data' });
  }
});

module.exports = router;
```

### 4. Service Class Patterns
```javascript
// server/services/domainService.js template
const { PrismaClient } = require('@prisma/client');

class DomainService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async getData() {
    // Business logic here
    return await this.prisma.model.findMany();
  }
}

module.exports = DomainService;
```

## Modernization & Modular Utilities System

### Core Modular Infrastructure
- **Validation Middleware**: `server/middleware/validation.js` - Centralized validation logic
- **Response Utilities**: `server/utils/responses.js` - Standardized response formatting
- **AsyncHandler Wrapper**: Automatic error handling for async route handlers
- **Pattern Elimination**: Systematically removes duplicate try-catch and validation patterns

### Modular Utility Functions
```javascript
// server/utils/responses.js
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');

// server/middleware/validation.js  
const { validateRequiredFields, validateMediaTypeAndTitle } = require('../middleware/validation');
```

### Route Modernization Pattern
**BEFORE (Legacy Pattern):**
```javascript
router.get('/example', async (req, res) => {
  try {
    // validation logic
    if (!req.body.field) {
      return res.status(400).json({ error: 'Field required' });
    }
    
    const result = await someOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**AFTER (Modernized Pattern):**
```javascript
router.get('/example', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['field']);
  
  const result = await someOperation();
  sendSuccess(res, result);
}));
```

### Modernization Benefits Achieved
- **Code Reduction**: ~455 lines eliminated across 16+ route files
- **Pattern Elimination**: 100+ duplicate try-catch blocks removed
- **Consistency**: Standardized error/success response formats
- **Maintainability**: Centralized validation and response logic
- **Zero Breaking Changes**: 100% functional compatibility preserved

### Critical Modernization Rules
1. **Import Dependencies**: Always import utilities at route file level or within router functions
2. **Preserve Response Formats**: Match existing API response structures expected by frontend
3. **Systematic Application**: Apply consistently across all routes in a file
4. **Syntax Validation**: Always run `node -c filename.js` after changes
5. **Test Endpoints**: Verify functionality after modernization

### Files Successfully Modernized
- ✅ `server/routes/settings.js` - Complete
- ✅ `server/routes/customOrderItems.js` - Complete  
- ✅ `server/routes/watchTracking.js` - Complete
- ✅ `server/routes/bulkOperations.js` - Complete
- ✅ `server/routes/sessionTracking.js` - Complete
- ✅ `server/routes/comicvine.js` - Complete
- ✅ `server/routes/books.js` - Complete
- ✅ `server/routes/music.js` - Complete
- ✅ `server/routes/plex.js` - Complete
- ✅ `server/routes/komga.js` - Complete
- ✅ `server/routes/openlibrary.js` - Complete
- ✅ `server/routes/searchDebug.js` - Complete
- ✅ `server/routes/orders.js` - Complete
- ✅ `server/routes/playlists.js` - Complete
- 🔄 `server/routes/stash.js` - Partial (modernization interrupted)
- 📋 `server/routes/notes.js` - Pending
- 📋 `server/routes/core/*.js` - Pending

## Environment Detection
- **Automatic**: Uses `DATABASE_URL` to detect SQLite vs PostgreSQL
- **Development**: SQLite with file database
- **Production**: PostgreSQL with connection string
- **Schema Selection**: Handled by `setup-schema.js`

## Key Integration Points

### Artwork System
- **Proxy Route**: `/api/artwork/*` handles Plex artwork proxying
- **Cache Service**: `ArtworkCacheService` for local artwork caching
- **Custom Orders**: Artwork URLs generated via `getArtworkUrl(item, baseUrl)`

### Custom Orders & Up Next
- **Selection Logic**: `getNextEpisode()` determines TV/Movie/Custom order type
- **Custom Order Handler**: `getNextCustomOrder(req)` requires request object for baseURL
- **Artwork Integration**: Custom order items include proper artwork URLs

### Background Services
- **Plex Sync**: Configurable interval (default 12h)
- **Stash Sync**: Configurable interval (default 24h)
- **Auto-start**: Services start with server initialization

## Common Development Tasks

### Adding New API Routes
1. Create `server/routes/newDomain.js` with modular route handlers
2. Import and mount in `server/index.js`: `app.use('/api/new-domain', newDomainRoutes)`
3. Create corresponding service class if needed
4. Add frontend integration
5. **Use modular utilities from day one** - import asyncHandler and response utilities

### Database Schema Changes
1. **Always** update all three schema files
2. **Always** test with both SQLite and PostgreSQL
3. **Always** run migrations and verify data integrity

### Frontend Module Integration
1. Create modular components in `client/src/components/`
2. Use consistent API patterns with error handling
3. Implement loading states and user feedback
4. Follow Tailwind CSS conventions

## Error Handling Patterns
- **API Routes**: Use `sendBadRequest`, `sendSuccess`, `sendServerError` utilities
- **Services**: Throw descriptive errors, let routes handle HTTP status
- **Frontend**: Display user-friendly error messages
- **Logging**: Use `console.error` with context for debugging

## Testing Approach
- **Manual Testing**: Test both SQLite and PostgreSQL environments
- **API Testing**: Use curl/Postman for endpoint verification
- **Integration Testing**: Verify external API connections (Plex/Stash)
- **Database Testing**: Verify schema synchronization and migrations

## Performance Considerations
- **Artwork Caching**: Local cache reduces external API calls
- **Background Sync**: Heavy operations run asynchronously
- **Database Queries**: Use Prisma's include/select for optimization
- **Route Efficiency**: Keep route handlers lightweight, business logic in services

## Security Notes
- **API Keys**: Always use environment variables
- **CORS**: Configured for development/production
- **Input Validation**: Validate all API inputs
- **Database**: Prisma provides SQL injection protection

Remember: **MODULARITY AND REUSABILITY** are the top priorities. Every new feature should be self-contained, reusable, and follow the established patterns.
