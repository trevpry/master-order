// Test ComicVine service directly
const comicVineService = require('./server/comicVineService');

async function testComicVineService() {
    console.log('🧪 Testing ComicVine service directly...\n');
    
    try {
        // Test if API key is available
        const isAvailable = await comicVineService.isApiKeyAvailable();
        console.log('✅ API key availability:', isAvailable);
        
        if (!isAvailable) {
            console.log('❌ ComicVine API key not available');
            return;
        }
        
        // Test fetching comic details
        const testComics = [
            'The High Republic Adventures (2022) #7',
            'The Amazing Spider-Man (2022) #1',
            'Batman (2016) #125'
        ];
        
        for (const comic of testComics) {
            console.log(`\n🔍 Testing: ${comic}`);
            try {
                const details = await comicVineService.getComicCoverArt(comic);
                if (details) {
                    console.log('✅ Successfully fetched details');
                    console.log(`   Title: ${details.title || 'N/A'}`);
                    console.log(`   Issue: ${details.issue || 'N/A'}`);
                    console.log(`   Cover Art: ${details.coverArt ? 'Yes' : 'No'}`);
                    if (details.coverArt) {
                        console.log(`   Cover URL: ${details.coverArt}`);
                    }
                } else {
                    console.log('⚠️  No details found');
                }
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }
        
        console.log('\n🎉 ComicVine service test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testComicVineService();
