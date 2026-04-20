const prisma = require('../prismaClient');
const StashWikiService = require('./StashWikiService');

class StashWikiBackgroundService {
  constructor() {
    this.stashWikiService = new StashWikiService();
    this.isRunning = false;
    this.currentTimer = null;
    this.syncInProgress = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Stash wiki background service is already running');
      return;
    }

    console.log('Starting stash wiki background generation service...');
    this.isRunning = true;
    await this.scheduleNextGeneration();
    console.log('Stash wiki background generation service started');
  }

  async stop() {
    if (!this.isRunning) return;

    console.log('Stopping stash wiki background generation service...');
    this.isRunning = false;
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    console.log('Stash wiki background generation service stopped');
  }

  async scheduleNextGeneration() {
    if (!this.isRunning) return;

    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const enabled = settings?.stashWikiAutoGenEnabled ?? false;

      if (!enabled) {
        console.log('Stash wiki auto-generation is disabled, will check again in 10 minutes');
        this.currentTimer = setTimeout(() => this.scheduleNextGeneration(), 10 * 60 * 1000);
        return;
      }

      const intervalMinutes = settings?.stashWikiAutoGenInterval || 120;
      const intervalMs = intervalMinutes * 60 * 1000;

      console.log(`Next stash wiki generation scheduled in ${intervalMinutes} minutes`);

      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
      }

      this.currentTimer = setTimeout(async () => {
        await this.runGeneration();
        await this.scheduleNextGeneration();
      }, intervalMs);
    } catch (error) {
      console.error('Error scheduling stash wiki generation:', error);
      this.currentTimer = setTimeout(() => this.scheduleNextGeneration(), 60 * 60 * 1000);
    }
  }

  async runGeneration() {
    if (this.syncInProgress) {
      console.log('Stash wiki generation already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    console.log('Running stash wiki background generation...');

    try {
      // Generate wiki pages for any unprocessed tags
      const result = await this.stashWikiService.generateFromTags();

      if (result.pages.length > 0) {
        console.log(`Stash wiki: Generated ${result.pages.length} new pages from ${result.processed} tags`);
      } else {
        console.log('Stash wiki: No new tags to process');
      }

      // Generate performer wiki pages for any unprocessed performers
      const performerResult = await this.stashWikiService.generatePerformerPages();

      if (performerResult.pages.length > 0) {
        console.log(`Stash wiki: Generated ${performerResult.pages.length} new performer pages`);
      } else {
        console.log('Stash wiki: No new performers to process');
      }

      // Update last generation time
      await prisma.settings.upsert({
        where: { id: 1 },
        update: { lastStashWikiGenAt: new Date() },
        create: { id: 1, lastStashWikiGenAt: new Date() }
      });

      console.log('Stash wiki background generation completed');
    } catch (error) {
      console.error('Stash wiki background generation failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

module.exports = StashWikiBackgroundService;
