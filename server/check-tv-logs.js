const { PrismaClient } = require('@prisma/client');

async function checkTvLogs() {
    const prisma = new PrismaClient();
    
    try {
        // First check all watch logs
        const allLogs = await prisma.watchLog.findMany({
            select: {
                id: true,
                title: true,
                seriesTitle: true,
                plexKey: true,
                totalWatchTime: true,
                mediaType: true,
                startTime: true
            },
            orderBy: { startTime: 'desc' }
        });
        
        console.log(`Found ${allLogs.length} total watch logs:`);
        allLogs.forEach((log, index) => {
            console.log(`${index + 1}. [${log.mediaType}] ${log.title} ${log.seriesTitle ? `(${log.seriesTitle})` : ''}`);
            console.log(`   plexKey: ${log.plexKey}`);
            console.log(`   totalWatchTime: ${log.totalWatchTime}`);
            console.log(`   startTime: ${log.startTime}`);
            console.log('');
        });
        
        // Now specifically TV logs
        const tvLogs = allLogs.filter(log => log.mediaType === 'tv');
        console.log(`\nSpecifically TV logs: ${tvLogs.length}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTvLogs();
