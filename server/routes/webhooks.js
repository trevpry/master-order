const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');
const WatchLogService = require('../watchLogService');
const PlexDatabaseService = require('../plexDatabaseService');
const { markCustomOrderItemAsWatched } = require('../getNextCustomOrder');
const prisma = require('../prismaClient');

// Initialize services
const watchLogService = new WatchLogService(prisma);
const plexDb = new PlexDatabaseService();

// Configure multer for file uploads (for Plex webhook thumbnails)
const upload = multer({
  dest: 'uploads/', // Temporary upload directory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * EDDIE LIFE MANAGEMENT - WEBHOOK ROUTES
 * 
 * This module handles webhook processing including:
 * - Plex media server webhooks with thumbnail upload support
 * - Node-RED notification webhooks
 * - Integration with watch tracking and media management
 */

// POST /webhook - Main Plex webhook endpoint with thumbnail upload support
router.post('/', upload.single('thumb'), async (req, res) => {
  try {
    console.log('\n🎬 =================================');
    console.log('🎬 PLEX WEBHOOK RECEIVED');
    console.log('🎬 =================================');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🔗 Headers:', JSON.stringify(req.headers, null, 2));
    
    // Parse the JSON payload
    let payload;
    if (req.body.payload) {
      payload = JSON.parse(req.body.payload);
      console.log('📦 Raw payload found in req.body.payload');
    } else {
      payload = req.body;
      console.log('📦 Using req.body directly');
    }

    console.log('🎯 Event Type:', payload.event);
    console.log('👤 User:', payload.Account?.title || 'Unknown User');
    console.log('📱 Player:', payload.Player?.title || 'Unknown Player');
    console.log('🖥️  Server:', payload.Server?.title || 'Unknown Server');
    
    if (payload.Metadata) {
      console.log('📺 Media Details:');
      console.log('   Type:', payload.Metadata.type);
      console.log('   Title:', payload.Metadata.title);
      console.log('   Year:', payload.Metadata.year);
      console.log('   Duration:', payload.Metadata.duration);
      console.log('   Rating Key:', payload.Metadata.ratingKey);
      
      if (payload.Metadata.type === 'episode') {
        console.log('   Series:', payload.Metadata.grandparentTitle);
        console.log('   Season:', payload.Metadata.parentIndex);
        console.log('   Episode:', payload.Metadata.index);
      }
    }
    
    console.log('📄 Full Payload:', JSON.stringify(payload, null, 2));
    console.log('🎬 =================================\n');

    // Check if we should filter by selected Plex user
    const { getSettings } = require('../databaseUtils');
    const settings = await getSettings();
    const selectedPlexUser = settings?.selectedPlexUser;
    const webhookUser = payload.Account?.title || payload.Account?.name;

    if (selectedPlexUser && webhookUser && webhookUser !== selectedPlexUser) {
      console.log(`🚫 Ignoring webhook from user "${webhookUser}" (only processing "${selectedPlexUser}")`);
      res.status(200).send('OK - Ignored (different user)');
      return;
    }

    // Process the webhook based on event type
    if (payload.event === 'media.play' || payload.event === 'media.resume') {
      console.log('▶️  Media playback started/resumed');
      // Add any specific play event handling here
    } else if (payload.event === 'media.pause') {
      console.log('⏸️  Media playback paused');
      // Add any specific pause event handling here
    } else if (payload.event === 'media.stop') {
      console.log('⏹️  Media playback stopped');
      // Add any specific stop event handling here
    } else if (payload.event === 'media.scrobble') {
      console.log('\n🎯 Processing media.scrobble event for automatic watched marking...');

      // Only process episodes and movies, skip music tracks and other media types
      const mediaType = payload.Metadata?.type;
      if (mediaType !== 'episode' && mediaType !== 'movie') {
        console.log(`   🚫 Skipping scrobble for media type: "${mediaType}" (only episodes and movies are tracked)`);
        res.status(200).send('OK');
        return;
      }

      const ratingKey = payload.Metadata?.ratingKey;

      if (ratingKey) {
        try {
          // Find custom order item with this ratingKey (plexKey)
          const customOrderItem = await prisma.customOrderItem.findFirst({
            where: { plexKey: ratingKey.toString() },
            include: {
              customOrder: true
            }
          });

          if (customOrderItem && !customOrderItem.isWatched) {
            console.log(`   📺 Found matching item in custom order: "${customOrderItem.title}"`);

            // Mark as watched in custom order
            await markCustomOrderItemAsWatched(customOrderItem.id);

            // Create watch log entry
            let watchLogMediaType = customOrderItem.mediaType;

            // Map custom order media types to watch log media types (same as manual marking)
            if (customOrderItem.mediaType === 'episode') {
              watchLogMediaType = 'tv';
            }

            const watchLogData = {
              mediaType: watchLogMediaType,
              title: customOrderItem.title,
              plexKey: ratingKey.toString(),
              customOrderItemId: customOrderItem.id,
              isCompleted: true
            };

            // Add series-specific data for TV episodes
            if (customOrderItem.mediaType === 'episode') {
              watchLogData.seriesTitle = customOrderItem.seriesTitle;
              watchLogData.seasonNumber = customOrderItem.seasonNumber;
              watchLogData.episodeNumber = customOrderItem.episodeNumber;
            }

            // Try to get duration from Plex data
            try {
              if (customOrderItem.mediaType === 'episode') {
                const plexItem = await plexDb.getItemMetadata(ratingKey, 'episode');
                if (plexItem && plexItem.duration) {
                  watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
                }
              } else if (customOrderItem.mediaType === 'movie') {
                const plexItem = await plexDb.getMovieByRatingKey(ratingKey);
                if (plexItem && plexItem.duration) {
                  watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
                }
              }
            } catch (plexError) {
              console.warn(`   ⚠️ Could not get duration from Plex: ${plexError.message}`);
            }

            // Set default duration if not found
            if (!watchLogData.duration) {
              watchLogData.duration = customOrderItem.mediaType === 'movie' ? 120 : 45;
            }
            watchLogData.totalWatchTime = watchLogData.duration;

            // Log the watch activity
            await watchLogService.logWatched(watchLogData);

            // Mark as watched in Plex database
            try {
              if (customOrderItem.mediaType === 'episode') {
                await plexDb.markEpisodeAsWatched(ratingKey);
                console.log(`   📺 Marked episode as watched in Plex database`);
              } else if (customOrderItem.mediaType === 'movie') {
                await plexDb.markMovieAsWatched(ratingKey);
                console.log(`   🎬 Marked movie as watched in Plex database`);
              }
            } catch (plexMarkError) {
              console.warn(`   ⚠️ Could not mark as watched in Plex database: ${plexMarkError.message}`);
            }

            console.log(`   ✅ Successfully marked "${customOrderItem.title}" as watched via Plex scrobble`);
            console.log(`   📂 Custom order: "${customOrderItem.customOrder.name}"`);
            console.log(`   ⏱️ Duration: ${watchLogData.duration} minutes`);
          } else if (customOrderItem && customOrderItem.isWatched) {
            console.log(`   ✅ Item "${customOrderItem.title}" is already marked as watched`);
          } else {
            console.log(`   🔍 No matching custom order item found for ratingKey: ${ratingKey}`);
            console.log(`   📝 Creating watch log entry for non-custom order item...`);

            // Still create a watch log entry even if not in custom order
            try {
              const watchLogData = {
                title: payload.Metadata?.title || 'Unknown Title',
                plexKey: ratingKey.toString(),
                isCompleted: true
              };

              // Determine media type and add appropriate data
              if (payload.Metadata?.type === 'episode') {
                watchLogData.mediaType = 'tv';  // Use 'tv' for consistency with stats queries
                watchLogData.seriesTitle = payload.Metadata?.grandparentTitle;
                watchLogData.seasonNumber = payload.Metadata?.parentIndex;
                watchLogData.episodeNumber = payload.Metadata?.index;
              } else if (payload.Metadata?.type === 'movie') {
                watchLogData.mediaType = 'movie';
              } else {
                watchLogData.mediaType = payload.Metadata?.type || 'unknown';
              }

              // Get duration from payload or Plex database
              let duration = null;
              if (payload.Metadata?.duration) {
                duration = Math.round(payload.Metadata.duration / (1000 * 60)); // Convert from ms to minutes
              }

              // If no duration in payload, try to get from Plex database
              if (!duration) {
                try {
                  if (watchLogData.mediaType === 'tv' || payload.Metadata?.type === 'episode') {
                    const plexItem = await plexDb.getItemMetadata(ratingKey, 'episode');
                    if (plexItem && plexItem.duration) {
                      duration = Math.round(plexItem.duration / (1000 * 60));
                    }
                  } else if (watchLogData.mediaType === 'movie') {
                    const plexItem = await plexDb.getMovieByRatingKey(ratingKey);
                    if (plexItem && plexItem.duration) {
                      duration = Math.round(plexItem.duration / (1000 * 60));
                    }
                  }
                } catch (plexError) {
                  console.warn(`   ⚠️ Could not get duration from Plex database: ${plexError.message}`);
                }
              }

              // Set default duration if still not found
              if (!duration) {
                duration = watchLogData.mediaType === 'movie' ? 120 : 45;
              }

              watchLogData.duration = duration;
              watchLogData.totalWatchTime = duration;

              // Log the watch activity
              await watchLogService.logWatched(watchLogData);

              // Mark as watched in Plex database
              try {
                if (watchLogData.mediaType === 'tv' || payload.Metadata?.type === 'episode') {
                  await plexDb.markEpisodeAsWatched(ratingKey);
                  console.log(`   📺 Marked episode as watched in Plex database`);
                } else if (watchLogData.mediaType === 'movie') {
                  await plexDb.markMovieAsWatched(ratingKey);
                  console.log(`   🎬 Marked movie as watched in Plex database`);
                }
              } catch (plexMarkError) {
                console.warn(`   ⚠️ Could not mark as watched in Plex database: ${plexMarkError.message}`);
              }

              console.log(`   ✅ Successfully logged "${watchLogData.title}" as watched via Plex scrobble`);
              console.log(`   📺 Media type: ${watchLogData.mediaType}`);
              console.log(`   ⏱️ Duration: ${duration} minutes`);
              if (watchLogData.seriesTitle) {
                console.log(`   📺 Series: "${watchLogData.seriesTitle}" S${watchLogData.seasonNumber}E${watchLogData.episodeNumber}`);
              }
            } catch (watchLogError) {
              console.error(`   ❌ Failed to create watch log for non-custom order item: ${watchLogError.message}`);
            }
          }
        } catch (error) {
          console.error(`   ❌ Error processing scrobble event: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️ No ratingKey found in scrobble payload`);
      }
    }

    // Send webhook notification to Node-RED if needed
    if (payload.event && payload.Metadata) {
      try {
        const notificationData = {
          ratingKey: payload.Metadata.ratingKey,
          action: payload.event,
          title: payload.Metadata.title,
          type: payload.Metadata.type,
          timestamp: new Date().toISOString()
        };

        // Forward to Node-RED webhook
        await sendNodeRedNotification(notificationData);
      } catch (notificationError) {
        console.error('Failed to send Node-RED notification:', notificationError);
        // Don't fail the whole webhook if notification fails
      }
    }

    console.log('✅ Plex webhook processed successfully');
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// POST /api/webhook/notify - Node-RED notification webhook
router.post('/notify', async (req, res) => {
  try {
    const { ratingKey, action, title, type, timestamp } = req.body;
    
    console.log('Sending webhook notification to Node-RED:', {
      ratingKey,
      action,
      title,
      type,
      timestamp
    });

    await sendNodeRedNotification({ ratingKey, action, title, type, timestamp });
    res.json({ success: true, message: 'Webhook notification sent' });
    
  } catch (error) {
    console.error('Failed to send webhook notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send webhook notification',
      details: error.message 
    });
  }
});

/**
 * Helper function to send notifications to Node-RED
 */
async function sendNodeRedNotification(data) {
  return new Promise((resolve, reject) => {
    // Prepare the data to send
    const postData = JSON.stringify(data);
    
    // HTTP request options
    const options = {
      hostname: '192.168.1.117',
      port: 1880,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Master-Order-App/1.0',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.NODE_RED_TOKEN}`
      }
    };
    
    // Make the HTTP request to Node-RED
    const request = http.request(options, (response) => {
      let responseData = '';
      
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      
      response.on('end', () => {
        console.log(`Node-RED response status: ${response.statusCode}`);
        console.log(`Node-RED response headers:`, response.headers);
        console.log(`Node-RED response body:`, responseData);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          console.log('Webhook notification sent successfully to Node-RED');
          resolve({ success: true, data: responseData });
        } else {
          console.error('Node-RED webhook failed with status:', response.statusCode);
          reject(new Error(`Node-RED webhook failed with status ${response.statusCode}: ${responseData}`));
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Failed to send webhook notification:', error);
      reject(error);
    });
    
    // Send the data
    request.write(postData);
    request.end();
  });
}

module.exports = router;
