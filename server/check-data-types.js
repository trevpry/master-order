const { PrismaClient } = require('@prisma/client');

async function checkDataTypes() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== CHECKING DATA TYPE MISMATCH ===\n');
    
    // Get a sample episode ratingKey
    const episode = await prisma.plexEpisode.findFirst({
      where: { ratingKey: '44074' }
    });
    
    if (episode) {
      console.log('Episode ratingKey:', episode.ratingKey);
      console.log('Episode ratingKey type:', typeof episode.ratingKey);
    }
    
    // Get a sample role episodeRatingKey  
    const role = await prisma.plexRole.findFirst({
      where: { episodeRatingKey: '44074' }
    });
    
    if (role) {
      console.log('Role episodeRatingKey:', role.episodeRatingKey);
      console.log('Role episodeRatingKey type:', typeof role.episodeRatingKey);
    }
    
    // Test the Set comparison
    console.log('\n=== TESTING SET COMPARISON ===');
    const validEpisodeKeys = new Set(['44074']);
    console.log('Set contains "44074":', validEpisodeKeys.has('44074'));
    console.log('Set contains episode.ratingKey:', validEpisodeKeys.has(episode?.ratingKey));
    console.log('Set contains role.episodeRatingKey:', validEpisodeKeys.has(role?.episodeRatingKey));
    
    // Test with numbers
    const validEpisodeKeysNum = new Set([44074]);
    console.log('Numeric set contains 44074:', validEpisodeKeysNum.has(44074));
    console.log('Numeric set contains "44074":', validEpisodeKeysNum.has('44074'));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDataTypes();