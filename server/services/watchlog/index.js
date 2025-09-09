/**
 * WatchLog Service Factory
 * Modular service that combines all watch logging domains
 * Phase 5 Modularization: Extracted from monolithic watchLogService.js (1,988 lines → 6 modules)
 */

const WatchSessionService = require('./watchSessionService');
const WatchStatsService = require('./watchStatsService');
const ReadingSessionService = require('./readingSessionService');
const ViewingSessionService = require('./viewingSessionService');
const ActivityStatsService = require('./activityStatsService');
const WatchUtilsService = require('./watchUtilsService');

/**
 * Complete WatchLogService with all logging domains
 * Maintains backward compatibility with the original monolithic service
 */
class WatchLogService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || require('../../prismaClient');
    
    // Initialize modular services
    this.watchSession = new WatchSessionService(this.prisma);
    this.watchStats = new WatchStatsService(this.prisma);
    this.readingSession = new ReadingSessionService(this.prisma);
    this.viewingSession = new ViewingSessionService(this.prisma);
    this.activityStats = new ActivityStatsService(this.prisma);
    this.utils = new WatchUtilsService(this.prisma);
    
    console.log('WatchLogService: Modular services initialized');
  }
  
  // ==================== WATCH SESSION DELEGATION ====================
  
  async startWatching(params) {
    return this.watchSession.startWatching(params);
  }
  
  async completeWatching(watchLogId, params = {}) {
    return this.watchSession.completeWatching(watchLogId, params);
  }
  
  async logWatched(params) {
    return this.watchSession.logWatched(params);
  }
  
  // ==================== WATCH STATS DELEGATION ====================
  
  async getWatchStats(params = {}) {
    return this.watchStats.getWatchStats(params);
  }
  
  async groupWatchStats(watchLogs, groupBy) {
    return this.watchStats.groupWatchStats(watchLogs, groupBy);
  }
  
  calculateTotalStats(watchLogs) {
    return this.watchStats.calculateTotalStats(watchLogs);
  }
  
  async getRecentActivity(limit = 20) {
    return this.watchStats.getRecentActivity(limit);
  }
  
  async getTodayInTimezone() {
    return this.watchStats.getTodayInTimezone();
  }
  
  async getTodayStats() {
    return this.watchStats.getTodayStats();
  }
  
  // ==================== ACTIVITY STATS DELEGATION ====================
  
  async getMediaTypeStats(mediaType, period = 'all', groupBy = 'day', actorSortBy, movieActorSortBy) {
    return this.activityStats.getMediaTypeStats(mediaType, period, groupBy, actorSortBy, movieActorSortBy);
  }
  
  async getCustomOrderStats(period = 'all') {
    return this.activityStats.getCustomOrderStats(period);
  }
  
  async getDailyStats(date) {
    return this.activityStats.getDailyStats(date);
  }
  
  async getMonthlyStats(year, month) {
    return this.activityStats.getMonthlyStats(year, month);
  }
  
  async getActivityTrends(period = 'week', count = 12) {
    return this.activityStats.getActivityTrends(period, count);
  }
  
  async getAllActivityStats(period = 'all', groupBy = 'day') {
    return this.activityStats.getAllActivityStats(period, groupBy);
  }
  
  // ==================== READING SESSION DELEGATION ====================
  
  async startReading(params) {
    return this.readingSession.startReading(params);
  }
  
  async pauseReading(readingLogId) {
    return this.readingSession.pauseReading(readingLogId);
  }
  
  async resumeReading(readingLogId) {
    return this.readingSession.resumeReading(readingLogId);
  }
  
  async stopReading(readingLogId) {
    return this.readingSession.stopReading(readingLogId);
  }
  
  async getActiveReadingSession(customOrderItemId) {
    return this.readingSession.getActiveReadingSession(customOrderItemId);
  }
  
  // ==================== VIEWING SESSION DELEGATION ====================
  
  async startViewing(params) {
    return this.viewingSession.startViewing(params);
  }
  
  async pauseViewing(viewingLogId) {
    return this.viewingSession.pauseViewing(viewingLogId);
  }
  
  async resumeViewing(viewingLogId) {
    return this.viewingSession.resumeViewing(viewingLogId);
  }
  
  async stopViewing(customOrderItemId) {
    return this.viewingSession.stopViewing(customOrderItemId);
  }
  
  async getActiveViewingSession(customOrderItemId) {
    return this.viewingSession.getActiveViewingSession(customOrderItemId);
  }
  
  // ==================== UTILITY DELEGATION ====================
  
  async deleteWatchLog(id) {
    return this.utils.deleteWatchLog(id);
  }
  
  formatWatchTime(minutes) {
    return this.utils.formatWatchTime(minutes);
  }
  
  async getTimezoneAwarePeriodBounds(period) {
    return this.utils.getTimezoneAwarePeriodBounds(period);
  }
  
  async validateCustomOrderItem(customOrderItemId) {
    return this.utils.validateCustomOrderItem(customOrderItemId);
  }
  
  async getWatchLogWithDetails(watchLogId) {
    return this.utils.getWatchLogWithDetails(watchLogId);
  }
  
  calculateSessionTime(startTime, endTime) {
    return this.utils.calculateSessionTime(startTime, endTime);
  }
  
  addFormattedTimeFields(stats) {
    return this.utils.addFormattedTimeFields(stats);
  }
}

module.exports = WatchLogService;
