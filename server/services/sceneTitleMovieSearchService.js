/**
 * Scrape All fallback for scenes that only have a title (no performers, no URLs):
 * treat the title as a movie title and search GEVI and AEBN for it.
 */

const VIDEO_EXTENSION = /\.(mp4|m4v|avi|wmv|mkv|mov|mpe?g|flv|webm|ts)$/i;
const SCENE_SUFFIX = /^(.*?\S)\s*(?:[-–—:|,]\s*)?(?:scene|sc\.?)\s*#?\s*(\d{1,3})\s*$/i;

const DEFAULT_LIMIT = 3;
const DEFAULT_MIN_SCORE = 0.6;

/** Strips file extensions, separators and bracketed noise; splits off a trailing "Scene N". */
function parseMovieSearchTitle(title) {
  let text = String(title || '').trim().replace(VIDEO_EXTENSION, '');
  text = text.replace(/[_]+/g, ' ').replace(/\.(?=\S)/g, ' ');
  text = text.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();

  let sceneNumber = null;
  const sceneMatch = text.match(SCENE_SUFFIX);
  if (sceneMatch) {
    text = sceneMatch[1].replace(/[\s\-–—:|,]+$/, '').trim();
    sceneNumber = Number(sceneMatch[2]);
  }
  return { query: text, sceneNumber };
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** 0..1 token similarity; differing or missing numbers (volume 12 vs 13) cut the score. */
function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.replace(/ /g, '') === nb.replace(/ /g, '')) return 0.98;

  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let shared = 0;
  ta.forEach(token => { if (tb.has(token)) shared += 1; });
  let score = (2 * shared) / (ta.size + tb.size);

  const numbers = (set) => [...set].filter(t => /^\d+$/.test(t)).sort().join(',');
  const na2 = numbers(ta);
  const nb2 = numbers(tb);
  if (na2 !== nb2) score *= (na2 && nb2) ? 0.5 : 0.6;
  return Math.round(score * 1000) / 1000;
}

/** Dedupes by URL, scores by title and keeps the best matches above minScore. */
function rankMovieCandidates(query, candidates, { limit = DEFAULT_LIMIT, minScore = DEFAULT_MIN_SCORE } = {}) {
  const byUrl = new Map();
  (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
    const url = candidate?.url;
    const title = candidate?.title || candidate?.name;
    if (!url || !title) return;
    const score = titleSimilarity(query, title);
    const existing = byUrl.get(url);
    if (!existing || score > existing.score) byUrl.set(url, { ...candidate, title, score });
  });
  return [...byUrl.values()]
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function uniqueByName(items) {
  const seen = new Map();
  (items || []).forEach(item => {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name });
  });
  return [...seen.values()];
}

const studioName = (studio) => (typeof studio === 'string' ? studio : studio?.name || null);

/** Scene-shaped Scrape All result for a GEVI movie page (from geviScraper.movieFromUrl). */
function buildGeviMovieResult(movie, { score, sceneNumber = null, proxyImage = (u) => u } = {}) {
  const allScenes = Array.isArray(movie.scenes) ? movie.scenes : [];
  const scene = sceneNumber ? allScenes.find(s => Number(s.sceneNumber) === Number(sceneNumber)) : null;
  const pool = scene ? [scene] : allScenes;
  const image = movie.front_image ? proxyImage(movie.front_image) : null;
  const urls = [movie.url, scene?.episodeUrl].filter(Boolean);

  return {
    id: scene?.episodeUrl || movie.url,
    url: movie.url,
    sourceUrl: movie.url,
    urls,
    title: scene ? `${movie.name} - Scene ${scene.sceneNumber}` : movie.name,
    date: movie.date || null,
    details: (scene?.details || movie.synopsis || null),
    studio: studioName(movie.studio),
    director: movie.director || null,
    image,
    performers: uniqueByName(pool.flatMap(s => s.performers || [])),
    tags: [],
    scenes: scene ? [] : allScenes,
    movies: [{ name: movie.name, url: movie.url, date: movie.date || null, studio: studioName(movie.studio), front_image: movie.front_image || null, back_image: movie.back_image || null, sceneNumber: scene?.sceneNumber || null }],
    externalUrls: movie.externalUrls || [],
    matchScore: score,
    sceneNumber: scene?.sceneNumber || null,
    source: 'GEVI'
  };
}

/** Scene-shaped Scrape All result for an AEBN movie (or a single scene when sceneNumber matched). */
function buildAebnMovieResult(scraped, url, { score, image = null } = {}) {
  const movie = scraped.movies?.[0] || {};
  const sceneNumber = movie.sceneNumber || null;
  const allScenes = Array.isArray(scraped.allScenes) ? scraped.allScenes : [];
  const tags = sceneNumber
    ? uniqueByName(scraped.tags)
    : uniqueByName(allScenes.flatMap(s => s.tags || []));

  return {
    id: sceneNumber ? `${url}#scene-${sceneNumber}` : url,
    url,
    sourceUrl: url,
    urls: [url],
    title: scraped.title || movie.name || null,
    date: scraped.date || null,
    details: scraped.details || scraped.synopsis || null,
    studio: studioName(scraped.studio),
    director: scraped.director || null,
    image: scraped.image || image || null,
    performers: uniqueByName(scraped.performers?.length ? scraped.performers : allScenes.flatMap(s => s.performers || [])),
    tags: tags.map(t => t.name),
    scenes: sceneNumber ? [] : allScenes,
    movies: [{ name: movie.name || scraped.title, url, date: scraped.date || null, studio: studioName(scraped.studio), front_image: scraped.front_image || scraped.image || null, back_image: scraped.back_image || null, sceneNumber }],
    matchScore: score,
    sceneNumber,
    source: 'AEBN'
  };
}

/** GEVI matches title text literally, so retry without punctuation and then with the leading words. */
function geviQueryVariants(query) {
  const variants = [query];
  const plain = String(query).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  variants.push(plain);
  const words = plain.split(' ');
  if (words.length > 3) variants.push(words.slice(0, 3).join(' '));
  return [...new Set(variants.filter(Boolean))];
}

async function attachMatches(result, { matchPerformers, matchGroups }) {
  const [performers, groups] = await Promise.all([
    result.performers.length && matchPerformers ? matchPerformers(result.performers).catch(() => null) : null,
    matchGroups ? matchGroups(result.movies).catch(() => null) : null
  ]);
  return {
    ...result,
    matchedPerformers: performers || { matched: [], unmatched: [] },
    matched: { performers: performers?.matched || [], tags: [], studio: null, groups: groups?.matched || [] },
    unmatched: { performers: performers?.unmatched || [], tags: [], groups: groups?.unmatched || [] }
  };
}

const toSource = (id, name, results, query) => ({
  id,
  name,
  endpoint: id,
  configured: true,
  resultCount: results.length,
  hasResults: results.length > 0,
  usedFallback: true,
  titleSearch: query,
  results
});

/**
 * Searches GEVI and AEBN for the scene title as a movie title and returns Scrape All sources.
 * deps: searchGevi(query) -> [{name,url}], scrapeGevi(url) -> movie, searchAebn(query) -> [{title,url,image}],
 *       scrapeAebn(url, sceneNumber) -> {success, scraped}, matchPerformers(list), matchGroups(movies), proxyGeviImage(url), log
 */
async function searchMoviesByTitle(title, deps, { limit = DEFAULT_LIMIT, minScore = DEFAULT_MIN_SCORE } = {}) {
  const { query, sceneNumber } = parseMovieSearchTitle(title);
  const log = deps.log || (() => {});
  if (!query) return { query, sceneNumber, sources: [] };

  const searchGevi = async () => {
    let found = [];
    for (const variant of geviQueryVariants(query)) {
      found = await deps.searchGevi(variant);
      if (Array.isArray(found) && found.length > 0) break;
    }
    const hits = rankMovieCandidates(query, found, { limit, minScore });
    log(`GEVI title search "${query}": ${hits.length} candidate(s)`);
    const movies = await Promise.all(hits.map(async hit => {
      try {
        const movie = await deps.scrapeGevi(hit.url);
        if (!movie?.name) return null;
        const result = buildGeviMovieResult({ ...movie, url: movie.url || hit.url }, {
          score: titleSimilarity(query, movie.name),
          sceneNumber,
          proxyImage: deps.proxyGeviImage
        });
        return attachMatches(result, deps);
      } catch (error) {
        log(`GEVI movie scrape failed for ${hit.url}: ${error.message}`);
        return null;
      }
    }));
    return movies.filter(Boolean).sort((a, b) => b.matchScore - a.matchScore);
  };

  const searchAebn = async () => {
    const hits = rankMovieCandidates(query, await deps.searchAebn(query), { limit, minScore });
    log(`AEBN title search "${query}": ${hits.length} candidate(s)`);
    const results = [];
    // One headless browser at a time
    for (const hit of hits) {
      try {
        let scrapeResult = await deps.scrapeAebn(hit.url, sceneNumber).catch((error) => {
          if (!sceneNumber) throw error;
          return null;
        });
        if (sceneNumber && !scrapeResult?.success) {
          // The movie may not have that scene; fall back to the whole movie
          scrapeResult = await deps.scrapeAebn(hit.url, null);
        }
        if (!scrapeResult?.success || !scrapeResult.scraped) continue;
        const result = buildAebnMovieResult(scrapeResult.scraped, hit.url, {
          score: titleSimilarity(query, scrapeResult.scraped.movies?.[0]?.name || scrapeResult.scraped.title || hit.title),
          image: hit.image
        });
        results.push(await attachMatches(result, deps));
      } catch (error) {
        log(`AEBN movie scrape failed for ${hit.url}: ${error.message}`);
      }
    }
    return results.sort((a, b) => b.matchScore - a.matchScore);
  };

  const [gevi, aebn] = await Promise.allSettled([searchGevi(), searchAebn()]);
  if (gevi.status === 'rejected') log(`GEVI title search failed: ${gevi.reason?.message}`);
  if (aebn.status === 'rejected') log(`AEBN title search failed: ${aebn.reason?.message}`);

  return {
    query,
    sceneNumber,
    sources: [
      toSource('gevi-title-search', `GEVI Movie Title Search ("${query}")`, gevi.status === 'fulfilled' ? gevi.value : [], query),
      toSource('aebn-title-search', `AEBN Movie Title Search ("${query}")`, aebn.status === 'fulfilled' ? aebn.value : [], query)
    ]
  };
}

/** True when a scene has a title but nothing else Scrape All could key off. */
function isTitleOnlyScene({ title, performerCount = 0, urlCount = 0 }) {
  return Boolean(String(title || '').trim()) && performerCount === 0 && urlCount === 0;
}

module.exports = {
  parseMovieSearchTitle,
  normalizeTitle,
  titleSimilarity,
  rankMovieCandidates,
  buildGeviMovieResult,
  buildAebnMovieResult,
  searchMoviesByTitle,
  isTitleOnlyScene
};
