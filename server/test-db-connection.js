const { PrismaClient } = require('@prisma/client');

async function quickTest() {
    const prisma = new PrismaClient({
        log: ['error', 'warn']
    });
    
    try {
        console.log('Testing basic database connection...');
        
        // Test basic connection
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection works');
        
        // Test artwork table exists
        const tableInfo = await prisma.$queryRaw`PRAGMA table_info(TvdbArtwork)`;
        console.log('✅ TvdbArtwork table exists');
        console.log('Columns:', tableInfo.length);
        
        // Test simple count
        const count = await prisma.tvdbArtwork.count();
        console.log(`✅ Artwork count: ${count}`);
        
        // Test series count
        const seriesCount = await prisma.tvdbSeries.count();
        console.log(`✅ Series count: ${seriesCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
        console.log('Disconnected from database');
    }
}

quickTest();
