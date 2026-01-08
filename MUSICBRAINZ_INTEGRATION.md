# MusicBrainz Integration

## Overview
The MusicBrainz integration allows you to search for and view detailed metadata about artists from the MusicBrainz database. MusicBrainz is a comprehensive, open-source music encyclopedia that provides rich metadata about artists, albums, recordings, and more.

## Features

### Artist Search
- Search MusicBrainz by artist name
- View search results with basic metadata (type, country, active years, disambiguation)
- See top tags/genres for each search result

### Artist Details
When you select an artist from search results, you can view:
- **Basic Information**: Name, sort name, type (Person/Group/etc.), country
- **Life Span**: Active years (begin - end or begin - present)
- **Aliases**: Alternative names and locale-specific names
- **Genres**: Community-tagged genres with vote counts
- **Tags**: Additional community tags beyond genres
- **Ratings**: Community ratings (out of 5 stars)
- **External Links**: URLs to official websites, social media, streaming platforms
- **MusicBrainz ID (MBID)**: Unique identifier with direct link to MusicBrainz website

## Usage

1. Navigate to an artist's detail page in the Music section
2. Click the **"🎵 MusicBrainz Search"** button in the header
3. The modal will automatically search for the artist
4. Browse the search results on the left panel
5. Click any result to view detailed information in the right panel
6. Click "View on MusicBrainz →" to open the full MusicBrainz page

## API Rate Limiting

MusicBrainz requires all API users to:
- Make **no more than 1 request per second**
- Use a **meaningful User-Agent string**

Our implementation automatically handles rate limiting by:
- Tracking the last request time
- Waiting at least 1.1 seconds between requests
- Setting a proper User-Agent: `EddieLifeManagement/1.0.0`

## Technical Implementation

### Backend Route: `/api/musicbrainz`

**Search for artists:**
```
GET /api/musicbrainz/search/artist?query=artist+name&limit=10
```

**Get artist details:**
```
GET /api/musicbrainz/artist/:mbid?inc=aliases+tags+genres+ratings+url-rels
```

**Browse artist releases:**
```
GET /api/musicbrainz/artist/:mbid/releases?limit=100
```

**Browse artist release groups:**
```
GET /api/musicbrainz/artist/:mbid/release-groups?type=album&limit=100
```

**Browse artist recordings:**
```
GET /api/musicbrainz/artist/:mbid/recordings?limit=100
```

### Components

**MusicBrainzSearchModal** (`client/src/components/music/MusicBrainzSearchModal.jsx`)
- Modal dialog for searching and viewing MusicBrainz data
- Two-panel layout: search results on left, details on right
- Automatically searches when opened with artist name

**ArtistDetail** (`client/src/modules/media/pages/music/components/ArtistDetail.jsx`)
- Updated to include MusicBrainz Search button in header
- Passes artist name to search modal

### Server Route (`server/routes/musicbrainz.js`)
- Proxies requests to MusicBrainz API
- Handles rate limiting (1 request per second)
- Sets proper User-Agent header
- Returns JSON format responses

## MusicBrainz API Documentation

Full API documentation: https://musicbrainz.org/doc/MusicBrainz_API

Key concepts:
- **MBID**: MusicBrainz Identifier - unique UUID for each entity
- **inc= parameters**: Include additional related data (aliases, tags, genres, relationships)
- **Rate limiting**: Maximum 1 request per second (we use 1.1s to be safe)
- **User-Agent**: Required for all requests, format: "ApplicationName/Version"

## Future Enhancements

Potential improvements for the future:
- Import artist metadata from MusicBrainz to update local database
- Link MusicBrainz IDs to local artists for permanent association
- Browse albums and recordings from MusicBrainz
- Match Plex artists to MusicBrainz artists automatically
- Display MusicBrainz artwork/images
- Add ability to submit data back to MusicBrainz (requires OAuth authentication)

## License & Attribution

This application uses the MusicBrainz API:
- MusicBrainz is free for **non-commercial use**
- Data is licensed under CC0 (public domain)
- API is provided by MetaBrainz Foundation
- Commercial use requires sponsorship: https://metabrainz.org/supporters/account-type

When displaying MusicBrainz data, we provide:
- Direct links to MusicBrainz.org for each artist
- Proper attribution in the UI with MusicBrainz branding colors
- Respect for rate limiting requirements
