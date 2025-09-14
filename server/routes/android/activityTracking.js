/**
 * Android Activity Tracking Routes
 * Handles watch status and activity logging for Android app using delegation pattern
 */

const express = require('express');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Helper function to get the base URL for API calls
 */
function getAndroidApiBaseUrl() {
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Create activity tracking routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createActivityTrackingRoutes(prisma) {
  const router = express.Router();

  // Mark content as watched
  router.post('/mark-watched', async (req, res) => {
    console.log('� Android app requesting to mark item as read/watched...');
    
    try {
      const { itemId, mediaType, title = 'Unknown Item' } = req.body;

      if (!itemId) {
        return res.status(400).json({
          type: 'MARK_WATCHED_ERROR',
          data: {
            error: 'Item ID is required',
            message: 'Unable to mark as watched: missing item identifier'
          }
        });
      }

      console.log(`🔲 Mark watched request - itemId: ${itemId}, mediaType: ${mediaType}, title: ${title}`);

      // Use existing mark custom order item as watched endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const watchedResponse = await fetch(`${baseUrl}/api/mark-custom-order-item-watched/${itemId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!watchedResponse.ok) {
        const errorData = await watchedResponse.json();
        console.error('Failed to mark item as watched:', errorData);

        const androidErrorResponse = {
          type: 'MARK_WATCHED_ERROR',
          data: {
            success: false,
            itemId: itemId,
            title: title,
            mediaType: mediaType,
            error: errorData.error || 'Failed to mark as watched',
            details: errorData.details || 'Check item exists and is not already watched',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(watchedResponse.status).json(androidErrorResponse);
      }

      const watchedData = await watchedResponse.json();
      console.log('✅ Item marked as watched successfully:', JSON.stringify(watchedData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: 'MARK_WATCHED_SUCCESS',
        data: {
          success: true,
          itemId: itemId,
          title: title,
          mediaType: mediaType,
          message: `Successfully marked "${title}" as read/watched`,
          watchLogCreated: watchedData.watchLogCreated || false,
          plexUpdated: watchedData.plexUpdated || false,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Mark watched successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android mark watched endpoint:', error);

      const androidErrorResponse = {
        type: 'MARK_WATCHED_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      };

      res.status(500).json(androidErrorResponse);
    }
  });

  return router;
}

module.exports = createActivityTrackingRoutes;
