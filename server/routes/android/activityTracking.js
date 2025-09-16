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
 * Helper function to resolve item ID - handles both numeric IDs and non-numeric plexKeys
 * @param {PrismaClient} prisma - Database client instance
 * @param {string|number} itemIdentifier - Either numeric ID or plexKey (like 'history-plus-video-123')
 * @returns {Promise<number|null>} The actual database ID, or null if not found
 */
async function resolveCustomOrderItemId(prisma, itemIdentifier) {
  // If it's already a numeric ID, use it directly
  if (!isNaN(itemIdentifier) && Number.isInteger(Number(itemIdentifier))) {
    return parseInt(itemIdentifier);
  }
  
  // If it's non-numeric, look it up by plexKey
  try {
    const item = await prisma.customOrderItem.findFirst({
      where: { plexKey: String(itemIdentifier) }
    });
    
    if (item) {
      console.log(`🔍 Resolved non-numeric itemId '${itemIdentifier}' to database ID ${item.id}`);
      return item.id;
    } else {
      console.warn(`⚠️  Could not find CustomOrderItem with plexKey: ${itemIdentifier}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error resolving itemId ${itemIdentifier}:`, error);
    return null;
  }
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

      // Check if this is a History Plus video ID
      if (String(itemId).startsWith('history-plus-video-')) {
        console.log('🎓 Detected History Plus video, routing to History Plus completion endpoint');
        
        // Extract the actual video ID from the history-plus-video-{id} format
        const historyPlusVideoId = String(itemId).replace('history-plus-video-', '');
        
        const baseUrl = getAndroidApiBaseUrl();
        const completeResponse = await fetch(`${baseUrl}/api/history-plus/videos/${historyPlusVideoId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json();
          console.error('Failed to complete History Plus video:', errorData);

          return res.status(completeResponse.status).json({
            type: 'MARK_WATCHED_ERROR',
            data: {
              success: false,
              itemId: itemId,
              historyPlusVideoId: historyPlusVideoId,
              title: title,
              mediaType: mediaType,
              error: errorData.error || 'Failed to complete History Plus video',
              details: errorData.details || 'Check that the History Plus video exists',
              timestamp: new Date().toISOString()
            }
          });
        }

        const completeData = await completeResponse.json();
        console.log('✅ History Plus video completed successfully:', JSON.stringify(completeData, null, 2));

        // Success response in Android format
        return res.json({
          type: 'MARK_WATCHED_SUCCESS',
          data: {
            success: true,
            itemId: itemId,
            historyPlusVideoId: historyPlusVideoId,
            title: title,
            mediaType: mediaType || 'webvideo',
            message: `Successfully completed History Plus video "${title}"`,
            watchLogCreated: true,
            historyPlusCompleted: true,
            timestamp: new Date().toISOString()
          }
        });
      }

      // For non-History Plus items, resolve the item ID (handles both numeric IDs and non-numeric plexKeys)
      const resolvedItemId = await resolveCustomOrderItemId(prisma, itemId);
      
      if (!resolvedItemId) {
        return res.status(404).json({
          type: 'MARK_WATCHED_ERROR',
          data: {
            success: false,
            itemId: itemId,
            title: title,
            mediaType: mediaType,
            error: 'Custom order item not found',
            details: 'Check that the item exists in the database',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Use existing mark custom order item as watched endpoint with resolved ID
      const baseUrl = getAndroidApiBaseUrl();
      const watchedResponse = await fetch(`${baseUrl}/api/mark-custom-order-item-watched/${resolvedItemId}`, {
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
          resolvedItemId: resolvedItemId,
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
