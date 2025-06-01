const { PrismaClient } = require('@prisma/client');

async function checkTableStructure() {
    const prisma = new PrismaClient();
    
    try {
        console.log('=== CHECKING TABLE STRUCTURE ===\n');
        
        // Check the actual table structure
        const tableInfo = await prisma.$queryRaw`PRAGMA table_info(TvdbArtwork)`;
        console.log('TvdbArtwork table columns:');
        tableInfo.forEach(col => {
            console.log(`  ${col.name}: ${col.type} (nullable: ${col.notnull === 0})`);
        });
        
        // Check indexes and constraints
        const indexes = await prisma.$queryRaw`PRAGMA index_list(TvdbArtwork)`;
        console.log('\nTable indexes:');
        indexes.forEach(idx => {
            console.log(`  ${idx.name}: unique=${idx.unique}`);
        });
        
        // Check the specific unique constraint
        const constraintInfo = await prisma.$queryRaw`PRAGMA index_info(artwork_unique_context)`;
        console.log('\nUnique constraint details:');
        constraintInfo.forEach(info => {
            console.log(`  Column ${info.seqno}: ${info.name}`);
        });
        
        // Test a simple insert
        console.log('\n=== TESTING SIMPLE INSERT ===');
        
        try {
            const testInsert = await prisma.tvdbArtwork.create({
                data: {
                    tvdbId: 'test123',
                    seriesTvdbId: 'series123',
                    seasonTvdbId: 'season123',
                    image: 'https://example.com/test.jpg',
                    type: 7,
                    lastSyncedAt: new Date()
                }
            });
            console.log('✅ Test insert successful:', testInsert.id);
            
            // Check count
            const count = await prisma.tvdbArtwork.count();
            console.log(`✅ New artwork count: ${count}`);
            
            // Clean up test data
            await prisma.tvdbArtwork.delete({
                where: { id: testInsert.id }
            });
            console.log('✅ Test data cleaned up');
            
        } catch (insertError) {
            console.error('❌ Insert failed:', insertError.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTableStructure();
