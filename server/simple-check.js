const { PrismaClient } = require('@prisma/client');

async function simpleCheck() {
    const prisma = new PrismaClient();
    
    try {
        const artworkCount = await prisma.tvdbArtwork.count();
        console.log(`Artwork count: ${artworkCount}`);
        
        if (artworkCount === 0) {
            console.log('CRITICAL: Artwork cache is empty!');
            
            // Check if we need to repopulate
            const seriesCount = await prisma.tvdbSeries.count();
            console.log(`Series count: ${seriesCount}`);
            
            if (seriesCount > 0) {
                console.log('We have series data but no artwork - need to repopulate cache!');
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

simpleCheck();
