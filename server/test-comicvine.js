const { PrismaClient } = require('@prisma/client');
const comicVineService = require('./comicVineService');

const prisma = new PrismaClient();

async function testComicVineIntegration() {
  try {
    console.log('Setting ComicVine API key...');
    
    // Set the API key
    await prisma.settings.update({
      where: { id: 1 },
      data: { comicVineApiKey: 'ecf2430615cbac5b4694db05aaa86909a3001ddc' }
    });
    
    console.log('API key set successfully!');
    
    // Test the API key
    console.log('Testing API key availability...');
    const isAvailable = await comicVineService.isApiKeyAvailable();
    console.log('API key available:', isAvailable);
    
    if (isAvailable) {
      console.log('Testing series search...');
      const searchResults = await comicVineService.searchSeries('Batman');
      console.log('Search results found:', searchResults.length);
      if (searchResults.length > 0) {
        console.log('First result:', searchResults[0]);
        
        // Test getting an issue
        console.log('Testing issue lookup...');
        const seriesId = searchResults[0].id;
        const issue = await comicVineService.getIssueByNumber(seriesId, 1);
        if (issue) {
          console.log('Issue found:', issue.name || issue.volume.name);
          console.log('Issue ID:', issue.id);
          
          // Test getting cover art
          console.log('Testing cover art...');
          const coverArt = await comicVineService.getComicCoverArt(issue.id);
          console.log('Cover art URL:', coverArt);
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testComicVineIntegration();
