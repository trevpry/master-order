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
   * This creates a three-way relationship: clip + performer + tag
   * Also adds the tag to both the clip and the performer separately
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

      // Verify clip exists
      const clip = await prisma.stashClip.findUnique({
        where: { id: clipId }
      });

      if (!clip) {
        return res.status(404).json({ error: 'Clip not found' });
      }

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

      console.log('✅ Successfully added tags to clip-performer combination');

      res.json({
        success: true,
        message: 'Tags added to clip-performer combination',
        clipId,
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
