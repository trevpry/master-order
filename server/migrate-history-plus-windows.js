#!/usr/bin/env node

/**
 * Windows-Compatible History Plus Migration
 * Handles Windows file permission issues and Prisma client generation problems
 */

const { execSync } = require('child_process');
const readline = require('readline');

async function main() {
  console.log('🔧 Master Order History Plus Migration (Windows-Compatible)');
  console.log('========================================================');
  
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
    // Step 1: Analyze SQLite data first (before switching schemas)
    console.log('🔍 Analyzing SQLite source data...');
    process.env.DATABASE_URL = 'file:../master_order.db';
    
    // Use the original schema to check SQLite data
    execSync('node setup-schema.js', { stdio: 'inherit' });
    
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

    await sqlitePrisma.$disconnect();

    // Step 2: Switch to PostgreSQL environment
    console.log('\n🔄 Configuring PostgreSQL connection...');
    process.env.DATABASE_URL = postgresUrl;
    
    // Setup PostgreSQL schema
    console.log('📝 Setting up PostgreSQL schema...');
    execSync('node setup-schema.js', { stdio: 'inherit' });
    
    // Step 3: Try Prisma generate with error handling
    console.log('🔧 Generating Prisma client for PostgreSQL...');
    let generateSuccess = false;
    try {
      execSync('npx prisma generate --skip-generate', { stdio: 'inherit' });
      generateSuccess = true;
    } catch (error) {
      console.log('⚠️ Prisma generate with --skip-generate failed, trying standard generate...');
      try {
        execSync('npx prisma generate', { stdio: ['inherit', 'inherit', 'pipe'] });
        generateSuccess = true;
      } catch (error2) {
        console.log('⚠️ Standard generate failed, continuing with existing client...');
        console.log('This may work if the schema hasn\'t changed significantly.');
      }
    }

    // Clear require cache to force fresh Prisma client
    delete require.cache[require.resolve('@prisma/client')];
    
    // Step 4: Create new Prisma clients
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

    // Step 5: Run migration with new client instances
    console.log(`\n🔄 Migrating ${total} records with CREATE-only operations...`);
    
    // Create fresh SQLite client for migration
    process.env.DATABASE_URL = 'file:../master_order.db';
    delete require.cache[require.resolve('@prisma/client')];
    const { PrismaClient: SqlitePrismaClient } = require('@prisma/client');
    const migrationSqlitePrisma = new SqlitePrismaClient();
    
    // Restore PostgreSQL environment
    process.env.DATABASE_URL = postgresUrl;

    // Run transaction-based migration
    await postgresPrisma.$transaction(async (tx) => {
      // Migrate channels first (no dependencies)
      if (counts.channels > 0) {
        console.log('📺 Migrating channels...');
        const channels = await migrationSqlitePrisma.historyChannel.findMany();
        for (const channel of channels) {
          const existing = await tx.historyChannel.findUnique({ where: { id: channel.id } });
          if (!existing) {
            await tx.historyChannel.create({ data: channel });
          }
        }
      }

      // Migrate events (no dependencies)
      if (counts.events > 0) {
        console.log('📅 Migrating historical events...');
        const events = await migrationSqlitePrisma.historicalEvent.findMany();
        for (const event of events) {
          const existing = await tx.historicalEvent.findUnique({ where: { id: event.id } });
          if (!existing) {
            await tx.historicalEvent.create({ data: event });
          }
        }
      }

      // Migrate videos (depends on events and channels)
      if (counts.videos > 0) {
        console.log('🎥 Migrating videos...');
        const videos = await migrationSqlitePrisma.historyVideo.findMany();
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
        const books = await migrationSqlitePrisma.historyBook.findMany();
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
        const chapters = await migrationSqlitePrisma.historyChapter.findMany();
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
        const sections = await migrationSqlitePrisma.historySection.findMany();
        for (const section of sections) {
          const existing = await tx.historySection.findUnique({ where: { id: section.id } });
          if (!existing) {
            await tx.historySection.create({ data: section });
          }
        }
      }
    });

    console.log('🎉 Migration completed successfully!');

    // Cleanup
    await migrationSqlitePrisma.$disconnect();
    await postgresPrisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
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