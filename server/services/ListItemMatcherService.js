const prisma = require('../prismaClient');
const cheerio = require('cheerio');
const openLibraryService = require('../openLibraryService');
const BookService = require('./BookService');

class ListItemMatcherService {
  constructor(tvdbService = null) {
    this.tvdbService = tvdbService;
    this.openLibraryService = openLibraryService;
    this.bookService = new BookService(prisma);
  }

  /**
   * Match a scraped item against existing integrations and enrich it
   * @param {Object} scrapedItem - { title, position, mediaType, itemUrl, itemYear, seriesTitle?, seasonNumber?, episodeNumber? }
   * @returns {Object} - Enriched item data ready for CustomOrderItem creation
   */
  async matchItem(scrapedItem) {
    const { title, mediaType, itemUrl, itemYear } = scrapedItem;

    let result;
    switch (mediaType) {
      case 'movie':
        result = await this.matchMovie(title, itemYear, itemUrl);
        break;
      case 'episode':
        result = await this.matchEpisode(title, itemYear, itemUrl, scrapedItem);
        break;
      case 'comic':
        result = await this.matchComic(scrapedItem);
        break;
      case 'book':
        result = await this.matchBook(title, itemYear, itemUrl, scrapedItem.isbn, scrapedItem.author, scrapedItem.pageCount);
        break;
      case 'shortstory':
        result = this.matchShortStory(title, itemYear, itemUrl);
        break;
      case 'webvideo':
        result = this.formatWebVideo(title, itemUrl);
        break;
      case 'game':
        result = await this.matchGame(title, itemYear);
        break;
      default:
        result = await this.matchMovie(title, itemYear, itemUrl);
    }

    // Preserve episode metadata from custom parsers if not set by matcher
    if (scrapedItem.seriesTitle && !result.seriesTitle) {
      result.seriesTitle = scrapedItem.seriesTitle;
    }
    if (scrapedItem.seasonNumber != null && result.seasonNumber == null) {
      result.seasonNumber = scrapedItem.seasonNumber;
    }
    if (scrapedItem.episodeNumber != null && result.episodeNumber == null) {
      result.episodeNumber = scrapedItem.episodeNumber;
    }

    // Preserve comic issue from custom parsers; parser-set value overrides default
    if (mediaType === 'comic' && scrapedItem.comicIssue != null) {
      result.comicIssue = scrapedItem.comicIssue;
    }

    return result;
  }

  /**
   * Match against Plex movies, then fall back to TVDB
   */
  async matchMovie(title, year, itemUrl) {
    // Try Plex first
    const plexMovie = await this.searchPlexMovie(title, year);
    if (plexMovie) {
      return {
        mediaType: 'movie',
        title: plexMovie.title,
        plexKey: plexMovie.ratingKey,
        originalArtworkUrl: plexMovie.thumb || null,
        tvdbYear: plexMovie.year || null
      };
    }

    // Fall back to TVDB
    if (this.tvdbService) {
      try {
        const tvdbResults = await this.tvdbService.searchMovies(title);
        if (tvdbResults && tvdbResults.length > 0) {
          const best = this.pickBestTvdbMatch(tvdbResults, title, year);
          if (best) {
            return {
              mediaType: 'movie',
              title: best.name || title,
              plexKey: null,
              tvdbId: best.tvdb_id || best.id?.toString() || null,
              tvdbYear: best.year ? parseInt(best.year) : null,
              tvdbOverview: best.overview || null,
              tvdbArtworkUrl: best.image_url || best.thumbnail || null,
              originalArtworkUrl: best.image_url || best.thumbnail || null,
              isFromTvdbOnly: true
            };
          }
        }
      } catch (error) {
        console.error(`TVDB movie search failed for "${title}":`, error.message);
      }
    }

    // Return unmatched with original title
    return {
      mediaType: 'movie',
      title,
      plexKey: null,
      tvdbYear: year ? parseInt(year) : null,
      isFromTvdbOnly: true
    };
  }

  /**
   * Match against Plex TV shows/episodes, then fall back to TVDB
   */
  async matchEpisode(title, year, itemUrl, scrapedItem = {}) {
    const seriesTitle = scrapedItem.seriesTitle || title;
    const seasonNumber = scrapedItem.seasonNumber;
    const episodeNumber = scrapedItem.episodeNumber;

    console.log(`[ListSync] matchEpisode: seriesTitle="${seriesTitle}" S${seasonNumber}E${episodeNumber} year=${year}`);

    // If we have season/episode numbers, try to find the specific episode in Plex
    if (seasonNumber != null && episodeNumber != null) {
      const plexEpisode = await this.searchPlexEpisode(seriesTitle, seasonNumber, episodeNumber);
      if (plexEpisode) {
        console.log(`[ListSync] matchEpisode: found in Plex by episode key=${plexEpisode.ratingKey}`);
        return {
          mediaType: 'episode',
          title: plexEpisode.title,
          seriesTitle: plexEpisode.grandparentTitle || plexEpisode.season?.show?.title || seriesTitle,
          seasonNumber: plexEpisode.seasonIndex ?? seasonNumber,
          episodeNumber: plexEpisode.index ?? episodeNumber,
          plexKey: plexEpisode.ratingKey,
          originalArtworkUrl: plexEpisode.thumb || plexEpisode.season?.show?.thumb || null
        };
      }
    }

    // No specific episode found — check if the show exists in Plex at all
    const plexShow = await this.searchPlexTVShow(seriesTitle, year);
    console.log(`[ListSync] matchEpisode: searchPlexTVShow("${seriesTitle}") =>`, plexShow ? `found: "${plexShow.title}"` : 'NOT FOUND');
    if (plexShow) {
      // Show is in Plex but we couldn't pinpoint the exact episode.
      // Return with plexShowFound:true so the import is not blocked.
      return {
        mediaType: 'episode',
        title: scrapedItem.title || plexShow.title,
        seriesTitle: plexShow.title,
        seasonNumber: seasonNumber ?? null,
        episodeNumber: episodeNumber ?? null,
        plexKey: null,
        plexShowFound: true,
        originalArtworkUrl: plexShow.thumb || null
      };
    }

    // Fall back to TVDB
    if (this.tvdbService) {
      try {
        const tvdbResults = await this.tvdbService.searchSeries(seriesTitle);
        if (tvdbResults && tvdbResults.length > 0) {
          const best = this.pickBestTvdbMatch(tvdbResults, seriesTitle, year);
          if (best) {
            return {
              mediaType: 'episode',
              title: scrapedItem.title || title,
              seriesTitle: best.name || seriesTitle,
              seasonNumber: seasonNumber ?? null,
              episodeNumber: episodeNumber ?? null,
              plexKey: null,
              tvdbId: best.tvdb_id || best.id?.toString() || null,
              tvdbYear: best.year ? parseInt(best.year) : null,
              tvdbOverview: best.overview || null,
              tvdbArtworkUrl: best.image_url || best.thumbnail || null,
              originalArtworkUrl: best.image_url || best.thumbnail || null,
              isFromTvdbOnly: true
            };
          }
        }
      } catch (error) {
        console.error(`TVDB series search failed for "${seriesTitle}":`, error.message);
      }
    }

    return {
      mediaType: 'episode',
      title: scrapedItem.title || title,
      seriesTitle,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
      plexKey: null,
      isFromTvdbOnly: true
    };
  }

  /**
   * Match against local Plex movie library
   */
  async searchPlexMovie(title, year) {
    const normalizedTitle = title.toLowerCase().trim();

    // Exact match first
    let movie = await prisma.plexMovie.findFirst({
      where: {
        title: { equals: title },
        removed: false,
        ...(year ? { year: parseInt(year) } : {})
      }
    });
    if (movie) return movie;

    // Case-insensitive search
    const movies = await prisma.plexMovie.findMany({
      where: { removed: false },
      select: { id: true, ratingKey: true, title: true, year: true, thumb: true }
    });

    // Score matches
    let bestMatch = null;
    let bestScore = 0;

    for (const m of movies) {
      const mTitle = m.title.toLowerCase().trim();
      let score = 0;

      if (mTitle === normalizedTitle) {
        score = 1.0;
      } else if (mTitle.includes(normalizedTitle) || normalizedTitle.includes(mTitle)) {
        score = 0.7;
      }

      // Year boost
      if (score > 0 && year && m.year === parseInt(year)) {
        score += 0.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
      }
    }

    return bestScore >= 0.7 ? bestMatch : null;
  }

  /**
   * Match against local Plex TV show library
   */
  async searchPlexTVShow(title, year) {
    const normalizedTitle = title.toLowerCase().trim();

    const totalShows = await prisma.plexTVShow.count({ where: { removed: false } });
    console.log(`[ListSync] searchPlexTVShow: searching "${title}" among ${totalShows} active shows`);

    let show = await prisma.plexTVShow.findFirst({
      where: {
        title: { equals: title },
        removed: false,
        ...(year ? { year: parseInt(year) } : {})
      }
    });
    if (show) return show;

    // Strict fallback: exact case-insensitive title equality only.
    show = await prisma.plexTVShow.findFirst({
      where: {
        removed: false,
        ...(year ? { year: parseInt(year) } : {})
      },
      select: { id: true, ratingKey: true, title: true, year: true, thumb: true }
    });

    if (show && (show.title || '').toLowerCase().trim() === normalizedTitle) {
      return show;
    }

    const exactCaseInsensitive = await prisma.plexTVShow.findMany({
      where: {
        removed: false,
        ...(year ? { year: parseInt(year) } : {})
      },
      select: { id: true, ratingKey: true, title: true, year: true, thumb: true }
    });

    return exactCaseInsensitive.find(s => (s.title || '').toLowerCase().trim() === normalizedTitle) || null;
  }

  /**
   * Search for a specific Plex episode by series title, season, and episode number
   */
  async searchPlexEpisode(seriesTitle, seasonNumber, episodeNumber) {
    try {
      const normalizedTitle = seriesTitle.toLowerCase().trim();

      // Try exact title match first
      let episode = await prisma.plexEpisode.findFirst({
        where: {
          seasonIndex: parseInt(seasonNumber),
          index: parseInt(episodeNumber),
          removed: false,
          season: {
            show: {
              title: { equals: seriesTitle },
              removed: false
            }
          }
        },
        include: {
          season: {
            include: { show: true }
          }
        }
      });
      if (episode) return episode;

      // Fuzzy: search all episodes with matching season/episode numbers and score by show title
      const candidates = await prisma.plexEpisode.findMany({
        where: {
          seasonIndex: parseInt(seasonNumber),
          index: parseInt(episodeNumber),
          removed: false,
          season: {
            show: { removed: false }
          }
        },
        include: {
          season: {
            include: { show: true }
          }
        }
      });

      for (const ep of candidates) {
        const showTitle = (ep.season?.show?.title || '').toLowerCase().trim();
        if (showTitle === normalizedTitle) {
          return ep;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error searching Plex episode "${seriesTitle}" S${seasonNumber}E${episodeNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Match a comic against the ComicVine API and return a fully-enriched item
   * identical to what the manual "Add Comic" flow produces.
   * Uses structured fields from the parser when available, otherwise parses
   * series name and issue number out of the title string.
   * @param {Object} scrapedItem
   */
  async matchComic(scrapedItem) {
    const { title, itemYear } = scrapedItem;
    const { extractComicVineMetadata } = require('../routes/customOrders/utilities/metadataExtractor');

    // Use structured fields from parser if available
    let comicSeries = scrapedItem.comicSeries || null;
    let comicIssue  = scrapedItem.comicIssue  || null;
    let comicYear   = scrapedItem.comicYear
      ? parseInt(scrapedItem.comicYear)
      : (itemYear ? parseInt(itemYear) : null);

    // Parse series + issue from the title string when not already structured
    if (!comicSeries || !comicIssue) {
      // "Series Name (Year) #Issue" or "Series Name (Year) #Issue.5"
      const matchWithYear = title.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+(?:\.\d+)?)/);
      if (matchWithYear) {
        comicSeries = comicSeries || matchWithYear[1].trim();
        comicYear   = comicYear   || parseInt(matchWithYear[2]);
        comicIssue  = comicIssue  || matchWithYear[3];
      } else {
        // "Series Name #Issue" or "Series Name #Issue.5"
        const matchWithoutYear = title.match(/^(.+?)\s*#(\d+(?:\.\d+)?)/);
        if (matchWithoutYear) {
          comicSeries = comicSeries || matchWithoutYear[1].trim();
          comicIssue  = comicIssue  || matchWithoutYear[2];
        } else {
          comicSeries = comicSeries || title;
        }
      }
    }

    // Default to issue 1 when no issue number can be parsed
    if (!comicIssue) comicIssue = '1';

    const basicResult = {
      mediaType: 'comic',
      title,
      comicSeries: comicSeries || title,
      comicYear,
      comicIssue,
      comicPublisher: null,
      comicVineId: null,
      comicVineDetailsJson: null
    };

    if (!comicSeries) return basicResult;

    try {
      const comicVineService = require('../comicVineService');

      if (!(await comicVineService.isApiKeyAvailable())) {
        console.log('[ListSync] ComicVine API key not available, skipping comic match');
        return basicResult;
      }

      console.log(`[ListSync] Searching ComicVine for "${comicSeries}"${comicIssue ? ` #${comicIssue}` : ''}${comicYear ? ` (year: ${comicYear})` : ''}`);
      const seriesResults = await comicVineService.searchSeries(comicSeries);

      if (!seriesResults || seriesResults.length === 0) {
        console.log(`[ListSync] No ComicVine series found for "${comicSeries}"`);
        return basicResult;
      }

      // If we have a year, sort series so those matching the year come first.
      // This avoids picking the wrong "Darth Vader" (2015 vs 2017 vs 2020) etc.
      // Use ±1 year tolerance since an issue's release year may differ from the series start year.
      if (comicYear) {
        seriesResults.sort((a, b) => {
          const aYear = a.start_year ? parseInt(a.start_year) : null;
          const bYear = b.start_year ? parseInt(b.start_year) : null;
          const aDiff = aYear != null ? Math.abs(aYear - comicYear) : 999;
          const bDiff = bYear != null ? Math.abs(bYear - comicYear) : 999;
          const aScore = aDiff <= 1 ? 0 : 1;
          const bScore = bDiff <= 1 ? 0 : 1;
          if (aScore !== bScore) return aScore - bScore;
          return aDiff - bDiff;
        });
      }

      // Helper: build a fully-enriched result from series + issue data, identical to
      // what the manual "Add Comic" route produces via extractComicVineMetadata.
      const buildEnrichedResult = (series, issue) => {
        const coverUrl =
          issue?.image?.original_url ||
          issue?.image?.medium_url ||
          issue?.image?.small_url ||
          series.image?.original_url ||
          series.image?.medium_url ||
          null;

        // Build the same comicVineDetailsJson structure the frontend sends
        const detailsPayload = { series, issue: issue || null, coverUrl };
        const detailsJson = JSON.stringify(detailsPayload);

        // Extract all metadata fields the same way the manual Add Comic route does
        const extracted = extractComicVineMetadata(detailsJson);
        console.log(`[ListSync] Extracted fields: ${Object.keys(extracted).join(', ')}`);

        return {
          mediaType: 'comic',
          title,
          comicSeries: series.name,
          comicYear: comicYear || (series.start_year ? parseInt(series.start_year) : null),
          comicIssue: comicIssue || null,
          comicPublisher: series.publisher?.name || extracted.comicPublisher || null,
          comicVineId: series.api_detail_url || null,
          comicVineDetailsJson: detailsJson,
          originalArtworkUrl: extracted.originalArtworkUrl || coverUrl,
          // Spread all remaining extracted metadata (credits, descriptions, IDs, etc.)
          ...extracted
        };
      };

      // If we have an issue number, find the first series that actually has that issue.
      // Limit to top 5 series and add a short delay between lookups to avoid hitting
      // ComicVine rate limits during bulk list sync imports.
      if (comicIssue) {
        const seriesSlice = seriesResults.slice(0, 5);
        for (const series of seriesSlice) {
          try {
            // Small delay to respect ComicVine rate limits during bulk imports
            await new Promise(r => setTimeout(r, 250));
            const issue = await comicVineService.getIssueByNumber(series.id, comicIssue);
            if (issue) {
              console.log(`[ListSync] ✓ ComicVine match: "${series.name}" #${comicIssue} (issueId: ${issue.id})`);
              return buildEnrichedResult(series, issue);
            } else {
              console.log(`[ListSync] ✗ No issue #${comicIssue} in series "${series.name}" (id:${series.id})`);
            }
          } catch (issueErr) {
            console.warn(
              `[ListSync] ComicVine issue fetch error for "${series.name}" #${comicIssue}:`,
              issueErr.message
            );
          }
        }
        console.log(
          `[ListSync] No ComicVine series found with issue #${comicIssue} for "${comicSeries}", falling back to series-only match`
        );
      }

      // Fallback: use the best-matching series without issue verification
      console.log(`[ListSync] Using best series match for "${comicSeries}": "${seriesResults[0].name}"`);
      return buildEnrichedResult(seriesResults[0], null);

    } catch (error) {
      console.error(`[ListSync] ComicVine lookup failed for "${comicSeries}":`, error.message);
      return basicResult;
    }
  }

  /**
   * Match against OpenLibrary and create/find a Book record
   */
  async matchBook(title, year, itemUrl, isbn, author, pageCount) {
    try {
      // If no ISBN provided, try to fetch it from the wiki page (e.g. Wookieepedia)
      if (!isbn && itemUrl && itemUrl.includes('fandom.com/wiki/')) {
        try {
          const wikiDetails = await this.fetchBookDetailsFromWiki(itemUrl);
          if (wikiDetails.isbn) isbn = wikiDetails.isbn;
          if (wikiDetails.author && !author) author = wikiDetails.author;
          if (wikiDetails.pageCount && !pageCount) pageCount = wikiDetails.pageCount;
        } catch (err) {
          console.warn(`[BookMatch] Could not fetch wiki details for "${title}": ${err.message}`);
        }
      }

      // If we have an ISBN, search by ISBN first for a precise match
      let results = [];
      if (isbn) {
        results = await this.openLibraryService.searchBooks(`isbn:${isbn}`, 5);
      }

      // Fall back to title search if ISBN search found nothing
      if (results.length === 0) {
        let searchQuery = title.trim();
        if (year) {
          searchQuery += ` first_publish_year:${year}`;
        }
        results = await this.openLibraryService.searchBooks(searchQuery, 5);
      }

      if (results.length > 0) {
        const bestMatch = results[0];

        // Prefer the original scraped title if the OpenLibrary title is a truncated/series-level name
        const olTitle = bestMatch.title || '';
        const useTitle = (title && title.length > olTitle.length && title.toLowerCase().startsWith(olTitle.toLowerCase()))
          ? title
          : (olTitle || title);

        // Create or find the book in the unified Book table
        const book = await this.bookService.createBook({
          title: useTitle,
          author: bestMatch.authors?.[0] || author || null,
          isbn: bestMatch.isbn || isbn || null,
          publisher: bestMatch.publishers?.[0] || null,
          publishYear: bestMatch.firstPublishYear || (year ? parseInt(year) : null),
          coverUrl: bestMatch.coverUrl || null,
          openLibraryId: bestMatch.id || null,
          pageCount: bestMatch.pageCount || pageCount || null
        });

        console.log(`📚 List sync matched book: "${title}" → "${book.title}" (Book ID: ${book.id})`);

        return {
          mediaType: 'book',
          title: book.title,
          bookId: book.id,
          originalArtworkUrl: book.coverUrl || null,
          tvdbYear: book.publishYear || null
        };
      }

      // No OpenLibrary match — create a manual book entry with wiki metadata
      console.log(`📚 No OpenLibrary match for "${title}", creating manual entry`);
      const book = await this.bookService.createBook({
        title: title,
        author: author || null,
        isbn: isbn || null,
        publishYear: year ? parseInt(year) : null,
        pageCount: pageCount || null
      });

      return {
        mediaType: 'book',
        title: book.title,
        bookId: book.id,
        tvdbYear: book.publishYear || null
      };
    } catch (error) {
      console.error(`Error matching book "${title}":`, error.message);
      // Fallback: still create a basic book entry
      try {
        const book = await this.bookService.createBook({
          title: title,
          publishYear: year ? parseInt(year) : null
        });
        return {
          mediaType: 'book',
          title: book.title,
          bookId: book.id,
          tvdbYear: book.publishYear || null
        };
      } catch (innerError) {
        // Final fallback if even book creation fails
        return {
          mediaType: 'book',
          title,
          bookId: null,
          tvdbYear: year ? parseInt(year) : null
        };
      }
    }
  }

  /**
   * Format a short story item
   */
  matchShortStory(title, year, itemUrl) {
    return {
      mediaType: 'shortstory',
      title,
      storyTitle: title,
      storyUrl: itemUrl || null,
      storyYear: year ? parseInt(year) : null
    };
  }

  /**
   * Format a web video item
   */
  formatWebVideo(title, itemUrl) {
    return {
      mediaType: 'webvideo',
      title,
      webTitle: title,
      webUrl: itemUrl || null,
      webDescription: null
    };
  }

  /**
   * Match against video games library
   */
  async matchGame(title, year) {
    const game = await prisma.videoGame.findFirst({
      where: {
        title: { equals: title }
      }
    });

    if (game) {
      return {
        mediaType: 'game',
        title: game.title,
        gameId: game.id
      };
    }

    return {
      mediaType: 'game',
      title,
      gameId: null
    };
  }

  /**
   * Pick the best TVDB match from search results
   */
  pickBestTvdbMatch(results, searchTitle, searchYear) {
    if (!results || results.length === 0) return null;

    const normalized = searchTitle.toLowerCase().trim();

    let best = null;
    let bestScore = 0;

    for (const r of results) {
      const name = (r.name || '').toLowerCase().trim();
      let score = 0;

      if (name === normalized) {
        score = 1.0;
      } else if (name.includes(normalized) || normalized.includes(name)) {
        score = 0.6;
      } else {
        continue;
      }

      if (searchYear && r.year === searchYear) {
        score += 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    // If no strong match, return the first result
    return best || results[0];
  }

  /**
   * Fetch book details (ISBN, author, page count) from a Fandom wiki page infobox
   */
  async fetchBookDetailsFromWiki(itemUrl) {
    const parsed = new URL(itemUrl);
    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch) return {};

    const wikiBase = `${parsed.protocol}//${parsed.host}`;
    const pageName = decodeURIComponent(pathMatch[1]);
    const apiUrl = `${wikiBase}/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text&format=json`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EddieLifeManagement/1.0)' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return {};

    const data = await response.json();
    if (data.error) return {};

    const $ = cheerio.load(data.parse.text['*']);
    const details = {};

    const isbnText = $('[data-source="isbn"] .pi-data-value').first().text().trim();
    if (isbnText) {
      const isbnMatch = isbnText.match(/(\d{13}|\d{10})/);
      if (isbnMatch) details.isbn = isbnMatch[1];
    }

    const authorText = $('[data-source="author"] .pi-data-value').first().text().trim().replace(/\[\d+\]/g, '').trim();
    if (authorText) details.author = authorText;

    const pagesText = $('[data-source="pages"] .pi-data-value').first().text().trim().replace(/\[\d+\]/g, '').trim();
    if (pagesText) {
      const num = parseInt(pagesText);
      if (!isNaN(num)) details.pageCount = num;
    }

    return details;
  }
}

module.exports = ListItemMatcherService;
