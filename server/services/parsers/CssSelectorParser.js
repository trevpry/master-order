const cheerio = require('cheerio');
const BaseListParser = require('./BaseListParser');

/**
 * Generic CSS-selector-based parser (the original approach).
 * Works for pages where items can be selected with simple CSS selectors.
 */
class CssSelectorParser extends BaseListParser {
  constructor() {
    super('CSS Selector Parser');
  }

  async parse(config) {
    const $ = await this.fetchHtml(config.url, config.useJavaScript);
    const items = [];

    $(config.itemSelector).each((index, element) => {
      const $el = $(element);

      let title = '';
      if (config.titleSelector) {
        title = $el.find(config.titleSelector).first().text().trim();
        if (!title) {
          title = $el.is(config.titleSelector) ? $el.text().trim() : '';
        }
      }
      if (!title) {
        title = $el.text().trim();
      }
      if (!title) return;

      let mediaType = config.defaultMediaType || 'movie';
      if (config.mediaTypeSelector) {
        const rawType = $el.find(config.mediaTypeSelector).first().text().trim().toLowerCase();
        if (rawType) {
          mediaType = this.normalizeMediaType(rawType);
        }
      }

      let itemUrl = null;
      if (config.urlSelector) {
        itemUrl = $el.find(config.urlSelector).first().attr('href') || null;
        if (itemUrl && !itemUrl.startsWith('http')) {
          try {
            const base = new URL(config.url);
            itemUrl = new URL(itemUrl, base.origin).toString();
          } catch (e) { /* keep relative */ }
        }
      }

      let itemYear = null;
      if (config.yearSelector) {
        const rawYear = $el.find(config.yearSelector).first().text().trim();
        const yearMatch = rawYear.match(/(\d{4})/);
        if (yearMatch) itemYear = yearMatch[1];
      }

      items.push({
        title,
        position: index,
        mediaType,
        itemUrl,
        itemYear
      });
    });

    return items;
  }

  async fetchHtml(url, useJavaScript) {
    if (useJavaScript) {
      return await this.fetchHtmlWithPuppeteer(url);
    }
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return cheerio.load(await response.text());
  }

  async fetchHtmlWithPuppeteer(url) {
    let browser = null;
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      const html = await page.content();
      await browser.close();
      return cheerio.load(html);
    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
  }

  normalizeMediaType(raw) {
    const lower = raw.toLowerCase().trim();
    if (lower.includes('movie') || lower.includes('film')) return 'movie';
    if (lower.includes('tv') || lower.includes('series') || lower.includes('show') || lower.includes('episode')) return 'episode';
    if (lower.includes('comic')) return 'comic';
    if (lower.includes('book')) return 'book';
    if (lower.includes('game') || lower.includes('video game')) return 'game';
    if (lower.includes('web') || lower.includes('youtube') || lower.includes('video')) return 'webvideo';
    return 'movie';
  }

  getDescription() {
    return 'Extract items using CSS selectors. Requires itemSelector and titleSelector.';
  }

  getConfigFields() {
    return [
      { name: 'itemSelector', label: 'Item Selector', required: true, type: 'text' },
      { name: 'titleSelector', label: 'Title Selector', required: true, type: 'text' },
      { name: 'mediaTypeSelector', label: 'Media Type Selector', required: false, type: 'text' },
      { name: 'urlSelector', label: 'URL Selector', required: false, type: 'text' },
      { name: 'yearSelector', label: 'Year Selector', required: false, type: 'text' },
      { name: 'imageSelector', label: 'Image Selector', required: false, type: 'text' }
    ];
  }
}

module.exports = CssSelectorParser;
