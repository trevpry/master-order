const BaseListParser = require('./BaseListParser');

class YouTubeChannelParser extends BaseListParser {
  constructor() {
    super('YouTube Channel Parser');
  }

  normalizeChannelUrl(url) {
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed) return null;

    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();
      const isYouTubeHost = hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com';
      if (!isYouTubeHost) {
        return trimmed;
      }

      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (!pathname.includes('/videos') && !pathname.includes('/shorts') && !pathname.includes('/live')) {
        return `${parsed.origin}${pathname}/videos`;
      }
      return `${parsed.origin}${pathname}`;
    } catch (_error) {
      return trimmed;
    }
  }

  resolveUrl(href, baseUrl) {
    if (!href) return null;

    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    if (href.startsWith('//')) {
      return `https:${href}`;
    }

    return new URL(href, baseUrl).toString();
  }

  normalizeYouTubeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    const cleaned = rawUrl.trim();
    if (!cleaned) return null;

    try {
      const parsed = new URL(cleaned);
      const host = parsed.hostname.toLowerCase();

      if (host === 'youtu.be') {
        const videoId = parsed.pathname.replace(/^\//, '').split('/')[0];
        if (videoId && videoId.length >= 11) {
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      }

      const videoIdFromPath = parsed.pathname.match(/\/shorts\/(?:[^/]+\/)?([A-Za-z0-9_-]{11})/);
      const videoIdFromQuery = parsed.searchParams.get('v');
      const videoId = videoIdFromQuery || videoIdFromPath?.[1];

      if (videoId && videoId.length >= 11) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch (_error) {
      // Fall back to regex-based normalization below.
    }

    const directMatch = cleaned.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (directMatch && directMatch[1]) {
      return `https://www.youtube.com/watch?v=${directMatch[1]}`;
    }

    const shortsMatch = cleaned.match(/(?:youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (shortsMatch && shortsMatch[1]) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }

    return cleaned;
  }

  decodeHtmlText(value = '') {
    return value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getEmbeddedVideoTitle(html, videoId) {
    const escapedVideoId = videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`"videoId"\\s*:\\s*"${escapedVideoId}"[\\s\\S]{0,800}?"title"\\s*:\\s*\\{[\\s\\S]{0,400}?"text"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'),
      new RegExp(`"videoId"\\s*:\\s*"${escapedVideoId}"[\\s\\S]{0,300}?"text"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i')
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.decodeHtmlText(match[1]);
      }
    }

    return 'YouTube video';
  }

  decodeHtmlEntities(value = '') {
    if (!value) return '';

    let decoded = String(value)
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    decoded = decoded
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\');

    return decoded.replace(/\s+/g, ' ').trim();
  }

  extractVideoTitleFromHtml(html) {
    const patterns = [
      /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i,
      /<title[^>]*>([^<]*?)<\/title>/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match || !match[1]) continue;

      let title = this.decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
      title = title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
      if (title) {
        return title;
      }
    }

    const ldJsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (ldJsonMatch) {
      try {
        const json = JSON.parse(ldJsonMatch[1]);
        const name = json?.name || json?.['@graph']?.find?.(item => item?.name)?.name;
        if (name) {
          return this.decodeHtmlEntities(String(name)).replace(/\s*-\s*YouTube\s*$/i, '').trim();
        }
      } catch (_error) {
        // ignore invalid JSON and fall back to other patterns
      }
    }

    return null;
  }

  extractPublishedDateFromHtml(html) {
    const patterns = [
      /<meta\s+[^>]*itemprop=["']datePublished["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\s+[^>]*property=["']video:release_date["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /"publishDate"\s*:\s*"([^"]+)"/i,
      /"datePublished"\s*:\s*"([^"]+)"/i,
      /"uploadDate"\s*:\s*"([^"]+)"/i,
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*itemprop=["']datePublished["'][^>]*>/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match || !match[1]) continue;

      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }

  async fetchVideoMetadata(videoUrl) {
    try {
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!response.ok) {
        return { title: null, publishedAt: null, status: response.status };
      }

      const html = await response.text();
      return {
        title: this.extractVideoTitleFromHtml(html),
        publishedAt: this.extractPublishedDateFromHtml(html),
        status: response.status
      };
    } catch (_error) {
      return { title: null, publishedAt: null, status: null };
    }
  }

  /**
   * Items arrive in channel grid order (newest first); returns them oldest first.
   */
  async enrichVideoMetadata(items) {
    const enriched = [...items].reverse();

    // Fetch sequentially and only for missing titles — YouTube rate-limits bulk page fetches.
    let rateLimited = false;
    for (const item of enriched) {
      if (!item.needsTitle || rateLimited) continue;
      const metadata = await this.fetchVideoMetadata(item.itemUrl);
      if (metadata.status === 429) {
        rateLimited = true;
        console.warn('[YouTubeChannelParser] YouTube rate-limited video page requests; keeping grid titles');
        continue;
      }
      if (metadata.title) {
        item.title = metadata.title;
      }
    }

    const deduped = [];
    const seenTitles = new Set();

    for (const item of enriched) {
      const normalizedTitle = String(item.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalizedTitle) {
        deduped.push(item);
        continue;
      }

      if (seenTitles.has(normalizedTitle)) {
        continue;
      }

      seenTitles.add(normalizedTitle);
      deduped.push(item);
    }

    return deduped.map(({ needsTitle, ...item }, index) => ({
      ...item,
      position: index
    }));
  }

  async fetchHtml(url) {
    // Static HTML only contains the first ~30 videos, so a full browser scroll is required.
    try {
      return await this.fetchHtmlWithPuppeteer(url);
    } catch (error) {
      console.error(`[YouTubeChannelParser] Browser scrape failed, falling back to static fetch: ${error.message}`);
      return this.fetchStaticHtml(url);
    }
  }

  async fetchStaticHtml(url) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube channel page: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  async fetchHtmlWithPuppeteer(url) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      timeout: 90000
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      try {
        await page.waitForSelector('ytd-rich-grid-media, ytd-video-renderer, #contents', { timeout: 20000 });
      } catch (_error) {
        console.log('[YouTubeChannelParser] Video grid selector not found, continuing anyway');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));

      const countVideos = () => page.evaluate(() => {
        const ids = new Set();
        document.querySelectorAll('a[href*="/watch?v="]').forEach((anchor) => {
          const match = (anchor.getAttribute('href') || '').match(/[?&]v=([A-Za-z0-9_-]{11})/);
          if (match) ids.add(match[1]);
        });
        return ids.size;
      });

      const maxScrolls = 1000;
      const maxStableAttempts = 5;
      let lastCount = 0;
      let stableCount = 0;
      let scrollCount = 0;

      while (scrollCount < maxScrolls && stableCount < maxStableAttempts) {
        await page.evaluate(() => {
          const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
          window.scrollTo(0, height);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const currentCount = await countVideos();
        const hasMore = await page.evaluate(() => Boolean(document.querySelector('ytd-continuation-item-renderer')));

        if (currentCount === lastCount) {
          stableCount++;
          if (!hasMore && stableCount >= 2) break;
        } else {
          stableCount = 0;
          lastCount = currentCount;
        }

        scrollCount++;
        if (scrollCount % 10 === 0) {
          console.log(`[YouTubeChannelParser] Scroll ${scrollCount}: ${currentCount} videos loaded`);
        }
      }

      console.log(`[YouTubeChannelParser] Finished scrolling after ${scrollCount} scrolls, ${lastCount} videos found`);
      return await page.content();
    } finally {
      await browser.close();
    }
  }

  async parse(config) {
    const channelUrl = this.normalizeChannelUrl(config?.url || config?.channelUrl);
    if (!channelUrl) {
      throw new Error('A YouTube channel URL is required.');
    }

    const html = await this.fetchHtml(channelUrl);
    const $ = require('cheerio').load(html);
    const seen = new Map();

    const isPlaceholderTitle = (title) => !title || /^youtube video$/i.test(title);

    const addVideo = (rawUrl, titleText = '') => {
      const itemUrl = this.normalizeYouTubeUrl(rawUrl);
      if (!itemUrl) return;

      const normalizedKey = itemUrl.toLowerCase();
      const cleanTitle = (titleText || '').replace(/\s+/g, ' ').trim();
      const existing = seen.get(normalizedKey);

      if (existing) {
        if (existing.needsTitle && !isPlaceholderTitle(cleanTitle)) {
          existing.title = cleanTitle;
          existing.needsTitle = false;
        }
        return;
      }

      const needsTitle = isPlaceholderTitle(cleanTitle);
      seen.set(normalizedKey, {
        title: needsTitle ? `YouTube Video ${seen.size + 1}` : cleanTitle,
        mediaType: 'webvideo',
        itemUrl,
        itemYear: null,
        needsTitle
      });
    };

    $('a[href*="/watch?v="], a[href*="/shorts/"], a[href*="/live/"]').each((_, element) => {
      const $el = $(element);
      const absoluteUrl = this.resolveUrl($el.attr('href'), channelUrl);
      // Thumbnail anchors only contain overlay text like durations, not titles.
      const isThumbnail = $el.attr('id') === 'thumbnail' || $el.find('img, yt-image, ytd-thumbnail-overlay-time-status-renderer').length > 0;
      const titleText = $el.attr('title') || (isThumbnail ? '' : $el.text());
      addVideo(absoluteUrl, titleText);
    });

    const inlineMatches = [
      ...html.matchAll(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/g),
      ...html.matchAll(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/(?:[^/?#]+\/)?([A-Za-z0-9_-]{11})/g),
      ...html.matchAll(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([A-Za-z0-9_-]{11})/g),
      ...html.matchAll(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/g)
    ];
    inlineMatches.forEach((match) => {
      if (match[1]) {
        addVideo(`https://www.youtube.com/watch?v=${match[1]}`, 'YouTube video');
      }
    });

    const embeddedVideoIdMatches = [
      ...html.matchAll(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/g),
      ...html.matchAll(/(?:data-video-id|videoid)\s*=\s*["']([A-Za-z0-9_-]{11})["']/gi)
    ];
    embeddedVideoIdMatches.forEach((match) => {
      if (match[1]) {
        const videoId = match[1];
        addVideo(`https://www.youtube.com/watch?v=${videoId}`, this.getEmbeddedVideoTitle(html, videoId));
      }
    });

    const items = Array.from(seen.values()).map((item, index) => ({
      ...item,
      position: index
    }));

    const orderedItems = await this.enrichVideoMetadata(items);

    if (orderedItems.length === 0) {
      throw new Error('No YouTube videos were found on that channel page. Check the channel URL and try again.');
    }

    return orderedItems;
  }

  getDescription() {
    return 'Scrape a YouTube channel page and turn each video into a web-video item for a custom order.';
  }

  getConfigFields() {
    return [];
  }
}

module.exports = YouTubeChannelParser;
