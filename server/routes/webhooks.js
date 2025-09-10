const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');
const { asyncHandler } = require('../utils/responses');

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
router.post('/', upload.single('thumb'), asyncHandler(async (req, res) => {
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
      console.log('✅ Media watched (scrobble event)');
      // Add any specific scrobble event handling here
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
}));// POST /api/webhook/notify - Node-RED notification webhook
router.post('/notify', asyncHandler(async (req, res) => {
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
}));

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
