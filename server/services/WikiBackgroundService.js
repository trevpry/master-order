const prisma = require('../prismaClient');
const WikiService = require('./WikiService');

class WikiBackgroundService {
  constructor() {
    this.wikiService = new WikiService();
    this.isRunning = false;
    this.currentTimer = null;
    this.syncInProgress = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Wiki background service is already running');
      return;
    }

    console.log('Starting wiki background ingest service...');
    this.isRunning = true;
    await this.scheduleNextIngest();
    console.log('Wiki background ingest service started');
  }

  async stop() {
    if (!this.isRunning) return;

    console.log('Stopping wiki background ingest service...');
    this.isRunning = false;
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    console.log('Wiki background ingest service stopped');
  }

  async scheduleNextIngest() {
    if (!this.isRunning) return;

    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const enabled = settings?.wikiAutoIngestEnabled ?? true;

      if (!enabled) {
        console.log('Wiki auto-ingest is disabled, will check again in 10 minutes');
        this.currentTimer = setTimeout(() => this.scheduleNextIngest(), 10 * 60 * 1000);
        return;
      }

      const intervalMinutes = settings?.wikiAutoIngestInterval || 60;
      const intervalMs = intervalMinutes * 60 * 1000;

      console.log(`Next wiki ingest scheduled in ${intervalMinutes} minutes`);

      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
      }

      this.currentTimer = setTimeout(async () => {
        await this.runIngest();
        await this.scheduleNextIngest();
      }, intervalMs);
    } catch (error) {
      console.error('Error scheduling wiki ingest:', error);
      this.currentTimer = setTimeout(() => this.scheduleNextIngest(), 60 * 60 * 1000);
    }
  }

  async runIngest() {
    if (this.syncInProgress) {
      console.log('Wiki ingest already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    console.log('Running wiki background ingest...');

    try {
      // 1. Ingest notes modified since last ingest
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const lastIngest = settings?.lastWikiIngestAt;

      if (lastIngest) {
        const modifiedNotes = await prisma.note.findMany({
          where: {
            updatedAt: { gt: lastIngest },
            content: { not: '' }
          },
          select: { id: true }
        });

        if (modifiedNotes.length > 0) {
          console.log(`Wiki: Found ${modifiedNotes.length} notes modified since last ingest`);
          const noteIds = modifiedNotes.map(n => n.id);
          // Process in batches of 5
          for (let i = 0; i < noteIds.length; i += 5) {
            const batch = noteIds.slice(i, i + 5);
            await this.wikiService.ingestNotes(batch);
          }
        }
      }

      // 1b. Ingest dating-section records modified since last ingest
      const datingResult = await this.wikiService.ingestDatingData(lastIngest || null);
      if (datingResult.processed > 0) {
        console.log(`Wiki: Ingested ${datingResult.processed} updated dating records`);
      }

      // 2. Backfill chat extraction for any un-extracted messages
      const unextractedCount = await prisma.chatMessage.count({
        where: { wikiExtracted: false, role: 'user' }
      });

      if (unextractedCount > 0) {
        console.log(`Wiki: Found ${unextractedCount} unextracted chat messages`);
        await this.wikiService.backfillChatExtraction(10);
      }

      // Update last ingest time
      await prisma.settings.upsert({
        where: { id: 1 },
        update: { lastWikiIngestAt: new Date() },
        create: { id: 1, lastWikiIngestAt: new Date() }
      });

      console.log('Wiki background ingest completed');
    } catch (error) {
      console.error('Wiki background ingest failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

module.exports = WikiBackgroundService;
