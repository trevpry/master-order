# Writing a Stash Scraper YAML File

You are creating **one file**: `server/services/scrapers/configs/<SiteName>.yml`

The app auto-loads every `.yml` in that folder on startup. No code changes, no registration step.

> **Important:** This engine is a *subset* of Stash's YAML scraper format. Copying a scraper from
> the Stash community repo will usually **not** work. Follow this guide, not Stash's docs.

---

## 1. Rules you must not break

1. **Never guess a selector.** Fetch the real page and look at the real HTML first (Step 2).
2. **Test every section you write** before moving to the next one (Step 7).
3. **Only use the selector syntax in Section 5.** Unsupported syntax fails *silently* and returns `null`.
4. **Only use the two `postProcess` rules in Section 6.** Any other rule is ignored silently.
5. `Date` must end up as `YYYY-MM-DD`.
6. If a feature genuinely isn't available on the site, **leave it out and add a comment saying why.**
   Do not invent data or point at URLs you haven't confirmed return 200.

---

## 2. Research the site first

Create a throwaway probe script (delete it when done):

```js
// tmp-probe.js  —  usage: node tmp-probe.js "<url>" ["<needle>"]
const cheerio = require('cheerio');
const BaseScraperService = require('./server/services/scrapers/BaseScraperService');

(async () => {
  const [url, needle] = process.argv.slice(2);
  const svc = new BaseScraperService('Probe');
  const $ = await svc.fetchHtml(url, process.env.JS === '1'); // JS=1 to render with Puppeteer

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
```

Answer these before writing any YAML:

| Question | How to check |
|---|---|
| What do scene URLs look like? | Open a listing page, collect `a[href*="/scene"]` hrefs |
| What do performer URLs look like? | Collect `a[href*="/model"]` / `/performer` / `/star` hrefs |
| Does the page work without JS? | Run probe with and without `JS=1`. If content only appears with `JS=1`, set `renderJavaScript: true` |
| Is there a `<script type="application/ld+json">`? | Probe output. **If yes, prefer it** — it survives site redesigns |
| Are class names hashed? (`sc-1b6bgon-3`, `one-list-8ouyy7`) | If yes, **never** select on them. Use tags, `data-*`, `href` patterns, or JSON-LD |
| Is there a working text search? | Try `?q=`, `?query=`, `?s=`, `/search/<term>`. **Verify it filters** — compare two different queries. Many sites return identical results for any query |
| Does pagination work server-side? | Fetch `?page=2` and confirm the items actually differ from page 1 |

---

## 3. File skeleton

```yaml
name: SiteName          # REQUIRED. Becomes siteName. Used to link studios to scrapers.

renderJavaScript: true  # Only if the site needs JS. Slow (Puppeteer) — omit when possible.

# Optional: rewrite tracking/mobile links to canonical URLs before scraping.
urlReplacements:
  - pattern: '^https?://(?:www\.)?site\.net/track/'
    replace: 'https://www.site.com/'
    regex: true

sceneByURL:
  - action: scrapeXPath
    url:
      - site.com/scene/       # see Section 4 for matching rules
    scraper: sceneScraper

movieByURL:
  - action: scrapeXPath
    url:
      - site.com/scene/
    scraper: movieScraper

performerByURL:
  - action: scrapeXPath
    url:
      - site.com/model/
    scraper: performerScraper

sceneByFragment:          # Optional — see Section 8
  - action: scrapeXPath
    spacesConvertTo: '-'
    titleSearchScraper: sceneSearchScraper
    studioSearchUrl: https://www.site.com/search?q={title}
    performerSearchScraper: performerSearchScraper
    performerSearchUrl: https://www.site.com/models?q={performer}

xPathScrapers:
  sceneScraper:
    scene:
      # Section 7.1
  movieScraper:
    movie:
      # Section 7.2
  performerScraper:
    performer:
      # Section 7.3
  sceneSearchScraper:
    scene:
      # Section 8.1
  performerSearchScraper:
    performer:
      # Section 8.2
```

---

## 4. URL matching

A URL matches when **the domain is identical** *and* the URL **starts with** the pattern
(after stripping `https://` and `www.`).

```yaml
url:
  - site.com/scene/     # ✅ matches https://www.site.com/scene/123/slug
                        # ✅ matches http://site.com/scene/123/slug
                        # ❌ does NOT match site.com/videos/123
```

- Do **not** include `https://` or `www.` in the pattern.
- Do **not** use wildcards — there is no glob support.
- Include every domain the site uses (`site.com`, `site.net`, `www2.site.com`).

---

## 5. Selector syntax

Selectors are XPath-*like* strings converted to jQuery. **The converter supports only the following.**

### ✅ Supported

| Pattern | Example | Notes |
|---|---|---|
| Descendant | `//div//a` | |
| Direct child | `//div/a` | |
| Exact attribute | `//div[@id="main"]` | Attribute names may contain `-` (e.g. `@data-cy`) |
| Attribute contains | `//a[contains(@href,"/scene/")]` | |
| Class contains | `//div[contains(@class,"v-item")]` | **Use this for classes** |
| Attribute exists | `//a[@href]` | |
| Two conditions | `//a[@class="x" and contains(@href,"y")]` | |
| Text equals | `//strong[text()="From:"]` | |
| Text contains | `//li[contains(text(),"Added:")]` | |
| Node contains | `//p[contains(.,"Guys")]/a` | |
| Position (1-based) | `//p[2]` | |
| Extract attribute | `//img/@src` | Must be at the **end** |
| Extract text node | `//div/text()` | |
| Parent axis | `//h3[@class="t"]/parent::a` | |

### ❌ NOT supported — these fail silently and return `null`

| Pattern | Use instead |
|---|---|
| `following-sibling::` / `preceding-sibling::` | Select a common ancestor, or pick a different anchor |
| `ancestor::`, `descendant::` | `//` |
| `[@class="a b c"]` on multi-class elements | `[contains(@class,"a")]` |
| `last()`, `position()>1` | Fixed index `[n]` |
| `|` (union) | Separate fields |
| XPath functions (`normalize-space()`, `concat()`, …) | `postProcess` regex |

### Selector priority — pick the most stable option available

1. **JSON-LD** — `//script[@type="application/ld+json"]` + regex. Best choice when present.
2. **`data-*` attributes** — `//section[@data-cy="description"]//p`
3. **Semantic tags / href patterns** — `//h1`, `//a[contains(@href,"/model/")]`
4. **Meta tags** — `//meta[@property="og:image"]/@content`
5. **Stable class names** — only if they're human-written, not hashed.

> **Hashed class names** (`sc-1b6bgon-3`, `one-list-8ouyy7`, `css-1x2y3z`) change on every
> site deploy. Never select on them.

---

## 6. postProcess

**Only two rules exist.** `map`, `feetToCm`, `lbToKg`, `subScraper` etc. are **ignored silently**.

### `replace`

Applied in order. `regex` is a JS regex string; `with` supports `$1` backreferences.

```yaml
Title:
  selector: //h2
  postProcess:
    - replace:
        - regex: '^Watch\s+'
          with: ''
        - regex: '\s+\|.*$'
          with: ''
```

> ### ⚠️ The single most common bug
> If a regex **does not match**, the value passes through **unchanged**. A regex meant to
> *extract* a substring will leak the **entire source string** into the field when its label
> is missing.
>
> Always guard extractions with a blank-out rule first:
>
> ```yaml
> HairColor:
>   selector: //section[@data-cy="description"]//p
>   postProcess:
>     - replace:
>         # 1. blank the field when the label is absent
>         - regex: '^(?![\s\S]*Hair Color:)[\s\S]*$'
>           with: ''
>         # 2. now safe to extract
>         - regex: '^[\s\S]*?Hair Color:\s*([^|]+?)\s*(?:\||$)[\s\S]*$'
>           with: '$1'
> ```

### `parseDate`

Converts to `YYYY-MM-DD`. Go-style layout: `2006`=year, `01`=month, `02`=day.

```yaml
Date:
  selector: //span[@class="date"]
  postProcess:
    - replace:
        - regex: '^.*?(\d{2}/\d{2}/\d{4}).*$'   # isolate the date first
          with: '$1'
    - parseDate: 01/02/2006
```

| Site format | Layout to use |
|---|---|
| `08/28/2026` | `01/02/2006` |
| `28-08-2026` | `02-01-2006` |
| `2026-08-28` | none needed — already correct |
| `14 Aug 26`, `3 September 2024` | **auto-detected** — `parseDate: 02 Jan 06` |

> `parseDate` auto-detects `<day> <MonthName> <year>` regardless of the layout you give it.
> `August 28, 2026` (month-first, full name) is **not** auto-detected — convert it with
> `replace` rules first, or take the date from JSON-LD instead.

### Extracting from JSON-LD

```yaml
Title:
  selector: //script[@type="application/ld+json"]
  postProcess:
    - replace:
        - regex: '^[\s\S]*?"name":\s*"([\s\S]*?)"[\s\S]*$'
          with: '$1'
```

Verify with the probe that there is **exactly one** `ld+json` block; if there are several
(e.g. a BreadcrumbList), this grabs the first one only.

---

## 7. Field reference

Any field you omit is simply `null`. Only `Title` (scene/movie) and `Name` (performer) really matter.

### 7.1 `sceneScraper.scene`

| Field | Type | Notes |
|---|---|---|
| `Title` | selector | **Required** |
| `Date` | selector | Must produce `YYYY-MM-DD` |
| `Details` | selector | Description / synopsis |
| `Image` | selector | Cover image, absolute URL |
| `URL` | selector | Optional — omit and the source URL is used. **Omit unless you've confirmed it's right** (a `<base href>` tag will poison it) |
| `Studio.Name` | selector or `fixed:` | Usually `fixed: SiteName` |
| `Performers.Name` | selector (multi) | |
| `Performers.URL` | selector (multi) | Must align by index with `Performers.Name` |
| `Tags.Name` | selector (multi) | |
| `Movies` / `Groups` | `.Name`, `.URL` | Parent movie/series |

```yaml
sceneScraper:
  scene:
    Title:
      selector: //h1[@class="title"]
    Date:
      selector: //span[contains(@class,"date")]
      postProcess:
        - parseDate: 02 Jan 06
    Details: //div[contains(@class,"description")]
    Image:
      selector: //meta[@property="og:image"]/@content
    Studio:
      Name:
        fixed: SiteName
    Performers:
      Name:
        selector: //div[contains(@class,"models")]//a/@title
      URL:
        selector: //div[contains(@class,"models")]//a/@href
        postProcess:
          - replace:
              - regex: '^/'
                with: 'https://www.site.com/'
    Tags:
      Name:
        selector: //a[contains(@href,"/category/")]
```

### 7.2 `movieScraper.movie`

`Title`, `Synopsis`, `Date`, `Duration`, `Director`, `Rating`, `Studio.Name`,
`FrontImage` (or `Image`), `BackImage`.

Most sites have no separate movie page — point `movieByURL` at the same scene URL and reuse
the same selectors.

### 7.3 `performerScraper.performer`

| Field | Notes |
|---|---|
| `Name` | **Required** |
| `Gender` | Usually `fixed: Male` |
| `Details` | Bio |
| `Image` | Profile picture |
| `Aliases` | Multi-value |
| `Tags.Name` | Multi-value. Missing tags are **created automatically** on save |
| `Birthdate` | `YYYY-MM-DD` |
| `Country`, `Ethnicity`, `EyeColor`, `HairColor` | Free text |
| `Height`, `Weight`, `Measurements` | Free text |
| `PenisLength` | Free text |
| `Circumcised` | Output `Cut` or `Uncut` — the server normalises to `CUT`/`UNCUT` |
| `Tattoos`, `Piercings`, `CareerLength` | Free text |

```yaml
performerScraper:
  performer:
    Name:
      selector: //section[@data-cy="actorProfileName"]//h2
    Gender:
      fixed: Male
    Details:
      selector: //section[@data-cy="description"]//p
    Image:
      selector: //section[@data-cy="actorProfilePicture"]//img/@src
    HairColor:
      selector: //li[contains(text(),"Hair:")]
      postProcess:
        - replace:
            - regex: '^(?![\s\S]*Hair:)[\s\S]*$'
              with: ''
            - regex: '^[\s\S]*?Hair:\s*(.+?)\s*$'
              with: '$1'
```

**Many sites pack all physical stats into one bio string**
(`Hair Color: Black | Eye Color: Brown | Dick Size: 20cm | Cut or Uncut: Cut`).
Point every field at that same element and pull each one out with a guarded regex pair.

---

## 8. Search (`sceneByFragment`)

Search powers "Search by title", "Search by performers", and the studio-linked scraper button
on performer pages. **Omit the whole block if the site has no usable search.**

### Decision tree

```
Does the site have a text search that ACTUALLY filters results?
├─ No  → Can you list all scenes across working ?page=N pages?
│         ├─ Yes → HTML search (8.1). Set pagination.maxPages.
│         └─ No  → Omit sceneByFragment. Add a comment explaining why.
├─ Yes, returns HTML  → HTML search (8.1)
└─ Yes, returns JSON  → JSON search (8.3)  ← preferred, most reliable
```

> **Verify search really filters.** Request two very different queries and one nonsense query.
> If all three return the same items, the endpoint is a decoy — treat it as "no search".

### 8.1 HTML title search

```yaml
sceneByFragment:
  - action: scrapeXPath
    spacesConvertTo: '+'                                        # how spaces are encoded
    titleSearchScraper: sceneSearchScraper
    studioSearchUrl: https://www.site.com/search.php?query={title}
```

- `{title}` is replaced with the lowercased title, spaces → `spacesConvertTo`, other
  special characters percent-encoded.
- **No `{title}` placeholder?** The URL is fetched as a plain listing and results are filtered
  by title in JS. Add `pagination.maxPages` to walk more pages.

```yaml
  sceneSearchScraper:
    pagination:
      maxPages: 5                    # only if ?page=N genuinely works
    scene:
      Title:
        selector: //div[contains(@class,"v-title")]//a
      URL:
        selector: //div[contains(@class,"v-title")]//a/@href
        postProcess:
          - replace:
              - regex: '^/'
                with: 'https://www.site.com/'
      # Image / Date are optional
```

**Only `Title` and `URL` are required.** Full metadata is fetched later by re-scraping the
chosen URL.

> ### ⚠️ Index alignment
> `Title`, `URL`, `Image` and `Date` are matched together **by index**. If the page has
> 18 cards but only 9 thumbnails have loaded (lazy loading), `Image` will be attached to the
> wrong scenes. **Omit `Image` unless every card is guaranteed to have one.**
>
> If each card renders *two* links to the same scene (thumbnail + title), scope your selector
> to just one of them. Duplicates are deduplicated by URL, but titles must still line up.

Pagination stops early when a page yields no new URLs, so an over-large `maxPages` is safe
but wastes requests.

### 8.2 HTML performer search (two-stage)

Stage 1 finds the performer's page; stage 2 lists their scenes.

```yaml
    performerSearchScraper: performerSearchScraper
    performerSearchUrl: https://www.site.com/models?q={performer}
```

```yaml
  performerSearchScraper:
    performer:
      performerSceneScraper: performerSceneScraper   # scraper used on the performer's page
      Name:
        selector: //a[contains(@href,"/model/")]/@title
      URL:
        selector: //a[contains(@href,"/model/")]/@href
        postProcess:
          - replace:
              - regex: '^/'
                with: 'https://www.site.com/'

  performerSceneScraper:
    scene:
      Title:
        selector: //a[contains(@href,"/scene/")]/@title
      URL:
        selector: //a[contains(@href,"/scene/")]/@href
        postProcess:
          - replace:
              - regex: '^/'
                with: 'https://www.site.com/'
```

A scene is returned only if **every** searched performer appears on it. `Name` must match the
performer name exactly (case-insensitive) for stage 1 to succeed.

If the site has no performer-filtering search, you may point `performerSearchUrl` at a plain
`/models` listing — matching then only works for performers on that first page. Note the
limitation in a comment.

### 8.3 JSON API search

Use when the site's own front end calls a JSON API. Usually more reliable than HTML.

```yaml
sceneByFragment:
  - action: scrapeXPath
    spacesConvertTo: '-'
    jsonSearch:
      tokenUrl: https://www.site.com/scenes                 # page containing an auth token
      tokenRegex: 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'
      tokenHeader: Instance                                 # header to send the token in
      headers:
        Origin: https://www.site.com
        Referer: https://www.site.com/
      titleSearchUrl: https://api.site.com/v2/releases?type=scene&limit=20&search={query}
      performerSearchUrl: https://api.site.com/v2/releases?type=scene&limit=50&search={query}
      resultsPath: result                                   # dot path to the results array
      urlTemplate: https://www.site.com/scene/{id}/{slug}
      performerUrlTemplate: https://www.site.com/model/{id}/{slug}
      imagePath: images.poster.0.lg.url                     # dot path, supports numeric keys
      performersPath: actors
      tagsPath: tags
      fields:
        id: id
        title: title
        date: dateReleased
```

| Key | Default | Purpose |
|---|---|---|
| `tokenUrl` / `tokenRegex` / `tokenHeader` | — | Omit all three if the API needs no auth |
| `headers` | `{}` | Extra request headers |
| `titleSearchUrl` | — | `{query}` is percent-encoded |
| `performerSearchUrl` | — | Also used to resolve a performer page by name |
| `resultsPath` | `result` | Dot path to the array of records |
| `urlTemplate` | — | `{id}` and `{slug}` (slug generated from the title) |
| `performerUrlTemplate` | — | Enables name→performer-page lookup |
| `imagePath` | — | Dot path within a record |
| `performersPath` / `performerNameField` / `performerIdField` | `performers` / `name` / `id` | |
| `tagsPath` / `tagNameField` | `tags` / `name` | |
| `fields.id` / `.title` / `.date` | `id` / `title` / `date` | Date is truncated to the first 10 chars |

`jsonSearch` takes precedence over the HTML search when both are configured.

How to find the API: search the page source for `api`, `graphql`, or a config blob, and check
for a JWT (`eyJ...`) embedded in the HTML. Confirm the endpoint returns different results for
different queries before committing to it.

---

## 9. Test before you finish

Run each command that applies. Replace names and URLs.

```powershell
# Scene
node -e "const Y=require('./server/services/scrapers/YamlScraperService');const s=new Y('server/services/scrapers/configs/SiteName.yml');s.scrape('<scene-url>').then(r=>console.log(JSON.stringify(r.scraped,null,2)));"

# Performer
node -e "const Y=require('./server/services/scrapers/YamlScraperService');const s=new Y('server/services/scrapers/configs/SiteName.yml');s.scrapePerformer('<performer-url>').then(r=>console.log(JSON.stringify(r.scraped,null,2)));"

# Title search
node -e "const Y=require('./server/services/scrapers/YamlScraperService');const s=new Y('server/services/scrapers/configs/SiteName.yml');s.searchByTitle('<known title>').then(r=>console.log(JSON.stringify(r,null,2)));"

# Performer search (two names known to share a scene)
node -e "const Y=require('./server/services/scrapers/YamlScraperService');const s=new Y('server/services/scrapers/configs/SiteName.yml');s.searchScenes([{name:'A'},{name:'B'}]).then(r=>console.log(JSON.stringify(r,null,2)));"

# Performer lookup by name only
node -e "const Y=require('./server/services/scrapers/YamlScraperService');const s=new Y('server/services/scrapers/configs/SiteName.yml');s.searchPerformerUrl('<performer name>').then(console.log);"

# Registry loads it and URL patterns match
node -e "const R=require('./server/services/scrapers/ScraperRegistry');const r=new R();const x=r.scrapers.find(s=>s.siteName==='SiteName');console.log('loaded:',!!x,'scene:',x.canHandle('<scene-url>'),'performer:',x.canHandle('<performer-url>'));"
```

**Test with at least two different pages**, including an edge case — a performer with an empty
bio, or a scene with one performer and one with several. Confirm empty inputs produce `null`
rather than leaked text.

---

## 10. Troubleshooting

| Symptom | Cause |
|---|---|
| Field is `null` | Selector matched nothing. Check for unsupported syntax (Section 5), hashed classes, or content that needs `renderJavaScript: true` |
| Field contains the whole page/bio | A `replace` regex didn't match and passed the value through. Add the blank-out guard (Section 6) |
| Date unchanged or wrong | Format doesn't match the `parseDate` layout. Isolate the date with `replace` first |
| Duplicate search results | Each card renders two links. Scope the selector to one |
| Search images on wrong scenes | Index misalignment from lazy loading. Remove `Image` from the search scraper |
| Search returns same results for every query | The endpoint is a decoy — it doesn't filter. Remove it |
| Scraper missing from the UI | `canHandle` failed. Check the pattern has no `https://`/`www.` and the domain matches exactly |
| Relative URLs (`/scene/1`) in results | Add a `replace` turning `^/` into the absolute base |
| `Uncircumcised is not a valid CircumcisedEnum` | Output `Cut`/`Uncut` from `Circumcised` |

---

## 11. Final checklist

- [ ] `name` set; file is `configs/<name>.yml`
- [ ] `sceneByURL` patterns cover every domain, with no `https://` or `www.`
- [ ] `renderJavaScript: true` **only** if the site actually needs it
- [ ] No `following-sibling::`, no hashed class names, no exact `@class` on multi-class elements
- [ ] Every extraction regex has a blank-out guard
- [ ] `Date` produces `YYYY-MM-DD`; `Circumcised` produces `Cut`/`Uncut`
- [ ] All URLs in output are absolute
- [ ] Search verified to actually filter, or omitted with a comment
- [ ] Search scrapers return `Title` + `URL`, aligned and deduplicated
- [ ] Every applicable command in Section 9 run and output inspected
- [ ] Tested on at least two pages, including an edge case
- [ ] Probe scripts deleted
- [ ] Comments explain any feature deliberately left out
