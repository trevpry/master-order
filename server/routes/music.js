const express = require('express');
const router = express.Router();
const PlexDatabaseService = require('../plexDatabaseService');
const fetch = require('node-fetch');
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

const prisma = require('../prismaClient'); // Use shared singleton instance
const plexDb = new PlexDatabaseService();

// Music Sections
router.get('/sections', asyncHandler(async (req, res) => {
  const sections = await prisma.plexLibrarySection.findMany({
    where: { type: 'artist' },
    orderBy: { title: 'asc' }
  });
  res.json(sections);
}));

// Music Stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await plexDb.getMusicStats();
  res.json(stats);
}));

// Music Collections
router.get('/collections', asyncHandler(async (req, res) => {
  const { section } = req.query;
  
  let artistCollections, albumCollections;
  
  if (section && section !== 'all') {
    // Filter collections by section
    artistCollections = await plexDb.getAllMusicArtistCollectionsBySection(section);
    albumCollections = await plexDb.getAllMusicAlbumCollectionsBySection(section);
  } else {
    // Get all collections
    artistCollections = await plexDb.getAllMusicArtistCollections();
    albumCollections = await plexDb.getAllMusicAlbumCollections();
  }
  
  // Combine and deduplicate collections
  const allCollections = [...new Set([...artistCollections, ...albumCollections])];
  
  // Format for response
  const formattedCollections = allCollections
    .sort()
    .map(collection => ({
      value: collection,
      label: collection,
      type: 'music'
    }));
  
  res.json(formattedCollections);
}));

// Plex Music Playlists
router.get('/playlists', asyncHandler(async (req, res) => {
  const playlists = await prisma.plexPlaylist.findMany({
    where: { playlistType: 'audio' },
    orderBy: { title: 'asc' }
  });
  res.json(playlists);
}));

// Custom Music Playlists - List
router.get('/custom-playlists', asyncHandler(async (req, res) => {
  const playlists = await prisma.customPlaylist.findMany({
    include: {
      tracks: {
        orderBy: { sortOrder: 'asc' }
      },
      _count: {
        select: { tracks: true }
      }
    },
    orderBy: { title: 'asc' }
  });
  
  res.json(playlists.map(playlist => ({
    ...playlist,
    trackCount: playlist._count.tracks
  })));
}));

// Custom Music Playlists - Create
router.post('/custom-playlists', validateRequiredFields('title', 'Playlist title is required'), asyncHandler(async (req, res) => {
  const { title, description, isPublic } = req.body;
  
  if (title.trim() === '') {
    return sendBadRequest(res, 'Playlist title is required');
  }
  
  const playlist = await prisma.customPlaylist.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      isPublic: isPublic || false,
      createdBy: 'User' // TODO: Use actual user context
    },
    include: {
      _count: {
        select: { tracks: true }
      }
    }
  });
  
  res.status(201).json({
    ...playlist,
    trackCount: playlist._count.tracks
  });
}));

// Custom Music Playlists - Delete
router.delete('/custom-playlists/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await prisma.customPlaylist.delete({
    where: { id: parseInt(id) }
  });
  
  res.json({ message: 'Custom playlist deleted successfully' });
}));

// Add Track to Custom Playlist
router.post('/custom-playlists/:id/tracks', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trackRatingKey, title, artist, album, duration } = req.body;
  
  if (!trackRatingKey) {
    return res.status(400).json({ error: 'trackRatingKey is required' });
  }
  
  // Check if track exists
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: trackRatingKey }
  });
  
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }
  
  // Check if track is already in the playlist
  const existingTrack = await prisma.customPlaylistTrack.findFirst({
    where: {
      playlistId: parseInt(id),
      ratingKey: trackRatingKey
    }
  });
  
  if (existingTrack) {
    return res.status(409).json({ error: 'Track already exists in this playlist' });
  }
  
  // Get the current highest sort order
  const maxSortOrder = await prisma.customPlaylistTrack.aggregate({
    where: { playlistId: parseInt(id) },
    _max: { sortOrder: true }
  });
  
  const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1;
  
  const playlistTrack = await prisma.customPlaylistTrack.create({
    data: {
      playlistId: parseInt(id),
      ratingKey: trackRatingKey,
      title: title,
      artist: artist,
      album: album,
      duration: duration,
      sortOrder: nextSortOrder
    }
  });
  
  res.status(201).json(playlistTrack);
}));

// Remove Track from Custom Playlist
router.delete('/custom-playlists/:id/tracks/:trackId', asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  
  await prisma.customPlaylistTrack.delete({
    where: { id: parseInt(trackId) }
  });
  
  res.json({ message: 'Track removed from playlist successfully' });
}));

// Music Artists - All
router.get('/artists', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    // For search, get all matching artists (existing behavior for compatibility)
    const artists = await plexDb.searchArtists(search);
    res.json(artists);
  } else {
    // For regular requests, use pagination
    const artists = await plexDb.getAllArtists(parseInt(limit), offset);
    const totalArtists = await plexDb.getArtistsCount();
    
    res.json({
      artists,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalArtists / limit),
      totalArtists
    });
  }
}));

// Music Artists - By Section
router.get('/artists/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  console.log(`Artists requested for section: ${sectionKey}, page: ${pageNum}, limit: ${limitNum}, search: ${search}`);

  let artists;
  let total;

  if (search) {
    artists = await plexDb.searchArtistsBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.getArtistsBySectionCount(sectionKey); // For simplicity, using section total
  } else {
    artists = await plexDb.getArtistsBySection(sectionKey, limitNum, offset);
    total = await plexDb.getArtistsBySectionCount(sectionKey);
  }

  console.log(`Returning ${artists.length} artists for section ${sectionKey}, total: ${total}`);

  res.json({
    artists,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalArtists: total
  });
}));

// Music Artists - Single Artist
router.get('/artists/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  
  const artist = await plexDb.getArtistByRatingKey(ratingKey);
  if (!artist) {
    return res.status(404).json({ error: 'Artist not found' });
  }
  
  res.json(artist);
}));

// Music Albums - All
router.get('/albums', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    const albums = await plexDb.searchAlbums(search);
    res.json(albums);
  } else {
    const albums = await plexDb.getAllAlbums(parseInt(limit), offset);
    const totalAlbums = await plexDb.getAlbumsCount();
    
    res.json({
      albums,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalAlbums / limit),
      totalAlbums
    });
  }
}));

// Music Albums - By Section
router.get('/albums/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let albums;
  let total;

  if (search) {
    albums = await plexDb.searchAlbumsBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.getAlbumsBySectionCount(sectionKey);
  } else {
    albums = await plexDb.getAlbumsBySection(sectionKey, limitNum, offset);
    total = await plexDb.getAlbumsBySectionCount(sectionKey);
  }

  res.json({
    albums,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalAlbums: total
  });
}));

// Music Albums - By Artist
router.get('/albums/artist/:artistRatingKey', asyncHandler(async (req, res) => {
  const { artistRatingKey } = req.params;

  const albums = await plexDb.getAlbumsByArtist(artistRatingKey);

  res.json(albums);
}));

// Music Albums - Single Album
router.get('/albums/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const album = await plexDb.getAlbumByRatingKey(ratingKey);
  
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }
  
  res.json(album);
}));

// Music Albums - By Custom Playlist (albums that have tracks in the playlist)
router.get('/albums/playlist/:playlistId', asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Get unique albums that have tracks in this custom playlist
  const albumsWithTracks = await prisma.plexAlbum.findMany({
    where: {
      tracks: {
        some: {
          ratingKey: {
            in: await prisma.customPlaylistTrack.findMany({
              where: { playlistId: parseInt(playlistId) },
              select: { ratingKey: true }
            }).then(tracks => tracks.map(t => t.ratingKey))
          }
        }
      }
    },
    orderBy: { title: 'asc' },
    skip: offset,
    take: limitNum,
    include: {
      artist: true,
      librarySection: true
    }
  });

  // Get total count for pagination
  const totalCount = await prisma.plexAlbum.count({
    where: {
      tracks: {
        some: {
          ratingKey: {
            in: await prisma.customPlaylistTrack.findMany({
              where: { playlistId: parseInt(playlistId) },
              select: { ratingKey: true }
            }).then(tracks => tracks.map(t => t.ratingKey))
          }
        }
      }
    }
  });

  res.json({
    albums: albumsWithTracks,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalCount / limitNum),
    totalAlbums: totalCount
  });
}));

// Music Albums - NOT in Custom Playlist (albums that have NO tracks in the playlist)
router.get('/albums/not-in-playlist/:playlistId', asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Get track rating keys that are in this playlist
  const playlistTrackRatingKeys = await prisma.customPlaylistTrack.findMany({
    where: { playlistId: parseInt(playlistId) },
    select: { ratingKey: true }
  }).then(tracks => tracks.map(t => t.ratingKey));

  // Get albums that have NO tracks in the playlist
  const albumsNotInPlaylist = await prisma.plexAlbum.findMany({
    where: {
      NOT: {
        tracks: {
          some: {
            ratingKey: {
              in: playlistTrackRatingKeys
            }
          }
        }
      }
    },
    orderBy: { title: 'asc' },
    skip: offset,
    take: limitNum,
    include: {
      artist: true,
      librarySection: true
    }
  });

  // Get total count for pagination
  const totalCount = await prisma.plexAlbum.count({
    where: {
      NOT: {
        tracks: {
          some: {
            ratingKey: {
              in: playlistTrackRatingKeys
            }
          }
        }
      }
    }
  });

  res.json({
    albums: albumsNotInPlaylist,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalCount / limitNum),
    totalAlbums: totalCount
  });
}));

// Extract File Metadata from Album
router.post('/albums/:ratingKey/extract-file-metadata', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  
  // Get album and its tracks using PlexDatabaseService
  const album = await plexDb.getAlbumByRatingKey(ratingKey);
  
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }
  
  // Get tracks for this album
  const tracks = await plexDb.getTracksByAlbum(ratingKey);
  
  // TODO: Implement file metadata extraction logic
  // This would typically involve reading audio file metadata
  
  res.json({ 
    message: 'File metadata extraction initiated for album',
    albumTitle: album.title,
    trackCount: tracks.length
  });
}));

// Music Tracks - All
router.get('/tracks', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    const tracks = await plexDb.searchTracks(search);
    res.json(tracks);
  } else {
    const tracks = await plexDb.getAllTracks(parseInt(limit), offset);
    const totalTracks = await plexDb.getTracksCount();
    
    res.json({
      tracks,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalTracks / limit),
      totalTracks
    });
  }
}));

// Music Tracks - By Section
router.get('/tracks/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let tracks;
  let total;

  if (search) {
    tracks = await plexDb.searchTracksBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.getTracksBySectionCount(sectionKey);
  } else {
    tracks = await plexDb.getTracksBySection(sectionKey, limitNum, offset);
    total = await plexDb.getTracksBySectionCount(sectionKey);
  }

  res.json({
    tracks,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalTracks: total
  });
}));

// Get tracks by album
router.get('/tracks/album/:albumRatingKey', asyncHandler(async (req, res) => {
  const { albumRatingKey } = req.params;
  const tracks = await plexDb.getTracksByAlbum(albumRatingKey);
  res.json(tracks);
}));

// Get tracks by artist
router.get('/tracks/artist/:artistRatingKey', asyncHandler(async (req, res) => {
  const { artistRatingKey } = req.params;
  const tracks = await plexDb.getTracksByArtist(artistRatingKey);
  res.json(tracks);
}));

// Music streaming endpoint - Stream audio track from Plex
router.get('/stream/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.status(500).json({ error: 'Plex configuration not found' });
  }

  // Get track details to verify it exists
  const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
  const trackResponse = await fetch(trackUrl, {
    headers: {
      'X-Plex-Token': settings.plexToken,
      'Accept': 'application/json'
    }
  });

  if (!trackResponse.ok) {
    return res.status(404).json({ error: 'Track not found' });
  }

  const trackData = await trackResponse.json();
  const track = trackData.MediaContainer?.Metadata?.[0];
  
  if (!track) {
    return res.status(404).json({ error: 'Track metadata not found' });
  }

  // Get the media part for streaming
  const mediaPart = track.Media?.[0]?.Part?.[0];
  if (!mediaPart) {
    return res.status(404).json({ error: 'No media part found for track' });
  }

  // Construct Plex stream URL
  const streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
  
  console.log(`🎵 Streaming track: ${track.title} by ${track.originalTitle || track.grandparentTitle}`);
  console.log(`🔗 Stream URL: ${streamUrl}`);

  // Set appropriate headers for audio streaming
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');

  // Stream the audio from Plex
  const streamResponse = await fetch(streamUrl, {
    headers: {
      'Range': req.headers.range || 'bytes=0-',
      'User-Agent': 'Eddie-Life-Management/1.0'
    }
  });

  if (!streamResponse.ok) {
    console.error(`❌ Failed to get stream from Plex: ${streamResponse.status} ${streamResponse.statusText}`);
    console.error(`   Stream URL: ${streamUrl}`);
    return res.status(streamResponse.status).json({ error: `Failed to stream from Plex: ${streamResponse.statusText}` });
  }

  console.log(`✅ Successfully got stream from Plex: ${streamResponse.status}`);

  // Copy relevant headers from Plex response
  const contentType = streamResponse.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  
  if (streamResponse.headers.get('content-length')) {
    res.setHeader('Content-Length', streamResponse.headers.get('content-length'));
  }
  if (streamResponse.headers.get('content-range')) {
    res.setHeader('Content-Range', streamResponse.headers.get('content-range'));
  }
  if (streamResponse.headers.get('accept-ranges')) {
    res.setHeader('Accept-Ranges', streamResponse.headers.get('accept-ranges'));
  }

  // Set status code for range requests
  if (req.headers.range && streamResponse.status === 206) {
    res.status(206);
  }

  // Handle stream errors
  streamResponse.body.on('error', (error) => {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream error occurred' });
    }
  });

  // Pipe the stream
  streamResponse.body.pipe(res);
}));

// Music streaming debug endpoint
router.get('/debug/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.json({ 
      error: 'Plex configuration not found',
      hasSettings: !!settings,
      hasPlexUrl: !!(settings && settings.plexUrl),
      hasPlexToken: !!(settings && settings.plexToken)
    });
  }

  // Get track details
  const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
  const trackResponse = await fetch(trackUrl, {
    headers: {
      'X-Plex-Token': settings.plexToken,
      'Accept': 'application/json'
    }
  });

  const trackData = await trackResponse.json();
  const track = trackData.MediaContainer?.Metadata?.[0];
  const mediaPart = track?.Media?.[0]?.Part?.[0];
  
  res.json({
    success: true,
    track: {
      title: track?.title,
      artist: track?.originalTitle || track?.grandparentTitle,
      album: track?.parentTitle,
      ratingKey: track?.ratingKey,
      duration: track?.duration
    },
    media: {
      hasMedia: !!track?.Media,
      hasPart: !!mediaPart,
      partKey: mediaPart?.key,
      container: mediaPart?.container,
      size: mediaPart?.size
    },
    streamUrl: mediaPart ? `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}` : null,
    plexUrl: settings.plexUrl
  });
}));

// Update track rating
router.put('/tracks/:ratingKey/rating', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { rating } = req.body;
  
  console.log(`📊 Updating rating for track ${ratingKey} to ${rating}`);
  
  // Validate rating (0-10, where 0 removes the rating)
  if (rating !== undefined && (rating < 0 || rating > 10)) {
    return res.status(400).json({ error: 'Rating must be between 0 and 10' });
  }
  
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.status(500).json({ error: 'Plex configuration not found' });
  }
  
  try {
    // Update rating in Plex server
    // Plex uses a rating scale of 0-10 (0 = no rating)
    const plexRatingUrl = `${settings.plexUrl}/:/rate?key=${ratingKey}&identifier=com.plexapp.plugins.library&rating=${rating}`;
    console.log(`📊 Sending rating to Plex: ${plexRatingUrl}`);
    
    const plexResponse = await fetch(plexRatingUrl, {
      method: 'PUT',
      headers: {
        'X-Plex-Token': settings.plexToken,
        'Accept': 'application/json'
      }
    });
    
    if (!plexResponse.ok) {
      console.error('Failed to update rating in Plex:', await plexResponse.text());
      return res.status(500).json({ error: 'Failed to update rating in Plex' });
    }
    
    console.log('📊 Plex rating updated successfully');
    
    // Update rating in local database
    const updatedTrack = await prisma.plexTrack.update({
      where: { ratingKey },
      data: { 
        userRating: rating === 0 ? null : rating
      },
      include: {
        album: {
          include: {
            artist: true
          }
        }
      }
    });
    
    console.log(`📊 Database updated: userRating = ${updatedTrack.userRating}`);
    
    res.json({
      success: true,
      track: updatedTrack
    });
  } catch (error) {
    console.error('Error updating track rating:', error);
    res.status(500).json({ error: 'Failed to update track rating' });
  }
}));

module.exports = router;
