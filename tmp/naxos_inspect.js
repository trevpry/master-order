// Scratch: inspect Naxos catalogue page text. Safe to delete.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cheerio = require('../server/node_modules/cheerio');

const html = fs.readFileSync(path.join(os.tmpdir(), 'naxos_cds533.html'), 'utf8');
const doc = cheerio.load(html);
doc('script,style,noscript,svg').remove();
const text = doc('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
const start = text.indexOf(process.argv[2] || 'Semiramide');
console.log(text.slice(Math.max(0, start - 1500), start + Number(process.argv[3] || 6000)));
