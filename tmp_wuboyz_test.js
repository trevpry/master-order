const YamlScraperService = require('./server/services/scrapers/YamlScraperService');

// Test WuBoyz scraper
const scraper = new YamlScraperService('server/services/scrapers/configs/WuBoyz.yml');

async function runTests() {
    // Test scene scraping with actual URL
    console.log('Testing scene scraping...');
    try {
        const sceneUrl = 'https://www.wuboyz.com/scenes/Infatuation_vids.html';
        const sceneResult = await scraper.scrape(sceneUrl);
        console.log('Scene scrape result:');
        console.log('Title:', sceneResult.scene.Title);
        console.log('Date:', sceneResult.scene.Date);
        console.log('Details:', sceneResult.scene.Details);
        console.log('URL:', sceneResult.scene.URL);
        console.log('Image:', sceneResult.scene.Image);
        console.log('Studio:', sceneResult.scene.Studio);
        console.log('Performers:', sceneResult.scene.Performers || 'N/A (scene page)');
        console.log('Tags:', sceneResult.scene.Tags);
    } catch (error) {
        console.error('Scene scraping error:', error.message);
        console.error('Stack:', error.stack);
    }

    // Test movie scraping
    console.log('\nTesting movie scraping...');
    try {
        const movieUrl = 'https://www.wuboyz.com/scenes/Infatuation_vids.html';
        const movieResult = await scraper.scrapeMovie(movieUrl);
        console.log('Movie scrape result:');
        console.log('Title:', movieResult.movie.Title);
        console.log('Synopsis:', movieResult.movie.Synopsis);
        console.log('Date:', movieResult.movie.Date);
        console.log('Duration:', movieResult.movie.Duration);
        console.log('Studio:', movieResult.movie.Studio);
        console.log('FrontImage:', movieResult.movie.FrontImage);
    } catch (error) {
        console.error('Movie scraping error:', error.message);
        console.error('Stack:', error.stack);
    }

    // Test performer scraping
    console.log('\nTesting performer scraping...');
    try {
        const performerUrl = 'https://www.wuboyz.com/models/Tyler-Wu';
        const performerResult = await scraper.scrapePerformer(performerUrl);
        console.log('Performer scrape result:');
        console.log('Name:', performerResult.performer.Name);
        console.log('Gender:', performerResult.performer.Gender);
        console.log('Details:', performerResult.performer.Details);
        console.log('Image:', performerResult.performer.Image);
        console.log('Ethnicity:', performerResult.performer.Ethnicity);
        console.log('EyeColor:', performerResult.performer.EyeColor);
        console.log('HairColor:', performerResult.performer.HairColor);
        console.log('Height:', performerResult.performer.Height);
        console.log('PenisLength:', performerResult.performer.PenisLength);
    } catch (error) {
        console.error('Performer scraping error:', error.message);
        console.error('Stack:', error.stack);
    }

    console.log('\nAll tests completed!');
}

runTests();
