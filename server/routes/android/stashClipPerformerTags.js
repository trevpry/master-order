/**
 * Android Stash Clip Performer Tag Routes
 * Handles tagging specific performers in specific clips
 */

const express = require('express');

/**
 * Create Stash Clip Performer Tag routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createStashClipPerformerTagRoutes(prisma) {
  const router = express.Router();

  /**
   * POST /android/stash/clip/:clipId/performer/:performerId/tags
   * Add tags to a specific performer in a specific clip
   * This creates MULTIPLE relationships:
   * 1. clip + performer + tag (StashClipPerformerTag)
   * 2. scene + performer + tag (StashScenePerformerTag) - NEW!
   * 3. clip + tag (StashClipTag)
   * 4. performer + tag (StashPerformerTag)
   * 
   * When tagging via the clip overlay, tags are applied to both the clip-level
   * and scene-level performer relationships for consistency.
   */
  router.post('/stash/clip/:clipId/performer/:performerId/tags', async (req, res) => {
    const clipId = parseInt(req.params.clipId);
    const performerId = req.params.performerId;
    const { tagIds } = req.body;

    console.log('📱 Android app adding tags to clip-performer:', {
      clipId,
      performerId,
      tagIds
    });

    try {
      // Validate inputs
      if (isNaN(clipId)) {
        return res.status(400).json({ error: 'Invalid clip ID' });
      }

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({ error: 'tagIds must be a non-empty array' });
      }

      // Verify clip exists and get its scene
      const clip = await prisma.stashClip.findUnique({
        where: { id: clipId },
        include: {
          scene: true
        }
      });

      if (!clip) {
        return res.status(404).json({ error: 'Clip not found' });
      }

      if (!clip.scene) {
        return res.status(400).json({ error: 'Clip has no associated scene' });
      }

      const sceneId = clip.scene.id;

      // Verify performer exists
      const performer = await prisma.stashPerformer.findUnique({
        where: { id: performerId }
      });

      if (!performer) {
        return res.status(404).json({ error: 'Performer not found' });
      }

      // Verify all tags exist
      const tags = await prisma.stashTag.findMany({
        where: { id: { in: tagIds } }
      });

      if (tags.length !== tagIds.length) {
        return res.status(404).json({ error: 'One or more tags not found' });
      }

      // Create clip-performer-tag associations
      const clipPerformerTagsData = tagIds.map(tagId => ({
        clipId,
        performerId,
        tagId
      }));

      await prisma.stashClipPerformerTag.createMany({
        data: clipPerformerTagsData,
        skipDuplicates: true
      });

      // 🎯 NEW: Also create scene-performer-tag associations
      // When tagging a performer in a clip context, also apply to the scene-performer relationship
      const scenePerformerTagsData = tagIds.map(tagId => ({
        sceneId,
        performerId,
        tagId
      }));

      await prisma.stashScenePerformerTag.createMany({
        data: scenePerformerTagsData,
        skipDuplicates: true
      });

      console.log(`✅ Added tags to both clip-performer AND scene-performer pivots`);

      // Also add tags to the clip (if not already present)
      const clipTagsData = tagIds.map(tagId => ({
        clipId,
        tagId
      }));

      await prisma.stashClipTag.createMany({
        data: clipTagsData,
        skipDuplicates: true
      });

      // Also add tags to the performer (if not already present)
      const performerTagsData = tagIds.map(tagId => ({
        performerId,
        tagId
      }));

      await prisma.stashPerformerTag.createMany({
        data: performerTagsData,
        skipDuplicates: true
      });

      console.log('✅ Successfully added tags to clip-performer and scene-performer combinations');

      res.json({
        success: true,
        message: 'Tags added to clip-performer and scene-performer combinations',
        clipId,
        sceneId,
        performerId,
        tagIds
      });
    } catch (error) {
      console.error('❌ Error adding tags to clip-performer:', error);
      res.status(500).json({
        error: 'Failed to add tags to clip-performer',
        details: error.message
      });
    }
  });

  /**
   * GET /android/stash/clip/:clipId/performer/:performerId/tags
   * Get all tags for a specific performer in a specific clip
   */
  router.get('/stash/clip/:clipId/performer/:performerId/tags', async (req, res) => {
    const clipId = parseInt(req.params.clipId);
    const performerId = req.params.performerId;

    try {
      if (isNaN(clipId)) {
        return res.status(400).json({ error: 'Invalid clip ID' });
      }

      const clipPerformerTags = await prisma.stashClipPerformerTag.findMany({
        where: {
          clipId,
          performerId
        },
        include: {
          tag: true
        }
      });

      res.json({
        clipId,
        performerId,
        tags: clipPerformerTags.map(cpt => cpt.tag)
      });
    } catch (error) {
      console.error('❌ Error fetching clip-performer tags:', error);
      res.status(500).json({
        error: 'Failed to fetch clip-performer tags',
        details: error.message
      });
    }
  });

  return router;
}

module.exports = createStashClipPerformerTagRoutes;
