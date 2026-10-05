const test = require('node:test');
const assert = require('node:assert/strict');

const YouTubeChannelParser = require('../services/parsers/YouTubeChannelParser');

YouTubeChannelParser.prototype.fetchHtmlWithPuppeteer = function (url) {
  return this.fetchStaticHtml(url);
};

test('YouTube channel parser extracts web video items from a channel page', async () => {
  const originalFetch = global.fetch;
  const sampleHtml = `
    <html>
      <body>
        <a href="/watch?v=abc123defgh"><span>Alpha video</span></a>
        <a href="/watch?v=def456ghijk"><span>Beta video</span></a>
        <a href="/shorts/xyz987zyx21">Short video</a>
      </body>
    </html>
  `;

  global.fetch = async () => ({
    ok: true,
    text: async () => sampleHtml,
  });

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({
      url: 'https://www.youtube.com/@example/videos',
      useJavaScript: false,
      itemSelector: '',
      titleSelector: '',
      mediaTypeSelector: '',
      urlSelector: '',
      yearSelector: '',
      defaultMediaType: 'webvideo'
    });

    assert.equal(items.length, 3);
    assert.equal(items[0].mediaType, 'webvideo');
    assert.equal(items[0].itemUrl, 'https://www.youtube.com/watch?v=xyz987zyx21');
    assert.equal(items[1].itemUrl, 'https://www.youtube.com/watch?v=def456ghijk');
    assert.equal(items[2].itemUrl, 'https://www.youtube.com/watch?v=abc123defgh');
    assert.equal(items[2].title, 'Alpha video');
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube channel parser finds video IDs embedded in modern channel page JSON', async () => {
  const originalFetch = global.fetch;
  const sampleHtml = `
    <html>
      <body>
        <script>
          var ytInitialData = {
            "contents": {
              "twoColumnBrowseResultsRenderer": {
                "tabs": [{
                  "tabRenderer": {
                    "content": {
                      "richGridRenderer": {
                        "contents": [
                          {"richItemRenderer": {"content": {"videoRenderer": {"videoId": "abc123defgh", "title": {"runs": [{"text": "Alpha video"}]}}}}},
                          {"richItemRenderer": {"content": {"reelItemRenderer": {"videoId": "xyz987zyx21"}}}}
                        ]
                      }
                    }
                  }
                }]
              }
            }
          };
        </script>
      </body>
    </html>
  `;

  global.fetch = async () => ({
    ok: true,
    text: async () => sampleHtml,
  });

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({
      url: 'https://www.youtube.com/@example/videos',
      useJavaScript: false,
      itemSelector: '',
      titleSelector: '',
      mediaTypeSelector: '',
      urlSelector: '',
      yearSelector: '',
      defaultMediaType: 'webvideo'
    });

    assert.equal(items.length, 2);
    assert.deepEqual(items.map(item => item.itemUrl), [
      'https://www.youtube.com/watch?v=xyz987zyx21',
      'https://www.youtube.com/watch?v=abc123defgh'
    ]);
    assert.equal(items[1].title, 'Alpha video');
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube channel parser fetches the actual title when the grid has none', async () => {
  const originalFetch = global.fetch;
  const channelHtml = `
    <html>
      <body>
        <a id="thumbnail" href="/watch?v=abc123defgh"><span>12:34</span></a>
      </body>
    </html>
  `;

  global.fetch = async (url) => {
    const youtubeUrl = String(url);
    if (youtubeUrl.includes('watch?v=abc123defgh')) {
      return {
        ok: true,
        text: async () => '<html><head><title>Actual YouTube Title - YouTube</title></head></html>'
      };
    }

    return {
      ok: true,
      text: async () => channelHtml
    };
  };

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({
      url: 'https://www.youtube.com/@example/videos',
      useJavaScript: false,
      itemSelector: '',
      titleSelector: '',
      mediaTypeSelector: '',
      urlSelector: '',
      yearSelector: '',
      defaultMediaType: 'webvideo'
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Actual YouTube Title');
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube channel parser skips duplicate video titles', async () => {
  const originalFetch = global.fetch;
  const channelHtml = `
    <html>
      <body>
        <a href="/watch?v=duplicateOne"><span>Same title</span></a>
        <a href="/watch?v=duplicateTwo"><span>Same title</span></a>
      </body>
    </html>
  `;

  global.fetch = async (url) => {
    const youtubeUrl = String(url);
    if (youtubeUrl.includes('watch?v=duplicateOne')) {
      return {
        ok: true,
        text: async () => '<html><head><title>Same title - YouTube</title></head></html>'
      };
    }

    if (youtubeUrl.includes('watch?v=duplicateTwo')) {
      return {
        ok: true,
        text: async () => '<html><head><title>Same title - YouTube</title></head></html>'
      };
    }

    return {
      ok: true,
      text: async () => channelHtml
    };
  };

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({
      url: 'https://www.youtube.com/@example/videos',
      useJavaScript: false,
      itemSelector: '',
      titleSelector: '',
      mediaTypeSelector: '',
      urlSelector: '',
      yearSelector: '',
      defaultMediaType: 'webvideo'
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Same title');
    assert.equal(items[0].itemUrl, 'https://www.youtube.com/watch?v=duplicateTwo');
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube channel parser orders videos oldest first (reverse of channel grid)', async () => {
  const originalFetch = global.fetch;
  const channelHtml = `
    <html>
      <body>
        <a id="thumbnail" href="/watch?v=latestVideo"><span>3:00</span></a>
        <a id="video-title-link" title="Newest video" href="/watch?v=latestVideo">Newest video</a>
        <a id="thumbnail" href="/watch?v=middleVideo"><span>4:00</span></a>
        <a id="video-title-link" title="Middle video" href="/watch?v=middleVideo">Middle video</a>
        <a id="thumbnail" href="/watch?v=oldestVideo"><span>5:00</span></a>
        <a id="video-title-link" title="Oldest video" href="/watch?v=oldestVideo">Oldest video</a>
      </body>
    </html>
  `;

  let videoPageFetches = 0;
  global.fetch = async (url) => {
    if (String(url).includes('watch?v=')) videoPageFetches++;
    return { ok: true, status: 200, text: async () => channelHtml };
  };

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({ url: 'https://www.youtube.com/@example/videos' });

    assert.deepEqual(items.map(i => i.title), ['Oldest video', 'Middle video', 'Newest video']);
    assert.deepEqual(items.map(i => i.position), [0, 1, 2]);
    assert.equal(items[0].needsTitle, undefined);
    assert.equal(videoPageFetches, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube channel parser skips video page fetches after a 429', async () => {
  const originalFetch = global.fetch;
  const channelHtml = `
    <html>
      <body>
        <a id="thumbnail" href="/watch?v=aaaaaaaaaaa"></a>
        <a id="thumbnail" href="/watch?v=bbbbbbbbbbb"></a>
      </body>
    </html>
  `;

  let videoPageFetches = 0;
  global.fetch = async (url) => {
    if (String(url).includes('watch?v=')) {
      videoPageFetches++;
      return { ok: false, status: 429, text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => channelHtml };
  };

  try {
    const parser = new YouTubeChannelParser();
    const items = await parser.parse({ url: 'https://www.youtube.com/@example/videos' });

    assert.equal(items.length, 2);
    assert.equal(videoPageFetches, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

