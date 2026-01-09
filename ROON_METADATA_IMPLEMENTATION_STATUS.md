# Roon-Style Metadata System - Implementation Progress

## ✅ Phase 1: Database Foundation (COMPLETE)

### Schema Updates
All three schema files synchronized with metadata management fields:
- `schema.prisma` (main)
- `schema.sqlite.prisma` (development)
- `schema.postgresql.prisma` (production)

### Updated Models
**PlexArtist**
- `userTitle`, `userSortName`, `userBiography`, `userCountry`
- `metadataPreferences` (JSON: field-level source preferences)
- `identificationStatus` (default: "unidentified")
- `identificationConfidence` (Float)
- `lastIdentificationAttempt` (DateTime)

**PlexAlbum**
- `userTitle`, `userReleaseDate`, `userLabel`
- `metadataPreferences`, `identificationStatus`, `identificationConfidence`, `lastIdentificationAttempt`
- `workId` (direct album-to-work linking)

**PlexTrack**
- `userTitle`, `userComposer`
- `metadataPreferences`, `identificationStatus`, `identificationConfidence`, `lastIdentificationAttempt`
- `workId` (direct track-to-work linking)

**Work**
- `userTitle`, `userCatalogNumber`, `userOpusNumber`, `userNickname`
- `musicBrainzWorkId`
- `metadataPreferences`, `identificationStatus`, `identificationConfidence`
- `albums[]`, `tracks[]` (relations)

### New Tables
**IdentificationCandidate**
- Stores MusicBrainz match candidates for user review
- Fields: entityType, entityKey, musicBrainzId, title, artist, releaseDate, confidence, metadata, status

**MusicBrainzMetadataCache**
- Caches MusicBrainz metadata for 30 days
- Fields: musicBrainzId, entityType, metadata (JSON), lastFetched, expiresAt

**UserMetadataOverride**
- Stores user edits that don't fit inline fields
- Fields: entityType, entityKey, field, value

**MetadataPreference**
- Tracks preferred source per field per entity
- Fields: entityType, entityKey, field, source ('user'|'musicbrainz'|'plex')

### Migration Status
✅ All schema changes applied with `npx prisma db push`
✅ Database tables created successfully
✅ Prisma Client regenerated

---

## ✅ Phase 2: MetadataResolutionService (COMPLETE)

### Service Implementation
**Location:** `server/services/metadataResolutionService.js`

### Core Methods

**resolveField(entityType, entityKey, field)**
- Returns the active value for a field based on three-tier priority
- Priority: User Override → MusicBrainz → Plex Files
- Respects user's per-field source preferences
- Returns: `{ value, source }`

**getAllFieldSources(entityType, entityKey, field)**
- Returns all available values from all three sources
- Returns: `{ user, musicbrainz, plex }`

**getResolvedMetadata(entityType, entityKey)**
- Returns complete resolved metadata for an entity
- Returns: `{ metadata, sources, identificationStatus, identificationConfidence }`

**setPreference(entityType, entityKey, field, source)**
- Sets which source to use for a specific field
- Updates both MetadataPreference table and inline JSON

**setUserOverride(entityType, entityKey, field, value)**
- Saves user's manual edit
- Auto-sets preference to 'user'
- Updates inline user field or UserMetadataOverride table

**clearUserOverride(entityType, entityKey, field)**
- Removes user's manual edit
- Clears both inline field and override table entry

### Supported Entity Types
- `artist` (PlexArtist)
- `album` (PlexAlbum)
- `track` (PlexTrack)
- `work` (Work)

### Supported Fields by Entity
**Artist:** title, sortName, biography, country, disambiguation
**Album:** title, releaseDate, label, disambiguation
**Track:** title, composer, trackNumber, duration
**Work:** title, catalogNumber, opusNumber, nickname

---

## ✅ Phase 2: Metadata API Routes (COMPLETE)

### Route Implementation
**Location:** `server/routes/metadata.js`
**Mounted at:** `/api/metadata`

### Endpoints

**GET /api/metadata/:entityType/:entityKey/sources/:field**
- Get all available sources for a specific field
- Response: `{ user: value, musicbrainz: value, plex: value }`

**GET /api/metadata/:entityType/:entityKey/resolved**
- Get complete resolved metadata for an entity
- Response: `{ metadata: {}, sources: {}, identificationStatus, identificationConfidence }`

**GET /api/metadata/:entityType/:entityKey/field/:field**
- Resolve a single field's value
- Response: `{ value, source }`

**PUT /api/metadata/:entityType/:entityKey/preference**
- Set metadata source preference for a field
- Body: `{ field: string, source: 'user'|'musicbrainz'|'plex' }`

**PUT /api/metadata/:entityType/:entityKey/override**
- Set user override for a field
- Body: `{ field: string, value: any }`

**DELETE /api/metadata/:entityType/:entityKey/override/:field**
- Clear user override for a field

### Integration
✅ Routes imported in `server/index.js`
✅ Mounted at `/api/metadata`
✅ Uses modular utilities (asyncHandler, sendSuccess, etc.)

---

## ✅ Phase 2: MetadataEditor Component (COMPLETE)

### Component Implementation
**Location:** `client/src/components/MetadataEditor/index.jsx`

### Features
- **Inline Editing:** Click edit button to modify any field
- **Source Selection:** Dropdown to choose data source per field
- **Visual Indicators:** Color-coded sources (User=purple, MusicBrainz=blue, Files=gray)
- **User Override Management:** Clear user edits to revert to other sources
- **Real-time Updates:** Callbacks to parent components on value changes

### Props
```jsx
<MetadataEditor
  entityType="album"
  entityKey="12345"
  field="title"
  label="Album Title"
  currentValue="Current Album Title"
  onUpdate={(newValue) => console.log('Updated:', newValue)}
/>
```

### UI Elements
- **Text Display:** Shows current resolved value
- **Edit Button:** Opens inline editor
- **Source Dropdown:** Shows all available sources with values
- **Save/Cancel:** Commit or discard edits
- **Clear Override:** Remove user edit (only shown if user override exists)

---

## ✅ Phase 3: MusicBrainz Identification Service (COMPLETE)

### Service Implementation
**Location:** `server/services/identificationService.js`

### Core Methods

**identifyAlbum(ratingKey)**
- Searches MusicBrainz for album matches
- Calculates confidence scores based on:
  - Title similarity (40%)
  - Artist match (30%)
  - Year match (15%)
  - Track count match (10%)
  - Exact match bonus (5%)
- Stores top 10 candidates with scores
- Updates album identification status
- Returns sorted candidates (highest confidence first)

**identifyArtist(ratingKey)**
- Searches MusicBrainz for artist matches
- Calculates confidence scores based on:
  - Name similarity (60%)
  - Country match (20%)
  - Disambiguation presence (10%)
  - Sort name consistency (10%)
- Stores top 10 candidates
- Returns sorted candidates

**acceptIdentification(candidateId)**
- Applies MusicBrainz metadata to entity
- Caches full metadata for 30 days
- Marks candidate as accepted
- Rejects other pending candidates
- Updates entity identification status to 'identified'

**getPendingCandidates(entityType, entityKey)**
- Retrieves pending matches for user review
- Returns candidates sorted by confidence

**rejectCandidate(candidateId)**
- Marks candidate as rejected
- Keeps candidate record for history

**markAsManual(entityType, entityKey)**
- Sets identification status to 'manual'
- For entities with no MusicBrainz match
- Rejects all pending candidates

### Confidence Scoring Algorithm
- **String Similarity:** Levenshtein distance calculation
- **Normalization:** Removes punctuation, lowercases, trims
- **Weighted Factors:** Different weights for title/artist/year/tracks
- **Range:** 0.0 (no match) to 1.0 (perfect match)
- **Thresholds:** 
  - ≥95%: Excellent (auto-accept candidate)
  - 85-94%: Very good
  - 70-84%: Good
  - 50-69%: Fair
  - <50%: Poor

---

## ✅ Phase 3: Identification API Routes (COMPLETE)

### Route Implementation
**Location:** `server/routes/identification.js`
**Mounted at:** `/api/identification`

### Endpoints

**POST /api/identification/album/:ratingKey**
- Search MusicBrainz for album matches
- Returns candidates with confidence scores
- Response: `{ candidates: [], count: number, topMatch: object }`

**POST /api/identification/artist/:ratingKey**
- Search MusicBrainz for artist matches
- Returns candidates with confidence scores

**GET /api/identification/:entityType/:entityKey/candidates**
- Get pending identification candidates
- Returns previously stored matches

**POST /api/identification/accept/:candidateId**
- Accept a candidate and apply metadata
- Caches MusicBrainz data
- Updates entity with MB ID and metadata
- Response: `{ entity: updatedEntity, message: string }`

**POST /api/identification/reject/:candidateId**
- Reject a candidate
- Keeps record for history

**POST /api/identification/manual/:entityType/:entityKey**
- Mark entity as manually identified (no MB match)
- Rejects all pending candidates

**POST /api/identification/batch/auto-accept**
- Auto-accept high-confidence matches
- Body: `{ entityType: string, minConfidence?: number }`
- Default minConfidence: 0.95 (95%)
- Returns: `{ total, accepted, failed, errors[] }`

### Integration
✅ Routes imported in `server/index.js`
✅ Mounted at `/api/identification`
✅ Uses modular utilities (asyncHandler, sendSuccess, etc.)

---

## ✅ Phase 3: IdentifyModal Component (COMPLETE)

### Component Implementation
**Location:** `client/src/components/IdentifyModal/index.jsx`

### Features
- **Ranked Results:** Shows matches sorted by confidence
- **Confidence Indicators:** Color-coded scores (green/yellow/orange/red)
- **Detailed Info:** Title, artist, year, track count, disambiguation
- **Selection:** Click to select match before accepting
- **Manual Override:** "None of these match" option
- **Visual Feedback:** Loading states, error handling

### Props
```jsx
<IdentifyModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  entityType="album"
  entityKey={album.ratingKey}
  entityTitle={album.title}
  onIdentified={(entity) => {
    // Refresh album data
    setAlbum(entity);
  }}
/>
```

### UI Elements
- **Search Header:** Shows entity being identified
- **Loading State:** Animated search icon
- **Match Cards:** Ranked with confidence bars
- **Selection Indicator:** Checkmark on selected match
- **Footer Actions:**
  - "None of these match" → Marks as manual
  - "Cancel" → Closes without changes
  - "Accept & Apply Metadata" → Applies selected match

### Confidence Display
- **95-100%:** Green "Excellent Match"
- **85-94%:** Green "Very Good Match"
- **70-84%:** Yellow "Good Match"
- **50-69%:** Orange "Fair Match"
- **<50%:** Red "Poor Match"

---

## 🔄 Next Steps (Phases 4-8)

### Phase 4: UI Integration (READY TO IMPLEMENT)
- Add IdentifyModal to AlbumDetail page
- Add IdentifyModal to ArtistDetail page
- Add "Identify" and "Edit Metadata" buttons
- Show identification status indicators
- Display confidence scores in UI

### Phase 5: Batch Operations (READY TO IMPLEMENT)
- Multi-select albums for batch identification
- Bulk metadata preference changes
- Auto-accept high-confidence matches UI
- Progress tracking for batch operations

### Phase 6: Background Sync Enhancement
- Auto-identify new albums during Plex sync
- Cache MusicBrainz data proactively
- Expire cache entries after 30 days

### Phase 7: Advanced Features
- Disambiguation support for common names
- Multi-disc album handling
- Classical work matching improvements
- User confidence threshold settings
- User confidence threshold settings

---

## 🎯 Current Implementation Status

### ✅ Complete (Phases 1-5)
- Database schema with three-tier metadata support
- Identification tracking (status, confidence, last attempt)
- User override storage (inline + table)
- Metadata preference tracking
- MusicBrainz cache table structure
- Identification candidate table structure
- MetadataResolutionService with full three-tier logic
- Metadata API routes (6 endpoints)
- MetadataEditor React component
- IdentificationService with confidence scoring
- Identification API routes (7 endpoints)
- IdentifyModal React component
- **AlbumDetail page integration**
  - Identify button with modal
  - Edit Metadata mode with MetadataEditor
  - Identification status badges
  - Full metadata editing UI
- **ArtistDetail page integration**
  - Identify button with modal
  - Edit Metadata mode with MetadataEditor
  - Identification status badges
  - Full metadata editing UI
- **BatchIdentifyPanel component (NEW!)**
  - Auto-accept high-confidence matches
  - Configurable confidence threshold (50-100%)
  - Progress tracking with detailed results
  - Error reporting per candidate
  - Entity type selection (albums/artists)
- **MusicSettings admin page (NEW!)**
  - Library statistics dashboard
  - Identification status breakdown
  - Batch operations interface
  - Help documentation
  - Accessible via Settings tab in music navigation
- Server integration and route mounting

### 🚧 Ready for Testing
- Complete UI integration needs real-world testing
- Batch identification workflow
- Metadata source resolution with live data

### 📋 Pending (Phases 6-7)
- Background sync enhancements (auto-identify new items)
- Cache expiration cleanup
- Advanced features (disambiguation, multi-disc, classical)

---

## 📝 Usage Examples

### Backend: Resolve Album Metadata
```javascript
const MetadataResolutionService = require('./services/metadataResolutionService');
const service = new MetadataResolutionService();

// Get resolved metadata for an album
const metadata = await service.getResolvedMetadata('album', '12345');
console.log(metadata);
// {
//   metadata: { title: 'Abbey Road', releaseDate: '1969-09-26', ... },
//   sources: { title: 'musicbrainz', releaseDate: 'plex', ... },
//   identificationStatus: 'identified',
//   identificationConfidence: 0.98
// }

// Set user's preference for album title to use MusicBrainz
await service.setPreference('album', '12345', 'title', 'musicbrainz');

// Set user override for album title
await service.setUserOverride('album', '12345', 'title', 'Custom Album Title');
```

### Frontend: Edit Album Title
```jsx
import MetadataEditor from '@/components/MetadataEditor';

function AlbumDetails({ album }) {
  const handleUpdate = (newValue) => {
    // Refresh album data or update local state
    console.log('Album title updated to:', newValue);
  };

  return (
    <div>
      <MetadataEditor
        entityType="album"
        entityKey={album.ratingKey}
        field="title"
        label="Album Title"
        currentValue={album.title}
        onUpdate={handleUpdate}
      />
      
      <MetadataEditor
        entityType="album"
        entityKey={album.ratingKey}
        field="releaseDate"
        label="Release Date"
        currentValue={album.releaseDate}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
```

---

## 🔒 Data Safety Guarantees

### Non-Destructive Design
- ✅ Original Plex metadata never modified
- ✅ User overrides stored separately
- ✅ Can always revert to original file data
- ✅ All changes are additive (new fields/tables only)

### Safe for Deployment
- ✅ No breaking changes to existing functionality
- ✅ Backward compatible with existing data
- ✅ Optional fields (all nullable)
- ✅ Database migration tested successfully

### Rollback Strategy
If needed, simply:
1. Stop using MetadataEditor component
2. Existing resolved values continue to work
3. User can clear overrides individually
4. Or drop new tables if complete rollback needed

---

## 🚀 Deployment Notes

### Docker/Unraid Compatibility
- ✅ All schema files synchronized (SQLite + PostgreSQL)
- ✅ Environment-based schema detection works
- ✅ No file system dependencies beyond database
- ✅ All new functionality is opt-in

### Performance Considerations
- Metadata resolution is lightweight (single DB query)
- MusicBrainz cache prevents excessive API calls
- Preferences stored as JSON for fast lookups
- Indexes on candidate table for quick filtering

### Future Scalability
- Ready for async identification workflows
- Batch operation support planned
- Cache expiration handles stale data
- Confidence scoring enables automation
