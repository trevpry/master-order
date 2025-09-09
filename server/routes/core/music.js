/**
 * Core Music Routes
 * Handles music sections, artists, albums, tracks, and playlist management
 */

const express = require('express');

/**
 * Create music management routes
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createMusicRoutes(prisma, services) {
  const router = express.Router();
  
  // Initialize dependencies
  const plexDb = require('../../plexDatabaseService');

  // Music sections
  router.get('/api/music/sections', async (req, res) => {
    try {
      const sections = await plexDb.getMusicSections();
      console.log('Returning music sections:', sections);
      res.json(sections);
    } catch (error) {
      console.error('Error fetching music sections:', error);
      res.status(500).json({ error: 'Failed to fetch music sections' });
    }
  });

  // Music statistics
  router.get('/api/music/stats', async (req, res) => {
    try {
      const stats = await plexDb.getMusicStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching music statistics:', error);
      res.status(500).json({ error: 'Failed to fetch music statistics' });
    }
  });

  // Music collections
  router.get('/api/music/collections', async (req, res) => {
    try {
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
    } catch (error) {
      console.error('Error fetching music collections:', error);
      res.status(500).json({ error: 'Failed to fetch music collections' });
    }
  });

  // Plex playlists
  router.get('/api/music/playlists', async (req, res) => {
    try {
      const playlists = await plexDb.getAllPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error('Error fetching music playlists:', error);
      res.status(500).json({ error: 'Failed to fetch music playlists' });
    }
  });

  // Custom playlists
  router.get('/api/music/custom-playlists', async (req, res) => {
    try {
      const customPlaylists = await prisma.customPlaylist.findMany({
        include: {
          tracks: {
            orderBy: {
              sortOrder: 'asc'
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
      res.json(customPlaylists);
    } catch (error) {
      console.error('Error fetching custom playlists:', error);
      res.status(500).json({ error: 'Failed to fetch custom playlists' });
    }
  });

  // Create custom playlist
  router.post('/api/music/custom-playlists', async (req, res) => {
    try {
      const { title, description, isPublic, createdBy } = req.body;
      
      if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Playlist title is required' });
      }

      const customPlaylist = await prisma.customPlaylist.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          isPublic: isPublic || false,
          createdBy: createdBy || 'User'
        },
        include: {
          tracks: {
            orderBy: {
              sortOrder: 'asc'
            }
          }
        }
      });

      res.status(201).json(customPlaylist);
    } catch (error) {
      console.error('Error creating custom playlist:', error);
      res.status(500).json({ error: 'Failed to create custom playlist' });
    }
  });

  // Delete custom playlist
  router.delete('/api/music/custom-playlists/:id', async (req, res) => {
    try {
      const playlistId = parseInt(req.params.id);
      
      // Check if playlist exists
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: playlistId }
      });
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Delete the playlist (tracks will be deleted due to cascade)
      await prisma.customPlaylist.delete({
        where: { id: playlistId }
      });

      res.json({ message: 'Playlist deleted successfully' });
    } catch (error) {
      console.error('Error deleting custom playlist:', error);
      res.status(500).json({ error: 'Failed to delete custom playlist' });
    }
  });

  // Add track to playlist
  router.post('/api/music/custom-playlists/:id/tracks', async (req, res) => {
    try {
      const playlistId = parseInt(req.params.id);
      const { ratingKey, title, artist, album, duration } = req.body;
      
      if (!ratingKey || !title) {
        return res.status(400).json({ error: 'Track ratingKey and title are required' });
      }

      // Check if playlist exists
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: playlistId }
      });
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Check if track is already in the playlist
      const existingTrack = await prisma.customPlaylistTrack.findFirst({
        where: {
          playlistId: playlistId,
          ratingKey: ratingKey
        }
      });

      if (existingTrack) {
        return res.status(409).json({ error: 'Track is already in this playlist' });
      }

      // Get the next sort order
      const lastTrack = await prisma.customPlaylistTrack.findFirst({
        where: { playlistId: playlistId },
        orderBy: { sortOrder: 'desc' }
      });
      
      const nextSortOrder = (lastTrack?.sortOrder || 0) + 1;

      // Add the track to the playlist
      const playlistTrack = await prisma.customPlaylistTrack.create({
        data: {
          playlistId: playlistId,
          ratingKey: ratingKey,
          title: title,
          artist: artist || null,
          album: album || null,
          duration: duration ? parseInt(duration) : null,
          sortOrder: nextSortOrder
        }
      });

      // Update playlist's updatedAt timestamp
      await prisma.customPlaylist.update({
        where: { id: playlistId },
        data: { updatedAt: new Date() }
      });

      res.status(201).json(playlistTrack);
    } catch (error) {
      console.error('Error adding track to custom playlist:', error);
      res.status(500).json({ error: 'Failed to add track to playlist' });
    }
  });

  // Remove track from playlist
  router.delete('/api/music/custom-playlists/:id/tracks/:trackId', async (req, res) => {
    try {
      const playlistId = parseInt(req.params.id);
      const trackId = parseInt(req.params.trackId);
      
      // Check if playlist exists
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: playlistId }
      });
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Check if track exists in playlist
      const track = await prisma.customPlaylistTrack.findFirst({
        where: {
          id: trackId,
          playlistId: playlistId
        }
      });

      if (!track) {
        return res.status(404).json({ error: 'Track not found in playlist' });
      }

      // Delete the track
      await prisma.customPlaylistTrack.delete({
        where: { id: trackId }
      });

      // Update playlist's updatedAt timestamp
      await prisma.customPlaylist.update({
        where: { id: playlistId },
        data: { updatedAt: new Date() }
      });

      res.json({ message: 'Track removed from playlist successfully' });
    } catch (error) {
      console.error('Error removing track from custom playlist:', error);
      res.status(500).json({ error: 'Failed to remove track from playlist' });
    }
  });

  return router;
}

module.exports = createMusicRoutes;
