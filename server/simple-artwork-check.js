console.log('Starting artwork check...');

const prisma = require('./prismaClient');

async function main() {
    console.log('Connected to database');
    
    try {
        const count = await prisma.customOrderItem.count();
        console.log(`Found ${count} custom order items`);
        
        const firstItem = await prisma.customOrderItem.findFirst({
            select: {
                id: true,
                title: true,
                localArtworkPath: true,
                originalArtworkUrl: true,
                artworkLastCached: true
            }
        });
        
        if (firstItem) {
            console.log('First item:', firstItem);
        } else {
            console.log('No items found');
        }
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await prisma.$disconnect();
        console.log('Done');
    }
}

main().catch(console.error);
