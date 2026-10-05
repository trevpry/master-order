// Scratch: inspect a saved HTML page. Safe to delete.
const fs = require('fs');
const os = require('os');
const path = require('path');

const [file, mode, needle, length] = process.argv.slice(2);
const html = fs.readFileSync(path.join(os.tmpdir(), file), 'utf8');

if (mode === 'urls') {
  const urls = [...html.matchAll(/(?:src|href|data-src)="([^"]+)"/g)].map(match => match[1]);
  console.log([...new Set(urls.filter(url => url.toLowerCase().includes(String(needle).toLowerCase())))].join('\n'));
} else {
  const start = html.indexOf(needle);
  console.log(start < 0 ? 'NOT FOUND' : html.slice(Math.max(0, start - 600), start + Number(length || 1500)).replace(/\s{2,}/g, ' '));
}
