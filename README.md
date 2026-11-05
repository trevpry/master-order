# Master Order

A comprehensive media management application that intelligently curates your next entertainment experience by integrating Jellyfin movie/TV libraries (and Plex for music) with external metadata sources like TVDB and ComicVine.

## Features

### Core Functionality
- **Smart Episode Selection**: Automatically selects the next unwatched episode from your TV series
- **Collection-Aware Ordering**: Identifies shared collections between movies and TV shows for chronological viewing
- **Multi-Source Integration**: Combines Jellyfin library data with TVDB and ComicVine metadata
- **Custom Order Management**: Create and manage custom viewing orders for complex franchises
- **Custom Order Episode Identity**: Up Next uses the selected episode's ID, season/episode numbers, title, and TVDB artwork together. Artwork enrichment never substitutes the series' next unwatched episode, including when a custom order intentionally plays episodes out of broadcast order.
- **Custom Order Jellyfin Collections**: When you create or edit a custom order, you can link it to an existing Jellyfin collection (BoxSet) or create a new collection named after the order. Movies and series in the order are added to that collection automatically. This includes series of episodes and items in nested sub-orders. A sync runs when the link is set, after the order's items change (debounced), and after each Jellyfin library sync. Items are only ever added: removing an item from the order does not remove it from the collection. Every Up Next item from a linked order (or one of its sub-orders), whatever its type (book, comic, web video, etc.), shows the linked collection's artwork first, followed by its parent collections. The Android Custom Orders cards show the same artwork. The API accepts `jellyfinCollectionId` (`null` unlinks) or `createJellyfinCollection: true` on `POST`/`PUT /api/custom-orders`, and returns `jellyfinCollection { jellyfinId, name, thumb, removed }`. To link an existing order, open the order (Manage Items): its header has a **Jellyfin Collection** panel with **Save Collection Link**. The order list's Edit form also has the picker, and clicking Edit scrolls to that form.
- **Movie Credit Scenes**: The Up Next payload includes `hasCreditScenes` for movies, read from the TVDB movie's "Credit Scenes" tag (Yes/No) and cached for 24 hours. The Android app shows a "Credit Scenes" badge when it is `true`.
- **Course Library**: Browse courses under **Media > Courses**, independently of History Plus. Use **Add to Custom Order** on a course or lecture to select one, several, or all lectures. Lectures are appended in course order as web videos, with duplicate URLs skipped and independent watch/progress tracking per custom order. Import course videos first if a course has no lectures yet. Existing History Plus course URLs, video linking, and AI event assignment remain available.
- **Course Video Import**: **Add Course Videos** supports current Great Courses lecture lists and older numbered headings. **Refresh Course Videos** safely retries imports, skips existing lectures, and replaces older placeholder lecture URLs with the provider's `?lecplay=` links without resetting lecture watch status. Pages with no detected lectures report an error rather than a successful empty import.
- **Jellyfin Watch Tracking**: Custom-order movies and episodes are automatically marked watched only when Jellyfin reports them as played during sync or sends a completed-playback webhook. Playback activity (play, resume, pause, or an unfinished stop) alone does not mark items watched. Manual watched marking remains available and is pushed back to Jellyfin.
- **Comic Publisher Integration**: Automatically extracts and displays comic publisher information from ComicVine
- **Advanced Statistics**: Publisher breakdowns, author statistics, and comprehensive watch analytics
- **Real-time Artwork**: Dynamic artwork fetching and caching from TVDB
- **Background Image Cleanup**: Loading backgrounds or galleries automatically removes database records for missing local image files and updates gallery counts. Image requests also clean up missing records. Files and galleries are not deleted; records are retained when storage is unavailable or a filesystem check fails. Deleted subfolders are cleaned up when their configured background storage root remains accessible.

### Book Chapters and Sections
- In **Media > Books**, open a book and use **Add Chapters / Sections to Custom Order**, or the add-to-order button beside an individual chapter or section.
- From a custom order, **Add Book Chapters / Sections** opens the book library with that order preselected.
- Select chapters, sections, or a mixture. Items are appended in book order and existing entries are skipped. Chapters and sections are distinct entries; selecting a chapter does not also insert its sections.
- Read/unread status is shared with the book library and all orders referencing the same content. Completing a section does not directly mark the whole book complete; existing section-to-chapter and chapter-to-book completion rules apply. Up Next supports these items under the book filter, including reading sessions.
- Schema deployment is required: the SQLite migration is `20261009203004_add_custom_order_book_parts`. All three Prisma schemas include the new nullable chapter/section references; PostgreSQL deployments should use the project's existing PostgreSQL schema setup and safe schema-deployment workflow.

### Notes & Daily Journaling
- **Daily Notes System**: Structured daily journaling with mood tracking, goals, habits, and gratitude
- **Calendar Integration**: Visual calendar navigation for daily notes with indicators
- **Template Management**: Customizable note templates (daily, weekly, meeting, project)
- **Quick Capture**: Fast note creation with tags and folder organization
- **Full-Featured Editor**: Rich text editing with tag management and search

### Music Library
- **Disconnect Album**: Removes a track's local album association without deleting the track or changing its other metadata, artist credits, or work links. Disconnected tracks remain on the artist details page under **Tracks Not In Albums** (and retain any linked-artist listings). Plex music sync preserves the disconnection.
- **Add to Album**: Use **Add to Album** under **Tracks Not In Albums** on artist details. The picker defaults to albums associated with the track's primary and linked artists (including linked album artist credits), with duplicate albums shown only once. Choose **Search all albums** to browse or search the entire library, or return to **Track artists' albums**. Adding a disconnected track changes only its album association; its existing artist, metadata, credits, work links, and track numbering are preserved.

### Technical Stack
- **Frontend**: React with Vite, TailwindCSS
- **Backend**: Express.js with comprehensive API
- **Database**: SQLite for development, PostgreSQL 16 for production
- **Integrations**: Jellyfin (movies & TV), Plex Media Server (music), TVDB API, ComicVine API
- **Authentication**: Jellyfin API key; Plex token for music

## Architecture

### Frontend (`/client`)
- React application with modern hooks and context
- TailwindCSS for responsive design
- Real-time updates and loading states
- Artwork proxy and caching

### Backend (`/server`)
- Express.js RESTful API
- Prisma database layer with comprehensive models
- Service-oriented architecture:
  - `JellyfinSyncService`: Synchronizes every Jellyfin movie and TV library plus collections
  - `PlexSyncService`: Synchronizes the Plex music library
  - `TvdbCachedService`: Manages TVDB API calls and caching
  - `ComicVineService`: Handles comic book metadata
  - `PlexDatabaseService`: Database abstraction layer

### Database Schema
- **Library Models**: Movies, TV Shows, Seasons, Episodes, Libraries (populated from Jellyfin; tables keep their historical `Plex*` names and `ratingKey` holds the Jellyfin item id)
- **Collection Models**: `MediaCollection` / `MediaCollectionItem` (rows with `childCollectionId` are nested collections) store Jellyfin collections (mixed movies and shows, with nesting)
- **TVDB Models**: Series, seasons, episodes with artwork caching
- **ComicVine Models**: Comics, series, volumes
- **Custom Models**: User-defined viewing orders and settings

## Setup and Installation

### Database Configuration

This application supports dual database configurations:
- **Development**: SQLite (file-based, simple setup)
- **Production**: PostgreSQL 16 (Docker/Unraid, better performance and reliability)

The database provider is automatically determined by the `DATABASE_URL` environment variable:
- SQLite: `file:./master_order.db` 
- PostgreSQL: `postgresql://user:password@host:port/database`

### Docker Installation (Recommended)

#### For Unraid Users
See [UNRAID_SETUP.md](UNRAID_SETUP.md) for detailed Unraid-specific instructions.

#### Quick Docker Setup
```bash
# Clone the repository
git clone https://github.com/your-username/master-order.git
cd master-order

# Build the Docker image
chmod +x build-docker.sh
./build-docker.sh

# Run with Docker Compose (recommended)
docker-compose up -d

# Or run manually
docker run -d \
  --name master-order \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/artwork-cache:/app/server/artwork-cache \
  -e JELLYFIN_URL=http://your-jellyfin-server:8096 \
  -e JELLYFIN_API_KEY=your-jellyfin-api-key \
  -e PLEX_URL=http://your-plex-server:32400 \
  -e PLEX_TOKEN=your-plex-token \
  master-order:latest
```

### Manual Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Jellyfin server (movies & TV) with an API key
- Plex Media Server (music only, optional)
- TVDB API account (optional, for enhanced artwork)
- ComicVine API account (optional, for comic integration)

### Environment Variables
Create a `.env` file in the `/server` directory:

```env
DATABASE_URL="file:./prisma/dev.db"
JELLYFIN_URL="http://your-jellyfin-server:8096"
JELLYFIN_API_KEY="your-jellyfin-api-key"
# JELLYFIN_USER_ID="optional; defaults to the first administrator"
PLEX_TOKEN="your-plex-token-here"
PLEX_URL="http://your-plex-server:32400"
TVDB_API_KEY="your-tvdb-api-key"
TVDB_BEARER_TOKEN="your-tvdb-bearer-token"
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd master-order
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client && npm install && cd ..
   
   # Install server dependencies
   cd server && npm install && cd ..
   ```

3. **Set up the database**
   ```bash
   cd server
   npx prisma migrate dev --name "initial_setup"
   npx prisma generate
   ```

4. **Configure Jellyfin (and optionally Plex for music)**
   - Enter the Jellyfin URL and API key (Jellyfin Dashboard → API Keys) in **Settings**, or via the `.env` file. Settings values take precedence.
   - Click **Sync Jellyfin Libraries**. Every Jellyfin movie and TV library is synced on each run.
   - Optional: install the Jellyfin **Webhook** plugin and add a *Generic* destination pointing at `http://<master-order-host>:3001/api/webhook/jellyfin` with the **Playback Stop**, **Playback Start** and **User Data Saved** notification types and "Send All Properties" enabled. This lets watched state update immediately instead of waiting for the next sync.

## Running the Application

### Development Mode
```bash
# Start both client and server concurrently
npm run dev

# Or start individually:
npm run client  # Frontend only (port 5173)
npm run server  # Backend only (port 3001)
```

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Core Functionality
- `GET /api/next-episode` - Get next episode recommendation
- `GET /api/next-movie` - Get next movie recommendation
- `GET /api/next-custom-order` - Get next item from custom order

### Settings Management
- `GET /api/settings` - Retrieve application settings
- `POST /api/settings` - Update application settings

### Jellyfin Integration (movies & TV)
- `POST /api/jellyfin/sync` - Sync all Jellyfin movie/TV libraries and collections
- `GET /api/jellyfin/sync-status` - Check sync status
- `GET /api/jellyfin/collections` / `GET /api/jellyfin/collections/tree` - Collections (flat / nested)
- `GET /api/jellyfin/players` / `POST /api/jellyfin/play` - Remote-play on a Jellyfin client session
- `GET /api/jellyfin/playback/:itemId` - Stream info for in-app playback
- `POST /api/webhook/jellyfin` - Jellyfin Webhook plugin receiver

### Plex Integration (music)
- `POST /api/plex/sync` - Sync the Plex music library
- `GET /api/plex/sync-status` - Check sync status
- `GET /api/search` - Search the local library

### TVDB Integration
- `GET /api/tvdb-artwork` - Proxy TVDB artwork requests
- `POST /api/tvdb/clear-cache` - Clear TVDB cache

## Configuration

### Stash Random Scene Selection
Android and web Next Scene count eligible unwatched rows and retrieve a single
random row, instead of loading every scene and its relationships. Android reads
the selected row directly and supplies artwork proxy URLs without waiting for
Stash GraphQL; image loading is independent of scene selection. Unwatched means
a zero/null play count and no `__Watched` tag. No client timeout increase is needed.

### Collection Settings
Android Up Next shows collection posters for both movies and episodes. Movie
posters use the selected movie's memberships; episodes use the series'
memberships. Both include ancestor collections and exclude the configured
Now Watching/TV selection collection.

Configure which Jellyfin collection to use for initial TV series selection (for example, Now Watching), and which collections to ignore, in the Settings page. This collection does not restrict initial movie selection.
Jellyfin collections can mix movies and shows and can contain other collections: an item belongs to a collection if it is in it directly or in any collection nested inside it, and ignoring a collection ignores everything nested within it.

For general Up Next picks, TV/movie weights and release/long-unwatched preferences
choose the initial candidate only. Its collections and their nested collections
are then checked for the earliest unplayed movie or next unplayed episode, ordered
by movie release date or episode air date (not the series premiere). This final
chronological choice can cross from TV to movies or vice versa and is shared by
the Android and web endpoints. The configured selection collection is excluded
from franchise expansion, ignored collections and removed items are skipped,
and explicit custom orders retain their authored ordering.

Movie candidates are queried across every synced Jellyfin movie library, not
just the first library, regardless of membership in Now Watching or the configured
TV selection collection. Movies in mixed movie/TV collections remain eligible;
Jellyfin chooses uniformly from all eligible unwatched movies, including movies
without collections. The partially watched collection priority setting applies
only to legacy Plex selection, not Jellyfin: it cannot restrict the Jellyfin seed
pool or select a watched movie as a seed. Existing ignored-collection,
Christmas and custom-order filters still apply. If no unwatched movies remain,
Up Next returns no content rather than replaying a watched movie.
Collection chronology is applied only after choosing the candidate. Positive
fractional TV/movie weights are supported as well as whole-number percentages.

### Order Type Percentages
Set the probability distribution for different content types:
- TV General: Random episodes from your collection
- Movies General: Random movies across all synced movie libraries
- Custom Order: Episodes from user-defined custom orders

## Development

### Database Migrations
```bash
cd server
npx prisma migrate dev --name "migration_description"
```

### Database Studio
```bash
cd server
npx prisma studio
```

### Testing
Various test scripts are available in the root directory for debugging different components.

## Troubleshooting

### Common Issues
- **Blank Page**: Check browser console for JavaScript errors
- **API Connection Errors**: Verify the Jellyfin (and Plex, for music) servers are running and accessible; `GET /api/health/debug/jellyfin` reports the Jellyfin connection
- **Database Issues**: Run `npx prisma migrate reset` to reset the database
- **CORS Errors**: Ensure backend is running on port 3001

### Debug Scripts
- `test-plex-connection.js` - Test Plex API connectivity
- `test-tvdb-*.js` - Various TVDB integration tests
- `debug-*.js` - Debugging utilities for specific components

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Plex Media Server for the excellent media management platform
- TVDB for comprehensive TV show metadata
- ComicVine for comic book information
- The open-source community for the various libraries used
2. Install dependencies:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install
cd ..

# Install client dependencies
cd client && npm install
cd ..
```

### Running the Application

You can run both the frontend and backend together:

```bash
npm start
```

Or run them separately:

```bash
# Run the server
npm run server

# Run the client
npm run client
```

## API Endpoints

- `GET /api/test` - Returns a test message

## Future Enhancements

- Add user authentication
- Implement CRUD operations for orders
- Add more features and functionality

## Directory Structure

```
master-order/
├── client/             # React frontend
│   ├── public/         # Static files
│   └── src/            # React source code
│       ├── components/ # React components
│       └── styles/     # CSS styles
├── server/             # Express backend
│   ├── index.js        # Server entry point
│   └── masterorder.db  # SQLite database
└── start.js            # Script to start both client and server
```
