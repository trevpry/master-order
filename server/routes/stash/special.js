/**
 * Special Stash Routes - Routes requiring external dependencies
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * This module handles routes that need WebSocket, background sync, or other external dependencies
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { generateOptimizedClips } = require('./shared');

const prisma = new PrismaClient();

function createSpecialRoutes(dependencies) {
  const router = express.Router();
  const { io, stashBackgroundSync } = dependencies;

  // POST /clip-play - Select and play a random clip from a random scene (requires WebSocket)
  if (io) {
    router.post('/clip-play', async (req, res) => {
      try {
        console.log('🎬 Starting Clip Play - selecting random scene and checking/generating clips...');
        
        // First, get all scenes from Stash database
        const allScenes = await prisma.stashScene.findMany({
          select: {
            id: true,
            title: true,
            path: true,
            duration: true
          },
          where: {
            duration: { gt: 60 } // Only scenes longer than 1 minute
          }
        });
        
        if (allScenes.length === 0) {
          return res.status(404).json({ 
            error: 'No scenes available for clip generation',
            suggestion: 'Sync with Stash to populate scene library'
          });
        }

        // ALWAYS start by selecting a random scene first
        const randomSceneIndex = Math.floor(Math.random() * allScenes.length);
        const selectedScene = allScenes[randomSceneIndex];
        
        console.log(`🎲 Selected random scene: ${selectedScene.title}`);
        
        let selectedClip;
        
        // Check if this scene has any clips
        const existingClips = await prisma.stashClip.findMany({
          where: { sceneId: selectedScene.id },
          include: {
            scene: {
              select: {
                id: true,
                title: true,
                path: true,
                duration: true
              }
            }
          }
        });
        
        if (existingClips.length > 0) {
          // Scene has clips - check if any are unwatched
          const unwatchedClips = existingClips.filter(clip => !clip.watched);
          
          if (unwatchedClips.length > 0) {
            // Select random unwatched clip from this scene
            const randomIndex = Math.floor(Math.random() * unwatchedClips.length);
            selectedClip = unwatchedClips[randomIndex];
            console.log(`📋 Found ${unwatchedClips.length} unwatched clips, selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedScene.title}`);
          } else {
            // All clips from this scene are watched - reset them and pick random one
            await prisma.stashClip.updateMany({
              where: { sceneId: selectedScene.id },
              data: { 
                watched: false,
                watchedAt: null
              }
            });
            
            // Select random clip from the reset clips
            const randomClipIndex = Math.floor(Math.random() * existingClips.length);
            selectedClip = existingClips[randomClipIndex];
            selectedClip.watched = false;
            console.log(`♻️ Reset ${existingClips.length} clips for scene: ${selectedScene.title}, selected clip ${selectedClip.clipIndex + 1}`);
          }
        } else {
          // Scene has no clips - generate them
          const clipDuration = 60; // 1 minute clips
          
          console.log(`🎬 Generating optimized clips for scene: ${selectedScene.title} (${selectedScene.duration}s)`);
          const clipsToCreate = generateOptimizedClips(selectedScene.id, selectedScene.duration, clipDuration);
          
          if (clipsToCreate.length === 0) {
            return res.status(400).json({ 
              error: 'Selected scene too short for clip generation',
              suggestion: 'Scene must be longer than 60 seconds'
            });
          }
          
          // Bulk create clips
          await prisma.stashClip.createMany({
            data: clipsToCreate
          });
          
          // Get a random generated clip
          const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
          selectedClip = await prisma.stashClip.findFirst({
            where: { 
              sceneId: selectedScene.id,
              clipIndex: randomClipIndex
            },
            include: {
              scene: {
                select: {
                  id: true,
                  title: true,
                  path: true,
                  duration: true
                }
              }
            }
          });
          
          console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
        }
        
        // Get connection status for stream URL
        const settings = await prisma.settings.findFirst();
        let stashUrl = settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                       process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3;
        
        // Normalize URL - remove trailing slashes
        if (stashUrl) {
          stashUrl = stashUrl.replace(/\/+$/, '');
        }
        
        if (!stashUrl) {
          return res.status(400).json({ error: 'Stash URL not configured in settings or environment' });
        }
        
        // Build stream URL (stashUrl is already normalized)
        const streamUrl = `${stashUrl}/scene/${selectedClip.scene.id}/stream`;
        
        // Build Android companion app message
        const androidMessage = {
          type: 'STASH_PLAYBACK',
          action: 'PLAY_CLIP',
          scene: {
            id: selectedClip.scene.id,
            title: selectedClip.scene.title,
            streamUrl: streamUrl,
            startTime: selectedClip.startTime,
            endTime: selectedClip.endTime,
            duration: selectedClip.duration,
            clipIndex: selectedClip.clipIndex + 1, // Human-readable index
            totalClips: Math.floor(selectedClip.scene.duration / 60),
            stashUrl: stashUrl
          },
          clip: {
            id: selectedClip.id,
            clipIndex: selectedClip.clipIndex,
            startTime: selectedClip.startTime,
            endTime: selectedClip.endTime,
            duration: selectedClip.duration
          },
          timestamp: new Date().toISOString()
        };
        
        console.log(`🎯 Selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedClip.scene.title}`);
        console.log(`📱 Emitting Android companion app message (Clip Play):`, JSON.stringify(androidMessage, null, 2));
        
        // Emit WebSocket message to Android companion app
        io.emit('androidCompanion', androidMessage);
        
        // Also attempt HTTP forward for legacy support
        try {
          const fetch = require('node-fetch');
          const response = await fetch('http://localhost:8080/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'play_clip',
              scene: androidMessage.scene,
              clip: androidMessage.clip
            }),
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok) {
            console.log('HTTP clip play command sent successfully to Android app');
          }
        } catch (httpError) {
          console.log('Android HTTP app not available (using WebSocket only)');
        }
        
        // Mark clip as watched
        await prisma.stashClip.update({
          where: { id: selectedClip.id },
          data: { 
            watched: true,
            watchedAt: new Date()
          }
        });
        
        console.log(`✅ Clip ${selectedClip.id} marked as watched`);
        
        // Get current count of unwatched clips across all scenes
        const totalUnwatchedClips = await prisma.stashClip.count({
          where: { watched: false }
        });
        
        res.json({
          message: 'Clip play started successfully',
          clip: selectedClip,
          totalUnwatchedClips: totalUnwatchedClips,
          playbackInfo: {
            streamUrl: streamUrl,
            startTime: selectedClip.startTime,
            endTime: selectedClip.endTime,
            duration: selectedClip.duration
          }
        });
        
      } catch (error) {
        console.error('Error in clip play:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Background sync routes (require stashBackgroundSync)
  if (stashBackgroundSync) {
    // GET /background-sync-status
    router.get('/background-sync-status', async (req, res) => {
      try {
        const status = stashBackgroundSync.getSyncStatus();
        res.json(status);
      } catch (error) {
        console.error('Failed to get Stash background sync status:', error);
        res.status(500).json({ 
          error: 'Failed to get Stash background sync status',
          details: error.message 
        });
      }
    });

    // POST /background-sync/start
    router.post('/background-sync/start', async (req, res) => {
      try {
        await stashBackgroundSync.start();
        res.json({ message: 'Stash background sync service started successfully' });
      } catch (error) {
        console.error('Failed to start Stash background sync:', error);
        res.status(500).json({ 
          error: 'Failed to start Stash background sync',
          details: error.message 
        });
      }
    });

    // POST /background-sync/stop
    router.post('/background-sync/stop', async (req, res) => {
      try {
        await stashBackgroundSync.stop();
        res.json({ message: 'Stash background sync service stopped successfully' });
      } catch (error) {
        console.error('Failed to stop Stash background sync:', error);
        res.status(500).json({ 
          error: 'Failed to stop Stash background sync',
          details: error.message 
        });
      }
    });

    // POST /background-sync/force-now
    router.post('/background-sync/force-now', async (req, res) => {
      try {
        const result = await stashBackgroundSync.forceSyncNow();
        res.json({ message: 'Stash background sync completed', result });
      } catch (error) {
        console.error('Failed to force Stash background sync:', error);
        res.status(500).json({ 
          error: 'Failed to force Stash background sync',
          details: error.message 
        });
      }
    });
  }

  return router;
}

module.exports = createSpecialRoutes;
