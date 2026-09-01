const cheerio = require('cheerio');
const fs = require('fs');

const sceneHtml = fs.readFileSync('tmp_wuboyz_scene.html', 'utf8');
const $ = cheerio.load(sceneHtml);

console.log('Scene page has performer info (div.model-info):', $('div.model-info').length > 0);
console.log('Scene page has v-tags:', $('div.v-tags').length > 0);
console.log('Scene page has video tag:', $('video').length > 0);
console.log('Scene page has img tags:', $('img').length > 0);
