/**
 * StashSceneDeletionService
 * ---------------------------------------
 * Provides reusable business logic to delete a Stash scene (locally and remotely)
 * by supplying a clip ID. This encapsulates:
 *  - Resolving clip -> scene relationship
 *  - Local transactional deletion of all clips + the scene
 *  - Optional remote deletion via configured Stash GraphQL API
 *
 * Design Notes:
 *  - Reuses existing singleton `stashService` for remote deletion (no duplication of GraphQL logic)
 *  - Does NOT instantiate a new PrismaClient (uses injected or shared client to avoid connection bloat)
 *  - Returns a structured result object that callers (e.g., Android routes, future web routes) can format
 */

const stashServiceSingleton = require('../stashService');
const sharedPrisma = require('../prismaClient');

class StashSceneDeletionService {
  /**
   * @param {PrismaClient} prisma - Optional prisma instance (defaults to shared client)
   * @param {Object} stashService - Optional stash service (defaults to singleton)
   */
  constructor(prisma = sharedPrisma, stashService = stashServiceSingleton) {
    this.prisma = prisma;
    this.stashService = stashService;
  }

  /**
   * Delete a scene by providing a clip ID.
   * @param {number} clipId - ID of the clip whose parent scene should be deleted
   * @param {Object} options
   * @param {boolean} [options.deleteFile=true] - Whether to delete the actual media file remotely
   * @param {boolean} [options.deleteGenerated=true] - Whether to delete generated assets remotely
   * @returns {Promise<Object>} Result structure
   */
  async deleteSceneByClipId(clipId, options = {}) {
    const { deleteFile = true, deleteGenerated = true } = options;

    if (clipId === undefined || clipId === null || Number.isNaN(Number(clipId))) {
      return {
        success: false,
        status: 400,
        error: 'INVALID_CLIP_ID',
        message: 'A valid numeric clipId is required'
      };
    }

    // 1. Resolve clip -> scene
    const clip = await this.prisma.stashClip.findUnique({
      where: { id: Number(clipId) },
      select: { id: true, sceneId: true }
    });

    if (!clip) {
      return {
        success: false,
        status: 404,
        error: 'CLIP_NOT_FOUND',
        message: `Clip ${clipId} not found`
      };
    }

    const sceneId = clip.sceneId;

    // 2. Local deletion (clips + scene) wrapped for consistency
    let local = { sceneDeleted: false, clipsDeleted: 0 };
    try {
      // Delete all clips for scene, then scene itself
      const clipDeletionResult = await this.prisma.stashClip.deleteMany({ where: { sceneId } });
      local.clipsDeleted = clipDeletionResult.count;

      await this.prisma.stashScene.delete({ where: { id: sceneId } });
      local.sceneDeleted = true;
    } catch (error) {
      // Prisma not found error code
      if (error.code === 'P2025') {
        local.sceneDeleted = false;
      } else {
        return {
          success: false,
          status: 500,
          error: 'LOCAL_DELETION_FAILED',
          message: `Failed to delete scene locally: ${error.message}`,
          sceneId,
          local
        };
      }
    }

    // 3. Remote deletion (optional if stash is configured)
    let remote = { attempted: false, success: false };
    if (this.stashService && this.stashService.isConfigured()) {
      remote.attempted = true;
      try {
        const stashResult = await this.stashService.deleteScene(sceneId, deleteFile, deleteGenerated);
        remote = { ...remote, ...stashResult };
      } catch (err) {
        remote.error = err.message;
      }
    } else {
      remote.message = 'Stash service not configured';
    }

    return {
      success: true,
      status: 200,
      sceneId,
      clipId: Number(clipId),
      local,
      remote,
      message: remote.success
        ? 'Scene deleted locally and remotely'
        : 'Scene deleted locally; remote deletion skipped or failed'
    };
  }
}

module.exports = StashSceneDeletionService;
