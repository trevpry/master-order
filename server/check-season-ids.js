// Debug script to check actual TVDB season IDs
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function checkSeasonIds() {
  console.log('=== CHECKING SEASON IDS ===\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Find South Park series
    const southPark = await prisma.tvdbSeries.findFirst({
      where: {
        name: {
          contains: 'South Park',
          mode: 'insensitive'
        }
      },
      include: {
        seasons: {
          take: 10,
          orderBy: {
            number: 'asc'
          }
        }
      }
    });
    
    if (southPark) {
      console.log(`Found series: ${southPark.name}`);
      console.log(`Series TVDB ID: ${southPark.tvdbId}`);
      console.log(`Database ID: ${southPark.id}`);
      
      console.log('\nFirst 10 seasons:');
      southPark.seasons.forEach(season => {
        console.log(`  Season ${season.number}:`);
        console.log(`    TVDB ID: ${season.tvdbId}`);
        console.log(`    Database ID: ${season.id}`);
        console.log(`    Name: ${season.name || 'No name'}`);
        console.log('');
      });
      
      // Find Season 3 specifically
      const season3 = southPark.seasons.find(s => s.number === 3);
      if (season3) {
        console.log(`🎯 Season 3 Details:`);
        console.log(`  TVDB ID: ${season3.tvdbId}`);
        console.log(`  Database ID: ${season3.id}`);
        console.log(`  Name: ${season3.name}`);
        
        // Check if we have any artwork for this season
        const artworks = await prisma.tvdbArtwork.findMany({
          where: {
            seasonTvdbId: season3.tvdbId
          }
        });
        
        console.log(`  Artwork count: ${artworks.length}`);
        if (artworks.length > 0) {
          console.log('  Sample artwork:');
          artworks.slice(0, 3).forEach(artwork => {
            console.log(`    - Type: ${artwork.type}, Language: ${artwork.language || 'null'}, Image: ${artwork.image}`);
          });
        }
      }
    } else {
      console.log('❌ South Park series not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSeasonIds().then(() => {
  console.log('\nCheck complete');
  process.exit(0);
}).catch(error => {
  console.error('Check failed:', error);
  process.exit(1);
});
