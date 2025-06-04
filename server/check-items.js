const prisma = require('./prismaClient');

async function checkItems() {
    try {
        const items = await prisma.customOrderItem.findMany();
        console.log('All custom order items:');
        if (items.length === 0) {
            console.log('No items found in database');
        } else {
            items.forEach(item => {
                console.log(`- ${item.title} (${item.mediaType})`);
                if (item.mediaType === 'book') {
                    console.log(`  Author: ${item.bookAuthor || 'Unknown'}`);
                    console.log(`  Cover URL: ${item.bookCoverUrl || 'None'}`);
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkItems();
