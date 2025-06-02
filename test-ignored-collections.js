const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function testIgnoredCollections() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing ignored collections settings...\n');
    
    // Get current settings
    const currentSettings = await prisma.settings.findFirst();
    console.log('Current Settings:');
    console.log('- ID:', currentSettings?.id);
    console.log('- Ignored Movie Collections:', currentSettings?.ignoredMovieCollections);
    console.log('- Ignored TV Collections:', currentSettings?.ignoredTVCollections);
    
    if (currentSettings?.ignoredMovieCollections) {
      try {
        const parsedMovieCollections = JSON.parse(currentSettings.ignoredMovieCollections);
        console.log('- Parsed Movie Collections:', parsedMovieCollections);
      } catch (e) {
        console.log('- Movie Collections parsing error:', e.message);
      }
    }
    
    if (currentSettings?.ignoredTVCollections) {
      try {
        const parsedTVCollections = JSON.parse(currentSettings.ignoredTVCollections);
        console.log('- Parsed TV Collections:', parsedTVCollections);
      } catch (e) {
        console.log('- TV Collections parsing error:', e.message);
      }
    }
    
    // Test setting some ignored collections
    console.log('\nTesting update with sample ignored collections...');
    
    const testMovieCollections = ['Marvel Cinematic Universe', 'DC Comics'];
    const testTVCollections = ['Arrowverse', 'Star Trek'];
    
    const updated = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        ignoredMovieCollections: JSON.stringify(testMovieCollections),
        ignoredTVCollections: JSON.stringify(testTVCollections)
      },
      create: {
        id: 1,
        ignoredMovieCollections: JSON.stringify(testMovieCollections),
        ignoredTVCollections: JSON.stringify(testTVCollections),
        tvGeneralPercent: 50,
        moviesGeneralPercent: 50,
        customOrderPercent: 0,
        partiallyWatchedCollectionPercent: 75,
        plexSyncInterval: 12
      }
    });
    
    console.log('Updated successfully!');
    console.log('- Ignored Movie Collections (raw):', updated.ignoredMovieCollections);
    console.log('- Ignored TV Collections (raw):', updated.ignoredTVCollections);
    
    // Verify by reading again
    console.log('\nVerifying by reading settings again...');
    const verifySettings = await prisma.settings.findFirst();
    console.log('- Ignored Movie Collections:', verifySettings?.ignoredMovieCollections);
    console.log('- Ignored TV Collections:', verifySettings?.ignoredTVCollections);
    
    if (verifySettings?.ignoredMovieCollections) {
      const parsedMovies = JSON.parse(verifySettings.ignoredMovieCollections);
      console.log('- Parsed Movie Collections:', parsedMovies);
    }
    
    if (verifySettings?.ignoredTVCollections) {
      const parsedTV = JSON.parse(verifySettings.ignoredTVCollections);
      console.log('- Parsed TV Collections:', parsedTV);
    }
    
  } catch (error) {
    console.error('Error testing ignored collections:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\nPrisma client disconnected');
  }
}

testIgnoredCollections();
