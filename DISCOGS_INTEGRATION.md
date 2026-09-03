# Discogs Integration

## Overview

The Discogs integration allows you to import album, track, and work metadata from Discogs releases into your local music library. This feature enables you to:

- Import album metadata from Discogs releases
- Map local tracks to Discogs tracks
- Link imported tracks to works
- Update album and track metadata with Discogs data

## API Endpoint

### POST `/api/music/albums/:ratingKey/discogs-import`

Import Discogs metadata for a specific album.

#### Request Body

```json
{
  "url": "https://www.discogs.com/release/123456",
  "apply": false,
  "trackMappings": [],
  "excludedCreditKeys": []
}
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | Discogs release URL (required) |
| `apply` | boolean | Whether to apply changes to the database (default: false) |
| `trackMappings` | array | Track mapping configuration |
| `excludedCreditKeys` | array | Credit keys to exclude |

#### Response

```json
{
  "success": true,
  "data": {
    "discogs": {
      "sourceKind": "release",
      "releaseId": 123456,
      "title": "Album Title",
      "artist": "Artist Name",
      "tracks": [...],
      "credits": [...],
      "mapping": {
        "defaultTrackMappings": [...],
        "mappedTrackCount": 0,
        "localTrackCount": 10,
        "sourceTrackCount": 12
      }
    },
    "album": {
      "title": "Local Album Title",
      "discogsTitle": "Discogs Album Title"
    },
    "mapping": {
      "defaultTrackMappings": [...],
      "mappedTrackCount": 0,
      "localTrackCount": 10,
      "sourceTrackCount": 12
    },
    "credits": [...]
  }
}
```

## DiscogsService Class

The `DiscogsService` class provides methods to interact with the Discogs API:

### Methods

#### `getRelease(releaseId)`

Fetch release details by ID.

```javascript
const discogs = require('./services/discogsService');
const service = new discogs();
const release = await service.getRelease(123456);
```

#### `searchReleases(title, artist, limit)`

Search for releases by title and artist.

```javascript
const releases = await service.searchReleases('Album Title', 'Artist Name', 10);
```

#### `getArtist(artistId)`

Fetch artist details by ID.

```javascript
const artist = await service.getArtist(789012);
```

#### `searchArtists(name, limit)`

Search for artists by name.

```javascript
const artists = await service.searchArtists('Artist Name', 10);
```

#### `getLabel(labelId)`

Fetch label details by ID.

```javascript
const label = await service.getLabel(345678);
```

#### `searchLabels(name, limit)`

Search for labels by name.

```javascript
const labels = await service.searchLabels('Label Name', 10);
```

## Usage in Frontend

The frontend provides a modal to preview and apply Discogs imports:

1. Enter a Discogs release URL
2. Click "Import Discogs URL" to fetch metadata
3. Review the track mappings and artist credits
4. Click "Apply" to update the album and tracks

## Rate Limiting

The Discogs API enforces rate limiting:
- Authenticated requests: 60 requests per minute
- Unauthenticated requests: 25 requests per minute

The service implements rate limiting with exponential backoff to stay within these limits.

## Error Handling

The service includes retry logic for transient errors:
- 429 (Rate Limited): Wait and retry with exponential backoff
- Other errors: Retry up to 3 times with exponential backoff

## Configuration

No additional configuration is required. The service automatically uses the Discogs API v2.

## Notes

- The Discogs API requires a unique User-Agent header for all requests
- The service automatically handles the `{ data: {...} }` response format used by Discogs
- Track mappings are automatically generated based on track order
- Artist credits are grouped and can be selectively included/excluded
