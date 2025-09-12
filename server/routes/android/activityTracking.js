/**
 * Android Activity Tracking Routes
 * Handles watch status and activity logging for Android app
 */

const express = require('express');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create activity tracking routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createActivityTrackingRoutes(prisma) {
  const router = express.Router();

  // Mark content as watched
  router.post('/mark-watched', async (req, res) => {
    console.log('📱 Android app requesting to mark content as watched...');
    
    try {
      const { mediaType, ratingKey, customOrderItemId, title, orderType, videoId, bookId, chapterId, sectionId } = req.body;
      
      if (!mediaType) {
        return res.status(400).json(createAndroidErrorResponse(
          'MARK_WATCHED_ERROR',
          'Media type is required',
          'Unable to mark as watched: missing media type'
        ));
      }
      
      let result = null;
      
      if (orderType === 'HISTORY_PLUS') {
        // Handle History Plus content completion
        const HistoryPlusService = require('../../services/historyPlusService');
        const historyPlusService = new HistoryPlusService();
        
        if (mediaType === 'webvideo' && videoId) {
          console.log('📱 Android app marking History Plus video as watched:', videoId);
          result = await historyPlusService.completeVideo(videoId);
        } else if (mediaType === 'book' && bookId) {
          console.log('📱 Android app marking History Plus book as read:', bookId);
          result = await historyPlusService.completeBook(bookId);
        } else if (mediaType === 'chapter' && chapterId) {
          console.log('📱 Android app marking History Plus chapter as read:', chapterId);
          result = await historyPlusService.completeChapter(chapterId);
        } else if (mediaType === 'section' && sectionId) {
          console.log('📱 Android app marking History Plus section as read:', sectionId);
          result = await historyPlusService.completeSection(sectionId);
        } else {
          return res.status(400).json(createAndroidErrorResponse(
            'MARK_WATCHED_ERROR',
            'Invalid History Plus content',
            'Unable to mark as watched: missing required ID for History Plus content'
          ));
        }
        
      } else if (mediaType === 'episode' || mediaType === 'movie') {
        if (!ratingKey) {
          return res.status(400).json(createAndroidErrorResponse(
            'MARK_WATCHED_ERROR',
            'Rating key is required for Plex content',
            'Unable to mark as watched: missing rating key'
          ));
        }
        
        // Handle Plex content
        result = await prisma.watchLog.create({
          data: {
            ratingKey: ratingKey,
            mediaType: mediaType,
            title: title || 'Unknown Title',
            watchedAt: new Date(),
            source: 'android_app'
          }
        });
        
      } else if (customOrderItemId) {
        // Handle custom order content
        result = await prisma.customOrderItem.update({
          where: { id: customOrderItemId },
          data: { 
            watched: true,
            watchedAt: new Date()
          }
        });
      }
      
      const androidResponse = createAndroidResponse('MARK_WATCHED_SUCCESS', {
        success: true,
        action: 'mark_watched',
        media: {
          mediaType: mediaType,
          ratingKey: ratingKey,
          customOrderItemId: customOrderItemId,
          title: title
        },
        message: 'Content marked as watched successfully'
      });
      
      console.log('📱 Content marked as watched for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android mark watched endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'MARK_WATCHED_ERROR',
        'Failed to mark as watched',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createActivityTrackingRoutes;
