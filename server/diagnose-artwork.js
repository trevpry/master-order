const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function diagnoseArtworkIssue() {
    try {
        console.log('=== DIAGNOSING ARTWORK CACHE ISSUE ===\n');
        
        // Check all table counts
        const tvdbSeriesCount = await prisma.tvdbSeries.count();
        const tvdbSeasonCount = await prisma.tvdbSeason.count();
        const tvdbArtworkCount = await prisma.tvdbArtwork.count();
        
        console.log(`TVDB Series: ${tvdbSeriesCount}`);
        console.log(`TVDB Seasons: ${tvdbSeasonCount}`);
        console.log(`TVDB Artworks: ${tvdbArtworkCount}`);
        
        if (tvdbArtworkCount === 0) {
            console.log('\n❌ CRITICAL: Artwork table is completely empty!');
            console.log('This explains why all episodes show wrong artwork.');
            
            // Check if we have any series data to work with
            if (tvdbSeriesCount > 0) {
                const sampleSeries = await prisma.tvdbSeries.findFirst({
                    select: {
                        tvdbId: true,
                        name: true
                    }
                });
                console.log(`\nSample series available: ${sampleSeries.name} (ID: ${sampleSeries.tvdbId})`);
                
                // Check if we have seasons for this series
                const seasonsForSeries = await prisma.tvdbSeason.findMany({
                    where: {
                        seriesTvdbId: sampleSeries.tvdbId
                    },
                    select: {
                        tvdbId: true,
                        number: true
                    },
                    take: 3
                });
                
                console.log(`Seasons available for ${sampleSeries.name}:`);
                seasonsForSeries.forEach(season => {
                    console.log(`  Season ${season.number} (ID: ${season.tvdbId})`);
                });
            }
        }
        
        // Check the migration history
        const migrations = await prisma.$queryRaw`
            SELECT migration_name, started_at, finished_at 
            FROM _prisma_migrations 
            ORDER BY started_at DESC 
            LIMIT 5
        `;
        
        console.log('\nRecent migrations:');
        migrations.forEach(migration => {
            console.log(`  ${migration.migration_name} - ${migration.started_at}`);
        });
        
    } catch (error) {
        console.error('Error diagnosing artwork issue:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnoseArtworkIssue();
