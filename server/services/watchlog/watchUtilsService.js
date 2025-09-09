/**
 * Watch Utils Service
 * Provides utility functions for watch log operations
 */

const { PrismaClient } = require('@prisma/client');

class WatchUtilsService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
  }

  /**
   * Format time in minutes to a readable format
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  formatWatchTime(minutes) {
    if (!minutes || minutes === 0) return '0 minutes';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    } else {
      return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
    }
  }

  /**
   * Delete a watch log entry
   * @param {number} id - Watch log ID to delete
   * @returns {Promise<Object>} Deleted watch log
   */
  async deleteWatchLog(id) {
    try {
      const deletedLog = await this.prisma.watchLog.delete({
        where: { id: parseInt(id) }
      });

      console.log(`Deleted watch log entry: ${deletedLog.title} (ID: ${id})`);
      return deletedLog;
    } catch (error) {
      console.error('Error deleting watch log:', error);
      throw error;
    }
  }

  /**
   * Get timezone-aware period bounds
   * @param {string} period - Time period ('today', 'week', 'month', 'year')
   * @returns {Promise<Object>} Start and end dates for the period
   */
  async getTimezoneAwarePeriodBounds(period) {
    const { getSettings } = require('../../databaseUtils');
    const settings = await getSettings();
    const timezone = settings?.timezone || 'UTC';

    const now = new Date();
    const todayInTZ = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const [year, month, day] = todayInTZ.split('-').map(n => parseInt(n));

    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = new Date(`${todayInTZ}T00:00:00`);
        endDate = new Date(`${todayInTZ}T23:59:59.999`);
        break;
      case 'week':
        const weekStartDate = new Date(year, month - 1, day);
        weekStartDate.setDate(day - weekStartDate.getDay()); // Start of week (Sunday)
        const weekStartString = weekStartDate.toLocaleDateString('en-CA');
        startDate = new Date(`${weekStartString}T00:00:00`);
        
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6); // End of week (Saturday)
        const weekEndString = weekEndDate.toLocaleDateString('en-CA');
        endDate = new Date(`${weekEndString}T23:59:59.999`);
        break;
      case 'month':
        const monthStartString = `${year}-${String(month).padStart(2, '0')}-01`;
        startDate = new Date(`${monthStartString}T00:00:00`);
        
        const monthEndDate = new Date(year, month, 0); // Last day of month
        const monthEndString = monthEndDate.toLocaleDateString('en-CA');
        endDate = new Date(`${monthEndString}T23:59:59.999`);
        break;
      case 'year':
        startDate = new Date(`${year}-01-01T00:00:00`);
        endDate = new Date(`${year}-12-31T23:59:59.999`);
        break;
      default:
        return { startDate: null, endDate: null };
    }

    // Convert to UTC by adjusting for timezone offset
    const testDate = new Date(`${todayInTZ}T12:00:00`);
    const utcTime = testDate.getTime();
    const tzTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone })).getTime();
    const offsetMs = utcTime - tzTime;

    return {
      startDate: new Date(startDate.getTime() + offsetMs),
      endDate: new Date(endDate.getTime() + offsetMs)
    };
  }

  /**
   * Validate custom order item exists
   * @param {number} customOrderItemId - Custom order item ID
   * @returns {Promise<boolean>} Whether the item exists
   */
  async validateCustomOrderItem(customOrderItemId) {
    if (!customOrderItemId) return true;

    try {
      const existingItem = await this.prisma.customOrderItem.findUnique({
        where: { id: customOrderItemId }
      });
      
      if (!existingItem) {
        console.log(`⚠️  CustomOrderItem ${customOrderItemId} not found`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating custom order item:', error);
      return false;
    }
  }

  /**
   * Get watch log with custom order item details
   * @param {number} watchLogId - Watch log ID
   * @returns {Promise<Object|null>} Watch log with custom order item details
   */
  async getWatchLogWithDetails(watchLogId) {
    try {
      const watchLog = await this.prisma.watchLog.findUnique({
        where: { id: watchLogId },
        include: {
          customOrderItem: {
            select: {
              id: true,
              title: true,
              customOrder: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      return watchLog;
    } catch (error) {
      console.error('Error getting watch log with details:', error);
      return null;
    }
  }

  /**
   * Calculate session time from start/end timestamps
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @returns {number} Session time in minutes
   */
  calculateSessionTime(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const timeDiff = new Date(endTime) - new Date(startTime);
    return Math.floor(timeDiff / 1000 / 60); // Convert to minutes
  }

  /**
   * Add formatted time fields to statistics objects
   * @param {Object} stats - Statistics object to enhance
   * @returns {Object} Enhanced statistics with formatted time fields
   */
  addFormattedTimeFields(stats) {
    const enhanced = { ...stats };
    
    // Add formatted fields for any time-related properties
    Object.keys(stats).forEach(key => {
      if (key.includes('Time') && typeof stats[key] === 'number') {
        enhanced[`${key}Formatted`] = this.formatWatchTime(stats[key]);
      }
    });

    return enhanced;
  }
}

module.exports = WatchUtilsService;
