# Roon-Style Metadata Management Proposal
## Eddie Life Management - Music Module Enhancement

## Overview
This proposal outlines a comprehensive metadata identification and editing system inspired by Roon's approach to music metadata management. The system will provide flexible, multi-layered metadata handling with MusicBrainz integration while maintaining user control and data integrity.

---

## Core Principles (Roon-Inspired)

### 1. **Three-Tier Metadata Architecture**
```
┌─────────────────────────────────────┐
│  ROON DATABASE METADATA             │  ← Highest Priority
│  (MusicBrainz, AllMusic, etc.)      │
├─────────────────────────────────────┤
│  USER EDITS                         │  ← Medium Priority
│  (Manual overrides)                 │
├─────────────────────────────────────┤
│  FILE TAGS                          │  ← Lowest Priority
│  (ID3, FLAC, etc.)                  │
└─────────────────────────────────────┘
```

**For Eddie Life Management:**
- **MusicBrainz Metadata**: Authoritative metadata from MusicBrainz API
- **User Edits**: Manual corrections and preferences
- **Plex Metadata**: Original data from Plex server (file tags + Plex enrichment)

### 2. **User Control Philosophy**
- Users can choose which metadata source to prefer per field
- Explicit "Prefer File Tags" vs "Prefer MusicBrainz" toggle
- Field-level granularity (can use MusicBrainz for composer, file tags for track titles)
- Non-destructive editing (original metadata always preserved)

### 3. **Identification System**
- Manual and automatic identification
- Confidence scoring for matches
- Multi-source search (MusicBrainz, user input, file scanning)
- "Identify Album" workflow with ranked results

---

## Proposed Database Schema Changes

### New Tables

```prisma
// Metadata Source Tracking
model MetadataSource {
  id            Int      @id @default(autoincrement())
  name          String   @unique // "musicbrainz", "plex", "user"
  priority      Int      // Default priority order
  description   String?
  createdAt     DateTime @default(now())
  
  @@map("MetadataSource")
}

// Metadata Preferences (per entity)
model MetadataPreference {
  id              Int      @id @default(autoincrement())
  entityType      String   // "artist", "album", "track", "work"
  entityKey       String   // ratingKey or work.id
  fieldName       String   // "title", "composer", "releaseDate", etc.
  preferredSource String   // "musicbrainz", "plex", "user"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([entityType, entityKey, fieldName])
  @@index([entityType, entityKey])
  @@map("MetadataPreference")
}

// User Metadata Overrides
model UserMetadataOverride {
  id          Int      @id @default(autoincrement())
  entityType  String   // "artist", "album", "track", "work"
  entityKey   String   // ratingKey or work.id
  fieldName   String   // Field being overridden
  value       String   // User's custom value
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([entityType, entityKey, fieldName])
  @@index([entityType, entityKey])
  @@map("UserMetadataOverride")
}

// Identification Candidates (for manual review)
model IdentificationCandidate {
  id                  Int      @id @default(autoincrement())
  entityType          String   // "artist", "album", "track"
  entityKey           String   // ratingKey
  source              String   // "musicbrainz"
  externalId          String   // MusicBrainz ID
  confidence          Float    // 0.0 - 1.0
  matchedFields       String   // JSON array of matched fields
  metadata            String   // JSON of proposed metadata
  status              String   @default("pending") // "pending", "accepted", "rejected"
  createdAt           DateTime @default(now())
  
  @@index([entityType, entityKey, status])
  @@map("IdentificationCandidate")
}

// MusicBrainz Metadata Cache
model MusicBrainzMetadataCache {
  id                Int      @id @default(autoincrement())
  mbid              String   @unique
  entityType        String   // "artist", "release", "recording", "work"
  metadata          String   // Full JSON metadata
  fetchedAt         DateTime @default(now())
  expiresAt         DateTime // Cache expiry
  
  @@index([entityType])
  @@index([expiresAt])
  @@map("MusicBrainzMetadataCache")
}
```

### Extended Existing Tables

```prisma
// Add to PlexArtist
model PlexArtist {
  // ... existing fields
  
  // User override fields
  userTitle              String?
  userSortName           String?
  userBiography          String?
  userCountry            String?
  
  // Metadata source preferences (JSON)
  metadataPreferences    String? // {"title": "user", "country": "musicbrainz"}
  
  // Identification tracking
  identificationStatus   String? @default("unidentified") // "unidentified", "identified", "needs_review"
  identificationConfidence Float? // 0.0 - 1.0
  lastIdentificationAttempt DateTime?
}

// Add to PlexAlbum
model PlexAlbum {
  // ... existing fields
  
  // User override fields
  userTitle              String?
  userReleaseDate        DateTime?
  userLabel              String?
  
  // Metadata preferences
  metadataPreferences    String?
  
  // Identification
  identificationStatus   String? @default("unidentified")
  identificationConfidence Float?
  lastIdentificationAttempt DateTime?
}

// Add to PlexTrack
model PlexTrack {
  // ... existing fields
  
  // User override fields
  userTitle              String?
  userComposer           String?
  
  // Metadata preferences
  metadataPreferences    String?
  
  // Identification
  identificationStatus   String? @default("unidentified")
  identificationConfidence Float?
  lastIdentificationAttempt DateTime?
}

// Add to Work
model Work {
  // ... existing fields
  
  // User override fields
  userTitle              String?
  userCatalogNumber      String?
  userOpusNumber         String?
  userNickname           String?
  
  // MusicBrainz linkage
  musicBrainzWorkId      String?
  
  // Metadata preferences
  metadataPreferences    String?
  
  // Identification
  identificationStatus   String? @default("unidentified")
  identificationConfidence Float?
}
```

---

## UI/UX Design

### 1. **Album/Artist/Track Detail Page Enhancements**

#### Three-Dot Menu (⋮) Options:
```
┌─────────────────────────────────────┐
│ ⋮ More Actions                      │
├─────────────────────────────────────┤
│ 🔍 Identify Album                   │
│ ✏️  Edit Album                      │
│ 📋 View Metadata Sources            │
│ 🔄 Re-fetch MusicBrainz Data        │
│ ⚙️  Metadata Preferences            │
│ 📁 Prefer File Tags                 │
│ 🎵 Prefer MusicBrainz               │
└─────────────────────────────────────┘
```

### 2. **Identification Modal**

```
┌────────────────────────────────────────────────────────┐
│  🔍 Identify Album: "Konzert für Oboe"                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Search Criteria:                                      │
│  Title: [Konzert für Oboe           ]                 │
│  Artist: [Strauss, Richard          ]                 │
│  Year:   [1970                      ]                 │
│  Tracks: [4                         ]                 │
│                                                        │
│  [🔍 Search MusicBrainz]                              │
│                                                        │
├────────────────────────────────────────────────────────┤
│  Search Results:                    Confidence         │
├────────────────────────────────────────────────────────┤
│  ✓ Richard Strauss: Horn Concertos                    │
│    Nos. 1 & 2; Duet-Concertino;                      │
│    Oboe Concerto                                       │
│    Wiener Philharmoniker • 1970                       │
│    Label: Deutsche Grammophon                          │
│    Tracks: 4 • MB ID: abc123...           98% Match   │
│    [📋 View Details]  [✓ Use This]                    │
├────────────────────────────────────────────────────────┤
│  ○ Richard Strauss: Complete Concertos                │
│    Various Artists • 1969-1971                        │
│    Label: DG                                           │
│    Tracks: 15 • MB ID: def456...          72% Match   │
│    [📋 View Details]  [○ Use This]                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [❌ None of These]  [Manual Entry]                   │
└────────────────────────────────────────────────────────┘
```

### 3. **Edit Metadata Modal**

```
┌────────────────────────────────────────────────────────┐
│  ✏️ Edit Album: "Konzert für Oboe"                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Field              Value                    Source    │
│  ─────────────────────────────────────────────────────│
│  Title              [Konzert für Oboe     ] [Plex  ▼] │
│                     ↓ MusicBrainz: "Horn Concertos    │
│                       Nos. 1 & 2..."                   │
│                     [Switch to MusicBrainz]            │
│                                                        │
│  Artist             [Richard Strauss      ] [MB    ▼] │
│                                                        │
│  Release Date       [1970                 ] [Plex  ▼] │
│                     ↓ MusicBrainz: 1970-05-15         │
│                                                        │
│  Label              [Deutsche Grammophon  ] [MB    ▼] │
│                                                        │
│  Catalog Number     [415 851-2            ] [User  ▼] │
│                                                        │
│  Country            [Germany              ] [MB    ▼] │
│                                                        │
│  [Reset All to Plex]  [Reset All to MB]               │
│                                                        │
│  [Cancel]                              [Save Changes]  │
└────────────────────────────────────────────────────────┘
```

### 4. **Metadata Source Indicator**

Display subtle indicators showing metadata source:

```
Album Title: "Horn Concertos Nos. 1 & 2" [MB]
Artist: Richard Strauss [MB]
Release Date: 1970 [Plex]
Label: Deutsche Grammophon [User✎]
```

Legend:
- `[MB]` = MusicBrainz
- `[Plex]` = Plex/File Tags
- `[User✎]` = User Override

---

## API Endpoints

### Identification Endpoints

```javascript
// Identify album with MusicBrainz
POST /api/music/albums/:ratingKey/identify
Body: {
  title?: string,
  artist?: string,
  year?: number,
  trackCount?: number
}
Response: {
  candidates: [
    {
      confidence: 0.98,
      musicBrainzId: "abc123...",
      title: "Horn Concertos Nos. 1 & 2...",
      artist: "Richard Strauss",
      releaseDate: "1970-05-15",
      label: "Deutsche Grammophon",
      metadata: { /* full MB metadata */ }
    }
  ]
}

// Accept identification candidate
POST /api/music/albums/:ratingKey/accept-identification
Body: {
  candidateId: 123,
  applyToTracks: true // Also update tracks with MB data
}

// Get metadata sources for entity
GET /api/music/albums/:ratingKey/metadata-sources
Response: {
  fields: {
    title: { plex: "Konzert für Oboe", musicbrainz: "Horn Concertos...", user: null, active: "plex" },
    artist: { plex: "Richard Strauss", musicbrainz: "Richard Strauss", user: null, active: "musicbrainz" },
    ...
  }
}

// Update metadata preference
PUT /api/music/albums/:ratingKey/metadata-preference
Body: {
  fieldName: "title",
  preferredSource: "musicbrainz"
}

// Save user override
PUT /api/music/albums/:ratingKey/metadata-override
Body: {
  fieldName: "label",
  value: "Deutsche Grammophon (Reissue)"
}
```

### Batch Operations

```javascript
// Identify multiple albums
POST /api/music/albums/batch-identify
Body: {
  albumKeys: ["123", "456", "789"],
  autoAcceptHighConfidence: true, // Auto-accept matches >95%
  threshold: 0.8 // Minimum confidence
}

// Apply metadata preference to all albums by artist
PUT /api/music/artists/:ratingKey/albums/metadata-preference
Body: {
  fieldName: "all",
  preferredSource: "musicbrainz"
}
```

---

## Backend Services

### 1. **MetadataResolutionService**

```javascript
class MetadataResolutionService {
  /**
   * Resolve the active value for a field based on preferences
   */
  async resolveField(entityType, entityKey, fieldName) {
    // 1. Check for user override
    const userOverride = await this.getUserOverride(entityType, entityKey, fieldName);
    if (userOverride) return { value: userOverride.value, source: 'user' };
    
    // 2. Check metadata preference
    const preference = await this.getPreference(entityType, entityKey, fieldName);
    
    // 3. Get values from all sources
    const sources = {
      plex: await this.getPlexValue(entityType, entityKey, fieldName),
      musicbrainz: await this.getMusicBrainzValue(entityType, entityKey, fieldName),
      user: null
    };
    
    // 4. Return preferred source or default fallback
    const preferredSource = preference?.preferredSource || 'plex';
    return {
      value: sources[preferredSource] || sources.plex,
      source: preferredSource
    };
  }
  
  /**
   * Get all field values with their sources
   */
  async getAllFieldSources(entityType, entityKey) {
    const fields = this.getFieldsForEntityType(entityType);
    const result = {};
    
    for (const field of fields) {
      result[field] = {
        plex: await this.getPlexValue(entityType, entityKey, field),
        musicbrainz: await this.getMusicBrainzValue(entityType, entityKey, field),
        user: await this.getUserOverride(entityType, entityKey, field),
        active: (await this.resolveField(entityType, entityKey, field)).source
      };
    }
    
    return result;
  }
}
```

### 2. **IdentificationService**

```javascript
class IdentificationService {
  /**
   * Identify album using MusicBrainz
   */
  async identifyAlbum(albumRatingKey, searchCriteria) {
    const album = await prisma.plexAlbum.findUnique({ where: { ratingKey: albumRatingKey } });
    const tracks = await prisma.plexTrack.findMany({ where: { parentRatingKey: albumRatingKey } });
    
    // Build search query
    const query = this.buildSearchQuery({
      title: searchCriteria.title || album.title,
      artist: searchCriteria.artist || album.parentTitle,
      year: searchCriteria.year || album.year,
      trackCount: searchCriteria.trackCount || tracks.length
    });
    
    // Search MusicBrainz
    const results = await this.musicBrainzService.searchReleases(query);
    
    // Score and rank candidates
    const candidates = results.map(result => ({
      musicBrainzId: result.id,
      confidence: this.calculateConfidence(album, tracks, result),
      metadata: result
    })).sort((a, b) => b.confidence - a.confidence);
    
    // Save candidates for review
    await this.saveCandidates(albumRatingKey, candidates);
    
    return candidates;
  }
  
  /**
   * Calculate match confidence
   */
  calculateConfidence(album, tracks, mbRelease) {
    let score = 0;
    let maxScore = 0;
    
    // Title match (30 points)
    maxScore += 30;
    if (this.fuzzyMatch(album.title, mbRelease.title) > 0.9) score += 30;
    else if (this.fuzzyMatch(album.title, mbRelease.title) > 0.7) score += 20;
    
    // Artist match (30 points)
    maxScore += 30;
    const mbArtist = mbRelease['artist-credit']?.map(ac => ac.name).join(', ');
    if (this.fuzzyMatch(album.parentTitle, mbArtist) > 0.9) score += 30;
    
    // Year match (20 points)
    maxScore += 20;
    const mbYear = mbRelease.date?.substring(0, 4);
    if (album.year && mbYear && album.year.toString() === mbYear) score += 20;
    
    // Track count match (20 points)
    maxScore += 20;
    if (mbRelease['track-count'] === tracks.length) score += 20;
    else if (Math.abs(mbRelease['track-count'] - tracks.length) <= 2) score += 10;
    
    return score / maxScore;
  }
  
  /**
   * Accept identification and update metadata
   */
  async acceptIdentification(albumRatingKey, candidateId, options = {}) {
    const candidate = await prisma.identificationCandidate.findUnique({ where: { id: candidateId } });
    const metadata = JSON.parse(candidate.metadata);
    
    // Update album with MusicBrainz data
    await prisma.plexAlbum.update({
      where: { ratingKey: albumRatingKey },
      data: {
        musicBrainzId: candidate.externalId,
        identificationStatus: 'identified',
        identificationConfidence: candidate.confidence,
        // Store MB metadata but don't override unless user sets preference
      }
    });
    
    // Optionally update tracks
    if (options.applyToTracks) {
      await this.updateTracksFromRelease(albumRatingKey, metadata);
    }
    
    // Mark candidate as accepted
    await prisma.identificationCandidate.update({
      where: { id: candidateId },
      data: { status: 'accepted' }
    });
  }
}
```

### 3. **MusicBrainzCacheService**

```javascript
class MusicBrainzCacheService {
  /**
   * Get cached MusicBrainz metadata or fetch if expired
   */
  async getMetadata(mbid, entityType) {
    const cached = await prisma.musicBrainzMetadataCache.findUnique({ where: { mbid } });
    
    if (cached && cached.expiresAt > new Date()) {
      return JSON.parse(cached.metadata);
    }
    
    // Fetch from MusicBrainz
    const metadata = await this.musicBrainzService.getEntity(mbid, entityType);
    
    // Cache for 30 days
    await prisma.musicBrainzMetadataCache.upsert({
      where: { mbid },
      create: {
        mbid,
        entityType,
        metadata: JSON.stringify(metadata),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        metadata: JSON.stringify(metadata),
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
    return metadata;
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema updates and migration
- [ ] `MetadataResolutionService` implementation
- [ ] Basic API endpoints for metadata sources
- [ ] Simple UI indicator showing metadata source per field

### Phase 2: Identification (Week 3-4)
- [ ] `IdentificationService` implementation
- [ ] "Identify Album" modal with MusicBrainz search
- [ ] Confidence scoring algorithm
- [ ] Accept/reject identification workflow

### Phase 3: Editing (Week 5-6)
- [ ] Edit metadata modal with source dropdown
- [ ] User override functionality
- [ ] Metadata preference management
- [ ] Field-level source switching

### Phase 4: Batch Operations (Week 7)
- [ ] Batch identification for multiple albums
- [ ] Apply preferences to all albums by artist
- [ ] Auto-identification for high-confidence matches

### Phase 5: Advanced Features (Week 8+)
- [ ] Work identification and editing
- [ ] Track-level identification
- [ ] Metadata conflict resolution UI
- [ ] Import/export metadata preferences

---

## Benefits

1. **User Control**: Users decide which metadata to use per field
2. **Non-Destructive**: Original Plex metadata always preserved
3. **Flexible**: Can mix and match metadata sources
4. **Intelligent**: Automatic identification with confidence scoring
5. **Scalable**: Batch operations for large libraries
6. **Maintainable**: Clear separation of concerns, cached MB data

---

## Considerations

### Data Safety
- All changes are additive (user overrides, preferences)
- Original Plex metadata never deleted
- Can always revert to Plex data by clearing preferences
- Safe for Docker/Unraid deployment

### Performance
- MusicBrainz rate limiting (1 req/sec) handled by existing infrastructure
- Cache MusicBrainz metadata for 30 days
- Batch operations use queuing to avoid rate limits

### User Experience
- Progressive enhancement: works with existing data
- Clear visual indicators of metadata source
- Confirmation dialogs for bulk operations
- Undo functionality for recent changes

---

## Questions for Discussion

1. Should we auto-identify albums on first sync, or require manual trigger?
2. What confidence threshold should trigger automatic acceptance?
3. Should we support metadata import/export for backup?
4. Do we need a "metadata review queue" for uncertain matches?
5. Should Works have their own identification workflow separate from albums?

---

## Next Steps

1. Review and approve proposal
2. Prioritize phases based on user needs
3. Create detailed technical specs for Phase 1
4. Begin database schema implementation
5. Build prototype of identification modal for user testing
