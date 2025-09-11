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
  const WatchLogService = require('../../watchLogService');
  const watchLogService = new WatchLogService(prisma);
  
  // Import validation and response utilities
  const { validateReadingOperation, validateViewingOperation } = require('../../middleware/validation');
  const { sendBadRequest, sendSuccess, sendServerError, asyncHandler, logError } = require('../../utils/responses');
  
  // ==================== READING SESSION ENDPOINTS ====================
  
  // Start a reading session
  router.post('/reading/start', validateReadingOperation, asyncHandler(async (req, res) => {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Reading session start request:', { mediaType, title, seriesTitle, customOrderItemId });

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
  }));

  // Pause/Resume the active reading session
  router.post('/reading/pause', async (req, res) => {
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
  router.post('/reading/stop', async (req, res) => {
    try {
      console.log('🎯 HIT OUR SESSIONTRACKING ROUTE! 🎯');
      console.log('Attempting to stop reading session...');
      console.log('Request body:', req.body);
      
      // Handle both nested progress object and direct progress data
      const progress = req.body.progress || req.body;
      
      const activeSession = await watchLogService.getActiveReadingSession();
      console.log('Active session found:', activeSession);
      
      if (!activeSession) {
        console.log('No active reading session found');
        return res.status(404).json({ error: 'No active reading session found' });
      }

      console.log('Stopping session with ID:', activeSession.id);
      
      let completedSession;
      try {
        completedSession = await watchLogService.stopReading(activeSession.id);
        console.log('✅ stopReading completed, continuing with progress update...');
      } catch (stopError) {
        console.error('❌ Error in stopReading:', stopError);
        throw stopError;
      }
      
      console.log('📋 Completed session result:', completedSession);
      console.log('📋 Session deleted?', completedSession.deleted);
      console.log('📋 Has customOrderItemId?', activeSession.customOrderItemId);
      console.log('📋 Progress data?', progress);
      
      // Update reading progress if provided and session wasn't deleted
      console.log('🔍 Checking progress update conditions:');
      console.log('  - Has progress?', !!progress);
      console.log('  - Session deleted?', completedSession.deleted);
      console.log('  - Has customOrderItemId?', !!activeSession.customOrderItemId);
      
      if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
        console.log('📝 Updating reading progress for item:', activeSession.customOrderItemId);
        console.log('📝 Progress data received:', progress);
        
        try {
          // First get the current item to access bookPageCount
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { bookPageCount: true, bookCurrentPage: true, bookPercentRead: true }
          });
          
          const updateData = {};
          
          // Handle page count updates
          if (progress.totalPages !== undefined && progress.totalPages > 0) {
            if (!existingItem?.bookPageCount) {
              updateData.bookPageCount = progress.totalPages;
            }
          }
          
          const pageCount = progress.totalPages || existingItem?.bookPageCount;
          
          // Handle reading progress updates - prioritize user-provided values
          // and ensure consistency between page and percentage
          
          // Store user-provided values
          const userProvidedPage = progress.currentPage !== undefined && progress.currentPage > 0;
          const userProvidedPercentage = progress.readPercentage !== undefined && progress.readPercentage >= 0 && progress.readPercentage <= 100;
          
          console.log('� Processing progress update:');
          console.log('  - User provided page:', userProvidedPage ? progress.currentPage : 'no');
          console.log('  - User provided percentage:', userProvidedPercentage ? progress.readPercentage : 'no');
          
          if (userProvidedPage && userProvidedPercentage) {
            // Both values provided - use both as-is (user knows what they want)
            updateData.bookCurrentPage = progress.currentPage;
            updateData.bookPercentRead = progress.readPercentage;
            console.log('� Using both user-provided values: page', progress.currentPage, 'and', progress.readPercentage + '%');
          } else if (userProvidedPage) {
            // Only page provided - calculate percentage
            updateData.bookCurrentPage = progress.currentPage;
            if (pageCount && pageCount > 0) {
              const calculatedPercent = Math.min(100, Math.round((progress.currentPage / pageCount) * 100));
              updateData.bookPercentRead = calculatedPercent;
              console.log('� Set page to', progress.currentPage, 'and calculated percentage:', calculatedPercent + '%');
            }
          } else if (userProvidedPercentage) {
            // Only percentage provided - calculate page
            updateData.bookPercentRead = progress.readPercentage;
            if (pageCount && pageCount > 0) {
              const calculatedPage = Math.round((progress.readPercentage / 100) * pageCount);
              updateData.bookCurrentPage = calculatedPage;
              console.log('� Set percentage to', progress.readPercentage + '% and calculated page:', calculatedPage);
            }
          }
          
          // Check for 100% completion
          if (updateData.bookPercentRead === 100) {
            updateData.isWatched = true;
            console.log('✅ Marking item as read/watched (100% completion)');
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.customOrderItem.update({
              where: { id: activeSession.customOrderItemId },
              data: updateData
            });
            
            console.log('Reading progress updated successfully:', updateData);
          }
          
          // Update the watchLog completion status based on reading progress
          if (progress.readPercentage !== undefined && !completedSession.deleted) {
            const isBookCompleted = progress.readPercentage >= 100;
            
            await prisma.watchLog.update({
              where: { id: activeSession.id },
              data: {
                isCompleted: isBookCompleted
              }
            });
            
            console.log(`Updated watchLog completion status: ${isBookCompleted} (${progress.readPercentage}% read)`);
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
        isCompleted: req.body.isCompleted // Let the caller specify completion status
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
  router.post('/viewing/start', validateViewingOperation, asyncHandler(async (req, res) => {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Viewing session start request:', { mediaType, title, seriesTitle, customOrderItemId });

    if (!customOrderItemId) {
      console.log('No customOrderItemId provided - this viewing session will not be linked to a custom order');
    }

    if (!['webvideo'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return sendBadRequest(res, 'Invalid media type for viewing');
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
  }));

  // Pause/Resume the active viewing session
  router.post('/viewing/pause', async (req, res) => {
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
  router.post('/viewing/stop', async (req, res) => {
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

  // Manual viewing log endpoint
  router.post('/viewing/log', async (req, res) => {
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
