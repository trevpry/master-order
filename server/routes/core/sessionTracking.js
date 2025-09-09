/**
 * Core Session Tracking Routes  
 * Handles reading and viewing session management
 */

const express = require('express');

/**
 * Create session tracking routes
 * @param {PrismaClient} prisma - Database client instance  
 * @returns {express.Router} Configured router
 */
function createSessionTrackingRoutes(prisma) {
  const router = express.Router();
  
  // Initialize dependencies
  const watchLogService = require('../../watchLogService');
  
  // ==================== READING SESSION ENDPOINTS ====================
  
  // Start a reading session
  router.post('/api/reading/start', async (req, res) => {
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

      // Validate customOrderItemId if provided
      let finalCustomOrderItemId = null;
      if (customOrderItemId) {
        const parsedId = parseInt(customOrderItemId);
        if (Number.isInteger(parsedId)) {
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
            global.io?.emit('androidCompanion', androidMessage);
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
        global.io?.emit('androidCompanion', androidMessage);
      }
      
      res.json(readingSession);
    } catch (error) {
      console.error('Error starting reading session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause/Resume the active reading session
  router.post('/api/reading/pause', async (req, res) => {
    try {
      console.log('Attempting to pause/resume reading session...');
      
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
  router.post('/api/reading/stop', async (req, res) => {
    try {
      console.log('Attempting to stop reading session...');
      const { progress } = req.body;
      
      const activeSession = await watchLogService.getActiveReadingSession();
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active reading session found');
        return res.status(404).json({ error: 'No active reading session found' });
      }

      console.log('Stopping session with ID:', activeSession.id);
      
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
            
            if (progress.readPercentage === 100) {
              updateData.isWatched = true;
              console.log('Marking item as read/watched (100% completion)');
            }
          }
          
          if (progress.totalPages !== undefined && progress.totalPages > 0) {
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
  router.get('/api/reading/active', async (req, res) => {
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
  router.post('/api/reading/log', async (req, res) => {
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
  router.post('/api/viewing/start', async (req, res) => {
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
  router.post('/api/viewing/pause', async (req, res) => {
    try {
      console.log('Attempting to pause/resume viewing session...');
      
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
  router.post('/api/viewing/stop', async (req, res) => {
    try {
      console.log('Attempting to stop viewing session...');
      const { progress } = req.body;
      
      const activeSession = await watchLogService.getActiveViewingSession();
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active viewing session found');
        return res.status(404).json({ error: 'No active viewing session found' });
      }

      console.log('Stopping session with ID:', activeSession.id);
      
      const completedSession = await watchLogService.stopViewing(activeSession.customOrderItemId);
      
      // Update viewing progress if provided and session wasn't deleted
      if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
        console.log('Updating viewing progress for item:', activeSession.customOrderItemId, progress);
        
        try {
          const updateData = {};
          
          if (progress.watchedPercentage !== undefined && progress.watchedPercentage >= 0 && progress.watchedPercentage <= 100) {
            updateData.webvideoPercentWatched = progress.watchedPercentage;
            
            if (progress.watchedPercentage === 100) {
              updateData.isWatched = true;
              console.log('Marking item as watched (100% completion)');
            }
          }
          
          if (progress.currentTime !== undefined && progress.currentTime >= 0) {
            updateData.webvideoCurrentTime = progress.currentTime;
          }
          
          if (progress.totalDuration !== undefined && progress.totalDuration > 0) {
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
  router.get('/api/viewing/active', async (req, res) => {
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

  // Manual viewing log endpoint
  router.post('/api/viewing/log', async (req, res) => {
    try {
      const watchLogData = {
        mediaType: req.body.mediaType,
        activityType: 'watch',
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

module.exports = createSessionTrackingRoutes;
