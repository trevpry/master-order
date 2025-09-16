/**
 * Weather Scheduler Service
 * Part of Eddie Life Management - Weather Information Module
 * 
 * Handles scheduled weather summary generation at midnight local time
 * Uses Eddie Settings timezone configuration for local midnight detection
 */

const cron = require('node-cron');
const WeatherSummaryService = require('./WeatherSummaryService');
const { PrismaClient } = require('@prisma/client');

class WeatherSchedulerService {
  constructor() {
    this.prisma = new PrismaClient();
    this.weatherSummaryService = new WeatherSummaryService();
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Get current timezone from Eddie Settings
   */
  async getCurrentTimezone() {
    try {
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      return eddieSettings?.timezone || 'UTC';
    } catch (error) {
      console.error('Error getting timezone from Eddie Settings:', error);
      return 'UTC';
    }
  }

  /**
   * Convert timezone to cron timezone string
   * Maps common timezone names to cron-compatible timezone strings
   */
  getCronTimezone(timezone) {
    // Common timezone mappings for node-cron
    const timezoneMap = {
      'UTC': 'UTC',
      'America/New_York': 'America/New_York',
      'America/Chicago': 'America/Chicago',
      'America/Denver': 'America/Denver',
      'America/Los_Angeles': 'America/Los_Angeles',
      'America/Toronto': 'America/Toronto',
      'America/Vancouver': 'America/Vancouver',
      'Europe/London': 'Europe/London',
      'Europe/Paris': 'Europe/Paris',
      'Europe/Berlin': 'Europe/Berlin',
      'Europe/Rome': 'Europe/Rome',
      'Asia/Tokyo': 'Asia/Tokyo',
      'Asia/Shanghai': 'Asia/Shanghai',
      'Asia/Kolkata': 'Asia/Kolkata',
      'Australia/Sydney': 'Australia/Sydney',
      'Australia/Melbourne': 'Australia/Melbourne'
    };

    return timezoneMap[timezone] || timezone;
  }

  /**
   * Execute weather summary generation for yesterday
   */
  async executeWeatherSummaryTask() {
    try {
      console.log('🌤️ Starting scheduled weather summary generation...');
      
      // Check if weather is enabled
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      if (!eddieSettings?.weatherEnabled) {
        console.log('🌤️ Weather is disabled in Eddie Settings, skipping weather summary');
        return;
      }

      // Generate yesterday's weather summary
      const result = await this.weatherSummaryService.generateYesterdayWeatherSummary();
      
      if (result) {
        console.log('🌤️ Weather summary generated successfully:', {
          date: result.date,
          conditions: result.conditions,
          tempMin: result.tempMin,
          tempMax: result.tempMax
        });
      } else {
        console.log('🌤️ Weather summary generation skipped (weather disabled or no location set)');
      }

      // Clean up old weather summaries (keep last year)
      await this.weatherSummaryService.cleanupOldWeatherSummaries();
      
    } catch (error) {
      console.error('🌤️ Error during scheduled weather summary generation:', error);
    }
  }

  /**
   * Start the weather scheduler with timezone-aware midnight execution
   */
  async start() {
    try {
      if (this.isRunning) {
        console.log('🌤️ Weather scheduler is already running');
        return;
      }

      // Get current timezone
      const timezone = await this.getCurrentTimezone();
      const cronTimezone = this.getCronTimezone(timezone);
      
      console.log(`🌤️ Starting weather scheduler...`);
      console.log(`🌤️ Timezone: ${timezone} (cron: ${cronTimezone})`);
      console.log(`🌤️ Schedule: Daily at 12:05 AM local time`);

      // Schedule to run at 12:05 AM every day in the configured timezone
      // Using 12:05 instead of 12:00 to avoid potential midnight conflicts
      this.cronJob = cron.schedule('5 0 * * *', async () => {
        await this.executeWeatherSummaryTask();
      }, {
        scheduled: true,
        timezone: cronTimezone
      });

      this.isRunning = true;
      console.log('✅ Weather scheduler started successfully');
      
      // Run initial check to ensure settings are valid
      try {
        const eddieSettings = await this.prisma.eddieSettings.findFirst();
        if (eddieSettings?.weatherEnabled) {
          console.log(`🌤️ Weather summary will be generated daily at 12:05 AM ${timezone}`);
          console.log(`🌤️ Weather location: ${eddieSettings.weatherLocation || 'Not set'}`);
          console.log(`🌤️ Weather API key: ${eddieSettings.weatherApiKey ? 'Configured' : 'Not configured'}`);
        } else {
          console.log('🌤️ Weather is currently disabled in Eddie Settings');
        }
      } catch (error) {
        console.error('🌤️ Error checking weather settings:', error);
      }
      
    } catch (error) {
      console.error('❌ Failed to start weather scheduler:', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the weather scheduler
   */
  async stop() {
    try {
      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }
      this.isRunning = false;
      console.log('🌤️ Weather scheduler stopped');
    } catch (error) {
      console.error('❌ Error stopping weather scheduler:', error);
    }
  }

  /**
   * Restart the weather scheduler (useful when timezone settings change)
   */
  async restart() {
    console.log('🌤️ Restarting weather scheduler...');
    await this.stop();
    await this.start();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasScheduledJob: !!this.cronJob,
      nextExecution: this.cronJob ? 'Daily at 12:05 AM local time' : null
    };
  }

  /**
   * Manually trigger weather summary generation (for testing)
   */
  async triggerManualExecution() {
    console.log('🌤️ Manual weather summary generation triggered...');
    await this.executeWeatherSummaryTask();
  }
}

module.exports = WeatherSchedulerService;