const cheerio = require('cheerio');
const { promisify } = require('util');
const { execFile } = require('child_process');
const BaseListParser = require('./BaseListParser');

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class AlienVsPredatorTimelineParser extends BaseListParser {
  constructor() {
    super('Alien vs Predator Timeline Parser');
  }

  async parse(config) {
    const parserConfig = this.parseParserConfig(config.parserConfig);
    const storedArticleHtml = parserConfig.articleHtml || parserConfig.sourceHtml || parserConfig.article || null;

    if (storedArticleHtml && storedArticleHtml.trim()) {
      return this.parseHtmlContent(storedArticleHtml, config.url || 'https://www.thecomicboard.com');
    }

    const source = await this.fetchSource(config.url, config.useJavaScript !== false);

    if (source.kind === 'html') {
      return this.parseHtmlContent(source.content, config.url);
    }

    return this.parseTextFallback(source.content, config.url, config.defaultMediaType || 'movie');
  }

  parseParserConfig(rawParserConfig) {
    if (!rawParserConfig) return {};

    if (typeof rawParserConfig === 'object') {
      return rawParserConfig;
    }

    if (typeof rawParserConfig === 'string') {
      const trimmed = rawParserConfig.trim();
      if (!trimmed) return {};

      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (_error) {
          // If JSON parsing fails, treat the string as raw article HTML below.
        }
      }

      return { articleHtml: rawParserConfig };
    }

    return {};
  }

  parseHtmlContent(html, baseUrl) {
    const sectionHtml = this.extractViewingOrderSectionHtml(html);
    const fragments = this.splitHtmlFragments(sectionHtml);
    const items = [];
    let position = 0;

    for (const fragment of fragments) {
      const parsed = this.parseHtmlFragment(fragment, baseUrl);
      if (!parsed) continue;

      items.push({
        ...parsed,
        position: position++,
        itemYear: null
      });
    }

    if (!items.length) {
      throw new Error('No Viewing Order items were found in the Alien vs Predator timeline thread');
    }

    return items;
  }

  parseTextFallback(text, baseUrl, defaultMediaType) {
    const fallbackSectionText = this.extractViewingOrderSectionText(text);
    const lines = fallbackSectionText
      .split(/\r?\n/)
      .map(line => this.normalizeWhitespace(line))
      .filter(Boolean);

    const sectionLines = [];
    for (const line of lines) {
      if (this.isFallbackTerminator(line)) break;
      sectionLines.push(line);
    }

    const mergedLines = this.mergeWrappedTextLines(sectionLines);
    const items = [];
    let position = 0;

    for (const line of mergedLines) {
      if (!line || this.isNonEntryText(line)) continue;

      const episode = this.parseEpisodeLine(line);
      if (episode) {
        items.push({
          ...episode,
          mediaType: 'episode',
          itemUrl: null,
          itemYear: null,
          position: position++
        });
        continue;
      }

      items.push({
        title: line,
        mediaType: this.inferFallbackMediaType(line, defaultMediaType),
        itemUrl: null,
        itemYear: null,
        position: position++
      });
    }

    if (!items.length) {
      throw new Error('No Viewing Order items were found in the Alien vs Predator timeline thread');
    }

    return items;
  }

  async fetchSource(url, allowJavaScript) {
    const directHtml = await this.tryFetchHtml(url);
    if (directHtml && !this.looksLikeCloudflareInterstitial(directHtml)) {
      return { kind: 'html', content: directHtml };
    }

    if (allowJavaScript) {
      const browserHtml = await this.tryFetchHtmlWithPuppeteer(url);
      if (browserHtml && !this.looksLikeCloudflareInterstitial(browserHtml)) {
        return { kind: 'html', content: browserHtml };
      }
    }

    const fallbackText = await this.fetchTextProxy(url);
    return { kind: 'text', content: fallbackText };
  }

  async tryFetchHtml(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch (_error) {
      return null;
    }
  }

  async tryFetchHtmlWithPuppeteer(url) {
    let browser = null;

    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 2000 });
      await page.setUserAgent(BROWSER_USER_AGENT);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForFunction(
        () => document.body && !document.body.innerText.includes('Enable JavaScript and cookies to continue'),
        { timeout: 12000 }
      ).catch(() => null);

      const html = await page.content();
      await browser.close();
      return html;
    } catch (_error) {
      if (browser) {
        await browser.close().catch(() => null);
      }
      return null;
    }
  }

  async fetchTextProxy(url) {
    const proxyUrls = [
      `https://r.jina.ai/http://https://${url.replace(/^https?:\/\//i, '')}`,
      `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`
    ];

    for (const proxyUrl of proxyUrls) {
      try {
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            'Accept': 'text/plain, text/markdown;q=0.9, */*;q=0.8'
          }
        });

        if (!response.ok) {
          continue;
        }

        const text = await response.text();
        if (!this.looksLikeForbiddenResponse(text)) {
          return text;
        }
      } catch (_error) {
        // Fall through to the next proxy variant or command-based retrieval below.
      }
    }

    return await this.fetchTextProxyViaCommand(proxyUrls, url);
  }

  async fetchTextProxyViaCommand(proxyUrls, originalUrl) {
    for (const proxyUrl of proxyUrls) {
      const commandAttempts = process.platform === 'win32'
        ? [
            {
              command: 'powershell',
              args: ['-NoProfile', '-Command', `& { $ProgressPreference='SilentlyContinue'; (Invoke-WebRequest -Uri '${proxyUrl}').Content }`]
            },
            {
              command: 'pwsh',
              args: ['-NoProfile', '-Command', `& { $ProgressPreference='SilentlyContinue'; (Invoke-WebRequest -Uri '${proxyUrl}').Content }`]
            },
            {
              command: 'curl.exe',
              args: ['-L', '-A', BROWSER_USER_AGENT, proxyUrl]
            }
          ]
        : [
            {
              command: 'curl',
              args: ['-L', '-A', BROWSER_USER_AGENT, proxyUrl]
            }
          ];

      for (const attempt of commandAttempts) {
        try {
          const { stdout } = await execFileAsync(attempt.command, attempt.args, { maxBuffer: 10 * 1024 * 1024 });
          if (stdout && stdout.trim() && !this.looksLikeForbiddenResponse(stdout)) {
            return stdout;
          }
        } catch (_error) {
          // Try the next available command.
        }
      }
    }

    throw new Error(`Failed to fetch ${originalUrl}: direct and proxy retrieval both failed`);
  }

  looksLikeForbiddenResponse(text) {
    const normalized = this.normalizeWhitespace((text || '').slice(0, 500));
    return normalized.startsWith('403 Forbidden')
      || normalized.includes('<title>403</title>')
      || normalized.includes('Enable JavaScript and cookies to continue');
  }

  extractViewingOrderSectionText(text) {
    const normalizedText = (text || '').replace(/\r/g, '');
    const headingRegex = /(^|\n)\s*(?:[#>*-]+\s*)?Viewing Order\b:?\s*(\n|$)/gi;
    const matches = [...normalizedText.matchAll(headingRegex)];

    if (!matches.length) {
      throw new Error('Could not find the Viewing Order section in the Alien vs Predator timeline thread');
    }

    let bestSection = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const sectionStart = (match.index || 0) + match[0].length;
      const nextHeadingIndex = index + 1 < matches.length ? (matches[index + 1].index || normalizedText.length) : normalizedText.length;
      const candidate = normalizedText.slice(sectionStart, nextHeadingIndex);
      const score = this.scoreFallbackViewingOrderCandidate(candidate);

      if (score > bestScore) {
        bestScore = score;
        bestSection = candidate;
      }
    }

    if (!bestSection) {
      throw new Error('Could not find the Viewing Order section in the Alien vs Predator timeline thread');
    }

    return bestSection;
  }

  scoreFallbackViewingOrderCandidate(sectionText) {
    const lines = sectionText
      .split(/\n+/)
      .map(line => this.normalizeWhitespace(line))
      .filter(Boolean)
      .slice(0, 80);

    const episodeCount = lines.filter(line => /\b\d+x\d+\b/i.test(line)).length;
    const comicCount = lines.filter(line => /#\d|\bpg\.|\bStory\s+\d+|\bvol\.\b/i.test(line)).length;
    const gameCount = lines.filter(line => /Mission\s+\d+|Hunting Grounds|Concrete Jungle|Primal Hunt|Alien: Isolation|Fireteam Elite/i.test(line)).length;
    const screenCount = lines.filter(line => /^(Prey|Predator|Predator 2|The Predator|Predators|Prometheus|Alien|Alien: Covenant|Alien: Resurrection|AVP:|Aliens vs Predator)/i.test(line)).length;
    const hasPredatorHuntingGrounds = lines.some(line => /Predator: Hunting Grounds/i.test(line));
    const hasPredator2 = lines.some(line => /^Predator 2\b/i.test(line));
    const hasPrometheus = lines.some(line => /^Prometheus\b/i.test(line));
    const hasAlienIsolation = lines.some(line => /^Alien: Isolation\b/i.test(line));
    const hasPreyFirst = lines.slice(0, 5).some(line => /^Prey\b/i.test(line));

    return (episodeCount * 5)
      + (gameCount * 2)
      + (screenCount * 2)
      + (hasPredatorHuntingGrounds ? 10 : 0)
      + (hasPredator2 ? 6 : 0)
      + (hasPrometheus ? 6 : 0)
      + (hasAlienIsolation ? 6 : 0)
      + (hasPreyFirst ? 4 : 0)
      - (comicCount * 3);
  }

  looksLikeCloudflareInterstitial(html) {
    if (!html) return true;

    return html.includes('Enable JavaScript and cookies to continue')
      || html.includes('window._cf_chl_opt')
      || html.includes('/cdn-cgi/challenge-platform/');
  }

  extractViewingOrderSectionHtml(html) {
    const $ = cheerio.load(html);
    const startNode = $('u').filter((_index, element) => {
      return this.normalizeWhitespace($(element).text()).toLowerCase() === 'viewing order';
    }).first();

    if (!startNode.length) {
      throw new Error('Could not find the underlined Viewing Order heading in the Alien vs Predator timeline thread');
    }

    const startHtml = $.html(startNode);
    const startIndex = html.indexOf(startHtml);
    if (startIndex === -1) {
      throw new Error('Could not isolate the Viewing Order section in the Alien vs Predator timeline thread');
    }

    const afterStartIndex = startIndex + startHtml.length;
    const remainingHtml = html.slice(afterStartIndex);
    const footerMatch = remainingHtml.match(/<footer\b/i);

    return footerMatch ? remainingHtml.slice(0, footerMatch.index) : remainingHtml;
  }

  splitHtmlFragments(sectionHtml) {
    const withLineBreaks = sectionHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<(?:\/)?(?:p|div|li|blockquote|section|article|tr|h[1-6])\b[^>]*>/gi, '\n');

    return withLineBreaks
      .split(/\n+/)
      .map(fragment => fragment.trim())
      .filter(Boolean);
  }

  parseHtmlFragment(fragmentHtml, baseUrl) {
    const $ = cheerio.load(`<root>${fragmentHtml}</root>`);
    const root = $('root');
    const lineText = this.normalizeWhitespace(root.text());

    if (!lineText || this.isNonEntryText(lineText)) {
      return null;
    }

    const firstUnderline = root.find('u').first();
    if (firstUnderline.length && this.normalizeWhitespace(firstUnderline.text()) === lineText) {
      return {
        title: lineText,
        mediaType: 'webvideo',
        itemUrl: this.resolveUrl(firstUnderline.find('a').first().attr('href') || root.find('a').first().attr('href') || null, baseUrl)
      };
    }

    const firstItalic = root.find('i').first();
    if (firstItalic.length && this.normalizeWhitespace(firstItalic.text()) === lineText) {
      const boldInItalic = firstItalic.find('b').first();
      if (boldInItalic.length) {
        return {
          title: this.normalizeWhitespace(boldInItalic.text()),
          mediaType: 'shortstory',
          itemUrl: this.resolveUrl(firstItalic.find('a').first().attr('href') || null, baseUrl)
        };
      }

      return {
        title: lineText,
        mediaType: 'comic',
        itemUrl: this.resolveUrl(firstItalic.find('a').first().attr('href') || null, baseUrl)
      };
    }

    const episodeFromLine = this.parseEpisodeLine(lineText);
    if (episodeFromLine) {
      return {
        ...episodeFromLine,
        mediaType: 'episode',
        itemUrl: this.resolveUrl(root.find('a').first().attr('href') || null, baseUrl)
      };
    }

    const firstBold = root.find('b').first();
    if (!firstBold.length) {
      return null;
    }

    const seriesOrTitle = this.normalizeWhitespace(firstBold.text());
    const trailingText = this.normalizeWhitespace(lineText.slice(lineText.indexOf(seriesOrTitle) + seriesOrTitle.length));
    const episode = this.parseEpisodeTrailingText(trailingText, seriesOrTitle);

    if (episode) {
      return {
        ...episode,
        mediaType: 'episode',
        itemUrl: this.resolveUrl(firstBold.find('a').first().attr('href') || root.find('a').first().attr('href') || null, baseUrl)
      };
    }

    return {
      title: seriesOrTitle,
      mediaType: 'movie',
      itemUrl: this.resolveUrl(firstBold.find('a').first().attr('href') || root.find('a').first().attr('href') || null, baseUrl)
    };
  }

  parseEpisodeTrailingText(trailingText, seriesTitle) {
    const match = trailingText.match(/^(\d+)x(\d+)(?:\s*,\s*["“](.+?)["”])?$/i);
    if (!match) {
      return null;
    }

    const seasonNumber = parseInt(match[1], 10);
    const episodeNumber = parseInt(match[2], 10);
    const title = this.normalizeWhitespace(match[3] || `${seriesTitle} ${match[1]}x${match[2]}`);

    return {
      title,
      seriesTitle,
      seasonNumber,
      episodeNumber
    };
  }

  parseEpisodeLine(line) {
    const match = line.match(/^(.*?)\s+(\d+)x(\d+)(?:\s*,\s*["“](.+?)["”])?$/i);
    if (!match) {
      return null;
    }

    const seriesTitle = this.normalizeWhitespace(match[1]);
    const seasonNumber = parseInt(match[2], 10);
    const episodeNumber = parseInt(match[3], 10);

    return {
      title: this.normalizeWhitespace(match[4] || `${seriesTitle} ${match[2]}x${match[3]}`),
      seriesTitle,
      seasonNumber,
      episodeNumber
    };
  }

  mergeWrappedTextLines(lines) {
    const merged = [];

    for (const line of lines) {
      if (!merged.length) {
        merged.push(line);
        continue;
      }

      const previous = merged[merged.length - 1];
      const previousQuoteCount = (previous.match(/["“”]/g) || []).length;
      const currentLooksLikeContinuation = previousQuoteCount % 2 === 1 || /^[a-z0-9'’\-]/i.test(line) === false;

      if (currentLooksLikeContinuation) {
        merged[merged.length - 1] = `${previous} ${line}`.trim();
      } else {
        merged.push(line);
      }
    }

    return merged;
  }

  inferFallbackMediaType(line, defaultMediaType) {
    const lower = line.toLowerCase();

    if (/(ted talk|happy birthday|quiet eye|transmission|prologue|meet walter|crew messages|advent|last signs of life|containment|specimen|night shift|ore|harvest|alone|crucified|moments of extraction)/i.test(line)) {
      return 'webvideo';
    }

    if (/(mission \d+|hunting grounds$|concrete jungle$|isolation$|blackout$|fireteam elite$|colonial marines$|primal hunt$)/i.test(line)) {
      return 'game';
    }

    if (lower.includes('comic')) return 'comic';
    if (lower.includes('short story')) return 'shortstory';

    return defaultMediaType;
  }

  isFallbackTerminator(line) {
    return /^(note:|click to expand|reply$|joined$|messages$|location$|last edited:|pro bot$|well-known member$|alien vs predator timeline by )/i.test(line)
      || /^#\d+$/.test(line);
  }

  isNonEntryText(line) {
    if (!line) return true;

    if (/^(viewing order|note:|click to expand)/i.test(line)) return true;
    if (/^(january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(line)) return true;
    if (/^\d{4}$/.test(line) || /^\d\?{3,}$/.test(line) || /^\?+$/.test(line)) return true;

    return false;
  }

  resolveUrl(href, baseUrl) {
    if (!href) return null;

    try {
      return new URL(href, baseUrl).toString();
    } catch (_error) {
      return href;
    }
  }

  normalizeWhitespace(value) {
    return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  getDescription() {
    return 'Parses the Comic Board Alien vs Predator timeline thread from the underlined Viewing Order section through the post footer. Maps italic entries to comics, italic-bold entries to short stories, bold entries to movies or episodes, and underlined entries to web videos.';
  }

  getConfigFields() {
    return [
      {
        name: 'articleHtml',
        label: 'Source Article HTML',
        required: true,
        type: 'textarea'
      }
    ];
  }
}

module.exports = AlienVsPredatorTimelineParser;