// tmp-probe.js  —  usage: node tmp-probe.js "<url>" ["<needle>"]
const cheerio = require('cheerio');

(async () => {
  const [url, needle] = process.argv.slice(2);
  
  const $ = await fetchHtml(url, process.env.JS === '1');

  console.log('title      :', $('title').text());
  console.log('ld+json    :', $('script[type="application/ld+json"]').length);
  console.log('data-* attrs:', [...new Set($('[data-cy],[data-test],[data-qa]').map((i, e) =>
    $(e).attr('data-cy') || $(e).attr('data-test') || $(e).attr('data-qa')).get())]);
  console.log('h1         :', $('h1').map((i, e) => $(e).text().trim()).get());
  console.log('h2         :', $('h2').map((i, e) => $(e).text().trim()).get().slice(0, 10));

  if (needle) {
    const html = $.html().replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    const i = html.indexOf(needle);
    console.log(`\n--- context for "${needle}" at ${i} ---\n`);
    console.log(html.substring(Math.max(0, i - 1500), i + 2500));
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

async function fetchHtml(url, useJavaScript = false) {
  if (useJavaScript) {
    const puppeteer = require('puppeteer');
    let browser = null;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-devshm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const html = await page.content();
      await browser.close();

      console.log(`   ✅ JavaScript content rendered`);
      return cheerio.load(html);
      
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return cheerio.load(html);
}