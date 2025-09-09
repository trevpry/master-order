const express = require('express');
const { PrismaClient } = require('@prisma/client');
const PlexDatabaseService = require('../plexDatabaseService');
const WatchLogService = require('../watchLogService');
const WatchStatsRoutes = require('./watchStatsRoutes');
const { markCustomOrderItemAsWatched } = require('../databaseUtils');

const prisma = new PrismaClient();

// Factory function to create routes with io instance
function createWatchTrackingRoutes(io) {
  const router = express.Router();
  
  // Initialize services
  const plexDb = new PlexDatabaseService();
  const watchLogService = new WatchLogService(prisma);
  const StatisticsService = require('../services/statisticsService');
  const statisticsService = new StatisticsService(prisma, watchLogService);
  const watchStatsRoutes = new WatchStatsRoutes(watchLogService, statisticsService);

// Mark a custom order item as watched
router.post('/mark-custom-order-item-watched/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    // Get the custom order item details first to check what type of media it is
    const customOrderItem = await prisma.customOrderItem.findUnique({
      where: { id: parseInt(itemId) }
    });

    if (!customOrderItem) {
      return res.status(404).json({ error: 'Custom order item not found' });
    }

    // Mark the custom order item as watched
    await markCustomOrderItemAsWatched(itemId);

    // Create a watch log entry for statistics
    let duration = null;
    let mediaType = customOrderItem.mediaType;
    
    // Map custom order media types to watch log media types
    if (customOrderItem.mediaType === 'episode') {
      mediaType = 'tv';
    } else if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
      // For reading media, we don't have duration but we'll log them anyway
      mediaType = customOrderItem.mediaType;
    }

    // Try to get duration from Plex database if available
    if (customOrderItem.plexKey) {
      try {
        if (customOrderItem.mediaType === 'episode') {
          const episodeData = await plexDb.getItemMetadata(customOrderItem.plexKey, 'episode');
          if (episodeData && episodeData.duration) {
            duration = Math.round(episodeData.duration / 60000); // Convert milliseconds to minutes
          }
        } else if (customOrderItem.mediaType === 'movie') {
          const movieData = await plexDb.getMovieByRatingKey(customOrderItem.plexKey);
          if (movieData && movieData.duration) {
            duration = Math.round(movieData.duration / 60000); // Convert milliseconds to minutes
          }
        }
      } catch (error) {
        console.warn('Could not get duration from Plex database:', error.message);
      }
    }

    // For books, comics, and short stories, set completion status to 100%
    if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
      const updateData = {
        bookPercentRead: 100
      };
      
      // If we have page count but no current page, set current page to total pages
      if (customOrderItem.bookPageCount && !customOrderItem.bookCurrentPage) {
        updateData.bookCurrentPage = customOrderItem.bookPageCount;
      }
      
      await prisma.customOrderItem.update({
        where: { id: parseInt(itemId) },
        data: updateData
      });
      
      console.log(`Set ${customOrderItem.mediaType} "${customOrderItem.title}" to 100% completed`);
    }

    // Create watch log entry
    const watchLogParams = {
      mediaType: mediaType,
      title: customOrderItem.title,
      seriesTitle: customOrderItem.seriesTitle,
      seasonNumber: customOrderItem.seasonNumber,
      episodeNumber: customOrderItem.episodeNumber,
      plexKey: customOrderItem.plexKey,
      customOrderItemId: parseInt(itemId),
      duration: duration,
      activityType: (mediaType === 'book' || mediaType === 'comic' || mediaType === 'shortstory') ? 'read' : 'watch',
      isCompleted: true
    };

    await watchLogService.logWatched(watchLogParams);
    console.log(`Created watch log entry for custom order item ${itemId}`);

    // If this is an episode or movie with a plexKey, also mark it as watched in the Plex database
    if (customOrderItem.plexKey && (customOrderItem.mediaType === 'episode' || customOrderItem.mediaType === 'movie')) {
      try {
        if (customOrderItem.mediaType === 'episode') {
          await plexDb.markEpisodeAsWatched(customOrderItem.plexKey);
          console.log(`Marked episode ${customOrderItem.plexKey} as watched in Plex database`);
        } else if (customOrderItem.mediaType === 'movie') {
          await plexDb.markMovieAsWatched(customOrderItem.plexKey);
          console.log(`Marked movie ${customOrderItem.plexKey} as watched in Plex database`);
        }
      } catch (error) {
        console.error(`Error marking ${customOrderItem.mediaType} as watched in Plex database:`, error);
        // Continue anyway since the custom order item was marked as watched
      }
    }
    
    res.json({ success: true, message: 'Item marked as watched and logged for statistics' });
  } catch (error) {
    console.error('Error marking custom order item as watched:', error);
    res.status(500).json({ error: 'Failed to mark item as watched' });
  }
});

// Mark a general TV episode or movie as watched (for TV_GENERAL and MOVIES_GENERAL orders)
router.post('/mark-media-watched', async (req, res) => {
  try {
    const { mediaType, ratingKey, episodeRatingKey } = req.body;
    
    if (!mediaType || (!ratingKey && !episodeRatingKey)) {
      return res.status(400).json({ error: 'Media type and ratingKey (or episodeRatingKey for episodes) are required' });
    }

    try {
      let duration = null;
      let mediaData = null;
      let watchLogMediaType = mediaType;

      if (mediaType === 'episode') {
        // For episodes, use episodeRatingKey if available, otherwise ratingKey
        const episodeKey = episodeRatingKey || ratingKey;
        await plexDb.markEpisodeAsWatched(episodeKey);
        console.log(`Marked episode ${episodeKey} as watched in Plex database`);
        
        // Get episode data for watch log
        try {
          mediaData = await plexDb.getItemMetadata(episodeKey, 'episode');
          if (mediaData && mediaData.duration) {
            duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
          }
          watchLogMediaType = 'tv';
        } catch (error) {
          console.warn('Could not get episode data for watch log:', error.message);
        }
      } else if (mediaType === 'movie') {
        await plexDb.markMovieAsWatched(ratingKey);
        console.log(`Marked movie ${ratingKey} as watched in Plex database`);
        
        // Get movie data for watch log
        try {
          mediaData = await plexDb.getMovieByRatingKey(ratingKey);
          if (mediaData && mediaData.duration) {
            duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
          }
        } catch (error) {
          console.warn('Could not get movie data for watch log:', error.message);
        }
      } else {
        return res.status(400).json({ error: 'Unsupported media type. Only episode and movie are supported.' });
      }

      // Create watch log entry if we have media data
      if (mediaData) {
        const watchLogParams = {
          mediaType: watchLogMediaType,
          title: mediaData.title,
          seriesTitle: mediaData.seriesTitle || (mediaData.grandparentTitle || null),
          seasonNumber: mediaData.parentIndex || mediaData.seasonNumber || null,
          episodeNumber: mediaData.index || mediaData.episodeNumber || null,
          plexKey: mediaData.ratingKey || ratingKey || episodeRatingKey,
          duration: duration,
          activityType: 'watch',
          isCompleted: true
        };

        await watchLogService.logWatched(watchLogParams);
        console.log(`Created watch log entry for ${mediaType} ${ratingKey || episodeRatingKey}`);
      }
      
      res.json({ success: true, message: `${mediaType} marked as watched and logged for statistics` });
    } catch (error) {
      console.error(`Error marking ${mediaType} as watched in Plex database:`, error);
      res.status(500).json({ error: `Failed to mark ${mediaType} as watched in database` });
    }
  } catch (error) {
    console.error('Error in mark-media-watched endpoint:', error);
    res.status(500).json({ error: 'Failed to mark media as watched' });
  }
});

// ==================== READING SESSION ENDPOINTS ====================

// Start a reading session
router.post('/reading/start', async (req, res) => {
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Reading session start request:', { mediaType, title, seriesTitle, customOrderItemId });
    
    if (!mediaType || !title) {
      console.log('Missing required fields - mediaType or title');
      return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
    }

    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return res.status(400).json({ error: 'Invalid media type for reading' });
    }

    // Validate customOrderItemId if provided - Fix for foreign key constraint error
    let finalCustomOrderItemId = null;
    if (customOrderItemId) {
      const parsedId = parseInt(customOrderItemId);
      if (Number.isInteger(parsedId)) {
        // Verify the customOrderItem exists before using it
        const existingItem = await prisma.customOrderItem.findUnique({
          where: { id: parsedId }
        });
        
        if (existingItem) {
          finalCustomOrderItemId = parsedId;
          console.log(`✅ Validated customOrderItemId: ${finalCustomOrderItemId}`);
        } else {
          console.log(`⚠️  CustomOrderItem ${parsedId} not found - proceeding without link`);
        }
      } else {
        console.log('⚠️  Invalid customOrderItemId format - proceeding without link');
      }
    }
    
    const readingSession = await watchLogService.startReading({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('Reading session started successfully:', readingSession.id);
    
    // Emit Android companion app message if this is part of a custom order
    if (customOrderItemId) {
      try {
        const customOrderItem = await prisma.customOrderItem.findUnique({
          where: { id: parseInt(customOrderItemId) },
          include: {
            customOrder: {
              include: {
                plexPlaylist: true,
                customPlaylist: {
                  include: {
                    _count: {
                      select: { tracks: true }
                    }
                  }
                }
              }
            }
          }
        });

        if (customOrderItem?.customOrder) {
          const customOrder = customOrderItem.customOrder;
          
          // Build Android companion app message
          let androidMessage = {
            action: 'START_READ_SESSION',
            mediaTitle: title,
            mediaType: mediaType,
            customOrderName: customOrder.name,
            customOrderDescription: customOrder.description,
            timestamp: new Date().toISOString()
          };

          // Add playlist information if available
          if (customOrder.plexPlaylist || customOrder.customPlaylist) {
            if (customOrder.plexPlaylist) {
              androidMessage.playlistName = customOrder.plexPlaylist.title;
              androidMessage.playlistPath = `plex://playlist/${customOrder.plexPlaylist.ratingKey}`;
              androidMessage.playlistType = 'plex';
              androidMessage.playlistTrackCount = customOrder.plexPlaylist.leafCount || 0;
              androidMessage.playlistMetadata = {
                ratingKey: customOrder.plexPlaylist.ratingKey,
                playlistType: customOrder.plexPlaylist.playlistType || 'audio',
                duration: customOrder.plexPlaylist.duration
              };
            } else if (customOrder.customPlaylist) {
              // Transform custom playlist to include trackCount
              customOrder.customPlaylist.trackCount = customOrder.customPlaylist._count?.tracks || 0;
              
              androidMessage.playlistName = customOrder.customPlaylist.title;
              androidMessage.playlistPath = `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/custom-playlists/${customOrder.customPlaylist.id}/play`;
              androidMessage.playlistType = 'custom';
              androidMessage.playlistTrackCount = customOrder.customPlaylist.trackCount;
              androidMessage.playlistDescription = customOrder.customPlaylist.description;
              androidMessage.playlistMetadata = {
                id: customOrder.customPlaylist.id,
                trackCount: customOrder.customPlaylist.trackCount,
                isPublic: customOrder.customPlaylist.isPublic,
                createdBy: customOrder.customPlaylist.createdBy
              };
            }
          } else {
            androidMessage.note = 'Custom order has no linked playlist';
          }

          // Emit to Android companion app clients
          console.log('📱 Emitting Android companion app message:', JSON.stringify(androidMessage, null, 2));
          io.emit('androidCompanion', androidMessage);
        }
      } catch (error) {
        console.warn('Could not fetch custom order info for Android companion app:', error);
      }
    } else {
      // Still emit a message for standalone reading sessions
      const androidMessage = {
        action: 'START_READ_SESSION',
        mediaTitle: title,
        mediaType: mediaType,
        note: 'Standalone reading session - not part of a custom order',
        timestamp: new Date().toISOString()
      };
      
      console.log('📱 Emitting Android companion app message (standalone):', JSON.stringify(androidMessage, null, 2));
      io.emit('androidCompanion', androidMessage);
    }
    
    res.json(readingSession);
  } catch (error) {
    console.error('Error starting reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause/Resume the active reading session
router.post('/reading/pause', async (req, res) => {
  try {
    console.log('Attempting to pause/resume reading session...');
    
    // Find the active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active reading session found');
      return res.status(404).json({ error: 'No active reading session found' });
    }

    console.log('Pausing/resuming session with ID:', activeSession.id);
    const updatedSession = await watchLogService.pauseReading(activeSession.id);
    console.log('Session paused/resumed successfully');
    res.json(updatedSession);
  } catch (error) {
    console.error('Error pausing reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop the active reading session
router.post('/reading/stop', async (req, res) => {
  try {
    console.log('Attempting to stop reading session...');
    const { progress } = req.body;
    
    // Find the active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active reading session found');
      return res.status(404).json({ error: 'No active reading session found' });
    }

    console.log('Stopping session with ID:', activeSession.id);
    
    // Stop the reading session
    const completedSession = await watchLogService.stopReading(activeSession.id);
    
    // Update reading progress if provided and session wasn't deleted
    if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
      console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        if (progress.currentPage !== undefined && progress.currentPage > 0) {
          updateData.bookCurrentPage = progress.currentPage;
        }
        
        if (progress.readPercentage !== undefined && progress.readPercentage >= 0 && progress.readPercentage <= 100) {
          updateData.bookPercentRead = progress.readPercentage;
          
          // If read percentage is 100%, mark as read/watched
          if (progress.readPercentage === 100) {
            updateData.isWatched = true;
            console.log('Marking item as read/watched (100% completion)');
          }
        }
        
        if (progress.totalPages !== undefined && progress.totalPages > 0) {
          // Also update the total page count if provided and not already set
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { bookPageCount: true }
          });
          
          if (!existingItem?.bookPageCount) {
            updateData.bookPageCount = progress.totalPages;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Reading progress updated successfully:', updateData);
        }
      } catch (progressError) {
        console.error('Error updating reading progress:', progressError);
        // Don't fail the whole request if progress update fails
      }
    }
    
    console.log('Session stopped successfully');
    res.json(completedSession);
  } catch (error) {
    console.error('Error stopping reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get the current active reading session
router.get('/reading/active', async (req, res) => {
  try {
    console.log('Getting active reading session...');
    const activeSession = await watchLogService.getActiveReadingSession();
    console.log('Active session:', activeSession);
    res.json(activeSession);
  } catch (error) {
    console.error('Error getting active reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual reading log endpoint (for testing)
router.post('/reading/log', async (req, res) => {
  try {
    const watchLogData = {
      mediaType: req.body.mediaType,
      activityType: 'read',
      title: req.body.title,
      seriesTitle: req.body.seriesTitle,
      customOrderItemId: req.body.customOrderItemId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      totalWatchTime: req.body.totalWatchTime,
      isCompleted: true
    };

    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json({ success: true, watchLog });
  } catch (error) {
    console.error('Error logging reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== VIEWING SESSION ENDPOINTS ====================

// Start a viewing session for web videos
router.post('/viewing/start', async (req, res) => {
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Viewing session start request:', { mediaType, title, seriesTitle, customOrderItemId });
    
    if (!mediaType || !title) {
      console.log('Missing required fields - mediaType or title');
      return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
    }

    if (!customOrderItemId) {
      console.log('No customOrderItemId provided - this viewing session will not be linked to a custom order');
    }

    if (!['webvideo'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return res.status(400).json({ error: 'Invalid media type for viewing' });
    }

    // Only use customOrderItemId if it's a valid integer, otherwise pass null
    const finalCustomOrderItemId = customOrderItemId && Number.isInteger(parseInt(customOrderItemId)) 
      ? parseInt(customOrderItemId) 
      : null;
    
    const viewingSession = await watchLogService.startViewing({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('Viewing session started successfully:', viewingSession.id);
    res.json(viewingSession);
  } catch (error) {
    console.error('Error starting viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause/Resume the active viewing session
router.post('/viewing/pause', async (req, res) => {
  try {
    console.log('Attempting to pause/resume viewing session...');
    
    // Find the active viewing session
    const activeSession = await watchLogService.getActiveViewingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active viewing session found');
      return res.status(404).json({ error: 'No active viewing session found' });
    }

    console.log('Pausing/resuming session with ID:', activeSession.id);
    const updatedSession = await watchLogService.pauseViewing(activeSession.id);
    console.log('Session paused/resumed successfully');
    res.json(updatedSession);
  } catch (error) {
    console.error('Error pausing viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop the active viewing session
router.post('/viewing/stop', async (req, res) => {
  try {
    console.log('Attempting to stop viewing session...');
    const { progress } = req.body;
    
    // Find the active viewing session
    const activeSession = await watchLogService.getActiveViewingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active viewing session found');
      return res.status(404).json({ error: 'No active viewing session found' });
    }

    console.log('Stopping session with ID:', activeSession.id);
    
    // Stop the viewing session
    const completedSession = await watchLogService.stopViewing(activeSession.customOrderItemId);
    
    // Update viewing progress if provided and session wasn't deleted
    if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
      console.log('Updating viewing progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        if (progress.watchedPercentage !== undefined && progress.watchedPercentage >= 0 && progress.watchedPercentage <= 100) {
          updateData.webvideoPercentWatched = progress.watchedPercentage;
          
          // If watched percentage is 100%, mark as watched
          if (progress.watchedPercentage === 100) {
            updateData.isWatched = true;
            console.log('Marking item as watched (100% completion)');
          }
        }
        
        if (progress.currentTime !== undefined && progress.currentTime >= 0) {
          updateData.webvideoCurrentTime = progress.currentTime;
        }
        
        if (progress.totalDuration !== undefined && progress.totalDuration > 0) {
          // Also update the total duration if provided and not already set
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { webvideoDuration: true }
          });
          
          if (!existingItem?.webvideoDuration) {
            updateData.webvideoDuration = progress.totalDuration;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Viewing progress updated successfully:', updateData);
        }
      } catch (progressError) {
        console.error('Error updating viewing progress:', progressError);
        // Don't fail the whole request if progress update fails
      }
    }
    
    console.log('Session stopped successfully');
    res.json(completedSession);
  } catch (error) {
    console.error('Error stopping viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get the current active viewing session
router.get('/viewing/active', async (req, res) => {
  try {
    console.log('Getting active viewing session...');
    const activeSession = await watchLogService.getActiveViewingSession();
    console.log('Active session:', activeSession);
    res.json(activeSession);
  } catch (error) {
    console.error('Error getting active viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual viewing log endpoint (for testing)
router.post('/viewing/log', async (req, res) => {
  try {
    const watchLogData = {
      mediaType: req.body.mediaType,
      activityType: 'view',
      title: req.body.title,
      seriesTitle: req.body.seriesTitle,
      customOrderItemId: req.body.customOrderItemId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      totalWatchTime: req.body.totalWatchTime,
      isCompleted: true
    };

    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json({ success: true, watchLog });
  } catch (error) {
    console.error('Error logging viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== WATCH STATISTICS ENDPOINTS ====================

// Get watch statistics with flexible date filtering
router.get('/watch-stats', watchStatsRoutes.getWatchStats.bind(watchStatsRoutes));

// Get recent watch activity
router.get('/watch-stats/recent', watchStatsRoutes.getRecentActivity.bind(watchStatsRoutes));

// Get today's watch statistics
router.get('/watch-stats/today', watchStatsRoutes.getTodayStats.bind(watchStatsRoutes));

// Manual watch log entry (for items not automatically tracked)
router.post('/watch-logs', async (req, res) => {
  try {
    const watchLogData = req.body;
    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json(watchLog);
  } catch (error) {
    console.error('Error creating watch log:', error);
    res.status(500).json({ error: 'Failed to create watch log' });
  }
});

// Delete a watch log entry
router.delete('/watch-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLog = await watchLogService.deleteWatchLog(id);
    res.json({ success: true, deletedLog, message: 'Watch log entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting watch log:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Watch log entry not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete watch log entry' });
    }
  }
});

// Get custom order statistics
router.get('/watch-stats/custom-orders', watchStatsRoutes.getCustomOrderStats.bind(watchStatsRoutes));

// Debug endpoint to fix webvideo completion status
router.post('/debug/fix-webvideo-completion', async (req, res) => {
  try {
    // Update webvideo sessions that have endTime but aren't marked as completed
    const result = await prisma.watchLog.updateMany({
      where: {
        mediaType: 'webvideo',
        endTime: { not: null },
        isCompleted: false
      },
      data: {
        isCompleted: true
      }
    });
    
    res.json({
      message: 'Fixed webvideo completion status',
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error fixing webvideo completion status:', error);
    res.status(500).json({ error: 'Failed to fix webvideo completion status' });
  }
  });

  // ==================== READING SESSION ROUTES ====================

  // Start a reading session
  router.post('/reading/start', async (req, res) => {
    try {
      const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
      
      console.log('Reading session start request:', { mediaType, title, seriesTitle, customOrderItemId });
      
      if (!mediaType || !title) {
        console.log('Missing required fields - mediaType or title');
        return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
      }

      if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
        console.log('Invalid media type:', mediaType);
        return res.status(400).json({ error: 'Invalid media type for reading' });
      }

      // Validate customOrderItemId if provided - Fix for foreign key constraint error
      let finalCustomOrderItemId = null;
      if (customOrderItemId) {
        const parsedId = parseInt(customOrderItemId);
        if (Number.isInteger(parsedId)) {
          // Verify the customOrderItem exists before using it
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: parsedId }
          });
          
          if (existingItem) {
            finalCustomOrderItemId = parsedId;
            console.log(`✅ Validated customOrderItemId: ${finalCustomOrderItemId}`);
          } else {
            console.log(`⚠️  CustomOrderItem ${parsedId} not found - proceeding without link`);
          }
        } else {
          console.log('⚠️  Invalid customOrderItemId format - proceeding without link');
        }
      }
      
      const readingSession = await watchLogService.startReading({
        mediaType,
        title,
        seriesTitle,
        customOrderItemId: finalCustomOrderItemId
      });

      console.log('Reading session started successfully:', readingSession.id);
      
      // Emit Android companion app message if this is part of a custom order
      if (customOrderItemId) {
        try {
          const customOrderItem = await prisma.customOrderItem.findUnique({
            where: { id: parseInt(customOrderItemId) },
            include: {
              customOrder: {
                include: {
                  plexPlaylist: true,
                  customPlaylist: {
                    include: {
                      _count: {
                        select: { tracks: true }
                      }
                    }
                  }
                }
              }
            }
          });

          if (customOrderItem?.customOrder) {
            const customOrder = customOrderItem.customOrder;
            
            // Build Android companion app message
            let androidMessage = {
              action: 'START_READ_SESSION',
              mediaTitle: title,
              mediaType: mediaType,
              customOrderName: customOrder.name,
              customOrderDescription: customOrder.description,
              timestamp: new Date().toISOString()
            };

            // Add playlist information if available
            if (customOrder.plexPlaylist || customOrder.customPlaylist) {
              if (customOrder.plexPlaylist) {
                androidMessage.playlistName = customOrder.plexPlaylist.title;
                androidMessage.playlistPath = `plex://playlist/${customOrder.plexPlaylist.ratingKey}`;
                androidMessage.playlistType = 'plex';
                androidMessage.playlistTrackCount = customOrder.plexPlaylist.leafCount || 0;
                androidMessage.playlistMetadata = {
                  ratingKey: customOrder.plexPlaylist.ratingKey,
                  playlistType: customOrder.plexPlaylist.playlistType || 'audio',
                  duration: customOrder.plexPlaylist.duration
                };
              } else if (customOrder.customPlaylist) {
                // Transform custom playlist to include trackCount
                customOrder.customPlaylist.trackCount = customOrder.customPlaylist._count?.tracks || 0;
                
                androidMessage.playlistName = customOrder.customPlaylist.title;
                androidMessage.playlistPath = `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/custom-playlists/${customOrder.customPlaylist.id}/play`;
                androidMessage.playlistType = 'custom';
                androidMessage.playlistTrackCount = customOrder.customPlaylist.trackCount;
                androidMessage.playlistDescription = customOrder.customPlaylist.description;
                androidMessage.playlistMetadata = {
                  id: customOrder.customPlaylist.id,
                  trackCount: customOrder.customPlaylist.trackCount,
                  isPublic: customOrder.customPlaylist.isPublic,
                  createdBy: customOrder.customPlaylist.createdBy
                };
              }
            } else {
              androidMessage.note = 'Custom order has no linked playlist';
            }

            // Emit to Android companion app clients
            console.log('📱 Emitting Android companion app message:', JSON.stringify(androidMessage, null, 2));
            io.emit('androidCompanion', androidMessage);
          }
        } catch (error) {
          console.warn('Could not fetch custom order info for Android companion app:', error);
        }
      } else {
        // Still emit a message for standalone reading sessions
        const androidMessage = {
          action: 'START_READ_SESSION',
          mediaTitle: title,
          mediaType: mediaType,
          note: 'Standalone reading session - not part of a custom order',
          timestamp: new Date().toISOString()
        };
        
        console.log('📱 Emitting Android companion app message (standalone):', JSON.stringify(androidMessage, null, 2));
        io.emit('androidCompanion', androidMessage);
      }
      
      res.json(readingSession);
    } catch (error) {
      console.error('Error starting reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause/Resume the active reading session
  router.post('/reading/pause', async (req, res) => {
    try {
      console.log('Attempting to pause/resume reading session...');
      
      // Find the active reading session
      const activeSession = await watchLogService.getActiveReadingSession();
      
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active reading session found');
        return res.status(404).json({ error: 'No active reading session found' });
      }

      console.log('Pausing/resuming session with ID:', activeSession.id);
      const updatedSession = await watchLogService.pauseReading(activeSession.id);
      console.log('Session paused/resumed successfully');
      res.json(updatedSession);
    } catch (error) {
      console.error('Error pausing reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop the active reading session
  router.post('/reading/stop', async (req, res) => {
    try {
      console.log('Attempting to stop reading session...');
      const { progress } = req.body;
      
      // Find the active reading session
      const activeSession = await watchLogService.getActiveReadingSession();
      
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active reading session found');
        return res.status(404).json({ error: 'No active reading session found' });
      }

      console.log('Stopping session with ID:', activeSession.id);
      
      // Stop the reading session
      const completedSession = await watchLogService.stopReading(activeSession.id);
      
      // Update reading progress if provided and session wasn't deleted
      if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
        console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
        
        try {
          const updateData = {};
          
          if (progress.currentPage !== undefined && progress.currentPage > 0) {
            updateData.bookCurrentPage = progress.currentPage;
          }
          
          if (progress.readPercentage !== undefined && progress.readPercentage >= 0 && progress.readPercentage <= 100) {
            updateData.bookPercentRead = progress.readPercentage;
            
            // If read percentage is 100%, mark as read/watched
            if (progress.readPercentage === 100) {
              updateData.isWatched = true;
              console.log('Marking item as read/watched (100% completion)');
            }
          }
          
          if (progress.totalPages !== undefined && progress.totalPages > 0) {
            // Also update the total page count if provided and not already set
            const existingItem = await prisma.customOrderItem.findUnique({
              where: { id: activeSession.customOrderItemId },
              select: { bookPageCount: true }
            });
            
            if (!existingItem?.bookPageCount) {
              updateData.bookPageCount = progress.totalPages;
            }
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.customOrderItem.update({
              where: { id: activeSession.customOrderItemId },
              data: updateData
            });
            
            console.log('Reading progress updated successfully:', updateData);
          }
        } catch (progressError) {
          console.error('Error updating reading progress:', progressError);
          // Don't fail the whole request if progress update fails
        }
      }
      
      console.log('Session stopped successfully');
      res.json(completedSession);
    } catch (error) {
      console.error('Error stopping reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get the current active reading session
  router.get('/reading/active', async (req, res) => {
    try {
      console.log('Getting active reading session...');
      const activeSession = await watchLogService.getActiveReadingSession();
      console.log('Active session:', activeSession);
      res.json(activeSession);
    } catch (error) {
      console.error('Error getting active reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual reading log endpoint (for testing)
  router.post('/reading/log', async (req, res) => {
    try {
      const watchLogData = {
        mediaType: req.body.mediaType,
        activityType: 'read',
        title: req.body.title,
        seriesTitle: req.body.seriesTitle,
        customOrderItemId: req.body.customOrderItemId,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        totalWatchTime: req.body.totalWatchTime,
        isCompleted: true
      };

      const watchLog = await watchLogService.logWatched(watchLogData);
      res.json({ success: true, watchLog });
    } catch (error) {
      console.error('Error logging reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== VIEWING SESSION ROUTES ====================

  // Start a viewing session for web videos
  router.post('/viewing/start', async (req, res) => {
    try {
      const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
      
      console.log('Viewing session start request:', { mediaType, title, seriesTitle, customOrderItemId });
      
      if (!mediaType || !title) {
        console.log('Missing required fields - mediaType or title');
        return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
      }

      if (!customOrderItemId) {
        console.log('No customOrderItemId provided - this viewing session will not be linked to a custom order');
      }

      if (!['webvideo'].includes(mediaType)) {
        console.log('Invalid media type:', mediaType);
        return res.status(400).json({ error: 'Invalid media type for viewing' });
      }

      // Only use customOrderItemId if it's a valid integer, otherwise pass null
      const finalCustomOrderItemId = customOrderItemId && Number.isInteger(parseInt(customOrderItemId)) 
        ? parseInt(customOrderItemId) 
        : null;
      
      const viewingSession = await watchLogService.startViewing({
        mediaType,
        title,
        seriesTitle,
        customOrderItemId: finalCustomOrderItemId
      });

      console.log('Viewing session started successfully:', viewingSession.id);
      res.json(viewingSession);
    } catch (error) {
      console.error('Error starting viewing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause/Resume the active viewing session
  router.post('/viewing/pause', async (req, res) => {
    try {
      console.log('Attempting to pause/resume viewing session...');
      
      // Find the active viewing session
      const activeSession = await watchLogService.getActiveViewingSession();
      
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active viewing session found');
        return res.status(404).json({ error: 'No active viewing session found' });
      }

      console.log('Pausing/resuming session with ID:', activeSession.id);
      const updatedSession = await watchLogService.pauseViewing(activeSession.id);
      console.log('Session paused/resumed successfully');
      res.json(updatedSession);
    } catch (error) {
      console.error('Error pausing viewing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop the active viewing session
  router.post('/viewing/stop', async (req, res) => {
    try {
      console.log('Attempting to stop viewing session...');
      const { progress } = req.body;
      
      // Find the active viewing session
      const activeSession = await watchLogService.getActiveViewingSession();
      
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active viewing session found');
        return res.status(404).json({ error: 'No active viewing session found' });
      }

      console.log('Stopping session with ID:', activeSession.id);
      
      // Stop the viewing session
      const completedSession = await watchLogService.stopViewing(activeSession.customOrderItemId);
      
      // Update viewing progress if provided and session wasn't deleted
      if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
        console.log('Updating viewing progress for item:', activeSession.customOrderItemId, progress);
        
        try {
          const updateData = {};
          
          if (progress.watchedPercentage !== undefined && progress.watchedPercentage >= 0 && progress.watchedPercentage <= 100) {
            updateData.webvideoPercentWatched = progress.watchedPercentage;
            
            // If watched percentage is 100%, mark as watched
            if (progress.watchedPercentage === 100) {
              updateData.isWatched = true;
              console.log('Marking item as watched (100% completion)');
            }
          }
          
          if (progress.currentTime !== undefined && progress.currentTime >= 0) {
            updateData.webvideoCurrentTime = progress.currentTime;
          }
          
          if (progress.totalDuration !== undefined && progress.totalDuration > 0) {
            // Also update the total duration if provided and not already set
            const existingItem = await prisma.customOrderItem.findUnique({
              where: { id: activeSession.customOrderItemId },
              select: { webvideoDuration: true }
            });
            
            if (!existingItem?.webvideoDuration) {
              updateData.webvideoDuration = progress.totalDuration;
            }
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.customOrderItem.update({
              where: { id: activeSession.customOrderItemId },
              data: updateData
            });
            
            console.log('Viewing progress updated successfully:', updateData);
          }
        } catch (progressError) {
          console.error('Error updating viewing progress:', progressError);
          // Don't fail the whole request if progress update fails
        }
      }
      
      console.log('Session stopped successfully');
      res.json(completedSession);
    } catch (error) {
      console.error('Error stopping viewing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get the current active viewing session
  router.get('/viewing/active', async (req, res) => {
    try {
      console.log('Getting active viewing session...');
      const activeSession = await watchLogService.getActiveViewingSession();
      console.log('Active session:', activeSession);
      res.json(activeSession);
    } catch (error) {
      console.error('Error getting active viewing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual viewing log endpoint (for testing)
  router.post('/viewing/log', async (req, res) => {
    try {
      const watchLogData = {
        mediaType: req.body.mediaType,
        activityType: 'view',
        title: req.body.title,
        seriesTitle: req.body.seriesTitle,
        customOrderItemId: req.body.customOrderItemId,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        totalWatchTime: req.body.totalWatchTime,
        isCompleted: true
      };

      const watchLog = await watchLogService.logWatched(watchLogData);
      res.json({ success: true, watchLog });
    } catch (error) {
      console.error('Error logging viewing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createWatchTrackingRoutes;