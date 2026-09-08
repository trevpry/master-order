const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2];
  
  console.log(`\n🔍 Probing scene page: ${url}\n`);
  
  const $ = await fetchHtml(url, process.env.JS === '1');

  console.log('\n=== HTML Structure Analysis ===\n');
  
  // Check for ld+json
  const ldjson = $('script[type="application/ld+json"]').length;
  console.log('ld+json scripts:', ldjson);
  
  if (ldjson > 0) {
    $('script[type="application/ld+json"]').each((i, el) => {
      const content = $(el).text();
      console.log(`\n=== ld+json #${i+1} ===`);
      console.log(content.substring(0, 500)); // First 500 chars
    });
  }
  
  // Check for data-* attributes
  const dataAttrs = [...new Set($('[data-cy],[data-test],[data-qa]').map((i, e) =>
    $(e).attr('data-cy') || $(e).attr('data-test') || $(e).attr('data-qa')).get())];
  console.log('\ndata-* attributes:', dataAttrs);
  
  // Check for common patterns
  console.log('\n=== Common Patterns ===');
  console.log('h1:', $('h1').map((i, e) => $(e).text().trim()).get());
  console.log('h2:', $('h2').map((i, e) => $(e).text().trim()).get().slice(0, 10));
  console.log('h3:', $('h3').map((i, e) => $(e).text().trim()).get().slice(0, 10));
  console.log('p:', $('p').map((i, e) => $(e).text().trim()).get().slice(0, 10));
  console.log('a href:', $('a').map((i, e) => $(e).attr('href')).get().slice(0, 10));
  console.log('img src:', $('img').map((i, e) => $(e).attr('src')).get().slice(0, 10));
  console.log('video:', $('video').length);
  console.log('iframe:', $('iframe').length);
  
  // Check for specific classes
  console.log('\n=== Class Patterns ===');
  const classes = [...new Set($('[class]').map((i, e) => $(e).attr('class') || '').get())];
  console.log('Sample classes:', classes.slice(0, 20));
  
  // Check for date patterns
  console.log('\n=== Date Patterns ===');
  console.log('Date elements:', $('span.date, div.date, .date').length);
  console.log('Date text:', $('span.date, div.date, .date').map((i, e) => $(e).text().trim()).get().slice(0, 5));
  
  // Check for performer patterns
  console.log('\n=== Performer Patterns ===');
  console.log('Performer links:', $('a:contains("Guys"), a:contains("Models"), .models, .performers').length);
  
  // Check for tag patterns
  console.log('\n=== Tag Patterns ===');
  console.log('Tags:', $('a.tag, .tag, .tags').length);
  
  // Check for image patterns
  console.log('\n=== Image Patterns ===');
  console.log('Images:', $('img').length);
  console.log('Cover images:', $('img.cover, .cover, .poster').length);
  
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
