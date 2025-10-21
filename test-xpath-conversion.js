/**
 * Test XPath to jQuery Conversion
 */

const YamlScraperService = require('./server/services/scrapers/YamlScraperService');
const path = require('path');

// Create instance
const yamlPath = path.join(__dirname, 'server/services/scrapers/configs/GayNetwork.yml');
const scraper = new YamlScraperService(yamlPath);

console.log('🧪 Testing XPath to jQuery Conversion\n');

const testXPaths = [
  '//h1',
  '//h2',
  '//link[@rel="alternate" and @hreflang="en"]/@href',
  '//script[@type="application/ld+json"]/text()',
  '//*[i[contains(@class, "fa-video")]]/span',
  '//div[contains(@class, "models-list-img")]//a',
  '//div[@class="row mb-4 px-0"]//h3[not(i)]',
  '//div[@class="row mb-4 px-0"]//h3[i[contains(@class, "fa-scrubber")]]'
];

testXPaths.forEach(xpath => {
  const jquery = scraper.xpathToJquery(xpath);
  console.log(`XPath: ${xpath}`);
  console.log(`jQuery: ${jquery}`);
  console.log('');
});

console.log('✅ Test complete!');
