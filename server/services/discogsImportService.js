// Lazily load the shared client so pure parsing/matching logic can be used without a DB.
let prismaInstance = null;
const prisma = new Proxy({}, {
  get: (_target, property) => {
    prismaInstance = prismaInstance || require('../prismaClient');
    return prismaInstance[property];
  }
});
const DiscogsService = require('./discogsService');
const { scoreArtistNameMatch, splitArtistNameAndType } = require('../utils/artistNameMatch');
const IdentificationService = require('./identificationService');

// Discogs credit roles that describe production/packaging rather than musical contribution.
const EXCLUDED_ROLE_PATTERNS = [
  /engineer/i, /producer/i, /produced by/i, /mastered/i, /mixed by/i, /recorded by/i, /remaster/i,
  /photograph/i, /design/i, /artwork/i, /art direction/i, /liner notes/i, /layout/i, /edited by/i,
  /editor/i, /translated/i, /coordinator/i, /management/i, /a&r/i, /^notes$/i, /lacquer/i,
  /graphics/i, /cover/i, /illustration/i, /supervised/i, /booklet/i, /copyright/i, /phonographic/i,
  /^other$/i, /technician/i, /tape op/i, /programmed by/i, /lettering/i, /typography/i, /^text by$/i,
  /sleeve/i, /authoring/i, /transfer/i, /restoration/i, /executive/i, /^painting$/i, /^logo$/i
];

const ROLE_TYPE_MAP = [
  [/^(composed by|composer|music by)$/i, 'Composer'],
  [/^(written-by|written by|songwriter)$/i, 'Writer'],
  [/^conductor$/i, 'Conductor'],
  [/^orchestra$/i, 'Orchestra'],
  [/^(libretto by|librettist)$/i, 'Librettist'],
  [/^(lyrics by|words by|lyricist)$/i, 'Lyricist'],
  [/^(chorus|choir)$/i, 'Choir'],
  [/^chorus master$/i, 'Chorus Master'],
  [/^(arranged by|arranger)$/i, 'Arranger'],
  [/^(orchestrated by|orchestration)$/i, 'Orchestrator'],
  [/^(performer|featuring|artist)$/i, 'Performer'],
  [/^vocals$/i, 'Vocals']
];

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Discogs disambiguates duplicate artist names with a numeric suffix, e.g. "John Smith (3)",
// and marks name variations in search titles with "*".
const cleanDiscogsName = (name) => String(name || '').replace(/\*+$/, '').replace(/\s+\(\d+\)$/, '').trim();

const parseDurationMs = (value) => {
  const parts = String(value || '').trim().split(':').map(part => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.some(part => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
};

const bigrams = (value) => {
  const text = normalizeText(value).replace(/\s+/g, '');
  const grams = new Map();
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
};

const titleSimilarity = (left, right) => {
  const a = bigrams(left);
  const b = bigrams(right);
  const sizeA = [...a.values()].reduce((sum, n) => sum + n, 0);
  const sizeB = [...b.values()].reduce((sum, n) => sum + n, 0);
  if (sizeA === 0 || sizeB === 0) return normalizeText(left) === normalizeText(right) ? 1 : 0;
  let overlap = 0;
  for (const [gram, count] of a) {
    overlap += Math.min(count, b.get(gram) || 0);
  }
  return (2 * overlap) / (sizeA + sizeB);
};

const inferLocalDiscNumber = (track) => {
  if (Number.isInteger(track?.discNumber) && track.discNumber > 0) return track.discNumber;

  const filePath = String(track?.file || '').trim();
  if (!filePath) return null;

  const folderMatch = filePath.match(/[\\/](?:disc|cd)\s*(\d{1,2})[\\/]/i);
  if (folderMatch) return Number.parseInt(folderMatch[1], 10);

  const filename = filePath.split(/[\\/]/).pop() || '';
  const filenameMatch = filename.match(/^(\d{1,2})\s*[-._]\s*\d{1,3}\b/);
  return filenameMatch ? Number.parseInt(filenameMatch[1], 10) : null;
};

// Titles like "Disc 2 - (02) ..." are more trustworthy than a default discNumber of 1.
const inferLocalPosition = (track) => {
  const titleMatch = String(track?.title || '').match(/\bdis[ck]\s*(\d{1,2})\b[^0-9]{0,6}(\d{1,3})\b/i);
  return {
    discNumber: titleMatch ? Number(titleMatch[1]) : inferLocalDiscNumber(track),
    index: Number.isInteger(track?.index) ? track.index : (titleMatch ? Number(titleMatch[2]) : null)
  };
};

const parsePosition = (position) => {
  const value = String(position || '').trim();
  let match = value.match(/^(?:cd|disc)?\s*(\d+)\s*[-.]\s*(\d+)$/i);
  if (match) return { discNumber: Number(match[1]), trackNumber: Number(match[2]) };
  match = value.match(/^(\d+)$/);
  if (match) return { discNumber: null, trackNumber: Number(match[1]) };
  return { discNumber: null, trackNumber: null };
};

class DiscogsImportService {
  constructor() {
    this.discogs = new DiscogsService();
    this.identification = new IdentificationService();
    this.identification.prisma = prisma;
  }

  static extractReleaseId(url) {
    const match = String(url || '').trim().match(/discogs\.com\/(?:[a-z]{2}\/)?release\/(\d+)/i);
    return match ? match[1] : null;
  }

  mapRoleToTypeNames(role) {
    if (!role) return [];

    return String(role)
      // Bracketed qualifiers are character names or instrument variants, e.g. "Soprano Vocals [Aminta]".
      .replace(/\[[^\]]*\]/g, '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .filter(part => !EXCLUDED_ROLE_PATTERNS.some(pattern => pattern.test(part)))
      .map((part) => {
        const mapped = ROLE_TYPE_MAP.find(([pattern]) => pattern.test(part));
        if (mapped) return mapped[1];

        const voiceMatch = part.match(/^(.+?)\s+vocals$/i);
        if (voiceMatch) return this.identification.formatArtistTypeName(voiceMatch[1]);

        return this.identification.formatArtistTypeName(part);
      })
      .filter(typeName => typeName && !this.identification.shouldExcludeArtistTypeName(typeName));
  }

  flattenTracklist(release) {
    const items = [];
    let currentHeading = null;

    const pushTrack = (track, extra = {}) => {
      const { discNumber, trackNumber } = parsePosition(track.position);
      items.push({
        discogsOrdinal: items.length + 1,
        position: String(track.position || '').trim(),
        discNumber,
        trackNumber,
        title: String(track.title || '').trim(),
        durationMs: parseDurationMs(track.duration),
        artists: track.artists || [],
        extraartists: track.extraartists || [],
        heading: currentHeading,
        workTitle: null,
        partTitle: String(track.title || '').trim(),
        partOrder: null,
        ...extra
      });
    };

    for (const entry of release.tracklist || []) {
      const type = entry.type_ || 'track';
      if (type === 'heading') {
        currentHeading = String(entry.title || '').trim() || null;
      } else if (type === 'index') {
        const workTitle = String(entry.title || '').trim();
        (entry.sub_tracks || [])
          .filter(sub => (sub.type_ || 'track') === 'track')
          .forEach((sub, idx) => {
            const partTitle = String(sub.title || '').trim();
            pushTrack(sub, {
              title: workTitle && partTitle ? `${workTitle}: ${partTitle}` : (partTitle || workTitle),
              artists: [...(entry.artists || []), ...(sub.artists || [])],
              extraartists: [...(entry.extraartists || []), ...(sub.extraartists || [])],
              workTitle: workTitle || null,
              partTitle: partTitle || workTitle,
              partOrder: idx + 1
            });
          });
      } else if (type === 'track') {
        pushTrack(entry);
      }
    }

    // Vinyl-style positions (A1, B2) carry no numbers, so fall back to running order.
    if (items.every(item => item.trackNumber === null)) {
      items.forEach((item) => { item.trackNumber = item.discogsOrdinal; });
    }

    // On releases that list works as index headers, a standalone "Work - Movement" track is
    // usually a single-movement work (e.g. "Fanfare For The Common Man - Molto Deliberato").
    const hasIndexWorks = items.some(item => item.workTitle);
    if (hasIndexWorks) {
      for (const item of items) {
        if (item.workTitle) continue;
        const [workPart, ...rest] = item.title.split(' - ');
        if (rest.length > 0 && workPart.trim()) {
          item.inferredWorkTitle = workPart.trim();
          item.inferredPartTitle = rest.join(' - ').trim();
        }
      }
    }

    return items;
  }

  /**
   * Groups tracks into works: Discogs index headers, plus inferred "Work - Movement" tracks.
   */
  buildWorkGroups(items) {
    const groups = new Map();

    for (const item of items) {
      const title = item.workTitle || item.inferredWorkTitle;
      if (!title) continue;

      const key = `work:${normalizeText(title)}`;
      if (!groups.has(key)) {
        groups.set(key, { key, title, inferred: !item.workTitle, items: [] });
      }
      groups.get(key).items.push(item);
    }

    for (const group of groups.values()) {
      group.items.forEach((item, index) => {
        item.workGroupKey = group.key;
        item.workPartTitle = item.workTitle ? item.partTitle : (item.inferredPartTitle || item.title);
        item.workPartOrder = item.workTitle && Number.isInteger(item.partOrder) ? item.partOrder : index + 1;
      });
    }

    return [...groups.values()];
  }

  composerCreditForItem(credits, item) {
    return credits.find(credit => credit.artistTypeName === 'Composer' && credit.discogsOrdinal === item.discogsOrdinal)
      || credits.find(credit => credit.artistTypeName === 'Composer' && credit.source === 'album')
      || null;
  }

  /**
   * Finds existing works that match each work group and picks a default action.
   */
  async matchWorkGroups(workGroups, credits) {
    if (workGroups.length === 0) return [];

    const works = await prisma.work.findMany({
      select: {
        id: true,
        title: true,
        userTitle: true,
        composerKey: true,
        composer: { select: { title: true, userTitle: true } },
        _count: { select: { parts: true } }
      }
    });

    const scoreTitle = (left, right) => {
      const a = normalizeText(left);
      const b = normalizeText(right);
      if (!a || !b) return 0;
      if (a === b) return 1;
      // "Appalachian Spring" vs "Appalachian Spring, suite"
      const containment = (a.includes(b) || b.includes(a)) ? 0.9 : 0;
      return Math.max(containment, titleSimilarity(left, right));
    };

    return workGroups.map((group) => {
      const composerCredit = this.composerCreditForItem(credits, group.items[0]);
      const composerKey = composerCredit?.matchedArtist?.ratingKey || null;
      const composerName = composerCredit?.artistName || null;

      const candidates = works
        .map((work) => {
          const titleScore = Math.max(scoreTitle(group.title, work.title), scoreTitle(group.title, work.userTitle));
          const workComposerName = work.composer?.userTitle || work.composer?.title || null;
          let composerScore = 0.5;
          if (composerKey && work.composerKey === composerKey) {
            composerScore = 1;
          } else if (composerName && workComposerName) {
            composerScore = scoreArtistNameMatch(composerName, workComposerName) >= 0.85 ? 1 : 0;
          }
          return {
            id: work.id,
            title: work.userTitle || work.title,
            composerName: workComposerName,
            partCount: work._count.parts,
            score: Math.round(((titleScore * 0.75) + (composerScore * 0.25)) * 1000) / 1000,
            titleScore,
            composerMatches: composerScore === 1
          };
        })
        .filter(candidate => candidate.titleScore >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ titleScore, ...candidate }) => candidate);

      const best = candidates[0];
      let defaultChoice = { mode: group.inferred ? 'none' : 'create' };
      if (best && best.score >= 0.85 && best.composerMatches) {
        defaultChoice = { mode: 'existing', workId: best.id };
      }

      return {
        key: group.key,
        title: group.title,
        inferred: group.inferred,
        trackOrdinals: group.items.map(item => item.discogsOrdinal),
        trackCount: group.items.length,
        composerName,
        candidates,
        defaultChoice
      };
    });
  }

  resolveTrackRange(rangeText, items) {
    const ordinals = new Set();
    const byPosition = new Map(items.map(item => [item.position.toLowerCase(), item.discogsOrdinal]));

    for (const segment of String(rangeText || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const rangeMatch = segment.match(/^(.+?)\s+to\s+(.+)$/i);
      if (rangeMatch) {
        const start = byPosition.get(rangeMatch[1].trim().toLowerCase());
        const end = byPosition.get(rangeMatch[2].trim().toLowerCase());
        if (start && end) {
          for (let ordinal = Math.min(start, end); ordinal <= Math.max(start, end); ordinal++) {
            ordinals.add(ordinal);
          }
        }
      } else {
        const ordinal = byPosition.get(segment.toLowerCase());
        if (ordinal) ordinals.add(ordinal);
      }
    }

    return ordinals;
  }

  async loadArtistIndex() {
    const artists = await prisma.plexArtist.findMany({
      where: { removed: false },
      select: {
        ratingKey: true,
        title: true,
        titleSort: true,
        userTitle: true,
        musicBrainzAliases: true,
        artistTypes: { select: { artistType: { select: { name: true } } } }
      }
    });

    const exact = new Map();
    const normalized = new Map();
    const scorable = [];
    const add = (map, key, artist) => {
      if (key && !map.has(key)) map.set(key, artist);
    };

    for (const artist of artists) {
      add(exact, artist.title, artist);
      add(exact, artist.userTitle, artist);

      const names = [artist.title, artist.userTitle, artist.titleSort];
      // Sort names are "Last, First"; index the natural order too.
      if (artist.titleSort && artist.titleSort.includes(',')) {
        const [last, ...rest] = artist.titleSort.split(',');
        names.push(`${rest.join(',').trim()} ${last.trim()}`);
      }
      try {
        for (const alias of JSON.parse(artist.musicBrainzAliases || '[]')) {
          names.push(alias?.name);
        }
      } catch (_error) {
        // ignore malformed alias JSON
      }

      names.filter(Boolean).forEach(name => add(normalized, normalizeText(name), artist));
      scorable.push({
        artist,
        names: [...new Set(names.filter(Boolean))],
        typeNames: new Set((artist.artistTypes || []).map(entry => entry.artistType?.name?.toLowerCase()).filter(Boolean))
      });
    }

    return { exact, normalized, scorable };
  }

  matchArtist(index, discogsArtist, typeName = null) {
    const candidates = [cleanDiscogsName(discogsArtist.name), cleanDiscogsName(discogsArtist.anv)].filter(Boolean);

    for (const name of candidates) {
      const hit = index.exact.get(name);
      if (hit) return { artist: hit, matchKind: 'exact' };
    }
    for (const name of candidates) {
      const hit = index.normalized.get(normalizeText(name));
      if (hit) return { artist: hit, matchKind: 'fuzzy' };
    }

    // Names often differ slightly between sources, e.g. a middle name or initials.
    const wantedType = typeName ? typeName.toLowerCase() : null;
    let best = null;
    for (const entry of index.scorable || []) {
      let score = 0;
      for (const candidate of candidates) {
        for (const name of entry.names) {
          score = Math.max(score, scoreArtistNameMatch(candidate, name));
        }
      }
      if (wantedType && entry.typeNames.has(wantedType)) score += 0.05;
      if (score >= 0.85 && (!best || score > best.score)) best = { artist: entry.artist, score };
    }

    return best ? { artist: best.artist, matchKind: 'fuzzy' } : null;
  }

  /**
   * Builds credit options: release-level credits (source "album") and per-track credits.
   */
  buildCredits(release, items, artistIndex) {
    const credits = new Map();

    const addCredit = (discogsArtist, typeName, source, item = null) => {
      const artistName = cleanDiscogsName(discogsArtist?.name);
      if (!artistName || /^various$/i.test(artistName)) return;

      const artistRef = discogsArtist.id || normalizeText(artistName);
      const creditKey = source === 'album'
        ? `album:${artistRef}:${typeName}`
        : `track:${item.discogsOrdinal}:${artistRef}:${typeName}`;
      if (credits.has(creditKey)) return;

      const match = this.matchArtist(artistIndex, discogsArtist, typeName);
      credits.set(creditKey, {
        creditKey,
        artistName,
        artistTypeName: typeName,
        source,
        discogsArtistId: discogsArtist.id || null,
        discogsOrdinal: item ? item.discogsOrdinal : null,
        discogsTrackTitle: item ? item.title : null,
        matchedExisting: Boolean(match),
        willCreateArtist: !match,
        matchedArtist: match ? { ratingKey: match.artist.ratingKey, title: match.artist.title } : null,
        matchKind: match ? match.matchKind : null
      });
    };

    const releaseRoleArtistRefs = new Set();
    for (const credit of release.extraartists || []) {
      const typeNames = this.mapRoleToTypeNames(credit.role);
      if (typeNames.length === 0) continue;

      if (!String(credit.tracks || '').trim()) {
        releaseRoleArtistRefs.add(credit.id || normalizeText(cleanDiscogsName(credit.name)));
        typeNames.forEach(typeName => addCredit(credit, typeName, 'album'));
      } else {
        for (const ordinal of this.resolveTrackRange(credit.tracks, items)) {
          typeNames.forEach(typeName => addCredit(credit, typeName, 'track', items[ordinal - 1]));
        }
      }
    }

    // Main release artists without an explicit role elsewhere are performers.
    for (const artist of release.artists || []) {
      const ref = artist.id || normalizeText(cleanDiscogsName(artist.name));
      const typeNames = this.mapRoleToTypeNames(artist.role);
      if (typeNames.length > 0) {
        typeNames.forEach(typeName => addCredit(artist, typeName, 'album'));
      } else if (!releaseRoleArtistRefs.has(ref)) {
        addCredit(artist, 'Performer', 'album');
      }
    }

    for (const item of items) {
      for (const artist of item.artists) {
        const typeNames = this.mapRoleToTypeNames(artist.role);
        (typeNames.length > 0 ? typeNames : ['Performer']).forEach(typeName => addCredit(artist, typeName, 'track', item));
      }
      for (const credit of item.extraartists) {
        this.mapRoleToTypeNames(credit.role).forEach(typeName => addCredit(credit, typeName, 'track', item));
      }
    }

    return [...credits.values()];
  }

  /**
   * Default local<->Discogs pairing: disc/track position, then title similarity, then running order.
   */
  matchTracks(items, localTracks) {
    const locals = localTracks.map(track => ({ track, ...inferLocalPosition(track) }));
    const used = new Set();
    const assignments = new Map();

    const discogsDiscs = new Set(items.map(item => item.discNumber).filter(Boolean));
    const localHasDiscs = locals.some(local => local.discNumber);
    const localIndexes = locals.map(local => local.index).filter(index => index !== null);
    const localIndexesUnique = new Set(localIndexes).size === localIndexes.length;
    // Multi-disc release but local tracks are numbered straight through: compare on running order.
    const useOrdinalNumbers = discogsDiscs.size > 1 && !localHasDiscs && localIndexesUnique;

    const assign = (item, local) => {
      assignments.set(item.discogsOrdinal, local.track.ratingKey);
      used.add(local.track.ratingKey);
    };

    for (const item of items) {
      const wantedNumber = useOrdinalNumbers ? item.discogsOrdinal : item.trackNumber;
      if (wantedNumber === null) continue;

      const candidates = locals.filter(local => !used.has(local.track.ratingKey)
        && local.index === wantedNumber
        && (useOrdinalNumbers || !item.discNumber || !local.discNumber || item.discNumber === local.discNumber));

      if (candidates.length === 1) {
        assign(item, candidates[0]);
      } else if (candidates.length > 1) {
        const best = candidates
          .map(local => ({ local, score: titleSimilarity(item.title, local.track.title) }))
          .sort((a, b) => b.score - a.score)[0];
        assign(item, best.local);
      }
    }

    for (const item of items) {
      if (assignments.has(item.discogsOrdinal)) continue;

      const best = locals
        .filter(local => !used.has(local.track.ratingKey))
        .map((local) => {
          const durationDiff = item.durationMs && local.track.duration
            ? Math.abs(item.durationMs - local.track.duration)
            : Number.MAX_SAFE_INTEGER;
          return { local, score: titleSimilarity(item.title, local.track.title), durationDiff };
        })
        .filter(entry => entry.score >= 0.6)
        .sort((a, b) => (b.score - a.score) || (a.durationDiff - b.durationDiff))[0];

      if (best) assign(item, best.local);
    }

    if (items.length === locals.length) {
      const remainingLocals = locals
        .filter(local => !used.has(local.track.ratingKey))
        .sort((a, b) => ((a.discNumber || 0) - (b.discNumber || 0)) || ((a.index || 0) - (b.index || 0)));
      items
        .filter(item => !assignments.has(item.discogsOrdinal))
        .forEach((item, idx) => {
          if (remainingLocals[idx]) assign(item, remainingLocals[idx]);
        });
    }

    return items.map(item => ({
      discogsOrdinal: item.discogsOrdinal,
      localTrackKey: assignments.get(item.discogsOrdinal) || null
    }));
  }

  async loadContext(albumRatingKey, releaseId) {
    const album = await prisma.plexAlbum.findUnique({
      where: { ratingKey: albumRatingKey },
      include: {
        tracks: {
          where: { removed: false },
          orderBy: [{ discNumber: 'asc' }, { index: 'asc' }, { ratingKey: 'asc' }]
        }
      }
    });

    if (!album) {
      const error = new Error('Album not found in local database');
      error.statusCode = 404;
      throw error;
    }

    const release = await this.discogs.getRelease(releaseId);
    const items = this.flattenTracklist(release);
    const artistIndex = await this.loadArtistIndex();
    const credits = this.buildCredits(release, items, artistIndex);
    const workGroups = await this.matchWorkGroups(this.buildWorkGroups(items), credits);

    return { album, release, items, credits, workGroups };
  }

  buildPreview({ album, release, items, credits, workGroups = [] }, trackMappings) {
    const mapping = {
      defaultTrackMappings: trackMappings,
      mappedTrackCount: trackMappings.filter(entry => entry.localTrackKey).length,
      localTrackCount: album.tracks.length,
      sourceTrackCount: items.length,
      discogsTracks: items.map(item => ({
        discogsOrdinal: item.discogsOrdinal,
        discogsTrackIndex: item.position || item.discogsOrdinal,
        discNumber: item.discNumber,
        trackNumber: item.trackNumber,
        discogsTrackTitle: item.title,
        discogsTrackDurationMs: item.durationMs,
        heading: item.heading,
        workGroupKey: item.workGroupKey || null
      })),
      localTracks: album.tracks.map((track) => {
        const position = inferLocalPosition(track);
        return {
          ratingKey: track.ratingKey,
          title: track.title,
          index: position.index,
          trackNumber: position.index,
          discNumber: position.discNumber,
          duration: track.duration
        };
      }),
      workGroups,
      proposedWorks: workGroups.map(group => ({ title: group.title, trackCount: group.trackCount }))
    };

    const images = (release.images || [])
      .map((image, index) => ({
        index,
        thumb: image.uri150 || image.uri || null,
        full: image.uri || null,
        width: image.width || null,
        height: image.height || null,
        discogsType: image.type || null
      }))
      .filter(image => image.full);
    const primaryImage = images.find(image => image.discogsType === 'primary') || images[0] || null;

    return {
      album: { title: album.title, discogsTitle: release.title },
      discogs: {
        sourceKind: 'release',
        releaseId: release.id,
        title: release.title,
        year: release.year || null,
        sourceTrackCount: items.length,
        creditOptions: credits,
        images,
        defaultArtwork: { front: primaryImage ? primaryImage.index : null, back: null }
      },
      mapping
    };
  }

  async preview(albumRatingKey, releaseId) {
    const context = await this.loadContext(albumRatingKey, releaseId);
    const trackMappings = this.matchTracks(context.items, context.album.tracks);
    return this.buildPreview(context, trackMappings);
  }

  /**
   * Finds the most likely Discogs releases for a local album, ranked by confidence (0..1).
   * A free-text query replaces the automatic title/artist search but results are still scored.
   */
  async searchForAlbum(albumRatingKey, { query = null, limit = 15 } = {}) {
    const album = await prisma.plexAlbum.findUnique({
      where: { ratingKey: albumRatingKey },
      include: {
        artist: { select: { title: true, userTitle: true } },
        albumArtists: { include: { artist: { select: { title: true, userTitle: true } } } },
        tracks: { where: { removed: false }, select: { discNumber: true, title: true, file: true } }
      }
    });

    if (!album) {
      const error = new Error('Album not found in local database');
      error.statusCode = 404;
      throw error;
    }

    const albumTitle = album.userTitle || album.title || '';
    const artistNames = [...new Set([
      album.albumArtist,
      album.artist?.userTitle || album.artist?.title,
      ...album.albumArtists.map(entry => entry.artist?.userTitle || entry.artist?.title)
    ].map(name => String(name || '').trim()).filter(name => name && !/^various/i.test(name)))];
    const localDiscCount = new Set(album.tracks.map(track => inferLocalPosition(track).discNumber || 1)).size;

    // Long classical titles ("Series, Vol. 6: Concerto no. 1 / Concerto no. 2") rarely match
    // Discogs verbatim; free-text searches on surnames plus each title segment work far better.
    const titleSegments = albumTitle.split(/\s*(?::|\(|\[)\s*/).map(segment => segment.replace(/[)\]]/g, '').trim()).filter(Boolean);
    const titleVariants = [...new Set([albumTitle, ...titleSegments])];
    const surname = (name) => {
      const text = String(name || '').trim();
      return text.includes(',') ? text.split(',')[0].trim() : (text.split(/\s+/).pop() || '');
    };
    const keyWords = (text) => text.split(/\s+/).slice(0, 6).join(' ');
    const primarySurname = surname(artistNames[0]);
    const secondarySurname = surname(artistNames.find(name => surname(name) !== primarySurname));

    const searches = query
      ? [{ q: query }]
      : [
          ...(artistNames[0] ? [{ release_title: albumTitle, artist: artistNames[0] }] : [{ release_title: albumTitle }]),
          ...titleSegments.map(segment => ({ q: [primarySurname, keyWords(segment)].filter(Boolean).join(' ') })),
          ...(secondarySurname ? [{ q: [primarySurname, secondarySurname, keyWords(titleSegments[titleSegments.length - 1] || albumTitle)].join(' ') }] : [])
        ];

    const resultsById = new Map();
    const seenSearches = new Set();
    for (const params of searches) {
      const signature = JSON.stringify(params);
      if (seenSearches.has(signature) || !Object.values(params).some(value => String(value || '').trim())) continue;
      seenSearches.add(signature);
      const results = await this.discogs.searchReleases({ ...params, per_page: 15 });
      results.forEach(result => {
        if (result?.id && !resultsById.has(result.id)) resultsById.set(result.id, result);
      });
      if (resultsById.size >= 40) break;
    }

    const candidates = [...resultsById.values()].map((result) => {
      // Discogs titles are "Artist(s) - Title", and the artist part may itself contain " - ".
      const parts = String(result.title || '').split(' - ');
      const releaseTitle = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const releaseArtist = parts.length > 1 ? parts.slice(0, -1).join(' - ') : '';
      const releaseArtistNames = releaseArtist.split(/\s*(?:,|&| - |\/)\s*/).map(cleanDiscogsName).filter(Boolean);

      const titleScore = Math.max(0, ...titleVariants.map(variant => titleSimilarity(variant, releaseTitle)));
      const artistScore = artistNames.length === 0 || releaseArtistNames.length === 0
        ? 0.5
        : Math.max(0, ...artistNames.flatMap(local => releaseArtistNames.map(remote => scoreArtistNameMatch(local, remote))));
      const year = Number.parseInt(result.year, 10);
      const yearScore = !album.year || !year ? 0.5 : (album.year === year ? 1 : (Math.abs(album.year - year) <= 1 ? 0.6 : 0));
      const discCount = Number.parseInt(result.format_quantity, 10);
      const discScore = !discCount ? 0.5 : (discCount === localDiscCount ? 1 : 0);

      const confidence = Math.min(1, (titleScore * 0.55) + (artistScore * 0.25) + (yearScore * 0.1) + (discScore * 0.1));

      return {
        id: result.id,
        title: releaseTitle,
        artist: releaseArtist || null,
        year: year || null,
        country: result.country || null,
        label: Array.isArray(result.label) ? result.label[0] : (result.label || null),
        catno: result.catno || null,
        format: Array.isArray(result.format) ? result.format.join(', ') : null,
        formatQuantity: discCount || null,
        thumb: result.cover_image || result.thumb || null,
        url: result.uri ? `https://www.discogs.com${result.uri}` : `https://www.discogs.com/release/${result.id}`,
        confidence: Math.round(confidence * 1000) / 1000
      };
    });

    return {
      query: query || searches.map(params => Object.values(params).join(' ')).find(Boolean) || albumTitle,
      local: { title: albumTitle, artists: artistNames, year: album.year || null, discCount: localDiscCount, trackCount: album.tracks.length },
      candidates: candidates.sort((a, b) => b.confidence - a.confidence).slice(0, limit)
    };
  }

  async resolveArtist(credit) {
    if (credit.overrideRatingKey) {
      const chosen = await prisma.plexArtist.findUnique({ where: { ratingKey: credit.overrideRatingKey } });
      if (chosen) return chosen.ratingKey;
    }

    if (credit.matchedArtist?.ratingKey && !credit.forceCreate) {
      return credit.matchedArtist.ratingKey;
    }

    const ratingKey = credit.discogsArtistId && !credit.forceCreate
      ? `discogs-artist:${credit.discogsArtistId}`
      : `discogs-artist:${normalizeText(credit.artistName).replace(/\s+/g, '-')}`;

    const existing = await prisma.plexArtist.findUnique({ where: { ratingKey } });
    if (existing) return existing.ratingKey;

    const created = await prisma.plexArtist.create({
      data: {
        ratingKey,
        key: `/library/metadata/${ratingKey}`,
        title: credit.artistName,
        titleSort: credit.artistName,
        identificationStatus: 'identified',
        identificationConfidence: 0.8,
        lastIdentificationAttempt: new Date()
      }
    });
    return created.ratingKey;
  }

  /**
   * selection: { mode: 'existing', workId } | { mode: 'create', title? } | { mode: 'none' };
   * falls back to the group's default when not provided.
   */
  async resolveWorkSelection(group, selection, composerKey) {
    const choice = selection && typeof selection === 'object' ? selection : group.defaultChoice;

    if (choice?.mode === 'existing') {
      const workId = Number.parseInt(choice.workId, 10);
      const existing = Number.isInteger(workId) ? await prisma.work.findUnique({ where: { id: workId } }) : null;
      if (existing) return existing;
    }

    if (choice?.mode === 'create' || choice?.mode === 'existing') {
      const title = String(choice.title || '').trim() || group.title;
      const effectiveComposerKey = composerKey || await this.identification.ensureFallbackComposerArtistKey();
      return await this.ensureWork(title, effectiveComposerKey);
    }

    return null;
  }

  // Existing works often name parts differently ("I. Very slowly" vs "Very Slowly"), so match fuzzily.
  async findOrCreateWorkPart(workId, title, order, usedPartIds = new Set()) {
    const work = await prisma.work.findUnique({ where: { id: workId }, select: { title: true, userTitle: true } });
    const workTitles = [work?.title, work?.userTitle].filter(Boolean).map(normalizeText);
    // Existing parts are often "Work: IV. Movement" while Discogs lists just "Movement".
    const corePartTitle = (value) => {
      let text = normalizeText(value);
      for (const workTitle of workTitles) {
        if (text.startsWith(`${workTitle} `)) text = text.slice(workTitle.length).trim();
      }
      return text.replace(/^(?:[ivxlc]+|\d+)\s+/, '').trim();
    };
    const scorePart = (partTitle) => {
      const a = corePartTitle(title);
      const b = corePartTitle(partTitle);
      if (!a || !b) return 0;
      if (a === b) return 1;
      const containment = (a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 4 ? 0.85 : 0;
      return Math.max(containment, titleSimilarity(a, b));
    };

    const parts = await prisma.workPart.findMany({ where: { workId }, orderBy: { order: 'asc' } });
    const best = parts
      .filter(part => !usedPartIds.has(part.id))
      .map(part => ({ part, score: scorePart(part.title) }))
      .sort((a, b) => b.score - a.score)[0];

    if (best && best.score >= 0.6) {
      usedPartIds.add(best.part.id);
      return best.part;
    }

    const created = await prisma.workPart.create({
      data: {
        workId,
        title,
        order: Number.isInteger(order) && !parts.some(part => part.order === order)
          ? order
          : (parts.length > 0 ? Math.max(...parts.map(part => part.order)) + 1 : 1)
      }
    });
    usedPartIds.add(created.id);
    return created;
  }

  async ensureWork(title, composerKey) {
    const existing = await prisma.work.findFirst({ where: { title, composerKey } });
    if (existing) return existing;

    return await prisma.work.create({
      data: {
        title,
        composerKey,
        identificationStatus: 'identified',
        identificationConfidence: 0.8
      }
    });
  }

  /**
   * Overrides map creditKey -> { ratingKey } to use an existing artist, or { createName } to create one.
   * createName may be "Name — Type", which also overrides the credit's artist type.
   */
  applyArtistOverrides(credits, artistOverrides) {
    const overrides = artistOverrides && typeof artistOverrides === 'object' ? artistOverrides : {};

    return credits.map((credit) => {
      const override = overrides[credit.creditKey];
      if (!override || typeof override !== 'object') return credit;

      const ratingKey = String(override.ratingKey || '').trim() || null;
      const { name, typeName } = splitArtistNameAndType(override.createName || override.typeName || '');
      const overrideType = String(override.typeName || typeName || '').trim();

      return {
        ...credit,
        artistName: !ratingKey && name ? name : credit.artistName,
        artistTypeName: overrideType || credit.artistTypeName,
        overrideRatingKey: ratingKey,
        forceCreate: !ratingKey && Boolean(override.createName)
      };
    });
  }

  /**
   * artwork: { front: imageIndex|null, back: imageIndex|null } — indexes into release.images,
   * so only images belonging to the Discogs release can be downloaded.
   */
  async saveArtwork(albumRatingKey, release, artwork) {
    const AlbumArtworkService = require('./albumArtworkService');
    const artworkService = new AlbumArtworkService();
    const images = release.images || [];
    const saved = [];
    const errors = [];

    for (const type of AlbumArtworkService.ARTWORK_TYPES) {
      const index = Number.parseInt(artwork?.[type], 10);
      const image = Number.isInteger(index) ? images[index] : null;
      if (!image?.uri) continue;

      try {
        await artworkService.saveFromUrl(albumRatingKey, type, image.uri, {
          source: 'discogs',
          width: image.width || null,
          height: image.height || null,
          headers: { 'User-Agent': this.discogs.userAgent }
        });
        saved.push(type);
      } catch (error) {
        console.error(`Failed to save Discogs ${type} artwork for album ${albumRatingKey}:`, error.message);
        errors.push({ type, error: error.message });
      }
    }

    return { saved, errors };
  }

  async apply(albumRatingKey, releaseId, { trackMappings = [], excludedCreditKeys = [], artistOverrides = {}, artwork = null, workSelections = null } = {}) {
    const context = await this.loadContext(albumRatingKey, releaseId);
    const { album, release, items } = context;
    const excluded = new Set(excludedCreditKeys.map(key => String(key || '').trim()));
    const credits = this.applyArtistOverrides(
      context.credits.filter(credit => !excluded.has(credit.creditKey)),
      artistOverrides
    );

    const localKeys = new Set(album.tracks.map(track => track.ratingKey));
    const itemsByOrdinal = new Map(items.map(item => [item.discogsOrdinal, item]));
    const usedLocalKeys = new Set();
    const mappings = [];
    for (const entry of Array.isArray(trackMappings) ? trackMappings : []) {
      const item = itemsByOrdinal.get(Number.parseInt(entry?.discogsOrdinal, 10));
      const localKey = entry?.localTrackKey ? String(entry.localTrackKey) : null;
      if (!item || !localKey || !localKeys.has(localKey) || usedLocalKeys.has(localKey)) continue;
      usedLocalKeys.add(localKey);
      const workTitleHint = String(entry?.workTitleHint || '').trim() || null;
      mappings.push({ item, localKey, workTitleHint });
    }

    const artistKeyByCredit = new Map();
    for (const credit of credits) {
      const isAlbumCredit = credit.source === 'album';
      const isMappedTrackCredit = mappings.some(mapping => mapping.item.discogsOrdinal === credit.discogsOrdinal);
      if (isAlbumCredit || isMappedTrackCredit) {
        artistKeyByCredit.set(credit.creditKey, await this.resolveArtist(credit));
      }
    }

    const albumCredits = credits.filter(credit => credit.source === 'album');
    const albumUpdate = {
      title: release.title,
      titleSort: release.title,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };
    if (release.year) albumUpdate.year = release.year;
    if (release.released) albumUpdate.musicBrainzReleaseDate = String(release.released);
    if (release.country) albumUpdate.musicBrainzCountry = release.country;
    if (release.labels?.[0]?.name) albumUpdate.musicBrainzLabel = cleanDiscogsName(release.labels[0].name);
    const barcode = (release.identifiers || []).find(identifier => /barcode/i.test(identifier?.type || ''))?.value;
    if (barcode) albumUpdate.musicBrainzBarcode = String(barcode).replace(/\s+/g, '');

    const primaryArtist = (release.artists || [])[0];
    if (primaryArtist?.name && !/^various$/i.test(cleanDiscogsName(primaryArtist.name))) {
      albumUpdate.albumArtist = cleanDiscogsName(primaryArtist.name);
      const primaryCredit = albumCredits.find(credit => credit.discogsArtistId === primaryArtist.id
        && (credit.overrideRatingKey || (credit.matchedExisting && !credit.forceCreate)));
      if (primaryCredit) albumUpdate.parentRatingKey = artistKeyByCredit.get(primaryCredit.creditKey);
    }

    await prisma.plexAlbum.update({ where: { ratingKey: albumRatingKey }, data: albumUpdate });

    for (const credit of albumCredits) {
      await this.identification.ensureAlbumArtistAssignment(albumRatingKey, artistKeyByCredit.get(credit.creditKey), credit.artistTypeName);
    }

    const discTotal = Math.max(
      Number.parseInt(release.format_quantity, 10) || 0,
      ...items.map(item => item.discNumber || 0)
    ) || null;

    let linkedWorkTrackCount = 0;
    const groupsByKey = new Map((context.workGroups || []).map(group => [group.key, group]));
    const resolvedWorkByGroup = new Map();
    const usedPartIds = new Set();

    for (const { item, localKey, workTitleHint } of mappings) {
      const trackCredits = credits.filter(credit => credit.source === 'album' || credit.discogsOrdinal === item.discogsOrdinal);
      const composerCredits = trackCredits.filter(credit => credit.artistTypeName === 'Composer');
      const composerKey = composerCredits.length > 0 ? artistKeyByCredit.get(composerCredits[0].creditKey) : null;

      let workId = null;
      let workPartId = null;
      if (workTitleHint) {
        const effectiveComposerKey = composerKey || await this.identification.ensureFallbackComposerArtistKey();
        const work = await this.ensureWork(workTitleHint, effectiveComposerKey);
        workId = work.id;
        const part = await this.identification.ensureWorkPartRecord(work.id, item.title, item.discogsOrdinal);
        workPartId = part?.id || null;
      } else if (item.workGroupKey && groupsByKey.has(item.workGroupKey)) {
        const group = groupsByKey.get(item.workGroupKey);
        if (!resolvedWorkByGroup.has(group.key)) {
          resolvedWorkByGroup.set(group.key, await this.resolveWorkSelection(group, workSelections?.[group.key], composerKey));
        }
        const work = resolvedWorkByGroup.get(group.key);
        if (work) {
          workId = work.id;
          const part = await this.findOrCreateWorkPart(work.id, item.workPartTitle, item.workPartOrder, usedPartIds);
          workPartId = part?.id || null;
        }
      }

      if (workId && composerKey) {
        await this.identification.ensureArtistTypeAssignmentByName(composerKey, 'Composer');
      }

      const trackUpdate = {
        title: item.title,
        titleSort: item.title,
        identificationStatus: 'identified',
        identificationConfidence: 1.0,
        lastIdentificationAttempt: new Date(),
        userComposer: composerCredits.length > 0 ? [...new Set(composerCredits.map(credit => credit.artistName))].join(', ') : null
      };
      if (Number.isInteger(item.trackNumber)) trackUpdate.index = item.trackNumber;
      if (Number.isInteger(item.discNumber)) trackUpdate.discNumber = item.discNumber;
      if (discTotal) trackUpdate.discTotal = discTotal;
      if (workId) trackUpdate.workId = workId;

      await prisma.plexTrack.update({ where: { ratingKey: localKey }, data: trackUpdate });

      if (workPartId) {
        await prisma.workPartTrack.upsert({
          where: { workPartId_trackKey: { workPartId, trackKey: localKey } },
          update: {},
          create: { workPartId, trackKey: localKey }
        });
        for (const typeName of new Set(trackCredits.map(credit => credit.artistTypeName))) {
          await this.identification.ensureWorkPartArtistTypeAssignmentByName(workPartId, typeName);
        }
        linkedWorkTrackCount++;
      }

      for (const credit of trackCredits) {
        const artistKey = artistKeyByCredit.get(credit.creditKey);
        await this.identification.ensureTrackArtistAssignment(localKey, artistKey, credit.artistTypeName);
        if (credit.source === 'track') {
          await this.identification.ensureAlbumArtistAssignment(albumRatingKey, artistKey, credit.artistTypeName);
        }
      }
    }

    const artworkResult = await this.saveArtwork(albumRatingKey, release, artwork);

    const preview = this.buildPreview(context, mappings.map(({ item, localKey }) => ({
      discogsOrdinal: item.discogsOrdinal,
      localTrackKey: localKey
    })));
    preview.discogs.mappedTrackCount = mappings.length;
    preview.discogs.linkedWorkTrackCount = linkedWorkTrackCount;
    preview.discogs.artworkSaved = artworkResult.saved;
    preview.discogs.artworkErrors = artworkResult.errors;
    return preview;
  }
}

module.exports = DiscogsImportService;
module.exports.helpers = { parsePosition, parseDurationMs, titleSimilarity, cleanDiscogsName, normalizeText };
