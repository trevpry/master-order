/**
 * Reading Session Service
 * Handles reading session management (books, comics, short stories)
 */

const { PrismaClient } = require('@prisma/client');

class ReadingSessionService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
  }

  /**
   * Start a reading session for an item
   * @param {Object} params - Reading session parameters
   * @param {string} params.mediaType - 'book', 'comic', or 'shortstory'
   * @param {string} params.title - Title of the content
   * @param {string} params.seriesTitle - Series title (for comics)
   * @param {number} params.customOrderItemId - Custom order item ID
   * @returns {Promise<Object>} The created reading log entry
   */
  async startReading(params) {
    try {
      // Validate customOrderItemId exists if provided
      if (params.customOrderItemId) {
        const existingItem = await this.prisma.customOrderItem.findUnique({
          where: { id: params.customOrderItemId }
        });
        
        if (!existingItem) {
          console.log(`⚠️  CustomOrderItem ${params.customOrderItemId} not found in startReading - removing link`);
          params.customOrderItemId = null;
        }
      }

      // Check if there's already an active reading session for this item
      const activeSession = await this.prisma.watchLog.findFirst({
        where: {
          customOrderItemId: params.customOrderItemId,
          activityType: 'read',
          endTime: null
        }
      });

      if (activeSession) {
        console.log(`Resuming existing reading session for ${params.title}`);
        // Resume the existing session (unpause it)
        return await this.resumeReading(activeSession.id);
      }

      const readingLog = await this.prisma.watchLog.create({
        data: {
          mediaType: params.mediaType,
          activityType: 'read',
          title: params.title,
          seriesTitle: params.seriesTitle || null,
          customOrderItemId: params.customOrderItemId,
          startTime: new Date(),
          endTime: null,
          duration: null, // No set duration for reading
          totalWatchTime: 0,
          isCompleted: false,
          isPaused: false
        }
      });

      console.log(`Started reading session for ${params.mediaType}: ${params.title}`);
      return readingLog;
    } catch (error) {
      console.error('Error starting reading session:', error);
      // If it's a foreign key constraint error, provide more helpful information
      if (error.code === 'P2003' || error.message.includes('Foreign key constraint')) {
        console.error('❌ Foreign key constraint violation - CustomOrderItem may not exist');
        throw new Error('Invalid customOrderItemId: Referenced item does not exist');
      }
      throw error;
    }
  }

  /**
   * Pause an active reading session
   * @param {number} readingLogId - ID of the reading log to pause
   * @returns {Promise<Object>} Updated reading log
   */
  async pauseReading(readingLogId) {
    try {
      const readingLog = await this.prisma.watchLog.findUnique({
        where: { id: readingLogId }
      });

      if (!readingLog) {
        throw new Error('Reading session not found');
      }

      if (readingLog.isPaused) {
        // If already paused, resume it
        console.log('Reading session is paused, resuming...');
        return await this.resumeReading(readingLogId);
      }

      // Calculate time since last resume (or start if never paused)
      const now = new Date();
      const sessionStartTime = readingLog.endTime ? new Date(readingLog.endTime) : new Date(readingLog.startTime);
      const timeElapsed = Math.floor((now - sessionStartTime) / 1000 / 60); // in minutes

      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          isPaused: true,
          endTime: now, // Temporarily store pause time in endTime
          totalWatchTime: (readingLog.totalWatchTime || 0) + timeElapsed
        }
      });

      console.log(`Paused reading session (${timeElapsed} minutes added)`);
      return updatedLog;
    } catch (error) {
      console.error('Error pausing reading session:', error);
      throw error;
    }
  }

  /**
   * Resume a paused reading session
   * @param {number} readingLogId - ID of the reading log to resume
   * @returns {Promise<Object>} Updated reading log
   */
  async resumeReading(readingLogId) {
    try {
      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          isPaused: false,
          endTime: null // Clear the temporary pause time
        }
      });

      console.log('Resumed reading session');
      return updatedLog;
    } catch (error) {
      console.error('Error resuming reading session:', error);
      throw error;
    }
  }

  /**
   * Stop and complete a reading session
   * @param {number} readingLogId - ID of the reading log to stop
   * @returns {Promise<Object>} Completed reading log
   */
  async stopReading(readingLogId) {
    try {
      const readingLog = await this.prisma.watchLog.findUnique({
        where: { id: readingLogId }
      });

      if (!readingLog) {
        throw new Error('Reading session not found');
      }

      const now = new Date();
      let finalTotalTime = readingLog.totalWatchTime || 0;

      // If not paused, add the time since last resume
      if (!readingLog.isPaused) {
        const sessionStartTime = readingLog.endTime ? new Date(readingLog.endTime) : new Date(readingLog.startTime);
        const timeElapsed = Math.floor((now - sessionStartTime) / 1000 / 60); // in minutes
        finalTotalTime += timeElapsed;
      }

      // If total time is less than 1 minute, delete the session instead of completing it
      if (finalTotalTime < 1) {
        await this.prisma.watchLog.delete({
          where: { id: readingLogId }
        });
        
        console.log(`Deleted reading session with ${finalTotalTime} minutes (less than 1 minute)`);
        
        // Return a special response indicating the session was deleted
        return {
          deleted: true,
          totalTime: finalTotalTime * 60, // Convert to seconds for client
          message: 'Reading session deleted (less than 1 minute)'
        };
      }

      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          endTime: now,
          totalWatchTime: finalTotalTime,
          isCompleted: false, // Don't automatically mark as completed - let the frontend decide based on progress
          isPaused: false
        }
      });

      // Add totalTime in seconds for client compatibility
      updatedLog.totalTime = finalTotalTime * 60; // Convert minutes to seconds

      console.log(`Completed reading session: ${finalTotalTime} minutes total`);
      return updatedLog;
    } catch (error) {
      console.error('Error stopping reading session:', error);
      throw error;
    }
  }

  /**
   * Get active reading session for a custom order item
   * @param {number} customOrderItemId - Custom order item ID (optional - if not provided, finds any active session)
   * @returns {Promise<Object|null>} Active reading session or null
   */
  async getActiveReadingSession(customOrderItemId) {
    try {
      const whereClause = customOrderItemId 
        ? {
            customOrderItemId: customOrderItemId,
            activityType: 'read',
            OR: [
              { endTime: null },  // Not ended
              { AND: [{ endTime: { not: null } }, { isPaused: true }] }  // Paused (has endTime but is paused)
            ]
          }
        : {
            activityType: 'read',
            OR: [
              { endTime: null },  // Not ended
              { AND: [{ endTime: { not: null } }, { isPaused: true }] }  // Paused (has endTime but is paused)
            ]
          };

      const activeSession = await this.prisma.watchLog.findFirst({
        where: whereClause,
        orderBy: {
          startTime: 'desc'
        }
      });

      return activeSession;
    } catch (error) {
      console.error('Error getting active reading session:', error);
      return null;
    }
  }
}

module.exports = ReadingSessionService;
