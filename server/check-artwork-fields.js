const prisma = require('./prismaClient');

async function checkArtworkFields() {
    try {
        const items = await prisma.customOrderItem.findMany({
            select: {
                id: true,
                title: true,
                mediaType: true,
                localArtworkPath: true,
                originalArtworkUrl: true,
                artworkLastCached: true,
                artworkMimeType: true
            }
        });

        console.log('Custom order items with full artwork cache info:');
        items.forEach(item => {
            console.log(`\n${item.id}: ${item.title} (${item.mediaType})`);
            console.log(`  Local Path: ${item.localArtworkPath || 'NONE'}`);
            console.log(`  Original URL: ${item.originalArtworkUrl || 'NONE'}`);
            console.log(`  Last Cached: ${item.artworkLastCached || 'NEVER'}`);
            console.log(`  MIME Type: ${item.artworkMimeType || 'NONE'}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkArtworkFields();
