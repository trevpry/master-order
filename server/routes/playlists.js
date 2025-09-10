const express = require('express');
const router = express.Router();
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient'); // Use shared singleton instance

// Get available playlists for linking to custom orders
router.get('/available', asyncHandler(async (req, res) => {
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
}));

module.exports = router;
