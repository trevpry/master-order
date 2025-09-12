#!/usr/bin/env node

/**
 * Robust History Plus Migration - Handles Prisma client regeneration properly
 */

const { execSync } = require('child_process');
const readline = require('readline');

async function main() {
  console.log('🔧 Master Order History Plus Migration (Robust)');
  console.log('===============================================');
  
  // Use environment variable or prompt for PostgreSQL URL
  let postgresUrl = process.env.DATABASE_URL;
  if (!postgresUrl || !postgresUrl.includes('postgresql://')) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    postgresUrl = await new Promise((resolve) => {
      rl.question('Enter PostgreSQL connection string: ', resolve);
    });
    rl.close();
  }

  console.log(`🎯 Target: ${postgresUrl.replace(/\/\/.*@/, '//***@')}`);

  // Backup original environment
  const originalDbUrl = process.env.DATABASE_URL || 'file:../master_order.db';
  console.log('\n📦 Backing up current environment...');

  try {
    // Step 1: Setup SQLite environment and analyze data
    console.log('🔍 Setting up SQLite environment for analysis...');
    process.env.DATABASE_URL = 'file:../master_order.db';
    
    // Setup SQLite schema
    execSync('node setup-schema.js', { stdio: 'inherit' });
    
    // Force regenerate Prisma client for SQLite
    console.log('🔧 Generating Prisma client for SQLite...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️ Prisma generate failed, but continuing...');
    }

    // Clear require cache and create SQLite client
    delete require.cache[require.resolve('@prisma/client')];
    const { PrismaClient } = require('@prisma/client');
    const sqlitePrisma = new PrismaClient();
    
    // Get counts from SQLite
    console.log('📊 SQLite source data:');
    const counts = {
      events: await sqlitePrisma.historicalEvent.count(),
      videos: await sqlitePrisma.historyVideo.count(),
      books: await sqlitePrisma.historyBook.count(),
      channels: await sqlitePrisma.historyChannel.count(),
      chapters: await sqlitePrisma.historyChapter.count(),
      sections: await sqlitePrisma.historySection.count()
    };
    
    Object.entries(counts).forEach(([key, count]) => {
      if (count > 0) console.log(`   ${key}: ${count}`);
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
      console.log('ℹ️  No History Plus data found to migrate');
      await sqlitePrisma.$disconnect();
      return;
    }

    // Get all data we need to migrate
    console.log('📥 Loading SQLite data for migration...');
    const sqliteData = {
      channels: counts.channels > 0 ? await sqlitePrisma.historyChannel.findMany() : [],
      events: counts.events > 0 ? await sqlitePrisma.historicalEvent.findMany() : [],
      videos: counts.videos > 0 ? await sqlitePrisma.historyVideo.findMany() : [],
      books: counts.books > 0 ? await sqlitePrisma.historyBook.findMany() : [],
      chapters: counts.chapters > 0 ? await sqlitePrisma.historyChapter.findMany() : [],
      sections: counts.sections > 0 ? await sqlitePrisma.historySection.findMany() : []
    };

    await sqlitePrisma.$disconnect();

    // Step 2: Switch to PostgreSQL environment
    console.log('\n🔄 Setting up PostgreSQL environment...');
    process.env.DATABASE_URL = postgresUrl;
    
    // Setup PostgreSQL schema
    execSync('node setup-schema.js', { stdio: 'inherit' });
    
    // Force regenerate Prisma client for PostgreSQL
    console.log('🔧 Generating Prisma client for PostgreSQL...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️ Prisma generate failed, but continuing...');
    }

    // Clear require cache and create PostgreSQL client
    delete require.cache[require.resolve('@prisma/client')];
    const { PrismaClient: PostgresPrismaClient } = require('@prisma/client');
    const postgresPrisma = new PostgresPrismaClient();

    // Test PostgreSQL connection
    console.log('🔍 Testing PostgreSQL connection...');
    await postgresPrisma.$executeRaw`SELECT 1`;
    console.log('✅ PostgreSQL connection successful');

    // Check existing PostgreSQL data
    console.log('\n🗃️  PostgreSQL target status:');
    const pgCounts = {
      events: await postgresPrisma.historicalEvent.count(),
      videos: await postgresPrisma.historyVideo.count(),
      books: await postgresPrisma.historyBook.count(),
      channels: await postgresPrisma.historyChannel.count(),
      chapters: await postgresPrisma.historyChapter.count(),
      sections: await postgresPrisma.historySection.count()
    };
    
    Object.entries(pgCounts).forEach(([key, count]) => {
      console.log(`   Existing ${key}: ${count}`);
    });

    // Step 3: Run migration with loaded data
    console.log(`\n🔄 Migrating ${total} records with CREATE-only operations...`);
    
    await postgresPrisma.$transaction(async (tx) => {
      // Migrate channels first (no dependencies)
      if (sqliteData.channels.length > 0) {
        console.log('📺 Migrating channels...');
        for (const channel of sqliteData.channels) {
          const existing = await tx.historyChannel.findUnique({ where: { id: channel.id } });
          if (!existing) {
            await tx.historyChannel.create({ data: channel });
          }
        }
      }

      // Migrate events (no dependencies)
      if (sqliteData.events.length > 0) {
        console.log('📅 Migrating historical events...');
        for (const event of sqliteData.events) {
          const existing = await tx.historicalEvent.findUnique({ where: { id: event.id } });
          if (!existing) {
            await tx.historicalEvent.create({ data: event });
          }
        }
      }

      // Migrate videos (depends on events and channels)
      if (sqliteData.videos.length > 0) {
        console.log('🎥 Migrating videos...');
        for (const video of sqliteData.videos) {
          const existing = await tx.historyVideo.findUnique({ where: { id: video.id } });
          if (!existing) {
            await tx.historyVideo.create({ data: video });
          }
        }
      }

      // Migrate books (depends on events)
      if (sqliteData.books.length > 0) {
        console.log('📚 Migrating books...');
        for (const book of sqliteData.books) {
          const existing = await tx.historyBook.findUnique({ where: { id: book.id } });
          if (!existing) {
            await tx.historyBook.create({ data: book });
          }
        }
      }

      // Migrate chapters (depends on books)
      if (sqliteData.chapters.length > 0) {
        console.log('📖 Migrating chapters...');
        for (const chapter of sqliteData.chapters) {
          const existing = await tx.historyChapter.findUnique({ where: { id: chapter.id } });
          if (!existing) {
            await tx.historyChapter.create({ data: chapter });
          }
        }
      }

      // Migrate sections (depends on chapters)
      if (sqliteData.sections.length > 0) {
        console.log('📄 Migrating sections...');
        for (const section of sqliteData.sections) {
          const existing = await tx.historySection.findUnique({ where: { id: section.id } });
          if (!existing) {
            await tx.historySection.create({ data: section });
          }
        }
      }
    });

    console.log('🎉 Migration completed successfully!');

    // Final verification
    console.log('\n📊 Post-migration verification:');
    const finalCounts = {
      events: await postgresPrisma.historicalEvent.count(),
      videos: await postgresPrisma.historyVideo.count(),
      books: await postgresPrisma.historyBook.count(),
      channels: await postgresPrisma.historyChannel.count(),
      chapters: await postgresPrisma.historyChapter.count(),
      sections: await postgresPrisma.historySection.count()
    };
    
    Object.entries(finalCounts).forEach(([key, count]) => {
      console.log(`   Final ${key}: ${count}`);
    });

    await postgresPrisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Always try to restore original environment
    console.log('\n🔄 Restoring original environment...');
    try {
      process.env.DATABASE_URL = originalDbUrl;
      execSync('node setup-schema.js', { stdio: 'inherit' });
      
      // Try to regenerate for original environment, but don't fail if it doesn't work
      try {
        execSync('npx prisma generate', { stdio: ['inherit', 'inherit', 'pipe'] });
        console.log('✅ Environment restored successfully');
      } catch (genError) {
        console.log('⚠️ Prisma generate failed during restore, but environment variables restored');
        console.log('You may need to manually run: npx prisma generate');
      }
    } catch (restoreError) {
      console.error('⚠️ Failed to restore environment:', restoreError.message);
      console.log('Manual restore steps:');
      console.log(`1. Set DATABASE_URL=${originalDbUrl}`);
      console.log('2. Run: node setup-schema.js');
      console.log('3. Run: npx prisma generate');
    }
  }
}

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});