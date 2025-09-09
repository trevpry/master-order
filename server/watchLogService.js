/**
 * WatchLog Service - Modular Entry Point
 * Phase 5 Modularization: Delegates to specialized service modules
 * 
 * This maintains backward compatibility while using the new modular architecture
 */

// Import the modular WatchLogService
const ModularWatchLogService = require('./services/watchlog');

// Export the modular service to maintain compatibility
module.exports = ModularWatchLogService;
