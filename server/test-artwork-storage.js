const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testArtworkStorage() {
    try {
        console.log('=== TESTING ARTWORK STORAGE ===\n');
        
        // Test data that should work
        const testArtwork = {
            tvdbId: "test123",
            seriesTvdbId: "series999",
            seasonTvdbId: "season888",
            image: "test.jpg",
            thumbnail: "test_thumb.jpg",
            language: "eng",
            type: "season",
            width: 680,
            height: 1000,
            score: 1000,
            includesText: false,
            lastUpdated: new Date().toISOString(),
            lastSyncedAt: new Date()
        };
        
        console.log('Testing artwork storage with composite constraint...');
        console.log('Test data:', testArtwork);
        
        // Try to insert using the new composite constraint
        const result = await prisma.tvdbArtwork.upsert({
            where: { 
                artwork_unique_context: {
                    tvdbId: testArtwork.tvdbId,
                    seriesTvdbId: testArtwork.seriesTvdbId,
                    seasonTvdbId: testArtwork.seasonTvdbId
                }
            },
            update: testArtwork,
            create: testArtwork
        });
        
        console.log('✅ Artwork storage successful!');
        console.log('Stored artwork ID:', result.id);
        
        // Check the count
        const count = await prisma.tvdbArtwork.count();
        console.log(`Total artworks in cache: ${count}`);
        
        // Clean up test data
        await prisma.tvdbArtwork.delete({
            where: { id: result.id }
        });
        
        console.log('✅ Test cleanup completed');
        
    } catch (error) {
        console.error('❌ Error testing artwork storage:', error.message);
        console.error('Full error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testArtworkStorage();
