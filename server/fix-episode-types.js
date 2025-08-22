const { PrismaClient } = require('@prisma/client');

async function fixEpisodeMediaTypes() {
    const prisma = new PrismaClient();
    
    try {
        // Update all watch logs with mediaType 'episode' to 'tv'
        const result = await prisma.watchLog.updateMany({
            where: {
                mediaType: 'episode'
            },
            data: {
                mediaType: 'tv'
            }
        });
        
        console.log(`Updated ${result.count} episode records to mediaType 'tv'`);
        
        // Check the results
        const tvLogs = await prisma.watchLog.findMany({
            where: { mediaType: 'tv' },
            select: {
                id: true,
                title: true,
                seriesTitle: true,
                mediaType: true,
                startTime: true
            }
        });
        
        console.log(`\nNow have ${tvLogs.length} TV logs:`);
        tvLogs.forEach((log, index) => {
            console.log(`${index + 1}. ${log.title} (${log.seriesTitle}) - ${log.mediaType}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixEpisodeMediaTypes();
