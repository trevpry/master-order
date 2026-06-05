const express = require('express');
const router = express.Router();
const PlexDatabaseService = require('../plexDatabaseService');
const PlexSyncService = require('../plexSyncService');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs').promises;
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');
const ArtistMergeService = require('../services/artistMergeService');
const { getPreferredMusicBrainzArtistName } = require('../utils/musicBrainzNames');

const prisma = require('../prismaClient'); // Use shared singleton instance
const plexDb = new PlexDatabaseService();
const plexSync = new PlexSyncService();

const PICARD_TAG_SECTIONS = [
  {
    title: 'MusicBrainz IDs',
    fields: [
      { key: 'musicbrainz_recordingid', label: 'Recording ID' },
      { key: 'musicbrainz_trackid', label: 'Track ID' },
      { key: 'musicbrainz_albumid', label: 'Album ID' },
      { key: 'musicbrainz_releasegroupid', label: 'Release Group ID' },
      { key: 'musicbrainz_artistid', label: 'Artist ID' },
      { key: 'musicbrainz_albumartistid', label: 'Album Artist ID' },
      { key: 'musicbrainz_workid', label: 'Work ID' },
      { key: 'musicbrainz_discid', label: 'Disc ID' },
      { key: 'musicbrainz_originalartistid', label: 'Original Artist ID' },
    ],
  },
  {
    title: 'Release Metadata',
    fields: [
      { key: 'album', label: 'Album' },
      { key: 'albumartist', label: 'Album Artist' },
      { key: 'artists', label: 'Artists' },
      { key: 'date', label: 'Date' },
      { key: 'originaldate', label: 'Original Date' },
      { key: 'originalyear', label: 'Original Year' },
      { key: 'releasetype', label: 'Release Type' },
      { key: 'releasestatus', label: 'Release Status' },
      { key: 'releasecountry', label: 'Release Country' },
      { key: 'label', label: 'Label' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'catalognumber', label: 'Catalog Number' },
      { key: 'asin', label: 'ASIN' },
      { key: 'isrc', label: 'ISRC' },
      { key: 'acoustid_id', label: 'AcoustID' },
      { key: 'musicip_puid', label: 'MusicIP PUID' },
    ],
  },
  {
    title: 'Credits & Work Tags',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'artist', label: 'Artist' },
      { key: 'composer', label: 'Composer' },
      { key: 'lyricist', label: 'Lyricist' },
      { key: 'writer', label: 'Writer' },
      { key: 'conductor', label: 'Conductor' },
      { key: 'arranger', label: 'Arranger' },
      { key: 'producer', label: 'Producer' },
      { key: 'engineer', label: 'Engineer' },
      { key: 'mixer', label: 'Mixer' },
      { key: 'djmixer', label: 'DJ Mixer' },
      { key: 'work', label: 'Work' },
      { key: 'movement', label: 'Movement' },
      { key: 'movementIndex', label: 'Movement Index' },
      { key: 'movementTotal', label: 'Movement Total' },
      { key: 'discsubtitle', label: 'Disc Subtitle' },
    ],
  },
  {
    title: 'Sort & Additional Tags',
    fields: [
      { key: 'artistsort', label: 'Artist Sort' },
      { key: 'albumartistsort', label: 'Album Artist Sort' },
      { key: 'albumsort', label: 'Album Sort' },
      { key: 'titlesort', label: 'Title Sort' },
      { key: 'genre', label: 'Genre' },
      { key: 'language', label: 'Language' },
      { key: 'mood', label: 'Mood' },
      { key: 'comment', label: 'Comment' },
      { key: 'license', label: 'License' },
      { key: 'copyright', label: 'Copyright' },
      { key: 'encodedby', label: 'Encoded By' },
      { key: 'encodersettings', label: 'Encoder Settings' },
    ],
  },
];

const PICARD_TRACK_SELECT = {
  ratingKey: true,
  key: true,
  title: true,
  index: true,
  file: true,
  duration: true,
  size: true,
  container: true,
  audioCodec: true,
  audioChannels: true,
  bitrate: true,
};

const PICARD_NATIVE_TAG_MATCHERS = [
  /musicbrainz/,
  /acoustid/,
  /musicip/,
  /barcode/,
  /catalog/,
  /^asin$/,
  /^isrc$/,
  /release(country|status|type)/,
  /artistsort/,
  /albumartistsort/,
  /albumsort/,
  /discsubtitle/,
  /work/,
  /movement/,
  /lyricist/,
  /writer/,
  /composer/,
  /conductor/,
  /arranger/,
  /producer/,
  /engineer/,
  /mixer/,
  /djmixer/,
];

function normalizePicardValues(value) {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap(normalizePicardValues))];
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'no') || Object.prototype.hasOwnProperty.call(value, 'of')) {
      const no = value.no ?? '?';
      const of = value.of ? `/${value.of}` : '';
      return [`${no}${of}`];
    }

    return Object.values(value).flatMap(normalizePicardValues);
  }

  return [String(value).trim()].filter(Boolean);
}

function collectMappedPicardSections(common = {}) {
  return PICARD_TAG_SECTIONS.map((section) => {
    const tags = section.fields
      .map((field) => {
        const values = normalizePicardValues(common[field.key]);
        if (values.length === 0) return null;
        return {
          key: field.key,
          label: field.label,
          values,
        };
      })
      .filter(Boolean);

    if (tags.length === 0) return null;

    return {
      title: section.title,
      tags,
    };
  }).filter(Boolean);
}

function isPicardNativeTag(tagId) {
  if (!tagId) return false;
  const normalized = String(tagId).trim().toLowerCase();
  return PICARD_NATIVE_TAG_MATCHERS.some((matcher) => matcher.test(normalized));
}

function collectRawPicardNativeTags(native = {}) {
  const tagMap = new Map();

  Object.entries(native).forEach(([format, tags]) => {
    if (!Array.isArray(tags)) return;

    tags.forEach((tag) => {
      const tagId = tag?.id || tag?.key;
      if (!isPicardNativeTag(tagId)) return;

      const values = normalizePicardValues(tag?.value);
      if (values.length === 0) return;

      if (!tagMap.has(tagId)) {
        tagMap.set(tagId, {
          key: tagId,
          values: new Set(),
          formats: new Set(),
        });
      }

      const entry = tagMap.get(tagId);
      values.forEach((value) => entry.values.add(value));
      entry.formats.add(format);
    });
  });

  return [...tagMap.values()]
    .map((entry) => ({
      key: entry.key,
      values: [...entry.values],
      formats: [...entry.formats],
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

async function ensureTrackFilePath(track) {
  let plexPath = track.file;

  if (!plexPath && track.key) {
    const trackData = await plexSync.makeRequest(track.key);
    const metadata = trackData?.MediaContainer?.Metadata?.[0];
    const mediaPart = metadata?.Media?.[0]?.Part?.[0];
    const stream = metadata?.Media?.[0]?.Part?.[0]?.Stream?.[0];

    if (mediaPart?.file) {
      plexPath = mediaPart.file;

      const updateData = {
        file: mediaPart.file,
        duration: mediaPart.duration ? parseInt(mediaPart.duration, 10) : track.duration,
        size: mediaPart.size ? parseInt(mediaPart.size, 10) : track.size,
        container: mediaPart.container || track.container,
      };

      if (stream) {
        updateData.audioCodec = stream.codec || track.audioCodec;
        updateData.audioChannels = stream.channels ? parseInt(stream.channels, 10) : track.audioChannels;
        updateData.bitrate = stream.bitrate ? parseInt(stream.bitrate, 10) : track.bitrate;
      }

      await prisma.plexTrack.update({
        where: { ratingKey: track.ratingKey },
        data: updateData,
      });
    }
  }

  const localPath = mapPlexPathToLocal(plexPath);
  if (!localPath) {
    throw new Error('No file path available');
  }

  await fs.access(localPath);

  return {
    plexPath,
    localPath,
  };
}

async function extractTrackPicardTags(track) {
  const { parseFile } = await import('music-metadata');
  const { plexPath, localPath } = await ensureTrackFilePath(track);
  const metadata = await parseFile(localPath);
  const mappedSections = collectMappedPicardSections(metadata.common);
  const rawTags = collectRawPicardNativeTags(metadata.native);

  return {
    track: {
      ratingKey: track.ratingKey,
      index: track.index ?? null,
      plexPath,
      filePath: localPath,
    },
    mappedSections,
    rawTags,
  };
}

function aggregatePicardResults(results) {
  const mappedSectionMap = new Map();
  const rawTagMap = new Map();

  results.forEach((result) => {
    result.mappedSections.forEach((section) => {
      if (!mappedSectionMap.has(section.title)) {
        mappedSectionMap.set(section.title, new Map());
      }

      const sectionMap = mappedSectionMap.get(section.title);
      section.tags.forEach((tag) => {
        if (!sectionMap.has(tag.key)) {
          sectionMap.set(tag.key, {
            key: tag.key,
            label: tag.label,
            values: new Set(),
            tracks: new Set(),
          });
        }

        const entry = sectionMap.get(tag.key);
        tag.values.forEach((value) => entry.values.add(value));
        entry.tracks.add(result.track.title);
      });
    });

    result.rawTags.forEach((tag) => {
      if (!rawTagMap.has(tag.key)) {
        rawTagMap.set(tag.key, {
          key: tag.key,
          values: new Set(),
          formats: new Set(),
          tracks: new Set(),
        });
      }

      const entry = rawTagMap.get(tag.key);
      tag.values.forEach((value) => entry.values.add(value));
      tag.formats.forEach((format) => entry.formats.add(format));
      entry.tracks.add(result.track.title);
    });
  });

  const sections = [...mappedSectionMap.entries()].map(([title, tagMap]) => ({
    title,
    tags: [...tagMap.values()]
      .map((tag) => ({
        key: tag.key,
        label: tag.label,
        values: [...tag.values],
        trackCount: tag.tracks.size,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  }));

  const rawTags = [...rawTagMap.values()]
    .map((tag) => ({
      key: tag.key,
      values: [...tag.values],
      formats: [...tag.formats],
      trackCount: tag.tracks.size,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  return { sections, rawTags };
}

function firstMetadataValue(value) {
  if (Array.isArray(value)) {
    return value.find((entry) => entry !== null && entry !== undefined && entry !== '') ?? null;
  }

  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
}

function formatMetadataPosition(value) {
  if (!value) {
    return { no: null, of: null };
  }

  if (typeof value === 'object') {
    return {
      no: value.no ?? value.position ?? null,
      of: value.of ?? value.total ?? null,
    };
  }

  return { no: value, of: null };
}

function parseMetadataPreferencesObject(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildAlbumExtractionUpdates(common = {}) {
  const updates = {};

  const albumTitle = firstMetadataValue(common.album);
  const albumArtist = firstMetadataValue(common.albumartist);
  const albumId = firstMetadataValue(common.musicbrainz_albumid);
  const releaseDate = firstMetadataValue(common.date);
  const originalDate = firstMetadataValue(common.originaldate);
  const originalYear = firstMetadataValue(common.originalyear);
  const releaseCountry = firstMetadataValue(common.releasecountry);
  const releaseStatus = firstMetadataValue(common.releasestatus);
  const releaseType = firstMetadataValue(common.releasetype);
  const barcode = firstMetadataValue(common.barcode);
  const asin = firstMetadataValue(common.asin);
  const label = firstMetadataValue(common.label);

  if (albumTitle) {
    updates.title = albumTitle;
  }

  if (albumArtist) {
    updates.albumArtist = albumArtist;
  }

  if (albumId) {
    updates.musicBrainzId = albumId;
  }

  if (releaseDate) {
    updates.musicBrainzReleaseDate = String(releaseDate);
    const parsedReleaseDate = new Date(releaseDate);
    if (!Number.isNaN(parsedReleaseDate.getTime())) {
      updates.originallyAvailableAt = parsedReleaseDate;
      updates.year = parsedReleaseDate.getUTCFullYear();
    }
  }

  if (!updates.originallyAvailableAt && originalDate) {
    const parsedOriginalDate = new Date(originalDate);
    if (!Number.isNaN(parsedOriginalDate.getTime())) {
      updates.originallyAvailableAt = parsedOriginalDate;
    }
  }

  if (!updates.year && originalYear) {
    const parsedYear = parseInt(originalYear, 10);
    if (!Number.isNaN(parsedYear)) {
      updates.year = parsedYear;
    }
  }

  if (releaseCountry) {
    updates.musicBrainzCountry = String(releaseCountry);
  }

  if (releaseStatus) {
    updates.musicBrainzStatus = String(releaseStatus);
  }

  if (releaseType) {
    updates.musicBrainzPackaging = String(releaseType);
  }

  if (barcode) {
    updates.musicBrainzBarcode = String(barcode);
  }

  if (asin) {
    updates.musicBrainzAsin = String(asin);
  }

  if (label) {
    updates.musicBrainzLabel = String(label);
  }

  return updates;
}

function parseDurationToMilliseconds(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parts = raw.split(':').map((entry) => parseInt(entry, 10));
  if (parts.some((entry) => Number.isNaN(entry))) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return ((minutes * 60) + seconds) * 1000;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (((hours * 60) + minutes) * 60 + seconds) * 1000;
  }

  return null;
}

function normalizeTrackTitleForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArtistNameForMatch(value) {
  return String(value || '')
    // Fold accented characters so François and Francois normalize the same.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(\d+\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrimaryDiscogsArtistName(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const markdownLabel = input.match(/^\[([^\]]+)\]\([^)]*\)$/);
  const normalizedInput = markdownLabel ? markdownLabel[1] : input;
  const cleaned = normalizedInput.replace(/\(\d+\)/g, '').trim();

  // Handle Discogs-style inverted names like "Schmidt, Anne-Sophie".
  const invertedNameMatch = cleaned.match(/^([^,]+),\s*([^,]+)$/);
  if (invertedNameMatch) {
    const lastName = String(invertedNameMatch[1] || '').trim();
    const firstName = String(invertedNameMatch[2] || '').trim();
    const lastNameTokenCount = lastName.split(/\s+/).filter(Boolean).length;
    const firstNameTokenCount = firstName.split(/\s+/).filter(Boolean).length;

    if (lastNameTokenCount === 1 && firstNameTokenCount >= 1 && firstNameTokenCount <= 3) {
      return `${firstName} ${lastName}`.trim();
    }
  }

  const splitBy = [' feat. ', ' ft. ', ' featuring ', ' with ', ';', ',', ' / ', ' & '];

  for (const separator of splitBy) {
    const idx = cleaned.toLowerCase().indexOf(separator.trim().toLowerCase());
    if (idx > 0) {
      const candidate = cleaned.slice(0, idx).trim();
      if (candidate) return candidate;
    }
  }

  return cleaned || null;
}

function normalizeDiscogsCreditRole(roleValue) {
  const raw = String(roleValue || '').trim();
  if (!raw) return 'Performer';

  const primary = raw
    .split(/[,;]+/)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)[0] || 'Performer';

  const normalized = primary
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = normalized.toLowerCase();
  if (lower.includes('compos')) return 'Composer';
  if (lower.includes('arrang')) return 'Arranger';
  if (lower.includes('conduct')) return 'Conductor';
  if (lower.includes('produc')) return 'Producer';
  if (lower.includes('featur')) return 'Featured Artist';
  // Prefer ensemble roles when Discogs role text contains mixed descriptors.
  if (lower.includes('orchestra')) return 'Orchestra';
  if (lower.includes('bass') && lower.includes('baritone')) return 'Bass-Baritone';
  if (lower.includes('mezzo') && lower.includes('soprano')) return 'Mezzo-Soprano';
  if (lower.includes('coloratura') && lower.includes('soprano')) return 'Coloratura Soprano';
  if (lower.includes('soprano')) return 'Soprano';
  if (lower.includes('mezzo')) return 'Mezzo-Soprano';
  if (lower.includes('contralto') || lower.includes('alto')) return 'Contralto';
  if (lower.includes('countertenor')) return 'Countertenor';
  if (lower.includes('tenor')) return 'Tenor';
  if (lower.includes('baritone')) return 'Baritone';
  if (lower.includes('bass')) return 'Bass';
  if (lower.includes('vocal') || lower.includes('soprano') || lower.includes('tenor') || lower.includes('baritone')) return 'Vocalist';

  return normalized.slice(0, 80) || 'Performer';
}

function splitDiscogsCreditNames(rawValue) {
  const input = String(rawValue || '').replace(/\r/g, '\n').trim();
  if (!input) return [];

  const semicolonSplit = input
    .split(/[;\n]+/)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  const results = [];
  for (const segment of semicolonSplit) {
    const slashSplit = segment
      .split(/\s+\/\s+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);

    for (const slashSegment of slashSplit) {
      const commaParts = slashSegment
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);

      const keepCommaJoinedName = (
        commaParts.length === 2
        && commaParts[0].split(/\s+/).filter(Boolean).length === 1
        && commaParts[1].split(/\s+/).filter(Boolean).length <= 2
      );

      // Split comma-delimited lists, but keep "Last, First"-style names intact.
      if (
        commaParts.length > 1
        && !keepCommaJoinedName
      ) {
        results.push(...commaParts);
      } else {
        results.push(slashSegment);
      }
    }
  }

  return [...new Set(results.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

function parseDiscogsRoleScopedCredits(rawValue) {
  const input = String(rawValue || '').replace(/\r/g, '\n').trim();
  if (!input || !input.includes(':')) {
    return [];
  }

  const scopedCredits = [];
  const pattern = /([^:\n]{2,80}):\s*([\s\S]*?)(?=(?:\n[^:\n]{2,80}:)|$)/g;
  let match = pattern.exec(input);
  while (match) {
    const roleLabel = String(match[1] || '').trim();
    const scopedArtists = splitDiscogsCreditNames(match[2] || '');
    if (roleLabel && scopedArtists.length > 0) {
      for (const artistName of scopedArtists) {
        scopedCredits.push({
          artistName,
          artistTypeName: normalizeDiscogsCreditRole(roleLabel),
        });
      }
    }

    match = pattern.exec(input);
  }

  return scopedCredits;
}

function isLikelyDiscogsRoleLabel(roleLabel) {
  const label = String(roleLabel || '').trim().toLowerCase();
  if (!label) return false;

  const roleHints = [
    'vocal', 'soprano', 'mezzo', 'alto', 'contralto', 'countertenor', 'tenor', 'baritone', 'bass',
    'compos', 'conduct', 'arrang', 'orchestra', 'chorus', 'choir', 'libretto', 'producer',
    'featured', 'performer', 'soloist', 'instrument', 'piano', 'violin', 'viola', 'cello',
    'flute', 'clarinet', 'oboe', 'horn', 'trumpet', 'trombone', 'tuba', 'organ', 'harp',
    'guitar', 'drum', 'percussion'
  ];

  return roleHints.some((hint) => label.includes(hint));
}

function shouldSkipDiscogsCreditRole(roleValue) {
  const role = String(roleValue || '').trim().toLowerCase();
  if (!role) return false;

  if (role.includes('engineer')) return true;
  if (role.includes('producer')) return true;
  if (role.includes('technician')) return true;
  if (role.includes('booklet') && role.includes('editor')) return true;
  if (role.includes('leader')) return true;
  if (role.includes('liner') && role.includes('notes')) return true;
  if (role.includes('photograph')) return true;
  if (role.includes('leader') && role.includes('orchestra')) return true;

  return false;
}

function mapDiscogsExtraArtistsToCredits(extraArtists) {
  const entries = Array.isArray(extraArtists) ? extraArtists : [];
  const deduped = new Map();

  for (const entry of entries) {
    const explicitArtistName = extractPrimaryDiscogsArtistName(entry?.anv || entry?.name);
    const rawRoleText = String(entry?.role || '').trim();
    const looksLikeScopedRoleBlock = rawRoleText.includes(':') && (/\n/.test(rawRoleText) || /;/.test(rawRoleText));

    const roleScopedFromRole = (!explicitArtistName && looksLikeScopedRoleBlock)
      ? parseDiscogsRoleScopedCredits(rawRoleText)
      : [];

    const filteredScopedCredits = roleScopedFromRole
      .filter((scopedCredit) => isLikelyDiscogsRoleLabel(scopedCredit?.artistTypeName));

    // Restrict scoped parsing to explicit role text. Parsing names as scoped role blocks
    // can misinterpret artist names that contain punctuation and produce bogus credits.
    const scopedCredits = [...filteredScopedCredits];
    if (scopedCredits.length > 0) {
      for (const scopedCredit of scopedCredits) {
        if (shouldSkipDiscogsCreditRole(scopedCredit.artistTypeName)) {
          continue;
        }

        const normalizedArtistName = extractPrimaryDiscogsArtistName(scopedCredit.artistName);
        if (!normalizedArtistName) {
          continue;
        }

        const normalizedRole = normalizeDiscogsCreditRole(scopedCredit.artistTypeName);
        const key = `${normalizeArtistNameForMatch(normalizedArtistName)}::${normalizedRole.toLowerCase()}`;
        if (!deduped.has(key)) {
          deduped.set(key, {
            artistName: normalizedArtistName,
            artistTypeName: normalizedRole,
          });
        }
      }
      continue;
    }

    const rawName = entry?.anv || entry?.name || null;
    const artistNames = splitDiscogsCreditNames(rawName);
    const fallbackArtistName = artistNames.length > 0
      ? null
      : extractPrimaryDiscogsArtistName(rawName);

    const normalizedArtistNames = artistNames
      .map((nameValue) => extractPrimaryDiscogsArtistName(nameValue))
      .filter(Boolean);

    if (fallbackArtistName) {
      normalizedArtistNames.push(fallbackArtistName);
    }

    if (normalizedArtistNames.length === 0) {
      continue;
    }

    const rawRoleValue = String(entry?.role || '').trim();
    const parsedRoles = rawRoleValue
      ? rawRoleValue.split(/[,;]+/).map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    const roles = parsedRoles
      .filter((value) => !shouldSkipDiscogsCreditRole(value))
      .map((value) => normalizeDiscogsCreditRole(value))
      .filter(Boolean);

    const roleList = parsedRoles.length > 0 ? roles : ['Performer'];
    if (roleList.length === 0) {
      continue;
    }

    for (const artistName of normalizedArtistNames) {
      for (const artistTypeName of roleList) {
        const key = `${normalizeArtistNameForMatch(artistName)}::${artistTypeName.toLowerCase()}`;
        if (!deduped.has(key)) {
          deduped.set(key, {
            artistName,
            artistTypeName,
          });
        }
      }
    }
  }

  return [...deduped.values()];
}

function scoreArtistNameSimilarity(leftName, rightName) {
  const left = normalizeArtistNameForMatch(leftName);
  const right = normalizeArtistNameForMatch(rightName);

  const hasEnsembleHint = (value) => {
    const normalizedValue = String(value || '').toLowerCase();
    return [
      'orchestra', 'orchestre', 'orchester', 'philharmonic', 'symphony', 'choir', 'chorus',
      'chorale', 'ensemble', 'consort', 'quartet', 'quintet', 'sextet', 'trio', 'duo',
      'band', 'players', 'collective', 'sinfonia', 'camerata'
    ].some((hint) => normalizedValue.includes(hint));
  };

  if (!left || !right) return 0;
  if (left === right) return 100;

  const leftIsEnsemble = hasEnsembleHint(leftName);
  const rightIsEnsemble = hasEnsembleHint(rightName);
  if ((left.includes(right) || right.includes(left)) && leftIsEnsemble === rightIsEnsemble) {
    return 90;
  }

  const leftSet = new Set(left.split(' ').filter(Boolean));
  const rightSet = new Set(right.split(' ').filter(Boolean));
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size || 1;
  return Math.round((intersection / union) * 100);
}

function findBestExistingArtistMatch(candidateName, existingArtists) {
  if (!candidateName || !Array.isArray(existingArtists) || existingArtists.length === 0) {
    return null;
  }

  let bestArtist = null;
  let bestScore = -1;

  for (const artist of existingArtists) {
    const score = scoreArtistNameSimilarity(candidateName, artist.title);
    if (score > bestScore) {
      bestScore = score;
      bestArtist = artist;
    }
  }

  if (bestScore < 85) {
    return null;
  }

  return bestArtist;
}

function tokenizeTrackTitleForMatch(value) {
  return normalizeTrackTitleForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreTrackTitleMatch(localTitle, discogsTitle) {
  const localNorm = normalizeTrackTitleForMatch(localTitle);
  const discogsNorm = normalizeTrackTitleForMatch(discogsTitle);

  if (!localNorm || !discogsNorm) return 0;
  if (localNorm === discogsNorm) return 100;

  let score = 0;
  if (localNorm.includes(discogsNorm) || discogsNorm.includes(localNorm)) {
    score += 60;
  }

  const localTokens = tokenizeTrackTitleForMatch(localTitle);
  const discogsTokens = tokenizeTrackTitleForMatch(discogsTitle);
  const localSet = new Set(localTokens);
  const discogsSet = new Set(discogsTokens);

  const intersection = [...localSet].filter((token) => discogsSet.has(token)).length;
  const union = new Set([...localSet, ...discogsSet]).size || 1;
  const jaccard = intersection / union;
  score += Math.round(jaccard * 60);

  return Math.min(score, 100);
}

function scoreTrackDurationMatch(localDurationMs, discogsDurationMs) {
  const localDuration = Number.isInteger(localDurationMs) ? localDurationMs : null;
  const discogsDuration = Number.isInteger(discogsDurationMs) ? discogsDurationMs : null;

  if (!localDuration || !discogsDuration) return 0;

  const diffSeconds = Math.abs(localDuration - discogsDuration) / 1000;
  if (diffSeconds <= 3) return 30;
  if (diffSeconds <= 8) return 24;
  if (diffSeconds <= 15) return 16;
  if (diffSeconds <= 30) return 8;
  if (diffSeconds <= 60) return 2;
  return -8;
}

async function attachDiscNumbersForAlbumDisplay(tracks) {
  const trackList = Array.isArray(tracks) ? tracks : [];
  if (trackList.length === 0) {
    return [];
  }

  const { parseFile } = await import('music-metadata');
  const enrichedTracks = [];

  for (const track of trackList) {
    const persistedPreferences = parseMetadataPreferencesObject(track?.metadataPreferences);
    const persistedDisc = parseInt(persistedPreferences?.__fileExtraction?.discNumber, 10);

    const position = extractLocalTrackDiscTrackNumbers(track);
    let discNumber = !Number.isNaN(persistedDisc)
      ? persistedDisc
      : (Number.isInteger(position.discNumber) ? position.discNumber : null);

    if (!discNumber) {
      try {
        let localPath = null;

        if (track?.file) {
          localPath = await resolveExistingMusicFilePath(track.file);
        }

        if (!localPath && track?.key) {
          const ensured = await ensureTrackFilePath(track);
          localPath = ensured?.localPath || null;
        }

        if (localPath) {
          const metadata = await parseFile(localPath, { duration: false });
          const discPosition = formatMetadataPosition(metadata?.common?.disk);
          const parsedDiscNumber = parseInt(discPosition?.no, 10);
          if (!Number.isNaN(parsedDiscNumber)) {
            discNumber = parsedDiscNumber;
          }
        }
      } catch {
        // Ignore metadata read failures for display-only enrichment.
      }
    }

    enrichedTracks.push({
      ...track,
      discNumber,
      trackNumber: Number.isInteger(position.trackNumber) ? position.trackNumber : null,
    });
  }

  // Backfill missing disc numbers from neighboring known values to keep UI consistent.
  const sorted = [...enrichedTracks].sort((left, right) => {
    const leftIndex = Number.isInteger(left?.index) ? left.index : Number.MAX_SAFE_INTEGER;
    const rightIndex = Number.isInteger(right?.index) ? right.index : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  for (let i = 0; i < sorted.length; i += 1) {
    if (Number.isInteger(sorted[i].discNumber)) {
      continue;
    }

    let previousDisc = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (Number.isInteger(sorted[j].discNumber)) {
        previousDisc = sorted[j].discNumber;
        break;
      }
    }

    let nextDisc = null;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (Number.isInteger(sorted[j].discNumber)) {
        nextDisc = sorted[j].discNumber;
        break;
      }
    }

    if (Number.isInteger(previousDisc)) {
      sorted[i].discNumber = previousDisc;
    } else if (Number.isInteger(nextDisc)) {
      sorted[i].discNumber = nextDisc;
    }
  }

  return enrichedTracks;
}

function extractLocalTrackDiscTrackNumbers(localTrack) {
  const persistedPreferences = parseMetadataPreferencesObject(localTrack?.metadataPreferences);
  const extractedDisc = parseInt(persistedPreferences?.__fileExtraction?.discNumber, 10);
  const extractedTrack = parseInt(persistedPreferences?.__fileExtraction?.trackNumber, 10);

  let trackNumber = !Number.isNaN(extractedTrack)
    ? extractedTrack
    : (Number.isInteger(localTrack?.index) ? localTrack.index : null);

  let discNumber = !Number.isNaN(extractedDisc)
    ? extractedDisc
    : (Number.isInteger(localTrack?.parentIndex) ? localTrack.parentIndex : null);

  return { discNumber, trackNumber };
}

function scoreTrackPositionFallback(localTrack, discogsTrack) {
  const localPosition = extractLocalTrackDiscTrackNumbers(localTrack);
  const discogsTrackNumber = Number.isInteger(discogsTrack?.discogsTrackIndex) ? discogsTrack.discogsTrackIndex : null;
  const discogsDiscNumber = Number.isInteger(discogsTrack?.discogsAlbumNumber) ? discogsTrack.discogsAlbumNumber : null;
  const localTrackNumber = Number.isInteger(localPosition.trackNumber) ? localPosition.trackNumber : null;
  const localDiscNumber = Number.isInteger(localPosition.discNumber) ? localPosition.discNumber : null;

  if (!discogsTrackNumber || !localTrackNumber) {
    return 0;
  }

  let score = 0;
  if (discogsTrackNumber === localTrackNumber) {
    score += (discogsDiscNumber && localDiscNumber) ? 26 : 22;

    if (discogsDiscNumber && localDiscNumber) {
      score += discogsDiscNumber === localDiscNumber ? 22 : -18;
    }

    return score;
  }

  const trackDiff = Math.abs(discogsTrackNumber - localTrackNumber);
  score -= Math.min(trackDiff * 6, 24);

  if (discogsDiscNumber && localDiscNumber) {
    score += discogsDiscNumber === localDiscNumber ? -6 : -18;
  }

  return score;
}

function buildDefaultDiscogsTrackMappings(localTracks, normalizedDiscogsTracks) {
  const candidates = [];

  normalizedDiscogsTracks.forEach((discogsTrack) => {
    localTracks.forEach((localTrack) => {
      const localPosition = extractLocalTrackDiscTrackNumbers(localTrack);
      const titleScore = scoreTrackTitleMatch(localTrack.title, discogsTrack.discogsTrackTitle);
      const durationScore = scoreTrackDurationMatch(localTrack.duration, discogsTrack.discogsTrackDurationMs);
      const positionScore = scoreTrackPositionFallback(localTrack, discogsTrack);
      const localTrackNumber = Number.isInteger(localPosition.trackNumber) ? localPosition.trackNumber : null;
      const positionPenalty = Number.isInteger(localTrackNumber)
        && Number.isInteger(discogsTrack.discogsTrackIndex)
        && localTrackNumber !== discogsTrack.discogsTrackIndex
        ? Math.min(Math.abs(localTrackNumber - discogsTrack.discogsTrackIndex), 8)
        : 0;

      const totalScore = titleScore + durationScore + positionScore - positionPenalty;
      candidates.push({
        discogsOrdinal: discogsTrack.discogsOrdinal,
        localTrackKey: localTrack.ratingKey,
        score: totalScore,
        titleScore,
        durationScore,
        positionScore,
      });
    });
  });

  candidates.sort((left, right) => right.score - left.score);

  const usedDiscogs = new Set();
  const usedLocal = new Set();
  const chosen = new Map();

  for (const candidate of candidates) {
    if (usedDiscogs.has(candidate.discogsOrdinal) || usedLocal.has(candidate.localTrackKey)) {
      continue;
    }

    const strongTitle = candidate.titleScore >= 45;
    const titleAndDuration = candidate.titleScore >= 25 && candidate.durationScore >= 8;
    const strongOverall = candidate.score >= 55;
    const strongPosition = candidate.positionScore >= 34;
    if (!strongTitle && !titleAndDuration && !strongOverall && !strongPosition) {
      continue;
    }

    usedDiscogs.add(candidate.discogsOrdinal);
    usedLocal.add(candidate.localTrackKey);
    chosen.set(candidate.discogsOrdinal, candidate.localTrackKey);
  }

  return normalizedDiscogsTracks.map((discogsTrack) => ({
    discogsOrdinal: discogsTrack.discogsOrdinal,
    localTrackKey: chosen.get(discogsTrack.discogsOrdinal) || null,
  }));
}

function parseDiscogsUrl(urlValue) {
  try {
    const parsed = new URL(String(urlValue || '').trim());
    const normalizedHost = parsed.hostname.toLowerCase();
    if (!normalizedHost.endsWith('discogs.com')) {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const typeIdx = segments.findIndex((entry) => {
      const value = entry.toLowerCase();
      return value === 'release' || value === 'releases' || value === 'master' || value === 'masters';
    });

    if (typeIdx < 0 || !segments[typeIdx + 1]) {
      return null;
    }

    const releaseSegment = segments[typeIdx + 1];
    const match = releaseSegment.match(/(\d+)/);
    const id = match?.[1] || null;
    if (!id) {
      return null;
    }

    const kindSegment = segments[typeIdx].toLowerCase();
    const kind = kindSegment.startsWith('master') ? 'master' : 'release';

    const normalizedPath = `/${kind}/${id}`;
    const normalizedUrl = `${parsed.protocol}//${parsed.host}${normalizedPath}`;

    return {
      id,
      kind,
      normalizedUrl,
      originalUrl: parsed.toString(),
    };
  } catch {
    return null;
  }
}

function normalizeDiscogsTrackPosition(position, fallbackIndex) {
  const parsed = parseDiscogsTrackPositionMetadata(position, fallbackIndex);
  return Number.isInteger(parsed.trackNumber) ? parsed.trackNumber : fallbackIndex;
}

function parseDiscogsTrackPositionMetadata(position, fallbackIndex) {
  const value = String(position || '').trim();
  if (!value) {
    return {
      rawPosition: null,
      albumNumber: null,
      trackNumber: Number.isInteger(fallbackIndex) ? fallbackIndex : 1,
      sequenceNumber: Number.isInteger(fallbackIndex) ? fallbackIndex : 1,
    };
  }

  const discTrackMatch = value.match(/^(?:(?:disc|cd|d)\s*)?(\d{1,2})\s*[-.:/]\s*(?:t\s*)?(\d{1,3})(?:[a-z])?$/i);
  if (discTrackMatch) {
    const disc = parseInt(discTrackMatch[1], 10);
    const track = parseInt(discTrackMatch[2], 10);
    return {
      rawPosition: value,
      albumNumber: Number.isNaN(disc) ? null : disc,
      trackNumber: Number.isNaN(track) ? null : track,
      sequenceNumber: (!Number.isNaN(disc) && !Number.isNaN(track)) ? ((disc * 1000) + track) : (Number.isInteger(fallbackIndex) ? fallbackIndex : 1),
    };
  }

  const sideTrackMatch = value.match(/^([A-Z])(\d{1,3})$/i);
  if (sideTrackMatch) {
    const sideLetter = sideTrackMatch[1].toUpperCase();
    const sideIndex = sideLetter.charCodeAt(0) - 64;
    const track = parseInt(sideTrackMatch[2], 10);
    const albumNumber = sideIndex > 0 ? Math.ceil(sideIndex / 2) : null;

    return {
      rawPosition: value,
      albumNumber,
      trackNumber: Number.isNaN(track) ? null : track,
      sequenceNumber: (albumNumber && !Number.isNaN(track)) ? ((albumNumber * 1000) + track) : (Number.isInteger(fallbackIndex) ? fallbackIndex : 1),
    };
  }

  const directNumeric = parseInt(value, 10);
  if (!Number.isNaN(directNumeric)) {
    return {
      rawPosition: value,
      albumNumber: null,
      trackNumber: directNumeric,
      sequenceNumber: directNumeric,
    };
  }

  // Handles values where only trailing numeric track number is present.
  const trailingNumeric = value.match(/(\d+)$/)?.[1];
  const parsedTrailing = trailingNumeric ? parseInt(trailingNumeric, 10) : NaN;
  if (!Number.isNaN(parsedTrailing)) {
    return {
      rawPosition: value,
      albumNumber: null,
      trackNumber: parsedTrailing,
      sequenceNumber: Number.isInteger(fallbackIndex) ? fallbackIndex : parsedTrailing,
    };
  }

  return {
    rawPosition: value,
    albumNumber: null,
    trackNumber: Number.isInteger(fallbackIndex) ? fallbackIndex : 1,
    sequenceNumber: Number.isInteger(fallbackIndex) ? fallbackIndex : 1,
  };
}

function extractWorkTitleFromTrackName(trackTitle) {
  const title = String(trackTitle || '').trim();
  if (!title) return null;

  const separators = [': ', ' - '];
  for (const separator of separators) {
    const idx = title.indexOf(separator);
    if (idx > 2) {
      const candidate = title.slice(0, idx).trim();
      if (candidate.length >= 3) {
        return candidate;
      }
    }
  }

  return null;
}

function normalizeWorkTitleForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreWorkTitleSimilarity(leftTitle, rightTitle) {
  const left = normalizeWorkTitleForMatch(leftTitle);
  const right = normalizeWorkTitleForMatch(rightTitle);

  if (!left || !right) return 0;
  if (left === right) return 100;

  let score = 0;
  if (left.includes(right) || right.includes(left)) {
    score += 55;
  }

  const leftTokens = left.split(' ').filter(Boolean);
  const rightTokens = right.split(' ').filter(Boolean);
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size || 1;
  score += Math.round((intersection / union) * 45);

  return Math.min(score, 100);
}

function findBestExistingWorkMatch(candidateTitle, existingWorks) {
  if (!candidateTitle || !Array.isArray(existingWorks) || existingWorks.length === 0) {
    return null;
  }

  let bestWork = null;
  let bestScore = -1;

  for (const work of existingWorks) {
    const similarity = scoreWorkTitleSimilarity(candidateTitle, work.title);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestWork = work;
    }
  }

  if (bestScore < 70) {
    return null;
  }

  return bestWork;
}

async function ensureRouteWorkPartRecord(workId, title, order) {
  const existing = await prisma.workPart.findFirst({
    where: {
      workId,
      title
    }
  });

  if (existing) {
    return prisma.workPart.update({
      where: { id: existing.id },
      data: {
        order: Number.isInteger(order) ? order : existing.order
      }
    });
  }

  return prisma.workPart.create({
    data: {
      workId,
      title,
      order: Number.isInteger(order) ? order : 1
    }
  });
}

function deriveDiscogsPartTitle(workTitleHint, discogsTrackTitle) {
  const fullTitle = String(discogsTrackTitle || '').trim();
  const workTitle = String(workTitleHint || '').trim();

  if (!workTitle || !fullTitle) {
    return fullTitle || workTitle || null;
  }

  const prefixPatterns = [
    `${workTitle}: `,
    `${workTitle} - `,
    `${workTitle} — `,
  ];

  const matchedPrefix = prefixPatterns.find((prefix) => fullTitle.startsWith(prefix));
  if (!matchedPrefix) {
    return fullTitle;
  }

  const stripped = fullTitle.slice(matchedPrefix.length).trim();
  return stripped || fullTitle;
}

function selectDiscogsReleaseFromJsonLd(jsonLdValue) {
  const candidates = Array.isArray(jsonLdValue) ? jsonLdValue : [jsonLdValue];
  return candidates.find((entry) => {
    const typeValue = entry?.['@type'];
    const typeList = Array.isArray(typeValue) ? typeValue : [typeValue];
    return typeList.some((type) => String(type || '').toLowerCase().includes('musicalbum'));
  }) || null;
}

async function fetchDiscogsApiJson(kind, id) {
  const endpoint = kind === 'master'
    ? `https://api.discogs.com/masters/${id}`
    : `https://api.discogs.com/releases/${id}`;

  const headers = {
    'User-Agent': 'EddieLifeManagement/1.0.0 (+https://github.com/eddie-life)',
    'Accept': 'application/json'
  };

  const discogsToken = String(process.env.DISCOGS_TOKEN || '').trim();
  if (discogsToken) {
    headers.Authorization = `Discogs token=${discogsToken}`;
  }

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw new Error(`Discogs API request failed (${response.status})`);
  }

  return response.json();
}

function flattenDiscogsTrackEntries(tracklist, parentTitle = null, parentCredits = []) {
  const rows = Array.isArray(tracklist) ? tracklist : [];
  const flattened = [];

  for (const row of rows) {
    const rowTitle = String(row?.title || '').trim();
    const rowType = String(row?.type_ || '').toLowerCase();
    const subTracks = Array.isArray(row?.sub_tracks) ? row.sub_tracks : [];
    const rowCredits = mapDiscogsExtraArtistsToCredits(row?.extraartists);
    const combinedCredits = [...parentCredits, ...rowCredits];

    if (subTracks.length > 0) {
      const nested = flattenDiscogsTrackEntries(subTracks, rowTitle || parentTitle || null, combinedCredits);
      flattened.push(...nested);
      continue;
    }

    // Skip structural rows that are not concrete tracks.
    if ((rowType === 'heading' || rowType === 'index') && !row?.position && !row?.duration) {
      continue;
    }

    if (!rowTitle) {
      continue;
    }

    flattened.push({
      title: parentTitle ? `${parentTitle}: ${rowTitle}` : rowTitle,
      position: row?.position || null,
      duration: row?.duration || null,
      credits: combinedCredits,
    });
  }

  return flattened;
}

function mapDiscogsApiTracklist(tracklist) {
  const flattened = flattenDiscogsTrackEntries(tracklist);

  return flattened
    .map((track, index) => {
      const positionMeta = parseDiscogsTrackPositionMetadata(track?.position, index + 1);
      return {
        title: String(track?.title || '').trim(),
        position: positionMeta.sequenceNumber,
        rawPosition: positionMeta.rawPosition,
        discNumber: positionMeta.albumNumber,
        trackNumber: positionMeta.trackNumber,
        durationMs: parseDurationToMilliseconds(track?.duration),
        rawDuration: track?.duration || null,
        credits: Array.isArray(track?.credits) ? track.credits : [],
      };
    })
    .filter((track) => track.title);
}

function mapDiscogsApiResourceToReleaseShape(resource, discogsTarget) {
  const title = String(resource?.title || '').trim() || null;
  const artistName = resource?.artists_sort
    || resource?.artists?.[0]?.name
    || null;
  const labelName = resource?.labels?.[0]?.name || null;

  const datePublished = resource?.released
    || (resource?.year ? String(resource.year) : null)
    || null;

  return {
    releaseId: discogsTarget.id,
    sourceKind: discogsTarget.kind,
    sourceUrl: discogsTarget.originalUrl,
    title,
    datePublished,
    byArtist: artistName ? String(artistName).trim() : null,
    label: labelName ? String(labelName).trim() : null,
    credits: mapDiscogsExtraArtistsToCredits(resource?.extraartists),
    tracks: mapDiscogsApiTracklist(resource?.tracklist),
  };
}

async function scrapeDiscogsReleaseFromUrl(discogsUrl) {
  const discogsTarget = parseDiscogsUrl(discogsUrl);
  if (!discogsTarget) {
    throw new Error('Invalid Discogs release URL');
  }

  const apiResource = await fetchDiscogsApiJson(discogsTarget.kind, discogsTarget.id);

  let resourceForMapping = apiResource;
  if (discogsTarget.kind === 'master' && apiResource?.main_release) {
    try {
      resourceForMapping = await fetchDiscogsApiJson('release', String(apiResource.main_release));
    } catch (releaseFetchError) {
      console.warn('Discogs main_release lookup failed, using master payload only:', releaseFetchError.message);
      resourceForMapping = apiResource;
    }
  }

  const mapped = mapDiscogsApiResourceToReleaseShape(resourceForMapping, discogsTarget);

  if (!mapped.title || mapped.tracks.length === 0) {
    throw new Error('Discogs API returned incomplete album metadata');
  }

  return mapped;
}

function mergeCollectionValues(primaryCollections, duplicateCollections) {
  const parseCollections = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const merged = [...new Set([...parseCollections(primaryCollections), ...parseCollections(duplicateCollections)])];
  return merged.length > 0 ? JSON.stringify(merged) : null;
}

function buildAlbumMergePatch(primaryAlbum, duplicateAlbum) {
  const patch = {};
  const copyIfMissing = (field) => {
    if ((primaryAlbum[field] === null || primaryAlbum[field] === undefined || primaryAlbum[field] === '')
      && duplicateAlbum[field] !== null
      && duplicateAlbum[field] !== undefined
      && duplicateAlbum[field] !== '') {
      patch[field] = duplicateAlbum[field];
      primaryAlbum[field] = duplicateAlbum[field];
    }
  };

  [
    'titleSort',
    'summary',
    'year',
    'thumb',
    'art',
    'parentThumb',
    'originallyAvailableAt',
    'musicBrainzReleaseDate',
    'musicBrainzCountry',
    'musicBrainzStatus',
    'musicBrainzPackaging',
    'musicBrainzLabel',
    'musicBrainzBarcode',
    'musicBrainzAsin',
    'albumArtist',
    'workId',
    'userTitle',
    'userReleaseDate',
    'userLabel',
    'metadataPreferences',
    'identificationStatus',
    'identificationConfidence',
    'lastIdentificationAttempt',
  ].forEach(copyIfMissing);

  const mergedCollections = mergeCollectionValues(primaryAlbum.collections, duplicateAlbum.collections);
  if (mergedCollections && mergedCollections !== primaryAlbum.collections) {
    patch.collections = mergedCollections;
    primaryAlbum.collections = mergedCollections;
  }

  return patch;
}

async function mergeDuplicateAlbumsForPrimaryAlbum(primaryAlbumRatingKey) {
  const primaryAlbum = await prisma.plexAlbum.findUnique({
    where: { ratingKey: primaryAlbumRatingKey },
  });

  if (!primaryAlbum?.musicBrainzId) {
    return [];
  }

  const duplicateWhere = {
    removed: false,
    musicBrainzId: primaryAlbum.musicBrainzId,
    ratingKey: { not: primaryAlbum.ratingKey },
  };

  if (primaryAlbum.parentRatingKey) {
    duplicateWhere.parentRatingKey = primaryAlbum.parentRatingKey;
  }

  if (primaryAlbum.librarySectionID) {
    duplicateWhere.librarySectionID = primaryAlbum.librarySectionID;
  }

  const duplicates = await prisma.plexAlbum.findMany({
    where: duplicateWhere,
    orderBy: [{ addedAt: 'asc' }, { id: 'asc' }],
  });

  if (duplicates.length === 0) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const mergedAlbums = [];
    const mutablePrimary = { ...primaryAlbum };

    for (const duplicateAlbum of duplicates) {
      const patch = buildAlbumMergePatch(mutablePrimary, duplicateAlbum);

      if (Object.keys(patch).length > 0) {
        await tx.plexAlbum.update({
          where: { ratingKey: primaryAlbum.ratingKey },
          data: patch,
        });
      }

      const trackUpdateData = { parentRatingKey: primaryAlbum.ratingKey };
      if (primaryAlbum.parentRatingKey) {
        trackUpdateData.grandparentRatingKey = primaryAlbum.parentRatingKey;
      }

      await tx.plexTrack.updateMany({
        where: { parentRatingKey: duplicateAlbum.ratingKey },
        data: trackUpdateData,
      });

      await tx.plexAlbum.delete({
        where: { ratingKey: duplicateAlbum.ratingKey },
      });

      mergedAlbums.push({
        ratingKey: duplicateAlbum.ratingKey,
        title: duplicateAlbum.title,
      });
    }

    return mergedAlbums;
  });
}

async function extractAlbumFileMetadataByRatingKey(ratingKey) {
  const { parseFile } = await import('music-metadata');

  const album = await plexDb.getAlbumByRatingKey(ratingKey);
  if (!album) {
    const notFoundError = new Error('Album not found');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  const tracks = await plexDb.getTracksByAlbum(ratingKey);
  console.log(`Processing ${tracks.length} tracks for album "${album.title}"`);

  let successCount = 0;
  let failedCount = 0;
  const results = [];
  const albumIdVotes = new Map();
  const unresolvedPathMappingEntries = [];
  const unresolvedPathMappingTrackKeys = new Set();

  const isLikelyPlexInternalPath = (value) => {
    return typeof value === 'string' && value.startsWith('/');
  };

  const addUnresolvedPathMappingEntry = (track, plexPathValue, localPathValue, reason) => {
    if (!track?.ratingKey || unresolvedPathMappingTrackKeys.has(track.ratingKey)) {
      return;
    }

    unresolvedPathMappingTrackKeys.add(track.ratingKey);
    unresolvedPathMappingEntries.push({
      ratingKey: track.ratingKey,
      title: track.title,
      plexPath: plexPathValue || null,
      mappedPath: localPathValue || null,
      reason,
    });
  };
  const albumMetadataState = {
    title: album.title || null,
    albumArtist: album.albumArtist || null,
    musicBrainzId: album.musicBrainzId || null,
    originallyAvailableAt: album.originallyAvailableAt || null,
    year: album.year || null,
    musicBrainzReleaseDate: album.musicBrainzReleaseDate || null,
    musicBrainzCountry: album.musicBrainzCountry || null,
    musicBrainzStatus: album.musicBrainzStatus || null,
    musicBrainzPackaging: album.musicBrainzPackaging || null,
    musicBrainzLabel: album.musicBrainzLabel || null,
    musicBrainzBarcode: album.musicBrainzBarcode || null,
    musicBrainzAsin: album.musicBrainzAsin || null,
    metadataPreferences: album.metadataPreferences || null,
  };

  const albumPreferences = parseMetadataPreferencesObject(album.metadataPreferences);

  for (const track of tracks) {
    const result = {
      ratingKey: track.ratingKey,
      title: track.title,
      index: track.index,
      trackNumber: null,
      trackTotal: null,
      discNumber: null,
      discTotal: null,
      filePath: track.file,
      plexPath: null,
      success: false,
      common: null,
      formatInfo: null,
      error: null,
    };

    let plexPath = track.file;

    if (!plexPath) {
      try {
        console.log(`Fetching track metadata from Plex: ${track.key}`);

        const trackData = await plexSync.makeRequest(track.key);
        const metadata = trackData?.MediaContainer?.Metadata?.[0];
        const mediaPart = metadata?.Media?.[0]?.Part?.[0];
        const stream = metadata?.Media?.[0]?.Part?.[0]?.Stream?.[0];

        console.log(`Track ${track.title} media info:`, mediaPart);

        if (mediaPart?.file) {
          plexPath = mediaPart.file;
          result.plexPath = plexPath;
          console.log(`Found Plex path: ${plexPath}`);

          const updateData = {
            file: mediaPart.file,
            duration: mediaPart.duration ? parseInt(mediaPart.duration, 10) : track.duration,
            size: mediaPart.size ? parseInt(mediaPart.size, 10) : track.size,
            container: mediaPart.container || track.container,
          };

          if (stream) {
            updateData.audioCodec = stream.codec || track.audioCodec;
            updateData.audioChannels = stream.channels ? parseInt(stream.channels, 10) : track.audioChannels;
            updateData.bitrate = stream.bitrate ? parseInt(stream.bitrate, 10) : track.bitrate;
          }

          await prisma.plexTrack.update({
            where: { ratingKey: track.ratingKey },
            data: updateData,
          });

          console.log(`Updated track ${track.title} with Plex metadata`);
        } else {
          console.log(`No file path in Plex response for ${track.title}`);
        }
      } catch (error) {
        console.error(`Error fetching file path from Plex for track ${track.title}:`, error.message);
      }
    } else {
      result.plexPath = plexPath;
    }

    const pathResolution = mapPlexPathToLocalDetailed(plexPath);
    const localPath = pathResolution.localPath;
    result.filePath = localPath;

    if (!localPath) {
      result.error = 'No file path available';
      if (isLikelyPlexInternalPath(plexPath)) {
        addUnresolvedPathMappingEntry(track, plexPath, localPath, 'No local path mapping available');
      }
      failedCount++;
      results.push(result);
      continue;
    }

    try {
      await fs.access(localPath);
      const metadata = await parseFile(localPath);

      result.formatInfo = {
        container: metadata.format.container,
        codec: metadata.format.codec,
        lossless: metadata.format.lossless,
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        numberOfChannels: metadata.format.numberOfChannels,
        bitsPerSample: metadata.format.bitsPerSample,
        size: track.size,
      };

      result.common = {
        title: metadata.common.title,
        artist: metadata.common.artist,
        artists: metadata.common.artists,
        album: metadata.common.album,
        albumartist: metadata.common.albumartist,
        year: metadata.common.year,
        date: metadata.common.date,
        originaldate: metadata.common.originaldate,
        originalyear: metadata.common.originalyear,
        track: metadata.common.track,
        disk: metadata.common.disk,
        genre: metadata.common.genre,
        comment: metadata.common.comment,
        composer: metadata.common.composer,
        label: metadata.common.label,
        isrc: metadata.common.isrc,
        barcode: metadata.common.barcode,
        catalognumber: metadata.common.catalognumber,
        language: metadata.common.language,
        mood: metadata.common.mood,
        bpm: metadata.common.bpm,
        key: metadata.common.key,
        rating: metadata.common.rating,
        compilation: metadata.common.compilation,
        gapless: metadata.common.gapless,
        copyright: metadata.common.copyright,
        license: metadata.common.license,
        encodedby: metadata.common.encodedby,
        encodersettings: metadata.common.encodersettings,
        releasetype: metadata.common.releasetype,
        releasestatus: metadata.common.releasestatus,
        releasecountry: metadata.common.releasecountry,
        musicbrainz_recordingid: metadata.common.musicbrainz_recordingid,
        musicbrainz_trackid: metadata.common.musicbrainz_trackid,
        musicbrainz_albumid: metadata.common.musicbrainz_albumid,
        musicbrainz_artistid: metadata.common.musicbrainz_artistid,
        musicbrainz_albumartistid: metadata.common.musicbrainz_albumartistid,
        musicbrainz_releasegroupid: metadata.common.musicbrainz_releasegroupid,
        musicbrainz_workid: metadata.common.musicbrainz_workid,
      };

      const trackPosition = formatMetadataPosition(metadata.common.track);
      const discPosition = formatMetadataPosition(metadata.common.disk);
      result.trackNumber = trackPosition.no;
      result.trackTotal = trackPosition.of;
      result.discNumber = discPosition.no;
      result.discTotal = discPosition.of;

      result.success = true;
      successCount++;

      console.log(`MusicBrainz IDs for ${track.title}:`, {
        recordingid: metadata.common.musicbrainz_recordingid,
        trackid: metadata.common.musicbrainz_trackid,
        albumid: metadata.common.musicbrainz_albumid,
      });

      const trackUpdates = {};
      const parsedTrackNumber = parseInt(trackPosition.no, 10);
      const parsedTrackTotal = parseInt(trackPosition.of, 10);
      const parsedDiscNumber = parseInt(discPosition.no, 10);
      const parsedDiscTotal = parseInt(discPosition.of, 10);

      if (trackPosition.no !== null && trackPosition.no !== undefined) {
        if (!Number.isNaN(parsedTrackNumber)) {
          trackUpdates.index = parsedTrackNumber;
        }
      }

      if (metadata.common.musicbrainz_recordingid) {
        const recordingId = Array.isArray(metadata.common.musicbrainz_recordingid)
          ? metadata.common.musicbrainz_recordingid[0]
          : metadata.common.musicbrainz_recordingid;
        if (recordingId) {
          trackUpdates.musicBrainzTrackId = recordingId;
        }
      }

      const trackPreferences = parseMetadataPreferencesObject(track.metadataPreferences);
      trackPreferences.__fileExtraction = {
        extractedAt: new Date().toISOString(),
        trackNumber: Number.isNaN(parsedTrackNumber) ? null : parsedTrackNumber,
        trackTotal: Number.isNaN(parsedTrackTotal) ? null : parsedTrackTotal,
        discNumber: Number.isNaN(parsedDiscNumber) ? null : parsedDiscNumber,
        discTotal: Number.isNaN(parsedDiscTotal) ? null : parsedDiscTotal,
        filePath: localPath,
        plexPath: plexPath || null,
        common: result.common,
        formatInfo: result.formatInfo,
      };
      trackUpdates.metadataPreferences = JSON.stringify(trackPreferences);

      if (Object.keys(trackUpdates).length > 0) {
        try {
          await prisma.plexTrack.update({
            where: { ratingKey: track.ratingKey },
            data: trackUpdates,
          });
          console.log(`✓ Updated track ${track.title} with MusicBrainz Recording ID: ${trackUpdates.musicBrainzTrackId}`);
        } catch (dbError) {
          console.error(`Error updating track ${track.title} with file metadata:`, dbError.message);
        }
      } else {
        console.log(`No MusicBrainz Recording ID found in file for ${track.title}`);
      }

      const extractedAlbumUpdates = buildAlbumExtractionUpdates(metadata.common);

      const extractedAlbumId = extractedAlbumUpdates.musicBrainzId;
      if (extractedAlbumId) {
        albumIdVotes.set(extractedAlbumId, (albumIdVotes.get(extractedAlbumId) || 0) + 1);
      }

      if (Object.keys(extractedAlbumUpdates).length > 0) {
        const albumPatch = {};

        for (const [key, value] of Object.entries(extractedAlbumUpdates)) {
          if (key === 'musicBrainzId') {
            continue;
          }

          if (value === null || value === undefined || value === '') {
            continue;
          }

          if (albumMetadataState[key] !== value) {
            albumPatch[key] = value;
          }
        }

        albumPreferences.__fileExtraction = {
          extractedAt: new Date().toISOString(),
          sourceTrackRatingKey: track.ratingKey,
          sourceTrackTitle: track.title,
          extractedAlbumUpdates,
          common: result.common,
        };
        const nextAlbumMetadataPreferences = JSON.stringify(albumPreferences);
        if (albumMetadataState.metadataPreferences !== nextAlbumMetadataPreferences) {
          albumPatch.metadataPreferences = nextAlbumMetadataPreferences;
        }

        if (Object.keys(albumPatch).length > 0) {
          try {
            await prisma.plexAlbum.update({
              where: { ratingKey },
              data: albumPatch,
            });

            Object.assign(albumMetadataState, albumPatch);
            console.log(`✓ Updated album ${album.title} with extracted metadata:`, albumPatch);
          } catch (dbError) {
            console.error('Error updating album with extracted metadata:', dbError.message);
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting metadata for track ${track.title}:`, error.message);
      result.error = error.message;
      if (!pathResolution.mappingMatched && isLikelyPlexInternalPath(plexPath)) {
        addUnresolvedPathMappingEntry(track, plexPath, localPath, error.message || 'Mapped path could not be accessed');
      }
      failedCount++;
    }

    results.push(result);
  }

  if (albumIdVotes.size > 0) {
    const sortedAlbumIdVotes = [...albumIdVotes.entries()].sort((left, right) => right[1] - left[1]);
    const [bestAlbumId, bestAlbumIdCount] = sortedAlbumIdVotes[0];
    const totalAlbumIdVotes = sortedAlbumIdVotes.reduce((total, [, count]) => total + count, 0);
    const currentAlbumId = albumMetadataState.musicBrainzId;
    const currentAlbumIdCount = currentAlbumId ? (albumIdVotes.get(currentAlbumId) || 0) : 0;

    const hasMajority = totalAlbumIdVotes === 1 || (bestAlbumIdCount / totalAlbumIdVotes) > 0.5;
    const shouldUpdateAlbumId = hasMajority && (
      !currentAlbumId
      || currentAlbumId === bestAlbumId
      || bestAlbumIdCount > currentAlbumIdCount
    );

    if (shouldUpdateAlbumId && currentAlbumId !== bestAlbumId) {
      try {
        await prisma.plexAlbum.update({
          where: { ratingKey },
          data: { musicBrainzId: bestAlbumId },
        });

        albumMetadataState.musicBrainzId = bestAlbumId;
        console.log(`✓ Updated album ${album.title} with voted MusicBrainz album ID: ${bestAlbumId} (${bestAlbumIdCount}/${totalAlbumIdVotes})`);
      } catch (dbError) {
        console.error('Error updating album with voted MusicBrainz album ID:', dbError.message);
      }
    }
  }

  const mergedAlbums = await mergeDuplicateAlbumsForPrimaryAlbum(ratingKey);

  return {
    albumTitle: album.title,
    albumRatingKey: ratingKey,
    tracksProcessed: tracks.length,
    successCount,
    errorCount: failedCount,
    unresolvedPathMappingsCount: unresolvedPathMappingEntries.length,
    unresolvedPathMappings: unresolvedPathMappingEntries,
    extractedMetadata: results,
    mergedAlbums,
  };
}

async function buildPicardTagPayload({ entityType, entityKey, entityTitle, tracks }) {
  const extractedTracks = [];
  const errors = [];

  for (const track of tracks) {
    try {
      extractedTracks.push(await extractTrackPicardTags(track));
    } catch (error) {
      errors.push({
        ratingKey: track.ratingKey,
        title: track.title,
        error: error.message,
      });
    }
  }

  const aggregated = aggregatePicardResults(extractedTracks);

  return {
    entityType,
    entityKey,
    entityTitle,
    summary: {
      tracksScanned: tracks.length,
      tracksParsed: extractedTracks.length,
      tracksFailed: errors.length,
    },
    sections: aggregated.sections,
    rawTags: aggregated.rawTags,
    perTrack: entityType === 'track' ? extractedTracks : [],
    errors,
  };
}

// Helper function to get tracks filtered by unplayed albums/artists/works
// sectionKey: the Plex sectionKey string (e.g. "6"), or null for all sections
async function getUnplayedFilteredTracks(sectionKey, unplayedAlbums, unplayedArtists, unplayedWorks) {
  const allTracks = await prisma.plexTrack.findMany({
    where: sectionKey ? { 
      librarySection: { sectionKey: sectionKey },
      removed: false,
      OR: [
        { userRating: null },
        { userRating: { gte: 5 } }
      ]
    } : { 
      removed: false,
      OR: [
        { userRating: null },
        { userRating: { gte: 5 } }
      ]
    },
    include: {
      album: {
        include: {
          artist: true
        }
      },
      workPartTracks: {
        include: {
          workPart: {
            include: {
              work: true
            }
          }
        }
      }
    }
  });

  let filteredTracks = allTracks;

  if (unplayedAlbums) {
    // Group by album and check if ALL tracks in album are unplayed
    const albumTracks = {};
    for (const track of allTracks) {
      const albumKey = track.parentRatingKey || 'unknown';
      if (!albumTracks[albumKey]) {
        albumTracks[albumKey] = [];
      }
      albumTracks[albumKey].push(track);
    }
    // An album is unplayed only if ALL its tracks have viewCount null or 0
    const unplayedAlbumKeys = Object.keys(albumTracks).filter(key => 
      albumTracks[key].every(t => !t.viewCount || t.viewCount === 0)
    );
    filteredTracks = filteredTracks.filter(t => unplayedAlbumKeys.includes(t.parentRatingKey || 'unknown'));
  }

  if (unplayedArtists) {
    // Fetch ALL tracks for the section (no rating filter) to correctly determine play history.
    // The pre-filtered allTracks excludes low-rated played tracks, which would make a
    // played artist appear unplayed if those tracks were their only played ones.
    const allTracksForArtistCheck = await prisma.plexTrack.findMany({
      where: sectionKey
        ? { librarySection: { sectionKey: sectionKey }, removed: false }
        : { removed: false },
      select: { grandparentRatingKey: true, viewCount: true }
    });

    // Build a set of artist keys that have ANY played track in their entire catalog
    const playedArtistKeys = new Set();
    for (const track of allTracksForArtistCheck) {
      if (track.viewCount && track.viewCount > 0) {
        playedArtistKeys.add(track.grandparentRatingKey || 'unknown');
      }
    }

    filteredTracks = filteredTracks.filter(t => !playedArtistKeys.has(t.grandparentRatingKey || 'unknown'));
  }

  if (unplayedWorks) {
    // Group by work and check if ALL tracks in work are unplayed
    const workTracks = {};
    for (const track of allTracks) {
      if (track.workPartTracks && track.workPartTracks.length > 0) {
        for (const wpt of track.workPartTracks) {
          const workId = wpt.workPart?.work?.id || 'unknown';
          if (!workTracks[workId]) {
            workTracks[workId] = [];
          }
          workTracks[workId].push(track);
        }
      }
    }
    // A work is unplayed only if ALL its tracks have viewCount null or 0
    const unplayedWorkIds = Object.keys(workTracks).filter(key => 
      workTracks[key].every(t => !t.viewCount || t.viewCount === 0)
    );
    filteredTracks = filteredTracks.filter(t => {
      if (!t.workPartTracks || t.workPartTracks.length === 0) return false;
      return t.workPartTracks.some(wpt => unplayedWorkIds.includes(String(wpt.workPart?.work?.id || 'unknown')));
    });
  }

  return filteredTracks;
}

// Helper function to expand tracks to include complete works
async function expandToCompleteWorks(tracks) {
  const expandedTracks = [];
  const processedTrackIds = new Set();

  for (const track of tracks) {
    if (processedTrackIds.has(track.ratingKey)) {
      continue; // Skip if already processed
    }

    // Check if this track is part of a work
    if (track.workPartTracks && track.workPartTracks.length > 0) {
      // Get the work and album
      const workPart = track.workPartTracks[0].workPart;
      const workId = workPart?.work?.id;
      const albumRatingKey = track.parentRatingKey;

      if (workId && albumRatingKey) {
        // Find ALL tracks from the same work on the same album (including those before the randomly selected one)
        const workTracks = await prisma.plexTrack.findMany({
          where: {
            parentRatingKey: albumRatingKey,
            removed: false,
            workPartTracks: {
              some: {
                workPart: {
                  workId: workId
                }
              }
            }
          },
          include: {
            album: {
              include: {
                artist: true
              }
            },
            workPartTracks: {
              include: {
                workPart: {
                  include: {
                    work: true
                  }
                }
              }
            }
          },
          orderBy: {
            index: 'asc' // Sort by track index (track number on album) to play work from beginning
          }
        });

        console.log(`Play Complete Work: Found ${workTracks.length} tracks for work ${workId} (originally selected track at index ${track.index})`);

        // Add ALL work tracks in order (from Movement I, not from the randomly selected movement)
        for (const workTrack of workTracks) {
          if (!processedTrackIds.has(workTrack.ratingKey)) {
            expandedTracks.push(workTrack);
            processedTrackIds.add(workTrack.ratingKey);
          }
        }
      } else {
        // No work info, add the single track
        expandedTracks.push(track);
        processedTrackIds.add(track.ratingKey);
      }
    } else {
      // Track not part of a work, add it as-is
      expandedTracks.push(track);
      processedTrackIds.add(track.ratingKey);
    }
  }

  return expandedTracks;
}

// Music Sections
router.get('/sections', asyncHandler(async (req, res) => {
  const sections = await prisma.plexLibrarySection.findMany({
    where: { type: 'artist' },
    orderBy: { title: 'asc' }
  });
  res.json(sections);
}));

// Music Stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await plexDb.getMusicStats();
  res.json(stats);
}));

// Music Collections
router.get('/collections', asyncHandler(async (req, res) => {
  const { section } = req.query;
  
  let artistCollections, albumCollections;
  
  if (section && section !== 'all') {
    // Filter collections by section
    artistCollections = await plexDb.getAllMusicArtistCollectionsBySection(section);
    albumCollections = await plexDb.getAllMusicAlbumCollectionsBySection(section);
  } else {
    // Get all collections
    artistCollections = await plexDb.getAllMusicArtistCollections();
    albumCollections = await plexDb.getAllMusicAlbumCollections();
  }
  
  // Combine and deduplicate collections
  const allCollections = [...new Set([...artistCollections, ...albumCollections])];
  
  // Format for response
  const formattedCollections = allCollections
    .sort()
    .map(collection => ({
      value: collection,
      label: collection,
      type: 'music'
    }));
  
  res.json(formattedCollections);
}));

// Plex Music Playlists
router.get('/playlists', asyncHandler(async (req, res) => {
  const playlists = await prisma.plexPlaylist.findMany({
    where: { playlistType: 'audio' },
    orderBy: { title: 'asc' }
  });
  res.json(playlists);
}));

// Custom Music Playlists - List
router.get('/custom-playlists', asyncHandler(async (req, res) => {
  const playlists = await prisma.customPlaylist.findMany({
    include: {
      tracks: {
        orderBy: { sortOrder: 'asc' }
      },
      _count: {
        select: { tracks: true }
      }
    },
    orderBy: { title: 'asc' }
  });
  
  res.json(playlists.map(playlist => ({
    ...playlist,
    trackCount: playlist._count.tracks
  })));
}));

// Custom Music Playlists - Create
router.post('/custom-playlists', validateRequiredFields('title', 'Playlist title is required'), asyncHandler(async (req, res) => {
  const { title, description, isPublic } = req.body;
  
  if (title.trim() === '') {
    return sendBadRequest(res, 'Playlist title is required');
  }
  
  const playlist = await prisma.customPlaylist.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      isPublic: isPublic || false,
      createdBy: 'User' // TODO: Use actual user context
    },
    include: {
      _count: {
        select: { tracks: true }
      }
    }
  });
  
  res.status(201).json({
    ...playlist,
    trackCount: playlist._count.tracks
  });
}));

// Custom Music Playlists - Delete
router.delete('/custom-playlists/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await prisma.customPlaylist.delete({
    where: { id: parseInt(id) }
  });
  
  res.json({ message: 'Custom playlist deleted successfully' });
}));

// Add Track to Custom Playlist
router.post('/custom-playlists/:id/tracks', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trackRatingKey, title, artist, album, duration } = req.body;
  
  if (!trackRatingKey) {
    return res.status(400).json({ error: 'trackRatingKey is required' });
  }
  
  // Check if track exists
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: trackRatingKey }
  });
  
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }
  
  // Check if track is already in the playlist
  const existingTrack = await prisma.customPlaylistTrack.findFirst({
    where: {
      playlistId: parseInt(id),
      ratingKey: trackRatingKey
    }
  });
  
  if (existingTrack) {
    return res.status(409).json({ error: 'Track already exists in this playlist' });
  }
  
  // Get the current highest sort order
  const maxSortOrder = await prisma.customPlaylistTrack.aggregate({
    where: { playlistId: parseInt(id) },
    _max: { sortOrder: true }
  });
  
  const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1;
  
  const playlistTrack = await prisma.customPlaylistTrack.create({
    data: {
      playlistId: parseInt(id),
      ratingKey: trackRatingKey,
      title: title,
      artist: artist,
      album: album,
      duration: duration,
      sortOrder: nextSortOrder
    }
  });
  
  res.status(201).json(playlistTrack);
}));

// Remove Track from Custom Playlist
router.delete('/custom-playlists/:id/tracks/:trackId', asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  
  await prisma.customPlaylistTrack.delete({
    where: { id: parseInt(trackId) }
  });
  
  res.json({ message: 'Track removed from playlist successfully' });
}));

// Music Artists - All
router.get('/artists', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, artistTypeId } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    // For search, get all matching artists
    let artists = await plexDb.searchArtists(search);
    
    // Add play counts for each artist
    artists = await Promise.all(artists.map(async (artist) => {
      const playCount = await prisma.plexTrack.aggregate({
        where: { grandparentRatingKey: artist.ratingKey },
        _sum: { viewCount: true }
      });
      return {
        ...artist,
        totalPlayCount: playCount._sum.viewCount || 0
      };
    }));
    
    // If artistTypeId is provided, sort artists that have this type to the top
    if (artistTypeId) {
      const typeId = parseInt(artistTypeId);
      
      // Get artists that have this type assigned
      const artistsWithType = await prisma.artistTypeAssignment.findMany({
        where: { artistTypeId: typeId },
        select: { artistKey: true }
      });
      
      const artistKeysWithType = new Set(artistsWithType.map(a => a.artistKey));
      
      // Sort: artists with the type first, then others
      artists = artists.sort((a, b) => {
        const aHasType = artistKeysWithType.has(a.ratingKey);
        const bHasType = artistKeysWithType.has(b.ratingKey);
        
        if (aHasType && !bHasType) return -1;
        if (!aHasType && bHasType) return 1;
        return 0;
      });
    }
    
    res.json(artists);
  } else {
    // For regular requests, use pagination
    const artists = await plexDb.getAllArtists(parseInt(limit), offset);
    
    // Add play counts
    const artistsWithCounts = await Promise.all(artists.map(async (artist) => {
      const playCount = await prisma.plexTrack.aggregate({
        where: { grandparentRatingKey: artist.ratingKey },
        _sum: { viewCount: true }
      });
      return {
        ...artist,
        totalPlayCount: playCount._sum.viewCount || 0
      };
    }));
    
    const totalArtists = await plexDb.getArtistsCount();
    
    res.json({
      artists: artistsWithCounts,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalArtists / limit),
      totalArtists
    });
  }
}));

// Music Artists - By Section
router.get('/artists/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  console.log(`Artists requested for section: ${sectionKey}, page: ${pageNum}, limit: ${limitNum}, search: ${search}`);

  let artists;
  let total;

  if (search) {
    artists = await plexDb.searchArtistsBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.searchArtistsBySectionCount(sectionKey, search);
  } else {
    artists = await plexDb.getArtistsBySection(sectionKey, limitNum, offset);
    total = await plexDb.getArtistsBySectionCount(sectionKey);
  }

  console.log(`Returning ${artists.length} artists for section ${sectionKey}, total: ${total}`);

  res.json({
    artists,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalArtists: total
  });
}));

// Music Artists - Single Artist
router.get('/artists/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  
  const artist = await plexDb.getArtistByRatingKey(ratingKey);
  if (!artist) {
    return res.status(404).json({ error: 'Artist not found' });
  }

  const linkedAlbumAssignments = await prisma.albumArtist.findMany({
    where: { artistKey: artist.ratingKey },
    include: {
      artistType: true,
      album: {
        include: {
          artist: true
        }
      }
    },
    orderBy: [
      { album: { title: 'asc' } },
      { artistType: { name: 'asc' } }
    ]
  });

  const linkedTrackAssignments = await prisma.trackArtist.findMany({
    where: { artistKey: artist.ratingKey },
    include: {
      artistType: true,
      track: {
        include: {
          work: true,
          album: {
            include: {
              artist: true
            }
          },
          workPartTracks: {
            include: {
              workPart: {
                include: {
                  work: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [
      { track: { title: 'asc' } },
      { artistType: { name: 'asc' } }
    ]
  });

  const linkedAlbumMap = new Map();
  for (const assignment of linkedAlbumAssignments) {
    if (!assignment.album) {
      continue;
    }

    const existing = linkedAlbumMap.get(assignment.album.ratingKey) || {
      ...assignment.album,
      linkedArtistTypes: []
    };

    if (!existing.linkedArtistTypes.includes(assignment.artistType.name)) {
      existing.linkedArtistTypes.push(assignment.artistType.name);
    }

    linkedAlbumMap.set(assignment.album.ratingKey, existing);
  }

  const linkedTrackMap = new Map();
  for (const assignment of linkedTrackAssignments) {
    if (!assignment.track) {
      continue;
    }

    const existing = linkedTrackMap.get(assignment.track.ratingKey) || {
      ...assignment.track,
      linkedArtistTypes: []
    };

    if (!existing.linkedArtistTypes.includes(assignment.artistType.name)) {
      existing.linkedArtistTypes.push(assignment.artistType.name);
    }

    linkedTrackMap.set(assignment.track.ratingKey, existing);

    if (assignment.track.album) {
      const existingAlbum = linkedAlbumMap.get(assignment.track.album.ratingKey) || {
        ...assignment.track.album,
        linkedArtistTypes: []
      };

      const linkedArtistTypeName = assignment.artistType?.name || null;
      if (linkedArtistTypeName && !existingAlbum.linkedArtistTypes.includes(linkedArtistTypeName)) {
        existingAlbum.linkedArtistTypes.push(linkedArtistTypeName);
      }

      linkedAlbumMap.set(assignment.track.album.ratingKey, existingAlbum);
    }
  }

  const workMap = new Map();

  const upsertWorkSummary = (work, linkedArtistTypeName = null) => {
    if (!work) {
      return;
    }

    const existing = workMap.get(work.id) || {
      id: work.id,
      title: work.title,
      composerKey: work.composerKey,
      linkedArtistTypes: [],
      partsCount: 0,
      tracksCount: 0,
      totalPlayCount: 0,
    };

    if (linkedArtistTypeName && !existing.linkedArtistTypes.includes(linkedArtistTypeName)) {
      existing.linkedArtistTypes.push(linkedArtistTypeName);
    }

    workMap.set(work.id, existing);
  };

  const works = await prisma.work.findMany({
    where: {
      OR: [
        { composerKey: artist.ratingKey },
        {
          parts: {
            some: {
              tracks: {
                some: {
                  track: {
                    trackArtists: {
                      some: {
                        artistKey: artist.ratingKey
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    include: {
      parts: {
        include: {
          tracks: {
            include: {
              track: {
                select: {
                  viewCount: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      title: 'asc'
    }
  });

  for (const work of works) {
    const partsCount = work.parts.length;
    const tracksCount = work.parts.reduce((sum, part) => sum + (part.tracks?.length || 0), 0);
    const totalPlayCount = work.parts.reduce((workSum, part) => {
      return workSum + part.tracks.reduce((partSum, trackRel) => partSum + (trackRel.track?.viewCount || 0), 0);
    }, 0);

    const linkedArtistTypes = [];
    if (work.composerKey === artist.ratingKey) {
      linkedArtistTypes.push('Composer');
    }

    workMap.set(work.id, {
      id: work.id,
      title: work.title,
      composerKey: work.composerKey,
      linkedArtistTypes,
      partsCount,
      tracksCount,
      totalPlayCount,
    });
  }

  for (const assignment of linkedTrackAssignments) {
    const directWork = assignment.track?.work || null;
    if (directWork) {
      upsertWorkSummary(directWork, assignment.artistType?.name || null);
    }

    for (const relation of assignment.track?.workPartTracks || []) {
      upsertWorkSummary(relation.workPart?.work || null, assignment.artistType?.name || null);
    }
  }

  artist.linkedAlbums = [...linkedAlbumMap.values()]
    .sort((left, right) => (left.title || '').localeCompare(right.title || ''));
  artist.linkedTracks = [...linkedTrackMap.values()]
    .sort((left, right) => {
      const leftTitle = left.title || '';
      const rightTitle = right.title || '';
      if (leftTitle !== rightTitle) {
        return leftTitle.localeCompare(rightTitle);
      }

      const leftIndex = Number.isInteger(left.index) ? left.index : Number.MAX_SAFE_INTEGER;
      const rightIndex = Number.isInteger(right.index) ? right.index : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });

  artist.tracksWithoutAlbum = await prisma.plexTrack.findMany({
    where: {
      grandparentRatingKey: artist.ratingKey,
      removed: false,
      OR: [
        { parentRatingKey: null },
        { parentRatingKey: '' }
      ]
    },
    include: {
      work: true
    },
    orderBy: [
      { title: 'asc' },
      { index: 'asc' }
    ]
  });

  artist.works = [...workMap.values()]
    .sort((left, right) => (left.title || '').localeCompare(right.title || ''));
  
  // Add totalPlayCount for the artist
  const playCount = await prisma.plexTrack.aggregate({
    where: { grandparentRatingKey: artist.ratingKey },
    _sum: { viewCount: true }
  });
  artist.totalPlayCount = playCount._sum.viewCount || 0;
  
  res.json(artist);
}));

// Update Artist - Name and Sort Name
router.put('/artists/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { title, titleSort } = req.body;

  validateRequiredFields(req.body, ['title']);

  // Get Plex server settings
  const settings = await plexDb.getPlexSettings();
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return sendBadRequest(res, 'Plex settings not configured');
  }

  try {
    // Update in Plex first
    const plexUrl = `${settings.plexUrl}/library/metadata/${ratingKey}?type=8&title.value=${encodeURIComponent(title)}&titleSort.value=${encodeURIComponent(titleSort || title)}&X-Plex-Token=${settings.plexToken}`;
    
    const plexResponse = await fetch(plexUrl, {
      method: 'PUT'
    });

    if (!plexResponse.ok) {
      throw new Error(`Plex update failed: ${plexResponse.status} ${plexResponse.statusText}`);
    }

    // Update in local database
    const updatedArtist = await plexDb.prisma.plexArtist.update({
      where: { ratingKey },
      data: {
        title,
        titleSort: titleSort || title
      }
    });

    sendSuccess(res, { artist: updatedArtist, message: 'Artist updated successfully' });
  } catch (error) {
    console.error('Error updating artist:', error);
    sendServerError(res, `Failed to update artist: ${error.message}`);
  }
}));

// Delete Artist - soft delete by hiding the artist from app views
router.delete('/artists/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const existingArtist = await plexDb.prisma.plexArtist.findUnique({
    where: { ratingKey }
  });

  if (!existingArtist) {
    return sendBadRequest(res, 'Artist not found');
  }

  const deletedArtist = await plexDb.prisma.plexArtist.update({
    where: { ratingKey },
    data: {
      removed: true,
    }
  });

  sendSuccess(res, {
    artist: deletedArtist,
    message: 'Artist deleted successfully'
  });
}));

// Update artist with MusicBrainz metadata
router.put('/artists/:ratingKey/musicbrainz', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { 
    name, 
    sortName, 
    disambiguation, 
    country, 
    lifeSpan, 
    aliases, 
    relations, 
    musicBrainzId 
  } = req.body;

  validateRequiredFields(req.body, ['name', 'musicBrainzId']);

  const normalizedName = getPreferredMusicBrainzArtistName({
    name,
    'sort-name': sortName || null,
    aliases: Array.isArray(aliases) ? aliases : []
  }) || name;

  // Prepare the update data
  const updateData = {
    title: normalizedName,
    titleSort: sortName || normalizedName,
    summary: disambiguation || null,
    musicBrainzId,
    musicBrainzCountry: country || null,
    musicBrainzBeginDate: lifeSpan?.begin || null,
    musicBrainzEndDate: lifeSpan?.end || null,
    musicBrainzEnded: lifeSpan?.ended || false,
    musicBrainzAliases: aliases ? JSON.stringify(aliases) : null,
    musicBrainzLinks: relations ? JSON.stringify(relations) : null
  };

  // Update in local database
  const updatedArtist = await prisma.plexArtist.update({
    where: { ratingKey },
    data: updateData
  });

  sendSuccess(res, { 
    artist: updatedArtist, 
    message: 'Artist updated with MusicBrainz metadata' 
  });
}));

// Update album with MusicBrainz metadata
router.put('/albums/:ratingKey/musicbrainz', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const {
    title,
    date,
    country,
    status,
    packaging,
    barcode,
    asin,
    label,
    musicBrainzId
  } = req.body;

  validateRequiredFields(req.body, ['title', 'musicBrainzId']);

  // Prepare the update data
  const updateData = {
    title,
    musicBrainzId,
    musicBrainzReleaseDate: date || null,
    musicBrainzCountry: country || null,
    musicBrainzStatus: status || null,
    musicBrainzPackaging: packaging || null,
    musicBrainzBarcode: barcode || null,
    musicBrainzAsin: asin || null,
    musicBrainzLabel: label || null
  };

  // Update in local database
  const updatedAlbum = await prisma.plexAlbum.update({
    where: { ratingKey },
    data: updateData
  });

  sendSuccess(res, {
    album: updatedAlbum,
    message: 'Album updated with MusicBrainz metadata'
  });
}));

// Import album/track/work metadata from a Discogs release URL
router.post('/albums/:ratingKey/discogs-import', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const {
    url,
    apply: applyRequested = false,
    trackMappings: requestedTrackMappings = [],
    excludedCreditKeys: requestedExcludedCreditKeys = [],
  } = req.body;

  validateRequiredFields(req.body, ['url']);

  const album = await prisma.plexAlbum.findUnique({
    where: { ratingKey },
    include: {
      artist: true,
      tracks: {
        where: {
          removed: false
        },
        orderBy: [
          { index: 'asc' },
          { ratingKey: 'asc' }
        ]
      }
    }
  });

  if (!album) {
    return sendBadRequest(res, 'Album not found');
  }

  const discogsRelease = await scrapeDiscogsReleaseFromUrl(url);
  if (!discogsRelease.tracks.length) {
    return sendBadRequest(res, 'Discogs release contains no track list');
  }

  const shouldApply = applyRequested === true;
  const excludedCreditKeys = new Set(
    (Array.isArray(requestedExcludedCreditKeys) ? requestedExcludedCreditKeys : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  );

  const releaseDate = discogsRelease.datePublished ? new Date(discogsRelease.datePublished) : null;
  const validReleaseDate = releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate : null;

  const albumPatch = {
    title: discogsRelease.title || album.title,
    musicBrainzLabel: discogsRelease.label || album.musicBrainzLabel || null,
    originallyAvailableAt: validReleaseDate || album.originallyAvailableAt || null,
    year: validReleaseDate ? validReleaseDate.getUTCFullYear() : album.year,
  };

  const discogsArtistName = extractPrimaryDiscogsArtistName(discogsRelease.byArtist);
  const existingArtists = await prisma.plexArtist.findMany({
    where: { removed: false },
    select: {
      ratingKey: true,
      title: true,
    }
  });

  const artistLookupByNormalizedName = new Map(
    existingArtists.map((entry) => [normalizeArtistNameForMatch(entry.title), entry])
  );

  const createdArtistKeys = new Set();
  const matchedExistingArtistKeys = new Set();

  const resolveOrCreateDiscogsArtist = async (candidateName) => {
    const normalizedCandidate = normalizeArtistNameForMatch(candidateName);
    if (!normalizedCandidate) return null;

    let artist = artistLookupByNormalizedName.get(normalizedCandidate) || null;
    let created = false;
    let matchedExisting = false;

    if (!artist) {
      artist = findBestExistingArtistMatch(candidateName, existingArtists);
      if (artist) {
        matchedExisting = true;
      }
    } else {
      matchedExisting = true;
    }

    if (!artist && shouldApply) {
      const artistRatingKey = `discogs_artist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const artistKey = `/library/metadata/${artistRatingKey}`;

      artist = await prisma.plexArtist.create({
        data: {
          ratingKey: artistRatingKey,
          key: artistKey,
          title: candidateName,
          titleSort: candidateName,
          librarySectionID: album.librarySectionID || null,
        },
        select: {
          ratingKey: true,
          title: true,
        }
      });

      created = true;
      existingArtists.push(artist);
    }

    if (!artist) {
      return null;
    }

    artistLookupByNormalizedName.set(normalizedCandidate, artist);

    if (created) {
      createdArtistKeys.add(artist.ratingKey);
    } else if (matchedExisting) {
      matchedExistingArtistKeys.add(artist.ratingKey);
    }

    return { artist, created, matchedExisting };
  };

  let resolvedArtist = null;
  let createdArtist = false;
  let matchedExistingArtist = false;

  if (discogsArtistName) {
    const resolved = await resolveOrCreateDiscogsArtist(discogsArtistName);
    resolvedArtist = resolved?.artist || null;
    createdArtist = Boolean(resolved?.created);
    matchedExistingArtist = Boolean(resolved?.matchedExisting);
  }

  if (resolvedArtist) {
    albumPatch.parentRatingKey = resolvedArtist.ratingKey;
    albumPatch.albumArtist = resolvedArtist.title;
  }

  const localTracks = [...album.tracks];
  const discogsTracks = [...discogsRelease.tracks].sort((left, right) => left.position - right.position);

  const normalizedDiscogsTracks = discogsTracks.map((track, index) => ({
    discogsOrdinal: index + 1,
    discogsTrackTitle: track.title,
    discogsTrackIndex: Number.isInteger(track.trackNumber)
      ? track.trackNumber
      : (Number.isInteger(track.position) ? track.position : index + 1),
    discogsAlbumNumber: Number.isInteger(track.discNumber) ? track.discNumber : null,
    discogsPositionRaw: String(track.rawPosition || '').trim() || null,
    discogsTrackDurationMs: Number.isInteger(track.durationMs) && track.durationMs > 0 ? track.durationMs : null,
    workTitleHint: extractWorkTitleFromTrackName(track.title),
    trackCredits: Array.isArray(track.credits) ? track.credits : [],
  }));

  const previewDefaultTrackMappings = buildDefaultDiscogsTrackMappings(localTracks, normalizedDiscogsTracks);

  const localTrackByKey = new Map(localTracks.map((track) => [track.ratingKey, track]));
  const discogsTrackByOrdinal = new Map(normalizedDiscogsTracks.map((track) => [track.discogsOrdinal, track]));

  const normalizedRequestedMappings = (Array.isArray(requestedTrackMappings) ? requestedTrackMappings : [])
    .map((mapping) => ({
      discogsOrdinal: parseInt(mapping?.discogsOrdinal, 10),
      localTrackKey: String(mapping?.localTrackKey || '').trim() || null,
      workTitleHint: String(mapping?.workTitleHint || '').trim() || null,
    }))
    .filter((mapping) => Number.isInteger(mapping.discogsOrdinal));

  const mappingsSource = normalizedRequestedMappings.length > 0
    ? normalizedRequestedMappings
    : previewDefaultTrackMappings;

  const usedLocalTrackKeys = new Set();
  const trackMappings = [];

  for (const mapping of mappingsSource) {
    const discogsTrack = discogsTrackByOrdinal.get(mapping.discogsOrdinal);
    if (!discogsTrack || !mapping.localTrackKey) {
      continue;
    }

    if (usedLocalTrackKeys.has(mapping.localTrackKey)) {
      continue;
    }

    const localTrack = localTrackByKey.get(mapping.localTrackKey);
    if (!localTrack) {
      continue;
    }

    usedLocalTrackKeys.add(mapping.localTrackKey);

    trackMappings.push({
      discogsOrdinal: discogsTrack.discogsOrdinal,
      localTrackKey: localTrack.ratingKey,
      localTrackTitle: localTrack.title,
      localTrackIndex: localTrack.index,
      discogsTrackTitle: discogsTrack.discogsTrackTitle,
      discogsTrackIndex: discogsTrack.discogsTrackIndex,
      discogsTrackDurationMs: discogsTrack.discogsTrackDurationMs,
      workTitleHint: String(mapping.workTitleHint || discogsTrack.workTitleHint || '').trim() || null,
    });
  }

  const mappedTrackCount = trackMappings.length;

  const normalizePreviewCredit = (credit, source) => {
    const artistName = extractPrimaryDiscogsArtistName(credit?.artistName);
    if (!artistName) {
      return null;
    }

    const artistTypeName = normalizeDiscogsCreditRole(credit?.artistTypeName || 'Performer');
    return {
      artistName,
      artistTypeName,
      source,
    };
  };

  const buildDiscogsCreditImportKey = ({ artistName, artistTypeName, source, discogsOrdinal = null }) => {
    const normalizedArtistName = normalizeArtistNameForMatch(artistName);
    const normalizedArtistTypeName = String(artistTypeName || '').trim().toLowerCase();
    const normalizedSource = source === 'track' ? 'track' : 'album';
    if (!normalizedArtistName || !normalizedArtistTypeName) {
      return null;
    }

    if (normalizedSource === 'track') {
      const trackOrdinal = Number.isInteger(discogsOrdinal) ? discogsOrdinal : 0;
      return `${normalizedSource}:${trackOrdinal}:${normalizedArtistName}:${normalizedArtistTypeName}`;
    }

    return `${normalizedSource}:${normalizedArtistName}:${normalizedArtistTypeName}`;
  };

  const resolvePreviewArtistMatch = (candidateName) => {
    const normalizedCandidate = normalizeArtistNameForMatch(candidateName);
    if (!normalizedCandidate) {
      return {
        matchedExisting: false,
        willCreateArtist: false,
        matchedArtist: null,
        matchKind: null,
      };
    }

    const exactArtist = artistLookupByNormalizedName.get(normalizedCandidate) || null;
    if (exactArtist) {
      return {
        matchedExisting: true,
        willCreateArtist: false,
        matchedArtist: {
          ratingKey: exactArtist.ratingKey,
          title: exactArtist.title,
        },
        matchKind: 'exact',
      };
    }

    const fuzzyArtist = findBestExistingArtistMatch(candidateName, existingArtists);
    if (fuzzyArtist) {
      return {
        matchedExisting: true,
        willCreateArtist: false,
        matchedArtist: {
          ratingKey: fuzzyArtist.ratingKey,
          title: fuzzyArtist.title,
        },
        matchKind: 'fuzzy',
      };
    }

    return {
      matchedExisting: false,
      willCreateArtist: true,
      matchedArtist: null,
      matchKind: null,
    };
  };

  const previewArtistMatchLookup = new Map();
  const addPreviewArtistMatch = (candidateName) => {
    const normalizedCandidate = normalizeArtistNameForMatch(candidateName);
    if (!normalizedCandidate || previewArtistMatchLookup.has(normalizedCandidate)) {
      return;
    }

    const resolved = resolvePreviewArtistMatch(candidateName);
    previewArtistMatchLookup.set(normalizedCandidate, {
      artistName: String(candidateName || '').trim(),
      ...resolved,
    });
  };

  const uniquePreviewCreditsMap = new Map();
  const previewCreditOptions = [];
  const previewCreditOptionKeys = new Set();
  const addPreviewCredit = (credit, source) => {
    const normalized = normalizePreviewCredit(credit, source);
    if (!normalized) {
      return;
    }

    const key = `${normalizeArtistNameForMatch(normalized.artistName)}::${String(normalized.artistTypeName || '').toLowerCase()}`;
    const existing = uniquePreviewCreditsMap.get(key);
    if (!existing) {
      uniquePreviewCreditsMap.set(key, {
        artistName: normalized.artistName,
        artistTypeName: normalized.artistTypeName,
        sources: new Set([normalized.source]),
        discogsOrdinals: new Set(),
      });
      return;
    }

    existing.sources.add(normalized.source);
  };

  const addPreviewCreditOption = (credit, source, discogsOrdinal = null, discogsTrackTitle = null) => {
    const normalized = normalizePreviewCredit(credit, source);
    if (!normalized) {
      return;
    }

    const creditKey = buildDiscogsCreditImportKey({
      artistName: normalized.artistName,
      artistTypeName: normalized.artistTypeName,
      source,
      discogsOrdinal,
    });

    if (!creditKey || previewCreditOptionKeys.has(creditKey)) {
      return;
    }

    previewCreditOptionKeys.add(creditKey);
    previewCreditOptions.push({
      creditKey,
      source,
      discogsOrdinal: Number.isInteger(discogsOrdinal) ? discogsOrdinal : null,
      discogsTrackTitle: String(discogsTrackTitle || '').trim() || null,
      artistName: normalized.artistName,
      artistTypeName: normalized.artistTypeName,
      ...resolvePreviewArtistMatch(normalized.artistName),
    });
  };

  const previewAlbumCredits = [
    ...(Array.isArray(discogsRelease.credits) ? discogsRelease.credits : []),
    ...(discogsArtistName ? [{ artistName: discogsArtistName, artistTypeName: 'Primary Artist' }] : []),
  ]
    .map((credit) => normalizePreviewCredit(credit, 'album'))
    .filter(Boolean);

  for (const credit of previewAlbumCredits) {
    addPreviewCredit(credit, 'album');
    addPreviewArtistMatch(credit.artistName);
    addPreviewCreditOption(credit, 'album', null, null);
  }

  const previewMappedDiscogsOrdinals = new Set(
    trackMappings
      .filter((mapping) => mapping?.localTrackKey)
      .map((mapping) => mapping.discogsOrdinal)
      .filter((discogsOrdinal) => Number.isInteger(discogsOrdinal))
  );

  for (const discogsTrack of normalizedDiscogsTracks) {
    if (!previewMappedDiscogsOrdinals.has(discogsTrack.discogsOrdinal)) {
      continue;
    }

    const trackCredits = Array.isArray(discogsTrack.trackCredits) ? discogsTrack.trackCredits : [];
    for (const credit of trackCredits) {
      const normalized = normalizePreviewCredit(credit, 'track');
      if (!normalized) {
        continue;
      }

      addPreviewArtistMatch(normalized.artistName);
      addPreviewCreditOption(normalized, 'track', discogsTrack.discogsOrdinal, discogsTrack.discogsTrackTitle);

      const key = `${normalizeArtistNameForMatch(normalized.artistName)}::${String(normalized.artistTypeName || '').toLowerCase()}`;
      const existing = uniquePreviewCreditsMap.get(key);
      if (!existing) {
        uniquePreviewCreditsMap.set(key, {
          artistName: normalized.artistName,
          artistTypeName: normalized.artistTypeName,
          sources: new Set(['track']),
          discogsOrdinals: new Set([discogsTrack.discogsOrdinal]),
        });
      } else {
        existing.sources.add('track');
        existing.discogsOrdinals.add(discogsTrack.discogsOrdinal);
      }
    }
  }

  const previewImportArtists = [...uniquePreviewCreditsMap.values()]
    .map((entry) => {
      const previewMatch = resolvePreviewArtistMatch(entry.artistName);
      return {
        artistName: entry.artistName,
        artistTypeName: entry.artistTypeName,
        sources: [...entry.sources].sort(),
        trackCount: entry.discogsOrdinals.size,
        discogsOrdinals: [...entry.discogsOrdinals].sort((left, right) => left - right),
        ...previewMatch,
      };
    })
    .sort((left, right) => {
      const nameSort = left.artistName.localeCompare(right.artistName);
      if (nameSort !== 0) {
        return nameSort;
      }
      return left.artistTypeName.localeCompare(right.artistTypeName);
    });

  previewCreditOptions.sort((left, right) => {
    const sourceSort = String(left.source || '').localeCompare(String(right.source || ''));
    if (sourceSort !== 0) {
      return sourceSort;
    }

    if (left.source === 'track' || right.source === 'track') {
      const ordinalSort = (left.discogsOrdinal || 0) - (right.discogsOrdinal || 0);
      if (ordinalSort !== 0) {
        return ordinalSort;
      }
    }

    const nameSort = String(left.artistName || '').localeCompare(String(right.artistName || ''));
    if (nameSort !== 0) {
      return nameSort;
    }

    return String(left.artistTypeName || '').localeCompare(String(right.artistTypeName || ''));
  });

  const previewWorkMap = new Map();
  for (const mapping of trackMappings) {
    const resolvedWorkTitle = String(mapping.workTitleHint || mapping.discogsTrackTitle || '').trim();
    if (!resolvedWorkTitle) continue;

    if (!previewWorkMap.has(resolvedWorkTitle)) {
      previewWorkMap.set(resolvedWorkTitle, []);
    }
    previewWorkMap.get(resolvedWorkTitle).push(mapping.localTrackKey);
  }

  const previewWorks = [...previewWorkMap.entries()].map(([title, trackKeys]) => ({
    title,
    trackCount: trackKeys.length
  }));

  if (!shouldApply) {
    return sendSuccess(res, {
      preview: true,
      album: {
        ratingKey: album.ratingKey,
        title: album.title,
        discogsTitle: discogsRelease.title || album.title,
        discogsArtist: discogsRelease.byArtist || null,
      },
      discogs: {
        releaseId: discogsRelease.releaseId,
        sourceKind: discogsRelease.sourceKind,
        sourceUrl: discogsRelease.sourceUrl,
        sourceTrackCount: discogsRelease.tracks.length,
        releaseCreditCount: Array.isArray(discogsRelease.credits) ? discogsRelease.credits.length : 0,
        trackCreditCount: normalizedDiscogsTracks.reduce((sum, track) => sum + (Array.isArray(track.trackCredits) ? track.trackCredits.length : 0), 0),
        releaseCredits: previewAlbumCredits,
        importArtists: {
          totalUniqueCount: previewImportArtists.length,
          artists: previewImportArtists,
        },
        creditOptions: previewCreditOptions,
        artistMatchLookup: [...previewArtistMatchLookup.values()],
        artistName: discogsArtistName,
        matchedArtist: matchedExistingArtist ? {
          ratingKey: resolvedArtist?.ratingKey,
          title: resolvedArtist?.title,
        } : null,
        willCreateArtist: !matchedExistingArtist && Boolean(discogsArtistName),
      },
      mapping: {
        mappedTrackCount,
        localTrackCount: localTracks.length,
        localTracks: localTracks.map((track) => ({
          ...extractLocalTrackDiscTrackNumbers(track),
          ratingKey: track.ratingKey,
          title: track.title,
          index: track.index,
          parentIndex: track.parentIndex,
          file: track.file,
          duration: track.duration,
        })),
        discogsTracks: normalizedDiscogsTracks,
        defaultTrackMappings: previewDefaultTrackMappings,
        trackMappings,
        proposedWorks: previewWorks,
      },
      message: 'Discogs import preview ready'
    });
  }

  await prisma.plexAlbum.update({
    where: { ratingKey },
    data: albumPatch
  });

  if (resolvedArtist) {
    await prisma.plexTrack.updateMany({
      where: {
        parentRatingKey: ratingKey
      },
      data: {
        grandparentRatingKey: resolvedArtist.ratingKey,
      }
    });
  }

  const mappedTracks = [];
  for (const mapping of trackMappings) {
    const localTrack = localTracks.find((entry) => entry.ratingKey === mapping.localTrackKey);
    if (!localTrack) continue;

    const trackPatch = {
      title: mapping.discogsTrackTitle,
      index: mapping.discogsTrackIndex,
    };

    if (resolvedArtist) {
      trackPatch.grandparentRatingKey = resolvedArtist.ratingKey;
    }

    if (Number.isInteger(mapping.discogsTrackDurationMs) && mapping.discogsTrackDurationMs > 0) {
      trackPatch.duration = mapping.discogsTrackDurationMs;
    }

    const updatedTrack = await prisma.plexTrack.update({
      where: { ratingKey: localTrack.ratingKey },
      data: trackPatch
    });

    mappedTracks.push(updatedTrack);
  }

  let createdArtistTypeCount = 0;
  let linkedAlbumCreditCount = 0;
  let linkedTrackCreditCount = 0;

  const artistTypes = await prisma.artistType.findMany({
    select: {
      id: true,
      name: true,
    }
  });

  const artistTypeByNormalizedName = new Map(
    artistTypes.map((entry) => [String(entry.name || '').trim().toLowerCase(), entry])
  );

  const resolveOrCreateArtistType = async (name) => {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) return null;

    let artistType = artistTypeByNormalizedName.get(normalizedName) || null;
    if (!artistType) {
      artistType = await prisma.artistType.create({
        data: {
          name,
        },
        select: {
          id: true,
          name: true,
        }
      });

      artistTypeByNormalizedName.set(normalizedName, artistType);
      createdArtistTypeCount += 1;
    }

    return artistType;
  };

  const albumCredits = [
    ...(Array.isArray(discogsRelease.credits) ? discogsRelease.credits : []),
    ...(discogsArtistName ? [{ artistName: discogsArtistName, artistTypeName: 'Primary Artist' }] : []),
  ]
    .map((credit) => normalizePreviewCredit(credit, 'album'))
    .filter(Boolean);

  for (const credit of albumCredits) {
    const creditKey = buildDiscogsCreditImportKey({
      artistName: credit.artistName,
      artistTypeName: credit.artistTypeName,
      source: 'album',
    });
    if (creditKey && excludedCreditKeys.has(creditKey)) {
      continue;
    }

    const artistResolution = await resolveOrCreateDiscogsArtist(credit.artistName);
    const artistType = await resolveOrCreateArtistType(credit.artistTypeName || 'Performer');
    if (!artistResolution?.artist || !artistType) {
      continue;
    }

    await prisma.albumArtist.upsert({
      where: {
        albumKey_artistKey_artistTypeId: {
          albumKey: ratingKey,
          artistKey: artistResolution.artist.ratingKey,
          artistTypeId: artistType.id,
        }
      },
      update: {},
      create: {
        albumKey: ratingKey,
        artistKey: artistResolution.artist.ratingKey,
        artistTypeId: artistType.id,
      }
    });

    linkedAlbumCreditCount += 1;
  }

  for (const mapping of trackMappings) {
    const discogsTrack = discogsTrackByOrdinal.get(mapping.discogsOrdinal);
    const trackCredits = Array.isArray(discogsTrack?.trackCredits) ? discogsTrack.trackCredits : [];

    for (const credit of trackCredits) {
      const normalizedCredit = normalizePreviewCredit(credit, 'track');
      if (!normalizedCredit) {
        continue;
      }

      const creditKey = buildDiscogsCreditImportKey({
        artistName: normalizedCredit.artistName,
        artistTypeName: normalizedCredit.artistTypeName,
        source: 'track',
        discogsOrdinal: discogsTrack?.discogsOrdinal,
      });
      if (creditKey && excludedCreditKeys.has(creditKey)) {
        continue;
      }

      const artistResolution = await resolveOrCreateDiscogsArtist(normalizedCredit.artistName);
      const artistType = await resolveOrCreateArtistType(normalizedCredit.artistTypeName || 'Performer');
      if (!artistResolution?.artist || !artistType) {
        continue;
      }

      await prisma.trackArtist.upsert({
        where: {
          trackKey_artistKey_artistTypeId: {
            trackKey: mapping.localTrackKey,
            artistKey: artistResolution.artist.ratingKey,
            artistTypeId: artistType.id,
          }
        },
        update: {},
        create: {
          trackKey: mapping.localTrackKey,
          artistKey: artistResolution.artist.ratingKey,
          artistTypeId: artistType.id,
        }
      });

      linkedTrackCreditCount += 1;
    }
  }

  const workGroups = new Map();
  for (const mapping of trackMappings) {
    const resolvedWorkTitle = String(mapping.workTitleHint || mapping.discogsTrackTitle || '').trim();
    if (!resolvedWorkTitle) continue;

    const resolvedPartTitle = deriveDiscogsPartTitle(mapping.workTitleHint, mapping.discogsTrackTitle)
      || resolvedWorkTitle;
    const resolvedPartOrder = Number.isInteger(mapping.discogsTrackIndex)
      ? mapping.discogsTrackIndex
      : (Number.isInteger(mapping.localTrackIndex) ? mapping.localTrackIndex : 1);

    if (!workGroups.has(resolvedWorkTitle)) {
      workGroups.set(resolvedWorkTitle, []);
    }

    workGroups.get(resolvedWorkTitle).push({
      localTrackKey: mapping.localTrackKey,
      partTitle: resolvedPartTitle,
      partOrder: resolvedPartOrder,
    });
  }

  const composerKey = album.parentRatingKey || album.artist?.ratingKey || null;
  let createdWorkCount = 0;
  let matchedExistingWorkCount = 0;
  let linkedWorkTrackCount = 0;

  if (composerKey) {
    const existingComposerWorks = await prisma.work.findMany({
      where: { composerKey },
      select: {
        id: true,
        title: true,
      }
    });

    for (const [workTitle, groupedTrackEntries] of workGroups.entries()) {
      const uniqueEntriesMap = new Map();
      for (const entry of groupedTrackEntries) {
        if (!entry?.localTrackKey) continue;
        if (!uniqueEntriesMap.has(entry.localTrackKey)) {
          uniqueEntriesMap.set(entry.localTrackKey, entry);
        }
      }

      const uniqueTrackEntries = [...uniqueEntriesMap.values()];
      const uniqueTrackKeys = uniqueTrackEntries.map((entry) => entry.localTrackKey);

      if (uniqueTrackKeys.length === 0) {
        continue;
      }

      // Replace prior work links for these tracks so imported work mapping wins.
      await prisma.workPartTrack.deleteMany({
        where: {
          trackKey: {
            in: uniqueTrackKeys
          }
        }
      });

      let work = findBestExistingWorkMatch(workTitle, existingComposerWorks);

      if (work) {
        matchedExistingWorkCount += 1;
      }

      if (!work) {
        work = await prisma.work.findFirst({
          where: {
            title: workTitle,
            composerKey
          }
        });
      }

      if (!work) {
        work = await prisma.work.create({
          data: {
            title: workTitle,
            composerKey
          }
        });
        createdWorkCount += 1;
        existingComposerWorks.push({ id: work.id, title: work.title });
      }

      for (const trackEntry of uniqueTrackEntries) {
        const workPart = await ensureRouteWorkPartRecord(
          work.id,
          trackEntry.partTitle || workTitle,
          Number.isInteger(trackEntry.partOrder) ? trackEntry.partOrder : 1
        );

        await prisma.workPartTrack.upsert({
          where: {
            workPartId_trackKey: {
              workPartId: workPart.id,
              trackKey: trackEntry.localTrackKey,
            }
          },
          update: {},
          create: {
            workPartId: workPart.id,
            trackKey: trackEntry.localTrackKey,
          }
        });
      }

      await prisma.plexTrack.updateMany({
        where: {
          ratingKey: {
            in: uniqueTrackKeys
          }
        },
        data: {
          workId: work.id
        }
      });

      linkedWorkTrackCount += uniqueTrackKeys.length;
    }
  }

  const refreshedAlbum = await prisma.plexAlbum.findUnique({
    where: { ratingKey }
  });

  sendSuccess(res, {
    album: refreshedAlbum,
    discogs: {
      releaseId: discogsRelease.releaseId,
      mappedTrackCount,
      sourceTrackCount: discogsRelease.tracks.length,
      artistName: discogsArtistName,
      artistRatingKey: resolvedArtist?.ratingKey || null,
      artistMatchedExisting: matchedExistingArtist,
      artistCreated: createdArtist,
      createdCreditArtistCount: createdArtistKeys.size,
      matchedCreditArtistCount: matchedExistingArtistKeys.size,
      createdArtistTypeCount,
      linkedAlbumCreditCount,
      linkedTrackCreditCount,
      createdWorkCount,
      matchedExistingWorkCount,
      linkedWorkTrackCount,
    },
    message: 'Discogs metadata imported successfully'
  });
}));

// Create New Artist - Add to local database
router.post('/artists', validateRequiredFields('title', 'Artist name is required'), asyncHandler(async (req, res) => {
  const { title, titleSort, thumb } = req.body;

  if (!title || title.trim() === '') {
    return sendBadRequest(res, 'Artist name is required');
  }

  try {
    // Generate a unique rating key (using timestamp + random)
    const ratingKey = `custom_artist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const key = `/library/metadata/${ratingKey}`; // Plex-style key format
    
    // Create artist in local database
    const newArtist = await prisma.plexArtist.create({
      data: {
        ratingKey,
        key,
        title: title.trim(),
        titleSort: titleSort?.trim() || title.trim(),
        thumb: thumb || null,
        librarySectionID: null // Custom artists don't belong to a specific library section
      }
    });

    sendSuccess(res, { artist: newArtist, message: 'Artist created successfully' });
  } catch (error) {
    console.error('Error creating artist:', error);
    sendServerError(res, `Failed to create artist: ${error.message}`);
  }
}));

// POST /api/music/artists/merge - Merge multiple artists into one
router.post('/artists/merge', asyncHandler(async (req, res) => {
  const { mainArtistKey, mergeArtistKeys } = req.body;
  
  console.log('🔄 [Merge Artists] Request received');
  console.log(`   - Main artist: ${mainArtistKey}`);
  console.log(`   - Merge artists: ${mergeArtistKeys?.join(', ')}`);
  
  // Validate inputs
  if (!mainArtistKey) {
    return sendBadRequest(res, 'mainArtistKey is required');
  }
  
  if (!mergeArtistKeys) {
    return sendBadRequest(res, 'mergeArtistKeys is required');
  }
  
  if (!Array.isArray(mergeArtistKeys) || mergeArtistKeys.length === 0) {
    return sendBadRequest(res, 'mergeArtistKeys must be a non-empty array');
  }
  
  if (mergeArtistKeys.includes(mainArtistKey)) {
    return sendBadRequest(res, 'Cannot merge an artist into itself');
  }
  
  // Create merge service instance (does not update Plex to avoid track deletion)
  const mergeService = new ArtistMergeService(prisma);
  
  // Perform the merge
  const result = await mergeService.mergeArtists(mainArtistKey, mergeArtistKeys);
  
  if (result.success) {
    console.log('✅ [Merge Artists] Merge completed successfully');
    console.log(`   - Merged ${result.mergedCount} artist(s) into ${result.mainArtist.title}`);
    console.log(`   - Transferred ${result.transferredAlbums} album(s)`);
    console.log(`   - Transferred ${result.transferredWorks} work(s)`);
    console.log(`   - Transferred ${result.transferredTypes} artist type(s)`);
    console.log(`   - Transferred ${result.transferredTrackArtists} track artist relationship(s)`);
    console.log(`   - Transferred ${result.transferredAlbumArtists || 0} album artist relationship(s)`);
    
    sendSuccess(res, {
      mainArtist: result.mainArtist,
      mergedCount: result.mergedCount,
      transferredAlbums: result.transferredAlbums,
      transferredWorks: result.transferredWorks,
      transferredTypes: result.transferredTypes,
      transferredTrackArtists: result.transferredTrackArtists,
      transferredAlbumArtists: result.transferredAlbumArtists || 0,
      message: `Successfully merged ${result.mergedCount} artist(s) into "${result.mainArtist.title}"`
    });
  } else {
    console.error('❌ [Merge Artists] Merge failed:', result.error);
    return sendServerError(res, result.error || 'Failed to merge artists');
  }
}));

// Music Albums - All
router.get('/albums', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    const albums = await plexDb.searchAlbums(search);
    // Add totalPlayCount to each album
    const albumsWithPlayCount = await Promise.all(albums.map(async (album) => {
      const tracks = await prisma.plexTrack.findMany({
        where: { parentRatingKey: album.ratingKey },
        select: { viewCount: true }
      });
      const totalPlayCount = tracks.reduce((sum, track) => sum + (track.viewCount || 0), 0);
      return { ...album, totalPlayCount };
    }));
    res.json(albumsWithPlayCount);
  } else {
    const albums = await plexDb.getAllAlbums(parseInt(limit), offset);
    // Add totalPlayCount to each album
    const albumsWithPlayCount = await Promise.all(albums.map(async (album) => {
      const tracks = await prisma.plexTrack.findMany({
        where: { parentRatingKey: album.ratingKey },
        select: { viewCount: true }
      });
      const totalPlayCount = tracks.reduce((sum, track) => sum + (track.viewCount || 0), 0);
      return { ...album, totalPlayCount };
    }));
    const totalAlbums = await plexDb.getAlbumsCount();
    
    res.json({
      albums: albumsWithPlayCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalAlbums / limit),
      totalAlbums
    });
  }
}));

// Music Albums - By Section
router.get('/albums/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let albums;
  let total;

  if (search) {
    albums = await plexDb.searchAlbumsBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.getAlbumsBySectionCount(sectionKey);
  } else {
    albums = await plexDb.getAlbumsBySection(sectionKey, limitNum, offset);
    total = await plexDb.getAlbumsBySectionCount(sectionKey);
  }

  res.json({
    albums,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalAlbums: total
  });
}));

// Music Albums - By Artist
router.get('/albums/artist/:artistRatingKey', asyncHandler(async (req, res) => {
  const { artistRatingKey } = req.params;

  const albums = await plexDb.getAlbumsByArtist(artistRatingKey);
  
  // Add totalPlayCount to each album
  const albumsWithPlayCount = await Promise.all(albums.map(async (album) => {
    const tracks = await prisma.plexTrack.findMany({
      where: { parentRatingKey: album.ratingKey },
      select: { viewCount: true }
    });
    const totalPlayCount = tracks.reduce((sum, track) => sum + (track.viewCount || 0), 0);
    return { ...album, totalPlayCount };
  }));

  res.json(albumsWithPlayCount);
}));

// Music Albums - Single Album
router.get('/albums/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const album = await plexDb.getAlbumByRatingKey(ratingKey);
  
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }
  
  // Add totalPlayCount to album
  const tracks = await prisma.plexTrack.findMany({
    where: { parentRatingKey: album.ratingKey },
    select: { viewCount: true }
  });
  const totalPlayCount = tracks.reduce((sum, track) => sum + (track.viewCount || 0), 0);
  album.totalPlayCount = totalPlayCount;
  
  res.json(album);
}));

// Music Albums - By Custom Playlist (albums that have tracks in the playlist)
router.get('/albums/playlist/:playlistId', asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Get unique albums that have tracks in this custom playlist
  const albumsWithTracks = await prisma.plexAlbum.findMany({
    where: {
      tracks: {
        some: {
          ratingKey: {
            in: await prisma.customPlaylistTrack.findMany({
              where: { playlistId: parseInt(playlistId) },
              select: { ratingKey: true }
            }).then(tracks => tracks.map(t => t.ratingKey))
          }
        }
      }
    },
    orderBy: { title: 'asc' },
    skip: offset,
    take: limitNum,
    include: {
      artist: true,
      librarySection: true
    }
  });

  // Get total count for pagination
  const totalCount = await prisma.plexAlbum.count({
    where: {
      tracks: {
        some: {
          ratingKey: {
            in: await prisma.customPlaylistTrack.findMany({
              where: { playlistId: parseInt(playlistId) },
              select: { ratingKey: true }
            }).then(tracks => tracks.map(t => t.ratingKey))
          }
        }
      }
    }
  });

  res.json({
    albums: albumsWithTracks,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalCount / limitNum),
    totalAlbums: totalCount
  });
}));

// Music Albums - NOT in Custom Playlist (albums that have NO tracks in the playlist)
router.get('/albums/not-in-playlist/:playlistId', asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Get track rating keys that are in this playlist
  const playlistTrackRatingKeys = await prisma.customPlaylistTrack.findMany({
    where: { playlistId: parseInt(playlistId) },
    select: { ratingKey: true }
  }).then(tracks => tracks.map(t => t.ratingKey));

  // Get albums that have NO tracks in the playlist
  const albumsNotInPlaylist = await prisma.plexAlbum.findMany({
    where: {
      NOT: {
        tracks: {
          some: {
            ratingKey: {
              in: playlistTrackRatingKeys
            }
          }
        }
      }
    },
    orderBy: { title: 'asc' },
    skip: offset,
    take: limitNum,
    include: {
      artist: true,
      librarySection: true
    }
  });

  // Get total count for pagination
  const totalCount = await prisma.plexAlbum.count({
    where: {
      NOT: {
        tracks: {
          some: {
            ratingKey: {
              in: playlistTrackRatingKeys
            }
          }
        }
      }
    }
  });

  res.json({
    albums: albumsNotInPlaylist,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalCount / limitNum),
    totalAlbums: totalCount
  });
}));

// Extract File Metadata from Album
function getConfiguredPathMappings() {
  const numberedMappings = [];
  for (let i = 1; i <= 50; i += 1) {
    const configuredPlexPath = process.env[`PLEX_PATH_${i}`];
    const configuredLocalPath = process.env[`LOCAL_PATH_${i}`];

    if (!configuredPlexPath || !configuredLocalPath) {
      continue;
    }

    numberedMappings.push({
      plexPath: configuredPlexPath.trim(),
      localPath: configuredLocalPath.trim(),
    });
  }

  // Legacy fallback mappings kept for backward compatibility
  const legacyMappings = [
    { plexPath: '/xmas', localPath: process.env.XMAS_PATH },
    { plexPath: '/classical', localPath: process.env.CLASSICAL_PATH }
  ];

  return [...numberedMappings, ...legacyMappings]
    .filter((mapping) => mapping.plexPath && mapping.localPath)
    // Prefer longest Plex prefix first so nested mappings resolve correctly
    .sort((left, right) => right.plexPath.length - left.plexPath.length);
}

function mapUnraidMediaPathToHost(filePath) {
  if (!filePath) {
    return null;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const unraidMediaPrefix = '/mnt/user/Media';
  if (!normalizedPath.toLowerCase().startsWith(unraidMediaPrefix.toLowerCase())) {
    return null;
  }

  const relativePath = normalizedPath.substring(unraidMediaPrefix.length).replace(/^\//, '');
  if (process.platform === 'win32') {
    const unraidServerName = process.env.UNRAID_SERVER_NAME || 'tower';
    const uncRoot = `\\\\${unraidServerName}\\Media`;
    return relativePath ? path.join(uncRoot, relativePath) : uncRoot;
  }

  const shareRoot = process.env.UNRAID_SHARE_ROOT || '/mnt/user';
  return path.join(shareRoot, 'Media', relativePath);
}

function mapPlexPathToLocalDetailed(plexPath) {
  if (!plexPath) {
    return {
      localPath: null,
      mappingMatched: false,
      matchedPlexPath: null,
      matchedLocalPath: null,
    };
  }

  const pathMappings = getConfiguredPathMappings();
  
  // Try each mapping
  for (const mapping of pathMappings) {
    if (plexPath.toLowerCase().startsWith(mapping.plexPath.toLowerCase())) {
      const relativePath = plexPath.substring(mapping.plexPath.length);
      const localPath = mapping.localPath + relativePath.replace(/\//g, path.sep);
      console.log(`Mapped Plex path: ${plexPath} -> ${localPath}`);
      return {
        localPath,
        mappingMatched: true,
        matchedPlexPath: mapping.plexPath,
        matchedLocalPath: mapping.localPath,
      };
    }
  }

  const translatedUnraidPath = mapUnraidMediaPathToHost(plexPath);
  if (translatedUnraidPath) {
    console.log(`Translated Unraid media path: ${plexPath} -> ${translatedUnraidPath}`);
    return {
      localPath: translatedUnraidPath,
      mappingMatched: true,
      matchedPlexPath: '/mnt/user/Media',
      matchedLocalPath: translatedUnraidPath,
    };
  }
  
  // If no mapping found, return original path (useful for Docker where paths match)
  console.log(`No path mapping found for: ${plexPath}, using as-is`);
  return {
    localPath: plexPath,
    mappingMatched: false,
    matchedPlexPath: null,
    matchedLocalPath: null,
  };
}

// Helper function to map Plex path to local filesystem path
function mapPlexPathToLocal(plexPath) {
  return mapPlexPathToLocalDetailed(plexPath).localPath;
}

function getUnraidMusicFallbackCandidates(plexPath) {
  if (!plexPath || !plexPath.startsWith('/')) {
    return [];
  }

  const normalizedPath = plexPath.replace(/\\/g, '/');
  const prefixToShare = {
    '/xmas': 'Christmas',
    '/movies': 'Movies',
    '/music': 'Music',
    '/classical': 'Classical',
    '/tv': 'TV',
    '/video_games': 'VideoGames',
    '/pop_music': 'PopMusic',
  };

  const matchingPrefix = Object.keys(prefixToShare)
    .filter((prefix) => normalizedPath.toLowerCase().startsWith(prefix.toLowerCase()))
    .sort((left, right) => right.length - left.length)[0];

  if (!matchingPrefix) {
    return [];
  }

  const unraidMediaPath = path.posix.join('/mnt/user/Media', prefixToShare[matchingPrefix], normalizedPath.substring(matchingPrefix.length));
  const translatedPath = mapUnraidMediaPathToHost(unraidMediaPath);
  return translatedPath ? [translatedPath] : [];
}

async function resolveExistingMusicFilePath(plexPath) {
  const candidatePaths = [];
  const mappedPath = mapPlexPathToLocal(plexPath);

  if (mappedPath) {
    candidatePaths.push(mappedPath);
  }

  for (const fallbackPath of getUnraidMusicFallbackCandidates(plexPath)) {
    if (!candidatePaths.includes(fallbackPath)) {
      candidatePaths.push(fallbackPath);
    }
  }

  for (const candidatePath of candidatePaths) {
    try {
      await fs.access(candidatePath);
      return {
        localPath: candidatePath,
        mappingMatched: candidatePath === mappedPath,
        matchedPlexPath: null,
        matchedLocalPath: candidatePath,
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return {
    localPath: mappedPath || null,
    mappingMatched: !!mappedPath,
    matchedPlexPath: null,
    matchedLocalPath: mappedPath || null,
  };
}

async function ensureTrackPlexPath(track) {
  let plexPath = track.file;

  if (!plexPath && track.key) {
    try {
      const trackData = await plexSync.makeRequest(track.key);
      const metadata = trackData?.MediaContainer?.Metadata?.[0];
      const mediaPart = metadata?.Media?.[0]?.Part?.[0];
      const stream = metadata?.Media?.[0]?.Part?.[0]?.Stream?.[0];

      if (mediaPart?.file) {
        plexPath = mediaPart.file;

        const updateData = {
          file: mediaPart.file,
          duration: mediaPart.duration ? parseInt(mediaPart.duration, 10) : track.duration,
          size: mediaPart.size ? parseInt(mediaPart.size, 10) : track.size,
          container: mediaPart.container || track.container,
        };

        if (stream) {
          updateData.audioCodec = stream.codec || track.audioCodec;
          updateData.audioChannels = stream.channels ? parseInt(stream.channels, 10) : track.audioChannels;
          updateData.bitrate = stream.bitrate ? parseInt(stream.bitrate, 10) : track.bitrate;
        }

        await prisma.plexTrack.update({
          where: { ratingKey: track.ratingKey },
          data: updateData,
        });
      }
    } catch (error) {
      console.error(`Error resolving Plex file path for track ${track.ratingKey}:`, error.message);
    }
  }

  return plexPath;
}

async function buildSplitAlbumCreateData(sourceAlbum, targetAlbumId, suffix) {
  return {
    ratingKey: `${sourceAlbum.ratingKey}-split-${suffix}`,
    key: `${sourceAlbum.key}::split:${suffix}`,
    parentRatingKey: sourceAlbum.parentRatingKey,
    guid: sourceAlbum.guid,
    type: sourceAlbum.type || 'album',
    title: sourceAlbum.title,
    titleSort: sourceAlbum.titleSort,
    summary: sourceAlbum.summary,
    index: sourceAlbum.index,
    year: sourceAlbum.year,
    thumb: sourceAlbum.thumb,
    art: sourceAlbum.art,
    parentThumb: sourceAlbum.parentThumb,
    originallyAvailableAt: sourceAlbum.originallyAvailableAt,
    addedAt: sourceAlbum.addedAt,
    updatedAt: sourceAlbum.updatedAt,
    librarySectionID: sourceAlbum.librarySectionID,
    collections: sourceAlbum.collections,
    removed: false,
    musicBrainzId: targetAlbumId,
    musicBrainzReleaseDate: sourceAlbum.musicBrainzReleaseDate,
    musicBrainzCountry: sourceAlbum.musicBrainzCountry,
    musicBrainzStatus: sourceAlbum.musicBrainzStatus,
    musicBrainzPackaging: sourceAlbum.musicBrainzPackaging,
    musicBrainzLabel: sourceAlbum.musicBrainzLabel,
    musicBrainzBarcode: sourceAlbum.musicBrainzBarcode,
    musicBrainzAsin: sourceAlbum.musicBrainzAsin,
    albumArtist: sourceAlbum.albumArtist,
    workId: sourceAlbum.workId,
    userTitle: sourceAlbum.userTitle,
    userReleaseDate: sourceAlbum.userReleaseDate,
    userLabel: sourceAlbum.userLabel,
    metadataPreferences: sourceAlbum.metadataPreferences,
    identificationStatus: sourceAlbum.identificationStatus,
    identificationConfidence: sourceAlbum.identificationConfidence,
    lastIdentificationAttempt: sourceAlbum.lastIdentificationAttempt,
  };
}

async function resolveUniqueSplitAlbumRatingKey(baseRatingKey) {
  let candidate = baseRatingKey;
  let suffix = 2;

  while (await prisma.plexAlbum.findUnique({ where: { ratingKey: candidate } })) {
    candidate = `${baseRatingKey}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

router.post('/albums/:ratingKey/split-by-album-id', asyncHandler(async (req, res) => {
  const { parseFile } = await import('music-metadata');
  const { ratingKey } = req.params;

  const sourceAlbum = await prisma.plexAlbum.findUnique({
    where: { ratingKey }
  });

  if (!sourceAlbum) {
    return sendBadRequest(res, 'Album not found');
  }

  const tracks = await prisma.plexTrack.findMany({
    where: { parentRatingKey: ratingKey, removed: false },
    orderBy: { index: 'asc' }
  });

  if (tracks.length === 0) {
    return sendSuccess(res, {
      message: 'No tracks to split',
      sourceAlbumRatingKey: ratingKey,
      sourceAlbumTitle: sourceAlbum.title,
      groupsFound: 0,
      movedTrackCount: 0,
      createdAlbums: [],
      unresolvedTracks: []
    });
  }

  const unresolvedTracks = [];
  const groupedByAlbumId = new Map();

  for (const track of tracks) {
    const plexPath = await ensureTrackPlexPath(track);
    const pathResolution = await resolveExistingMusicFilePath(plexPath);

    if (!pathResolution.localPath) {
      unresolvedTracks.push({
        ratingKey: track.ratingKey,
        title: track.title,
        reason: 'No local path mapping available',
        plexPath: plexPath || null,
        mappedPath: null,
      });
      continue;
    }

    try {
      const metadata = await parseFile(pathResolution.localPath);
      const parsedAlbumId = firstMetadataValue(metadata.common.musicbrainz_albumid);

      if (!parsedAlbumId) {
        unresolvedTracks.push({
          ratingKey: track.ratingKey,
          title: track.title,
          reason: 'No musicbrainz_albumid tag found',
          plexPath: plexPath || null,
          mappedPath: pathResolution.localPath,
        });
        continue;
      }

      if (!groupedByAlbumId.has(parsedAlbumId)) {
        groupedByAlbumId.set(parsedAlbumId, []);
      }

      groupedByAlbumId.get(parsedAlbumId).push(track);
    } catch (error) {
      unresolvedTracks.push({
        ratingKey: track.ratingKey,
        title: track.title,
        reason: error.message || 'Failed to parse metadata',
        plexPath: plexPath || null,
        mappedPath: pathResolution.localPath,
      });
    }
  }

  if (groupedByAlbumId.size <= 1) {
    const onlyAlbumId = [...groupedByAlbumId.keys()][0] || sourceAlbum.musicBrainzId || null;

    if (onlyAlbumId && sourceAlbum.musicBrainzId !== onlyAlbumId) {
      await prisma.plexAlbum.update({
        where: { ratingKey },
        data: { musicBrainzId: onlyAlbumId }
      });
    }

    return sendSuccess(res, {
      message: 'No split needed',
      sourceAlbumRatingKey: ratingKey,
      sourceAlbumTitle: sourceAlbum.title,
      groupsFound: groupedByAlbumId.size,
      movedTrackCount: 0,
      createdAlbums: [],
      unresolvedTracks,
      selectedAlbumId: onlyAlbumId,
    });
  }

  const sortedGroups = [...groupedByAlbumId.entries()].sort((left, right) => right[1].length - left[1].length);
  const sourceGroupEntry = sourceAlbum.musicBrainzId
    ? sortedGroups.find(([albumId]) => albumId === sourceAlbum.musicBrainzId)
    : null;
  const [primaryAlbumId] = sourceGroupEntry || sortedGroups[0];

  if (sourceAlbum.musicBrainzId !== primaryAlbumId) {
    await prisma.plexAlbum.update({
      where: { ratingKey },
      data: { musicBrainzId: primaryAlbumId }
    });
  }

  const createdAlbums = [];
  let movedTrackCount = 0;

  for (const [albumId, groupedTracks] of sortedGroups) {
    if (albumId === primaryAlbumId) {
      continue;
    }

    let targetAlbum = await prisma.plexAlbum.findFirst({
      where: {
        ratingKey: { not: sourceAlbum.ratingKey },
        removed: false,
        parentRatingKey: sourceAlbum.parentRatingKey,
        librarySectionID: sourceAlbum.librarySectionID,
        musicBrainzId: albumId,
      }
    });

    if (!targetAlbum) {
      const suffix = albumId.slice(0, 8);
      const createData = await buildSplitAlbumCreateData(sourceAlbum, albumId, suffix);
      createData.ratingKey = await resolveUniqueSplitAlbumRatingKey(createData.ratingKey);

      targetAlbum = await prisma.plexAlbum.create({ data: createData });

      createdAlbums.push({
        ratingKey: targetAlbum.ratingKey,
        title: targetAlbum.title,
        musicBrainzId: targetAlbum.musicBrainzId,
      });
    }

    const trackKeys = groupedTracks.map((track) => track.ratingKey);
    if (trackKeys.length > 0) {
      const updateResult = await prisma.plexTrack.updateMany({
        where: {
          ratingKey: { in: trackKeys },
          parentRatingKey: sourceAlbum.ratingKey,
        },
        data: {
          parentRatingKey: targetAlbum.ratingKey,
          grandparentRatingKey: sourceAlbum.parentRatingKey || undefined,
        }
      });

      movedTrackCount += updateResult.count;
    }
  }

  const refreshedPrimaryAlbum = await prisma.plexAlbum.findUnique({ where: { ratingKey } });

  sendSuccess(res, {
    message: 'Album split by MusicBrainz album ID completed',
    sourceAlbumRatingKey: sourceAlbum.ratingKey,
    sourceAlbumTitle: sourceAlbum.title,
    selectedAlbumId: primaryAlbumId,
    groupsFound: groupedByAlbumId.size,
    movedTrackCount,
    createdAlbums,
    unresolvedTracks,
    primaryAlbum: refreshedPrimaryAlbum,
  });
}));

router.post('/albums/:ratingKey/extract-file-metadata', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const result = await extractAlbumFileMetadataByRatingKey(ratingKey);
  res.json(result);
}));

router.post('/artists/:ratingKey/extract-file-metadata', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const artist = await prisma.plexArtist.findUnique({
    where: { ratingKey },
    select: { ratingKey: true, title: true },
  });

  if (!artist) {
    return res.status(404).json({ error: 'Artist not found' });
  }

  const albums = await plexDb.getAlbumsByArtist(ratingKey);
  const extractedAlbums = [];
  let tracksProcessed = 0;
  let successCount = 0;
  let errorCount = 0;
  let mergedAlbumCount = 0;

  for (const album of albums) {
    try {
      const result = await extractAlbumFileMetadataByRatingKey(album.ratingKey);
      extractedAlbums.push(result);
      tracksProcessed += result.tracksProcessed || 0;
      successCount += result.successCount || 0;
      errorCount += result.errorCount || 0;
      mergedAlbumCount += result.mergedAlbums?.length || 0;
    } catch (error) {
      extractedAlbums.push({
        albumTitle: album.title,
        albumRatingKey: album.ratingKey,
        tracksProcessed: 0,
        successCount: 0,
        errorCount: 1,
        extractedMetadata: [],
        mergedAlbums: [],
        error: error.message,
      });
      errorCount += 1;
    }
  }

  res.json({
    artistTitle: artist.title,
    artistRatingKey: artist.ratingKey,
    albumsProcessed: albums.length,
    mergedAlbumCount,
    tracksProcessed,
    successCount,
    errorCount,
    extractedAlbums,
  });
}));

router.get('/artists/:ratingKey/picard-tags', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const artist = await prisma.plexArtist.findUnique({
    where: { ratingKey },
    select: { ratingKey: true, title: true },
  });

  if (!artist) {
    return sendBadRequest(res, 'Artist not found');
  }

  const tracks = await prisma.plexTrack.findMany({
    where: { grandparentRatingKey: ratingKey, removed: false },
    select: PICARD_TRACK_SELECT,
    orderBy: [{ parentRatingKey: 'asc' }, { index: 'asc' }],
  });

  const payload = await buildPicardTagPayload({
    entityType: 'artist',
    entityKey: artist.ratingKey,
    entityTitle: artist.title,
    tracks,
  });

  sendSuccess(res, payload);
}));

router.get('/albums/:ratingKey/picard-tags', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const album = await prisma.plexAlbum.findUnique({
    where: { ratingKey },
    select: { ratingKey: true, title: true },
  });

  if (!album) {
    return sendBadRequest(res, 'Album not found');
  }

  const tracks = await prisma.plexTrack.findMany({
    where: { parentRatingKey: ratingKey, removed: false },
    select: PICARD_TRACK_SELECT,
    orderBy: { index: 'asc' },
  });

  const payload = await buildPicardTagPayload({
    entityType: 'album',
    entityKey: album.ratingKey,
    entityTitle: album.title,
    tracks,
  });

  sendSuccess(res, payload);
}));

router.get('/track/:ratingKey/picard-tags', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey },
    select: PICARD_TRACK_SELECT,
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  const payload = await buildPicardTagPayload({
    entityType: 'track',
    entityKey: track.ratingKey,
    entityTitle: track.title,
    tracks: [track],
  });

  sendSuccess(res, payload);
}));

// Music Tracks - All
router.get('/tracks', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  if (search) {
    const tracks = await plexDb.searchTracks(search);
    res.json(tracks);
  } else {
    const tracks = await plexDb.getAllTracks(parseInt(limit), offset);
    const totalTracks = await plexDb.getTracksCount();
    
    res.json({
      tracks,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalTracks / limit),
      totalTracks
    });
  }
}));

// Music Tracks - By Section
router.get('/tracks/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let tracks;
  let total;

  if (search) {
    tracks = await plexDb.searchTracksBySection(sectionKey, search, limitNum, offset);
    total = await plexDb.getTracksBySectionCount(sectionKey);
  } else {
    tracks = await plexDb.getTracksBySection(sectionKey, limitNum, offset);
    total = await plexDb.getTracksBySectionCount(sectionKey);
  }

  res.json({
    tracks,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    totalTracks: total
  });
}));

// Get tracks by album
router.get('/tracks/album/:albumRatingKey', asyncHandler(async (req, res) => {
  const { albumRatingKey } = req.params;
  const tracks = await plexDb.getTracksByAlbum(albumRatingKey);
  const tracksWithDiscNumbers = await attachDiscNumbersForAlbumDisplay(tracks);
  res.json(tracksWithDiscNumbers);
}));

// Disconnect a track from its album
router.post('/tracks/:ratingKey/disconnect-album', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;

  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey }
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  if (!track.parentRatingKey) {
    return sendBadRequest(res, 'Track is not linked to an album');
  }

  const updatedTrack = await prisma.plexTrack.update({
    where: { ratingKey },
    data: {
      parentRatingKey: null
    },
    include: {
      work: true,
      album: {
        include: {
          artist: true
        }
      }
    }
  });

  sendSuccess(res, {
    message: 'Track disconnected from album',
    track: updatedTrack
  });
}));

// Get tracks by artist
router.get('/tracks/artist/:artistRatingKey', asyncHandler(async (req, res) => {
  const { artistRatingKey } = req.params;
  const tracks = await plexDb.getTracksByArtist(artistRatingKey);
  res.json(tracks);
}));

// Get random tracks - All sections
router.get('/tracks/random', asyncHandler(async (req, res) => {
  const { limit = 100, unplayed, unplayedAlbums, unplayedArtists, unplayedWorks, minRating, minRatingPercent, playCompleteWork } = req.query;
  const limitNum = Math.min(parseInt(limit), 500); // Cap at 500 tracks

  // If minRatingPercent is specified, we need to fetch two separate sets
  if (minRating && parseInt(minRating) > 0 && minRatingPercent && parseInt(minRatingPercent) > 0) {
    const percent = Math.min(Math.max(parseInt(minRatingPercent), 0), 100);
    const ratedCount = Math.floor((limitNum * percent) / 100);
    const otherCount = limitNum - ratedCount;

    console.log(`Radio: Fetching ${ratedCount} rated tracks (${percent}%) and ${otherCount} other tracks`);

    // Fetch rated tracks (excluding tracks rated below 5 stars)
    const ratedTracks = await prisma.plexTrack.findMany({
      where: {
        removed: false,
        AND: [
          {
            userRating: {
              gte: parseInt(minRating)
            }
          },
          {
            OR: [
              { userRating: null },
              { userRating: { gte: 5 } }
            ]
          }
        ]
      },
      include: {
        album: {
          include: {
            artist: true
          }
        },
        workPartTracks: {
          include: {
            workPart: {
              include: {
                work: true
              }
            }
          }
        }
      }
    });

    // Build where clause for other tracks (applying unplayed filters if set, exclude tracks below 5 stars)
    const otherWhereClause = {
      removed: false,
      OR: [
        { userRating: null },
        { userRating: { gte: 5 } }
      ]
    };

    if (unplayed === 'true') {
      otherWhereClause.AND = [
        {
          OR: [
            { userRating: null },
            { userRating: { gte: 5 } }
          ]
        },
        {
          OR: [
            { viewCount: null },
            { viewCount: 0 }
          ]
        }
      ];
      delete otherWhereClause.OR;
    }

    // Handle unplayed albums/artists/works filters for the "other" tracks
    let otherTracks;
    if (unplayedAlbums === 'true' || unplayedArtists === 'true' || unplayedWorks === 'true') {
      otherTracks = await getUnplayedFilteredTracks(null, unplayedAlbums === 'true', unplayedArtists === 'true', unplayedWorks === 'true');
    } else {
      // Fetch other tracks (exclude tracks below 5 stars)
      otherTracks = await prisma.plexTrack.findMany({
        where: otherWhereClause,
        include: {
          album: {
            include: {
              artist: true
            }
          }
        }
      });
    }

    // Shuffle and select from each set
    const shuffledRated = ratedTracks.sort(() => Math.random() - 0.5).slice(0, ratedCount);
    const shuffledOther = otherTracks.sort(() => Math.random() - 0.5).slice(0, otherCount);

    // Combine and shuffle the final result
    let combinedTracks = [...shuffledRated, ...shuffledOther].sort(() => Math.random() - 0.5);

    // Expand to complete works if requested
    if (playCompleteWork === 'true') {
      combinedTracks = await expandToCompleteWorks(combinedTracks);
      console.log(`Expanded to ${combinedTracks.length} tracks with complete works`);
    }

    console.log(`Found ${shuffledRated.length} rated tracks and ${shuffledOther.length} other tracks for radio`);
    res.json({ tracks: combinedTracks });
    return;
  }

  // Handle unplayed albums/artists/works filters
  if (unplayedAlbums === 'true' || unplayedArtists === 'true' || unplayedWorks === 'true') {
    const filteredTracks = await getUnplayedFilteredTracks(null, unplayedAlbums === 'true', unplayedArtists === 'true', unplayedWorks === 'true');
    const shuffled = filteredTracks.sort(() => Math.random() - 0.5);
    let selectedTracks = shuffled.slice(0, limitNum);
    
    // Expand to complete works if requested
    if (playCompleteWork === 'true') {
      selectedTracks = await expandToCompleteWorks(selectedTracks);
      console.log(`Expanded to ${selectedTracks.length} tracks with complete works`);
    }
    
    console.log(`Found ${filteredTracks.length} unplayed filtered tracks for radio`);
    res.json({ tracks: selectedTracks });
    return;
  }

  // Original logic when no special filters
  // Build where clause (exclude tracks rated below 5 stars)
  const whereClause = {
    removed: false,
    OR: [
      { userRating: null },
      { userRating: { gte: 5 } }
    ]
  };

  // Add unplayed filter if requested
  if (unplayed === 'true') {
    whereClause.OR = [
      { viewCount: null },
      { viewCount: 0 }
    ];
  }

  // Add rating filter if requested
  if (minRating && parseInt(minRating) > 0) {
    whereClause.userRating = {
      gte: parseInt(minRating)
    };
  }

  // Get all eligible tracks with album and artist relations
  const allTracks = await prisma.plexTrack.findMany({
    where: whereClause,
    include: {
      album: {
        include: {
          artist: true
        }
      },
      workPartTracks: {
        include: {
          workPart: {
            include: {
              work: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${allTracks.length} total tracks for radio`);

  // Shuffle all tracks
  const shuffled = allTracks.sort(() => Math.random() - 0.5);
  
  // Take only the requested limit
  let selectedTracks = shuffled.slice(0, limitNum);

  // Expand to complete works if requested
  if (playCompleteWork === 'true') {
    selectedTracks = await expandToCompleteWorks(selectedTracks);
    console.log(`Expanded to ${selectedTracks.length} tracks with complete works`);
  }

  res.json({ tracks: selectedTracks });
}));

// Get random tracks - By section
router.get('/tracks/random/section/:sectionKey', asyncHandler(async (req, res) => {
  const { sectionKey } = req.params;
  const { limit = 100, unplayed, unplayedAlbums, unplayedArtists, unplayedWorks, minRating, minRatingPercent, playCompleteWork } = req.query;
  const limitNum = Math.min(parseInt(limit), 500); // Cap at 500 tracks

  // If minRatingPercent is specified, we need to fetch two separate sets
  if (minRating && parseInt(minRating) > 0 && minRatingPercent && parseInt(minRatingPercent) > 0) {
    const percent = Math.min(Math.max(parseInt(minRatingPercent), 0), 100);
    const ratedCount = Math.floor((limitNum * percent) / 100);
    const otherCount = limitNum - ratedCount;

    console.log(`Radio (section ${sectionKey}): Fetching ${ratedCount} rated tracks (${percent}%) and ${otherCount} other tracks`);

    // Fetch rated tracks (excluding tracks rated below 5 stars)
    const ratedTracks = await prisma.plexTrack.findMany({
      where: {
        librarySection: { sectionKey: sectionKey },
        removed: false,
        AND: [
          {
            userRating: {
              gte: parseInt(minRating)
            }
          },
          {
            OR: [
              { userRating: null },
              { userRating: { gte: 5 } }
            ]
          }
        ]
      },
      include: {
        album: {
          include: {
            artist: true
          }
        },
        workPartTracks: {
          include: {
            workPart: {
              include: {
                work: true
              }
            }
          }
        }
      }
    });

    // Build where clause for other tracks (applying unplayed filters if set, exclude tracks below 5 stars)
    const otherWhereClause = {
      librarySection: { sectionKey: sectionKey },
      removed: false,
      OR: [
        { userRating: null },
        { userRating: { gte: 5 } }
      ]
    };

    if (unplayed === 'true') {
      otherWhereClause.AND = [
        {
          OR: [
            { userRating: null },
            { userRating: { gte: 5 } }
          ]
        },
        {
          OR: [
            { viewCount: null },
            { viewCount: 0 }
          ]
        }
      ];
      delete otherWhereClause.OR;
    }

    // Handle unplayed albums/artists/works filters for the "other" tracks
    let otherTracks;
    if (unplayedAlbums === 'true' || unplayedArtists === 'true' || unplayedWorks === 'true') {
      otherTracks = await getUnplayedFilteredTracks(sectionKey, unplayedAlbums === 'true', unplayedArtists === 'true', unplayedWorks === 'true');
    } else {
      // Fetch other tracks (exclude tracks below 5 stars)
      otherTracks = await prisma.plexTrack.findMany({
        where: otherWhereClause,
        include: {
          album: {
            include: {
              artist: true
            }
          },
          workPartTracks: {
            include: {
              workPart: {
                include: {
                  work: true
                }
              }
            }
          }
        }
      });
    }

    // Shuffle and select from each set
    const shuffledRated = ratedTracks.sort(() => Math.random() - 0.5).slice(0, ratedCount);
    const shuffledOther = otherTracks.sort(() => Math.random() - 0.5).slice(0, otherCount);

    // Combine and shuffle the final result
    let combinedTracks = [...shuffledRated, ...shuffledOther].sort(() => Math.random() - 0.5);

    // Expand to complete works if requested
    if (playCompleteWork === 'true') {
      combinedTracks = await expandToCompleteWorks(combinedTracks);
      console.log(`Expanded to ${combinedTracks.length} tracks with complete works in section ${sectionKey}`);
    }

    console.log(`Found ${shuffledRated.length} rated tracks and ${shuffledOther.length} other tracks in section ${sectionKey} for radio`);
    res.json({ tracks: combinedTracks });
    return;
  }

  // Handle unplayed albums/artists/works filters
  if (unplayedAlbums === 'true' || unplayedArtists === 'true' || unplayedWorks === 'true') {
    const filteredTracks = await getUnplayedFilteredTracks(sectionKey, unplayedAlbums === 'true', unplayedArtists === 'true', unplayedWorks === 'true');
    const shuffled = filteredTracks.sort(() => Math.random() - 0.5);
    let selectedTracks = shuffled.slice(0, limitNum);
    
    // Expand to complete works if requested
    if (playCompleteWork === 'true') {
      selectedTracks = await expandToCompleteWorks(selectedTracks);
      console.log(`Expanded to ${selectedTracks.length} tracks with complete works in section ${sectionKey}`);
    }
    
    console.log(`Found ${filteredTracks.length} unplayed filtered tracks in section ${sectionKey} for radio`);
    res.json({ tracks: selectedTracks });
    return;
  }

  // Original logic when no special filters
  // Build where clause (exclude tracks rated below 5 stars)
  const whereClause = {
    librarySection: { sectionKey: sectionKey },
    removed: false,
    OR: [
      { userRating: null },
      { userRating: { gte: 5 } }
    ]
  };

  // Add unplayed filter if requested
  if (unplayed === 'true') {
    whereClause.OR = [
      { viewCount: null },
      { viewCount: 0 }
    ];
  }

  // Add rating filter if requested
  if (minRating && parseInt(minRating) > 0) {
    whereClause.userRating = {
      gte: parseInt(minRating)
    };
  }

  // Get all eligible tracks from section with album and artist relations
  const allTracks = await prisma.plexTrack.findMany({
    where: whereClause,
    include: {
      album: {
        include: {
          artist: true
        }
      },
      workPartTracks: {
        include: {
          workPart: {
            include: {
              work: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${allTracks.length} tracks in section ${sectionKey} for radio`);

  // Shuffle all tracks
  const shuffled = allTracks.sort(() => Math.random() - 0.5);
  
  // Take only the requested limit
  let selectedTracks = shuffled.slice(0, limitNum);

  // Expand to complete works if requested
  if (playCompleteWork === 'true') {
    selectedTracks = await expandToCompleteWorks(selectedTracks);
    console.log(`Expanded to ${selectedTracks.length} tracks with complete works in section ${sectionKey}`);
  }

  res.json({ tracks: selectedTracks });
}));

// Get single track with details including work parts
router.get('/track/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey },
    include: {
      work: {
        include: {
          composer: true,
          parts: {
            orderBy: { order: 'asc' }
          }
        }
      },
      album: {
        include: {
          artist: true
        }
      },
      librarySection: true,
      workPartTracks: {
        include: {
          workPart: {
            include: {
              work: {
                include: {
                  composer: true,
                  parts: {
                    orderBy: { order: 'asc' }
                  }
                }
              },
              artistTypes: {
                include: {
                  artistType: true
                }
              }
            }
          }
        }
      },
      trackArtists: {
        include: {
          artist: true,
          artistType: true
        }
      }
    }
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  sendSuccess(res, track);
}));

// Assign artist to track with artist type
router.post('/track/:trackKey/artists/:artistKey/types/:artistTypeId', asyncHandler(async (req, res) => {
  const { trackKey, artistKey, artistTypeId } = req.params;

  // Verify track exists
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: trackKey }
  });
  
  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  // Verify artist exists
  const artist = await prisma.plexArtist.findUnique({
    where: { ratingKey: artistKey }
  });
  
  if (!artist) {
    return sendBadRequest(res, 'Artist not found');
  }

  // Verify artist type exists
  const artistType = await prisma.artistType.findUnique({
    where: { id: parseInt(artistTypeId) }
  });
  
  if (!artistType) {
    return sendBadRequest(res, 'Artist type not found');
  }

  // Check if this assignment already exists
  const existing = await prisma.trackArtist.findFirst({
    where: {
      trackKey,
      artistKey,
      artistTypeId: parseInt(artistTypeId)
    }
  });

  if (existing) {
    // Return the existing assignment
    return sendSuccess(res, existing);
  }

  // Create the track artist assignment
  const trackArtist = await prisma.trackArtist.create({
    data: {
      trackKey,
      artistKey,
      artistTypeId: parseInt(artistTypeId)
    },
    include: {
      artist: true,
      artistType: true
    }
  });

  // Also ensure the artist has this type assigned globally (via ArtistTypeAssignment)
  const existingArtistType = await prisma.artistTypeAssignment.findFirst({
    where: {
      artistKey,
      artistTypeId: parseInt(artistTypeId)
    }
  });

  if (!existingArtistType) {
    await prisma.artistTypeAssignment.create({
      data: {
        artistKey,
        artistTypeId: parseInt(artistTypeId)
      }
    });
  }

  sendSuccess(res, trackArtist);
}));

// Remove artist from track
router.delete('/track/:trackKey/artists/:artistKey/types/:artistTypeId', asyncHandler(async (req, res) => {
  const { trackKey, artistKey, artistTypeId } = req.params;

  const trackArtist = await prisma.trackArtist.findFirst({
    where: {
      trackKey,
      artistKey,
      artistTypeId: parseInt(artistTypeId)
    }
  });

  if (!trackArtist) {
    return sendBadRequest(res, 'Track artist assignment not found');
  }

  await prisma.trackArtist.delete({
    where: { id: trackArtist.id }
  });

  sendSuccess(res, { message: 'Artist removed from track' });
}));

// Mark track as played
router.post('/track/:ratingKey/scrobble', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  
  // Get settings for Plex API
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return sendBadRequest(res, 'Plex configuration not found');
  }

  // Get track to verify it exists
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey }
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  console.log('🔍 Track data:', {
    ratingKey: track.ratingKey,
    key: track.key,
    title: track.title,
    duration: track.duration,
    viewCount: track.viewCount
  });

  try {
    // For music tracks, we need to send a timeline update to mark as played
    // This is what Plex clients actually do
    const duration = track.duration || 180000; // Duration in milliseconds
    const trackKey = track.key || `/library/metadata/${ratingKey}`;
    
    // Send timeline update with state=stopped and time=duration (track finished)
    const timelineUrl = `${settings.plexUrl}/:/timeline?` + new URLSearchParams({
      ratingKey: ratingKey,
      key: trackKey,
      state: 'stopped',
      time: duration.toString(),
      duration: duration.toString(),
      'X-Plex-Token': settings.plexToken
    }).toString();
    
    console.log('🎵 Sending timeline update for completed track:', trackKey);
    
    const timelineResponse = await fetch(timelineUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!timelineResponse.ok) {
      console.warn('⚠️  Timeline update failed:', timelineResponse.status);
      const responseText = await timelineResponse.text();
      console.log('Response:', responseText.substring(0, 200));
    } else {
      console.log('✓ Timeline update successful');
    }
    
    // Also try the scrobble endpoint
    const scrobbleUrl = `${settings.plexUrl}/:/scrobble?key=${ratingKey}&identifier=com.plexapp.plugins.library&X-Plex-Token=${settings.plexToken}`;
    console.log('🎵 Attempting scrobble with ratingKey:', ratingKey);
    
    const scrobbleResponse = await fetch(scrobbleUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('📊 Scrobble response status:', scrobbleResponse.status);
    if (scrobbleResponse.ok) {
      console.log('✓ Scrobble successful - track should now show as played in Plex');
      console.log('ℹ️  Note: You may need to refresh your Plex library to see the update');
    } else {
      const errorText = await scrobbleResponse.text();
      console.log('❌ Scrobble failed:', scrobbleResponse.status, errorText.substring(0, 100));
    }

    // Update local database
    const now = new Date();
    const updatedTrack = await prisma.plexTrack.update({
      where: { ratingKey },
      data: {
        viewCount: (track.viewCount || 0) + 1,
        lastViewedAt: now
      }
    });

    sendSuccess(res, { 
      message: 'Track marked as played',
      viewCount: updatedTrack.viewCount,
      lastViewedAt: updatedTrack.lastViewedAt
    });
  } catch (err) {
    console.error('Error scrobbling track:', err);
    return sendServerError(res, `Failed to mark track as played: ${err.message}`);
  }
}));

// Music streaming endpoint - Stream audio track from Plex
router.get('/stream/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.status(500).json({ error: 'Plex configuration not found' });
  }

  // Get track details to verify it exists
  const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
  const trackResponse = await fetch(trackUrl, {
    headers: {
      'X-Plex-Token': settings.plexToken,
      'Accept': 'application/json'
    }
  });

  if (!trackResponse.ok) {
    return res.status(404).json({ error: 'Track not found' });
  }

  const trackData = await trackResponse.json();
  const track = trackData.MediaContainer?.Metadata?.[0];
  
  if (!track) {
    return res.status(404).json({ error: 'Track metadata not found' });
  }

  // Get the media part for streaming
  const mediaPart = track.Media?.[0]?.Part?.[0];
  if (!mediaPart) {
    return res.status(404).json({ error: 'No media part found for track' });
  }

  // Construct Plex stream URL
  const streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
  
  console.log(`🎵 Streaming track: ${track.title} by ${track.originalTitle || track.grandparentTitle}`);
  console.log(`🔗 Stream URL: ${streamUrl}`);

  // Set appropriate headers for audio streaming
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');

  // Stream the audio from Plex
  const streamResponse = await fetch(streamUrl, {
    headers: {
      'Range': req.headers.range || 'bytes=0-',
      'User-Agent': 'Eddie-Life-Management/1.0'
    }
  });

  if (!streamResponse.ok) {
    console.error(`❌ Failed to get stream from Plex: ${streamResponse.status} ${streamResponse.statusText}`);
    console.error(`   Stream URL: ${streamUrl}`);
    return res.status(streamResponse.status).json({ error: `Failed to stream from Plex: ${streamResponse.statusText}` });
  }

  console.log(`✅ Successfully got stream from Plex: ${streamResponse.status}`);

  // Copy relevant headers from Plex response
  const contentType = streamResponse.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  
  if (streamResponse.headers.get('content-length')) {
    res.setHeader('Content-Length', streamResponse.headers.get('content-length'));
  }
  if (streamResponse.headers.get('content-range')) {
    res.setHeader('Content-Range', streamResponse.headers.get('content-range'));
  }
  if (streamResponse.headers.get('accept-ranges')) {
    res.setHeader('Accept-Ranges', streamResponse.headers.get('accept-ranges'));
  }

  // Set status code for range requests
  if (req.headers.range && streamResponse.status === 206) {
    res.status(206);
  }

  // Handle stream errors gracefully
  streamResponse.body.on('error', (error) => {
    // ECONNRESET is common when client disconnects or seeks - don't log as error
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
      console.log('Stream connection closed by client');
    } else {
      console.error('Stream error:', error);
    }
    // Don't try to send response if headers already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream error occurred' });
    } else {
      // Just end the response cleanly
      res.end();
    }
  });

  // Handle client disconnect
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log('Client disconnected from stream');
      streamResponse.body.destroy();
    }
  });

  // Pipe the stream
  streamResponse.body.pipe(res).on('error', (error) => {
    // Handle pipe errors (common during seeking or client disconnect)
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error('Pipe error:', error);
    }
  });
}));

// Music streaming debug endpoint
router.get('/debug/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.json({ 
      error: 'Plex configuration not found',
      hasSettings: !!settings,
      hasPlexUrl: !!(settings && settings.plexUrl),
      hasPlexToken: !!(settings && settings.plexToken)
    });
  }

  // Get track details
  const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
  const trackResponse = await fetch(trackUrl, {
    headers: {
      'X-Plex-Token': settings.plexToken,
      'Accept': 'application/json'
    }
  });

  const trackData = await trackResponse.json();
  const track = trackData.MediaContainer?.Metadata?.[0];
  const mediaPart = track?.Media?.[0]?.Part?.[0];
  
  res.json({
    success: true,
    track: {
      title: track?.title,
      artist: track?.originalTitle || track?.grandparentTitle,
      album: track?.parentTitle,
      ratingKey: track?.ratingKey,
      duration: track?.duration
    },
    media: {
      hasMedia: !!track?.Media,
      hasPart: !!mediaPart,
      partKey: mediaPart?.key,
      container: mediaPart?.container,
      size: mediaPart?.size
    },
    streamUrl: mediaPart ? `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}` : null,
    plexUrl: settings.plexUrl
  });
}));

// Update track rating
router.put('/tracks/:ratingKey/rating', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { rating } = req.body;
  
  console.log(`📊 Updating rating for track ${ratingKey} to ${rating}`);
  
  // Validate rating (0-10, where 0 removes the rating)
  if (rating !== undefined && (rating < 0 || rating > 10)) {
    return res.status(400).json({ error: 'Rating must be between 0 and 10' });
  }
  
  const settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.status(500).json({ error: 'Plex configuration not found' });
  }
  
  try {
    // Update rating in Plex server
    // Plex uses a rating scale of 0-10 (0 = no rating)
    const plexRatingUrl = `${settings.plexUrl}/:/rate?key=${ratingKey}&identifier=com.plexapp.plugins.library&rating=${rating}`;
    console.log(`📊 Sending rating to Plex: ${plexRatingUrl}`);
    
    const plexResponse = await fetch(plexRatingUrl, {
      method: 'PUT',
      headers: {
        'X-Plex-Token': settings.plexToken,
        'Accept': 'application/json'
      }
    });
    
    if (!plexResponse.ok) {
      console.error('Failed to update rating in Plex:', await plexResponse.text());
      return res.status(500).json({ error: 'Failed to update rating in Plex' });
    }
    
    console.log('📊 Plex rating updated successfully');
    
    // Update rating in local database
    const updatedTrack = await prisma.plexTrack.update({
      where: { ratingKey },
      data: { 
        userRating: rating === 0 ? null : rating
      },
      include: {
        album: {
          include: {
            artist: true
          }
        }
      }
    });
    
    console.log(`📊 Database updated: userRating = ${updatedTrack.userRating}`);
    
    res.json({
      success: true,
      track: updatedTrack
    });
  } catch (error) {
    console.error('Error updating track rating:', error);
    res.status(500).json({ error: 'Failed to update track rating' });
  }
}));

module.exports = router;
