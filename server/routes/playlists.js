const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get available playlists for linking to custom orders
router.get('/available', async (req, res) => {
  try {
    const [plexPlaylists, customPlaylists] = await Promise.all([
      prisma.plexPlaylist.findMany({
        select: {
          ratingKey: true,
          title: true,
          playlistType: true,
          leafCount: true,
          duration: true
        },
        orderBy: { title: 'asc' }
      }),
      prisma.customPlaylist.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          isPublic: true,
          createdBy: true,
          _count: {
            select: { tracks: true }
          }
        },
        orderBy: { title: 'asc' }
      })
    ]);

    res.json({
      plexPlaylists,
      customPlaylists: customPlaylists.map(playlist => ({
        ...playlist,
        trackCount: playlist._count.tracks
      }))
    });
  } catch (error) {
    console.error('Error fetching available playlists:', error);
    res.status(500).json({ error: 'Failed to fetch available playlists' });
  }
});

module.exports = router;
