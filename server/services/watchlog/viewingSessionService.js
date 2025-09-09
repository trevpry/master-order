/**
 * Viewing Session Service
 * Handles web video viewing session management
 */

const { PrismaClient } = require('@prisma/client');

class ViewingSessionService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
  }

  /**
   * Start a viewing session for a web video
   * @param {Object} params - Viewing session parameters
   * @param {string} params.mediaType - 'webvideo'
   * @param {string} params.title - Title of the web video
   * @param {string} params.webUrl - URL of the web video
   * @param {number} params.customOrderItemId - Custom order item ID
   * @returns {Promise<Object>} The created viewing log entry
   */
  async startViewing(params) {
    try {
      // Validate customOrderItemId exists if provided
      if (params.customOrderItemId) {
        const existingItem = await this.prisma.customOrderItem.findUnique({
          where: { id: params.customOrderItemId }
        });
        
        if (!existingItem) {
          console.log(`⚠️  CustomOrderItem ${params.customOrderItemId} not found in startViewing - removing link`);
          params.customOrderItemId = null;
        }
      }

      // Check if there's already an active viewing session for this item
      const activeSession = await this.prisma.watchLog.findFirst({
        where: {
          customOrderItemId: params.customOrderItemId,
          activityType: 'view',
          endTime: null
        }
      });

      if (activeSession) {
        console.log(`Resuming existing viewing session for ${params.title}`);
        // Resume the existing session (unpause it)
        return await this.resumeViewing(activeSession.id);
      }

      const viewingLog = await this.prisma.watchLog.create({
        data: {
          mediaType: params.mediaType,
          activityType: 'view',
          title: params.title,
          seriesTitle: null,
          customOrderItemId: params.customOrderItemId,
          startTime: new Date(),
          endTime: null,
          duration: null, // Web videos don't have a set duration
          totalWatchTime: 0,
          isCompleted: false,
          isPaused: false
        }
      });

      console.log(`Started viewing session for web video: ${params.title}`);
      return viewingLog;
    } catch (error) {
      console.error('Error starting viewing session:', error);
      // If it's a foreign key constraint error, provide more helpful information
      if (error.code === 'P2003' || error.message.includes('Foreign key constraint')) {
        console.error('❌ Foreign key constraint violation - CustomOrderItem may not exist');
        throw new Error('Invalid customOrderItemId: Referenced item does not exist');
      }
      throw error;
    }
  }

  /**
   * Pause an active viewing session (for web videos)
   * @param {number} viewingLogId - ID of the viewing log to pause
   * @returns {Promise<Object>} Updated viewing log
   */
  async pauseViewing(viewingLogId) {
    try {
      const viewingLog = await this.prisma.watchLog.findUnique({
        where: { id: viewingLogId }
      });

      if (!viewingLog) {
        throw new Error('Viewing session not found');
      }

      if (viewingLog.isPaused) {
        // If already paused, resume it
        console.log('Viewing session is paused, resuming...');
        return await this.resumeViewing(viewingLogId);
      }

      // Calculate time since last resume (or start if never paused)
      const now = new Date();
      
      // For active (unpaused) sessions, endTime will be either:
      // - null (never paused before) - use startTime
      // - a resume time (paused and resumed before) - use endTime as last resume time
      const lastActivityTime = (!viewingLog.isPaused && viewingLog.endTime) ? 
        new Date(viewingLog.endTime) : 
        new Date(viewingLog.startTime);
      
      const timeElapsed = Math.floor((now - lastActivityTime) / 1000 / 60); // in minutes

      const updatedLog = await this.prisma.watchLog.update({
        where: { id: viewingLogId },
        data: {
          isPaused: true,
          endTime: now, // Store pause time in endTime
          totalWatchTime: (viewingLog.totalWatchTime || 0) + timeElapsed
        }
      });

      console.log(`Paused viewing session (${timeElapsed} minutes added from last activity)`);
      return updatedLog;
    } catch (error) {
      console.error('Error pausing viewing session:', error);
      throw error;
    }
  }

  /**
   * Resume a paused viewing session (for web videos)
   * @param {number} viewingLogId - ID of the viewing log to resume
   * @returns {Promise<Object>} Updated viewing log
   */
  async resumeViewing(viewingLogId) {
    try {
      const now = new Date();
      
      const updatedLog = await this.prisma.watchLog.update({
        where: { id: viewingLogId },
        data: {
          isPaused: false,
          endTime: now // Set endTime to resume time for next pause calculation
        }
      });

      console.log('Resumed viewing session');
      return updatedLog;
    } catch (error) {
      console.error('Error resuming viewing session:', error);
      throw error;
    }
  }

  /**
   * Stop viewing session for web video
   * @param {number} customOrderItemId - Custom order item ID
   * @returns {Promise<Object>} Updated viewing session
   */
  async stopViewing(customOrderItemId) {
    console.log(`Stopping viewing session for custom order item: ${customOrderItemId}`);
    
    try {
      // Find the active viewing session
      const activeSession = await this.getActiveViewingSession(customOrderItemId);
      
      if (!activeSession) {
        throw new Error('No active viewing session found');
      }

      const endTime = new Date();
      let finalTotalTime = 0;

      if (activeSession.isPaused) {
        // If paused, use the existing totalWatchTime
        finalTotalTime = activeSession.totalWatchTime || 0;
        console.log(`Session was paused. Using existing total time: ${finalTotalTime} minutes`);
      } else {
        // Calculate time from last resume (or start if never paused) to now
        // For active sessions, endTime contains the last resume time (or null if never paused)
        const lastActivityTime = activeSession.endTime ? 
          new Date(activeSession.endTime) : 
          new Date(activeSession.startTime);
        
        const sessionTime = (endTime - lastActivityTime) / (1000 * 60); // Convert to minutes
        finalTotalTime = (activeSession.totalWatchTime || 0) + sessionTime;
        console.log(`Active session time since last activity: ${sessionTime.toFixed(2)} minutes, total: ${finalTotalTime.toFixed(2)} minutes`);
      }

      // Update the session as completed
      const updatedLog = await this.prisma.watchLog.update({
        where: { id: activeSession.id },
        data: {
          endTime: endTime,
          totalWatchTime: Math.round(finalTotalTime * 100) / 100, // Round to 2 decimal places
          isPaused: false,
          isCompleted: true
        }
      });

      // Add totalTime in seconds for client compatibility
      updatedLog.totalTime = finalTotalTime * 60; // Convert minutes to seconds

      console.log(`Completed viewing session: ${finalTotalTime} minutes total`);
      return updatedLog;
    } catch (error) {
      console.error('Error stopping viewing session:', error);
      throw error;
    }
  }

  /**
   * Get active viewing session for a custom order item
   * @param {number} customOrderItemId - Custom order item ID (optional - if not provided, finds any active session)
   * @returns {Promise<Object|null>} Active viewing session or null
   */
  async getActiveViewingSession(customOrderItemId) {
    try {
      const whereClause = customOrderItemId 
        ? {
            customOrderItemId: customOrderItemId,
            activityType: 'view',
            isCompleted: false  // Only consider sessions that aren't completed yet
          }
        : {
            activityType: 'view',
            isCompleted: false  // Only consider sessions that aren't completed yet
          };

      const activeSession = await this.prisma.watchLog.findFirst({
        where: whereClause,
        orderBy: {
          startTime: 'desc'
        }
      });

      return activeSession;
    } catch (error) {
      console.error('Error getting active viewing session:', error);
      return null;
    }
  }
}

module.exports = ViewingSessionService;
