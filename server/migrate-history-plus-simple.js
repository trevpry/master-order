#!/usr/bin/env node

/**
 * Simple History Plus Migration - Run from server directory
 */

const readline = require('readline');
const { execSync } = require('child_process');

async function main() {
  console.log('🚀 History Plus Migration Tool');
  console.log('📍 Make sure you\'re running this from the server/ directory');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Get PostgreSQL connection string
  const postgresUrl = await new Promise((resolve) => {
    rl.question('Enter your PostgreSQL connection string: ', resolve);
  });

  console.log('\n📋 Migration Steps:');
  console.log('1. First, I\'ll run analysis on your local SQLite database');
  console.log('2. Then switch to PostgreSQL and run the migration');
  console.log('3. Finally restore your original environment');

  const proceed = await new Promise((resolve) => {
    rl.question('\nProceed? (yes/no): ', resolve);
  });

  rl.close();

  if (proceed.toLowerCase() !== 'yes') {
    console.log('❌ Migration cancelled');
    return;
  }

  try {
    // Step 1: Backup current DATABASE_URL
    const originalDbUrl = process.env.DATABASE_URL || 'file:../master_order.db';
    console.log('\n📦 Backing up current environment...');
    console.log(`Original DATABASE_URL: ${originalDbUrl.replace(/\/\/.*@/, '//***@')}`);

    // Step 2: Set PostgreSQL URL and regenerate Prisma client
    console.log('🔄 Configuring PostgreSQL connection...');
    process.env.DATABASE_URL = postgresUrl;
    
    // Step 3: Setup PostgreSQL schema
    console.log('📝 Setting up PostgreSQL schema...');
    execSync('node setup-schema.js', { stdio: 'inherit' });
    
    // Step 4: Try to regenerate Prisma client for PostgreSQL
    console.log('🔧 Generating Prisma client for PostgreSQL...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (generateError) {
      console.log('⚠️ Prisma generate failed, trying to continue with existing client...');
      console.log('This might work if the schema hasn\'t changed significantly.');
    }

    // Step 5: Run the migration script
    console.log('🚀 Running migration...');
    
    // Create a simple migration runner
    const { PrismaClient } = require('@prisma/client');
    
    // SQLite client (restore original env temporarily)
    process.env.DATABASE_URL = 'file:../master_order.db';
    const sqlitePrisma = new PrismaClient();
    
    // PostgreSQL client
    process.env.DATABASE_URL = postgresUrl;
    delete require.cache[require.resolve('@prisma/client')];
    const { PrismaClient: PostgresPrismaClient } = require('@prisma/client');
    const postgresPrisma = new PostgresPrismaClient();

    console.log('🔍 Testing connections...');
    
    // Test SQLite
    await sqlitePrisma.$queryRaw`SELECT 1`;
    console.log('✅ SQLite connection OK');
    
    // Test PostgreSQL
    await postgresPrisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connection OK');

    // Count records to migrate
    console.log('📊 Analyzing data...');
    const counts = {
      events: await sqlitePrisma.historicalEvent.count(),
      videos: await sqlitePrisma.historyVideo.count(),
      books: await sqlitePrisma.historyBook.count(),
      chapters: await sqlitePrisma.historyChapter.count(),
      sections: await sqlitePrisma.historySection.count(),
      channels: await sqlitePrisma.historyChannel.count()
    };

    console.log('📈 Found data to migrate:');
    Object.entries(counts).forEach(([key, count]) => {
      if (count > 0) console.log(`   ${key}: ${count}`);
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
      console.log('ℹ️  No History Plus data found to migrate');
      return;
    }

    // Run migration (safe CREATE-only operations)
    console.log(`\n🔄 Migrating ${total} records...`);
    
    await postgresPrisma.$transaction(async (tx) => {
      // Migrate channels first (no dependencies)
      if (counts.channels > 0) {
        console.log('📺 Migrating channels...');
        const channels = await sqlitePrisma.historyChannel.findMany();
        for (const channel of channels) {
          const existing = await tx.historyChannel.findUnique({ where: { id: channel.id } });
          if (!existing) {
            await tx.historyChannel.create({ data: channel });
          }
        }
      }

      // Migrate events (no dependencies)
      if (counts.events > 0) {
        console.log('📅 Migrating events...');
        const events = await sqlitePrisma.historicalEvent.findMany();
        for (const event of events) {
          const existing = await tx.historicalEvent.findUnique({ where: { id: event.id } });
          if (!existing) {
            await tx.historicalEvent.create({ data: event });
          }
        }
      }

      // Migrate videos (depends on events/channels)
      if (counts.videos > 0) {
        console.log('🎥 Migrating videos...');
        const videos = await sqlitePrisma.historyVideo.findMany();
        for (const video of videos) {
          const existing = await tx.historyVideo.findUnique({ where: { id: video.id } });
          if (!existing) {
            await tx.historyVideo.create({ data: video });
          }
        }
      }

      // Migrate books (depends on events)
      if (counts.books > 0) {
        console.log('📚 Migrating books...');
        const books = await sqlitePrisma.historyBook.findMany();
        for (const book of books) {
          const existing = await tx.historyBook.findUnique({ where: { id: book.id } });
          if (!existing) {
            await tx.historyBook.create({ data: book });
          }
        }
      }

      // Migrate chapters (depends on books)
      if (counts.chapters > 0) {
        console.log('📖 Migrating chapters...');
        const chapters = await sqlitePrisma.historyChapter.findMany();
        for (const chapter of chapters) {
          const existing = await tx.historyChapter.findUnique({ where: { id: chapter.id } });
          if (!existing) {
            await tx.historyChapter.create({ data: chapter });
          }
        }
      }

      // Migrate sections (depends on chapters)
      if (counts.sections > 0) {
        console.log('📄 Migrating sections...');
        const sections = await sqlitePrisma.historySection.findMany();
        for (const section of sections) {
          const existing = await tx.historySection.findUnique({ where: { id: section.id } });
          if (!existing) {
            await tx.historySection.create({ data: section });
          }
        }
      }

      // Migrate user progress data
      console.log('👤 Migrating user progress...');
      
      const userWatches = await sqlitePrisma.user_video_watches.findMany();
      for (const watch of userWatches) {
        const existing = await tx.user_video_watches.findUnique({ where: { videoId: watch.videoId } });
        if (!existing) {
          await tx.user_video_watches.create({ data: watch });
        }
      }

      const userReads = await sqlitePrisma.user_book_reads.findMany();
      for (const read of userReads) {
        const existing = await tx.user_book_reads.findUnique({ where: { bookId: read.bookId } });
        if (!existing) {
          await tx.user_book_reads.create({ data: read });
        }
      }

      const chapterReads = await sqlitePrisma.user_chapter_reads.findMany();
      for (const read of chapterReads) {
        const existing = await tx.user_chapter_reads.findUnique({ where: { chapterId: read.chapterId } });
        if (!existing) {
          await tx.user_chapter_reads.create({ data: read });
        }
      }

      const sectionReads = await sqlitePrisma.user_section_reads.findMany();
      for (const read of sectionReads) {
        const existing = await tx.user_section_reads.findUnique({ where: { sectionId: read.sectionId } });
        if (!existing) {
          await tx.user_section_reads.create({ data: read });
        }
      }

      const eventReviews = await sqlitePrisma.user_event_reviews.findMany();
      for (const review of eventReviews) {
        const existing = await tx.user_event_reviews.findUnique({ where: { eventId: review.eventId } });
        if (!existing) {
          await tx.user_event_reviews.create({ data: review });
        }
      }
    });

    console.log('🎉 Migration completed successfully!');

    // Cleanup
    await sqlitePrisma.$disconnect();
    await postgresPrisma.$disconnect();

    // Restore original environment
    console.log('🔄 Restoring original environment...');
    process.env.DATABASE_URL = originalDbUrl;
    execSync('node setup-schema.js', { stdio: 'inherit' });
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('✅ Environment restored');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Try to restore environment on error
    try {
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
        execSync('node setup-schema.js', { stdio: 'inherit' });
        execSync('npx prisma generate', { stdio: 'inherit' });
        console.log('✅ Environment restored after error');
      }
    } catch (restoreError) {
      console.error('⚠️ Failed to restore environment:', restoreError.message);
    }
    
    process.exit(1);
  }
}

main().catch(console.error);