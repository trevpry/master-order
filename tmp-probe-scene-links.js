const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2];
  
  console.log(`\n🔍 Probing search page: ${url}\n`);
  
  const $ = await fetchHtml(url, process.env.JS === '1');

  console.log('\n=== Search Results HTML Structure ===');
  
  // Look for scene cards
  $('div').each((i, el) => {
    const html = $(el).html();
    if (html && html.includes('movies') && html.includes('.html')) {
      console.log('\n--- Scene Card ---');
      console.log('HTML:', html.substring(0, 500));
    }
  });

  // Look for links that might be scenes
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('.html') && !href.includes('search')) {
      console.log('Link:', href);
    }
  });

})().catch(e => { console.error('ERR', e.message); process.exit(1); });

async function fetchHtml(url, useJavaScript = false) {
  if (useJavaScript) {
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
