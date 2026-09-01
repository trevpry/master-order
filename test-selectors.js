const cheerio = require('cheerio');
const fs = require('fs');

// Test scene HTML
const sceneHtml = fs.readFileSync('tmp_wuboyz_scene.html', 'utf8');
const $ = cheerio.load(sceneHtml);

console.log('=== Scene HTML Analysis ===');
console.log('Title:', $('h2.text-left').first().text());
console.log('Date:', $('div.date').first().text());
console.log('Image (video poster):', $('video').first().attr('poster'));
console.log('Image (img tags):', $('img').first().attr('src'));
console.log('Performers:', $('div.model-info h2').first().text());
console.log('Tags:', $('div.v-tags a').first().text());

// Test performer HTML
const performerHtml = fs.readFileSync('tmp_wuboyz_performer.html', 'utf8');
const $p = cheerio.load(performerHtml);

console.log('\n=== Performer HTML Analysis ===');
console.log('Name:', $('h2.text-left').first().text());
console.log('Image:', $('img.img-fluid').first().attr('src'));
console.log('Stats:', $('div.stats').first().text());
console.log('Bio:', $('div.bio').first().text());
