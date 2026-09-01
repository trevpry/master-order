# Music Library Artists Implementation

## Overview

This document provides a comprehensive overview of the Artists section in the Music Library, including the current implementation, filtering capabilities, and how artists are displayed.

## File Structure

### Client-Side Components

```
client/src/modules/media/pages/music/
├── index.jsx                          # Main Music page component
├── Music.css                           # Main Music page styles
├── components/
│   ├── MusicArtistsView.jsx           # Artists grid view component
│   ├── ArtistDetail.jsx               # Individual artist detail view
│   ├── ArtistTypesManager.jsx         # Artist type management modal
│   ├── MusicViewNavigation.jsx        # View navigation tabs
│   ├── MusicBreadcrumb.jsx            # Breadcrumb navigation
│   ├── MusicAudioPlayer.jsx             # Audio player component
│   ├── MusicControls.jsx                # Playback controls
│   ├── MusicCollectionsView.jsx       # Collections view
│   ├── MusicPlaylistsView.jsx           # Playlists view
│   ├── MusicAlbumsView.jsx              # Albums view
│   ├── MusicTracksView.jsx              # Tracks view
│   ├── WorksView.jsx                    # Works view
│   └── RadioView.jsx                    # Radio view
```

### Server-Side Components

```
server/
├── routes/
│   ├── music.js                        # Music API routes
│   ├── artistTypes.js                  # Artist types API routes
│   └── artistMergeService.js           # Artist merge service
├── plexDatabaseService.js              # Database service for Plex data
└── services/
    └── artistMergeService.js           # Artist merge business logic
```

## Artist Display Implementation

### MusicArtistsView Component

**Location**: `client/src/modules/media/pages/music/components/MusicArtistsView.jsx`

**Key Features**:
- Displays artists in a responsive grid layout
- Shows artist thumbnail, title, and play count
- Supports selection mode for batch operations
- Includes "Load More" button for pagination
- Handles empty state when no artists are found

**Props**:
```javascript
const MusicArtistsView = ({
  artists,
  artistsLoading,
  artistsHasMore,
  onSelectArtist,
  onMergeArtist,
  onDeleteArtist,
  onLoadMoreArtists,
  onCreateArtist,
  selectionMode = false,
  selectedArtists = new Set(),
  onToggleSelection
}) => { ... }
```

**Display Logic**:
- Each artist card shows:
  - Thumbnail image (Plex artwork)
  - Artist title
  - Play count (if available)
  - Action buttons (Merge/Delete) when in non-selection mode
  - Checkbox for selection mode

### ArtistDetail Component

**Location**: `client/src/modules/media/pages/music/components/ArtistDetail.jsx`

**Key Features**:
- Detailed view of a single artist
- Shows linked albums, works, and tracks
- MusicBrainz integration for metadata
- Artist type management
- Metadata editing capabilities
- Play all tracks functionality

**Main Sections**:
1. **Artist Header**: Back button, artist title, edit button
2. **Artist Info**: Artwork, title, sort name, play count
3. **Linked Albums**: Albums associated with this artist
4. **Works**: Musical works where this artist is a composer
5. **Tracks**: Individual tracks by this artist
6. **Artist Types**: Type assignments for this artist

## Filtering & Browse Functionality

### URL-Based Navigation

The Music page uses URL parameters to manage navigation state:

```
?view=artists&section=all&artistTypeId=all&search=
```

**Parameters**:
- `view`: Current view (artists, artist, albums, tracks, album, track, works, etc.)
- `section`: Selected music section (library section key)
- `artistTypeId`: Filter by artist type
- `search`: Search query

### Artist Loading Logic

**Location**: `client/src/modules/media/pages/music/index.jsx`

**Key Functions**:

1. **`refreshArtists()`**: Resets pagination and reloads artists
   - Clears current artists array
   - Resets page counters
   - Loads first page with current filters

2. **`loadArtists(page, replace, sectionOverride, artistTypeOverride)`**: Fetches artists from API
   - Supports pagination
   - Handles search queries
   - Supports artist type filtering
   - Supports section filtering

3. **`loadMoreArtists()`**: Loads additional pages
   - Appends to existing artists array
   - Checks `artistsHasMore` to prevent unnecessary requests

### API Endpoints

**Location**: `server/routes/music.js`

#### GET `/api/music/artists` - All Artists

**Query Parameters**:
- `search`: Optional search query
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `artistTypeId`: Filter by artist type

**Response**:
```json
{
  "artists": [...],
  "page": 1,
  "limit": 20,
  "totalPages": 10,
  "totalArtists": 200
}
```

**Features**:
- Supports pagination
- Supports artist type filtering
- Includes play counts for each artist
- Search across title, titleSort, userTitle, userSortName, musicBrainzAliases

#### GET `/api/music/artists/section/:sectionKey` - Artists by Section

**Query Parameters**:
- `search`: Optional search query
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `artistTypeId`: Filter by artist type

**Response**: Same structure as `/api/music/artists`

**Features**:
- Filters artists by specific music section
- Supports all search and filter options

### Search Functionality

**Search Fields**:
- `title`: Artist title
- `titleSort`: Sort name
- `userTitle`: User-provided title
- `userSortName`: User-provided sort name
- `musicBrainzAliases`: MusicBrainz aliases

**Search Logic**:
```javascript
OR: [
  { title: makeContainsFilter(searchQuery) },
  { titleSort: makeContainsFilter(searchQuery) },
  { userTitle: makeContainsFilter(searchQuery) },
  { userSortName: makeContainsFilter(searchQuery) },
  { musicBrainzAliases: makeContainsFilter(searchQuery) }
]
```

### Artist Type Filtering

**Artist Type Assignment Model**:
```prisma
model ArtistTypeAssignment {
  artistKey    String
  artistTypeId Int
  artist       PlexArtist
  artistType   ArtistType
  
  @@unique([artistKey, artistTypeId])
}
```

**Filtering Logic**:
1. Fetch all artists with the specified artist type
2. Filter the results by the specified artist type
3. Return only artists that have the specified type assigned

**Usage**:
```javascript
const artistsWithType = await prisma.artistTypeAssignment.findMany({
  where: { artistTypeId: parsedArtistTypeId },
  select: { artistKey: true }
});

allowedArtistKeys = new Set(artistsWithType.map(assignment => assignment.artistKey));
```

## Artist Type Management

### ArtistTypesManager Component

**Location**: `client/src/modules/media/pages/music/components/ArtistTypesManager.jsx`

**Features**:
- View all available artist types
- Assign/remove types from an artist
- Create new artist types
- Edit existing artist types

**API Endpoints**:
- `GET /api/artist-types` - List all artist types
- `GET /api/artist-types/:id` - Get single artist type
- `POST /api/artist-types` - Create new artist type
- `PUT /api/artist-types/:id` - Update artist type
- `DELETE /api/artist-types/:id` - Delete artist type
- `POST /api/artist-types/:id/artists/:artistKey` - Assign type to artist
- `DELETE /api/artist-types/:id/artists/:artistKey` - Remove type from artist

### Artist Type Hierarchy

**Parent-Child Relationship**:
```prisma
model ArtistType {
  parentId    Int?
  parent      ArtistType?
  children    ArtistType[]
}
```

**Features**:
- Hierarchical artist types (parent/child)
- Type inheritance support
- Color coding for visual distinction

## Artist Merge Functionality

### MergeArtistsModal Component

**Location**: `client/src/components/music/MergeArtistsModal.jsx`

**Features**:
- Select multiple artists to merge
- Choose which artist to keep
- Review artist information before merging
- Visual comparison of artist data

### ArtistMergeService

**Location**: `server/services/artistMergeService.js`

**Merge Operations**:
1. Transfer album relationships
2. Transfer work relationships (composer)
3. Transfer artist type assignments
4. Transfer track artist relationships
5. Transfer album artist relationships
6. Delete merged artists

**API Endpoint**:
- `POST /api/music/artists/merge` - Merge multiple artists

## Database Schema

### PlexArtist Model

**Location**: `server/prisma/schema.prisma`

**Key Fields**:
```prisma
model PlexArtist {
  id                    Int                      @id @default(autoincrement())
  ratingKey             String                   @unique
  title                 String
  titleSort             String?
  thumb                 String?
  art                   String?
  librarySectionID      Int?
  musicBrainzId         String?
  musicBrainzAliases    String?
  userTitle             String?
  userSortName          String?
  albums                PlexAlbum[]
  works                 Work[]
  artistTypes           ArtistTypeAssignment[]
  trackArtists          TrackArtist[]
  albumArtists          AlbumArtist[]
  librarySection        PlexLibrarySection?
}
```

### ArtistTypeAssignment Model

**Location**: `server/prisma/schema.prisma`

**Key Fields**:
```prisma
model ArtistTypeAssignment {
  id           Int        @id @default(autoincrement())
  artistKey    String
  artistTypeId Int
  artist       PlexArtist
  artistType   ArtistType
  createdAt    DateTime   @default(now())
  
  @@unique([artistKey, artistTypeId])
}
```

## Styling

### CSS Files

- **Music.css**: Main music page styles
- **ArtistDetail.css**: Artist detail view styles
- **ArtistTypesManager.css**: Artist type manager styles

### Key Styles

**Artist Cards**:
```css
.artist-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: transform 0.2s;
}

.artist-card:hover {
  transform: translateY(-2px);
}

.artist-image img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
}
```

**Artist Types**:
```css
.type-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}
```

## Navigation Flow

### View Transitions

1. **Artists View**: Default view showing all artists
2. **Artist Detail**: Click on an artist to view details
3. **Albums View**: Navigate to albums for selected artist
4. **Tracks View**: Navigate to tracks for selected album
5. **Album Detail**: Click on an album to view details
6. **Track Detail**: Click on a track to view details

### URL Parameter Updates

The component automatically updates URL parameters when:
- Navigating between views
- Selecting artists/albums/tracks
- Applying filters
- Searching

## Performance Considerations

### Pagination
- Artists are loaded in pages of 20
- "Load More" button for infinite scrolling
- `artistsHasMore` state to prevent unnecessary requests

### Search Optimization
- Search queries use database indexes
- PostgreSQL uses case-insensitive matching
- SQLite uses case-sensitive matching

### Artist Type Filtering
- Pre-fetches artist keys with the specified type
- Uses Set for O(1) lookup performance
- Minimizes database queries

## Future Enhancements

Potential improvements to consider:
1. Batch artist type assignment
2. Advanced search filters (date range, play count, etc.)
3. Drag-and-drop artist reordering
4. Artist type drag-and-drop hierarchy editor
5. Bulk artist deletion
6. Artist statistics dashboard
7. Artist metadata quality indicators
