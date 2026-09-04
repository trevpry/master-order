const YamlScraperService = require('./server/services/scrapers/YamlScraperService');

async function test() {
  const s = new YamlScraperService('./server/services/scrapers/configs/UniversBlack.yml');
  
  console.log('\n=== Testing Scene Scraping ===\n');
  
  try {
    const result = await s.scrape('https://www.universblack.com/en/videos/detail/47964-fuck-me-for-hours-arad');
    const scraped = result.scraped;
    
    console.log('Scraped Result:');
    console.log('----------------');
    console.log('Title:', scraped.title);
    console.log('Image:', scraped.image || '(not set)');
    console.log('Tags:', scraped.tags || '(not set)');
    console.log('Performers:', scraped.performers || '(not set)');
    console.log('\nFull result:');
    console.log(JSON.stringify(scraped, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
