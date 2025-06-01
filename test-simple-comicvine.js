console.log('Testing ComicVine service...');

async function testService() {
    console.log('Loading ComicVine service...');
    
    try {
        const comicVineService = require('./server/comicVineService');
        console.log('✅ ComicVine service loaded');
        
        const isAvailable = await comicVineService.isApiKeyAvailable();
        console.log('API key available:', isAvailable);
        
        if (isAvailable) {
            console.log('Testing comic lookup...');
            const result = await comicVineService.getComicCoverArt('The High Republic Adventures (2022) #7');
            console.log('Result:', result);
        }
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

testService();
