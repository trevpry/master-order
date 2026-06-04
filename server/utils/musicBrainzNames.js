function hasLatinCharacters(value) {
  return /[A-Za-z]/.test(String(value || ''));
}

function hasCommonNonLatinCharacters(value) {
  return /[\u0400-\u04FF\u0370-\u03FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/.test(String(value || ''));
}

function unsortMusicBrainzName(sortName) {
  const value = String(sortName || '').trim();
  if (!value || !value.includes(',')) {
    return value || null;
  }

  const [familyName, ...givenParts] = value.split(',');
  const givenName = givenParts.join(',').trim();
  const family = familyName.trim();

  if (!givenName || !family) {
    return value;
  }

  return `${givenName} ${family}`.trim();
}

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function splitTokens(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractFamilyNameFromSort(sortName) {
  const raw = String(sortName || '').trim();
  if (!raw) return null;
  const family = raw.includes(',') ? raw.split(',')[0] : raw.split(/\s+/).slice(-1)[0];
  const normalized = normalizeToken(family);
  return normalized || null;
}

function extractAliasFamilyName(alias) {
  const aliasSort = String(alias?.['sort-name'] || alias?.sortName || '').trim();
  if (aliasSort) {
    return extractFamilyNameFromSort(aliasSort);
  }

  const aliasName = String(alias?.name || '').trim();
  if (!aliasName) return null;
  const parts = aliasName.split(/\s+/).filter(Boolean);
  return normalizeToken(parts[parts.length - 1]);
}

function collectArtistAliases(artist) {
  const aliasSources = [artist?.aliases, artist?.['alias-list'], artist?.aliasList].filter(Array.isArray);
  return aliasSources.flat().filter(Boolean);
}

function isAliasPrimary(alias) {
  return alias?.primary === true || alias?.primary === 'true' || alias?.primary === 1;
}

function isEnglishLocaleAlias(alias) {
  const locale = String(alias?.locale || '').trim().toLowerCase();
  return locale.startsWith('en');
}

function isLatinAliasName(alias) {
  const aliasName = String(alias?.name || '').trim();
  return Boolean(aliasName) && hasLatinCharacters(aliasName) && !hasCommonNonLatinCharacters(aliasName);
}

function isPreferredAlias(alias) {
  const aliasName = String(alias?.name || '').trim();
  if (!aliasName || !hasLatinCharacters(aliasName) || hasCommonNonLatinCharacters(aliasName)) {
    return false;
  }

  if (isAliasPrimary(alias) && isEnglishLocaleAlias(alias)) {
    return true;
  }

  if (isEnglishLocaleAlias(alias)) {
    return true;
  }

  const type = String(alias?.type || '').trim().toLowerCase();
  return type === 'artist name' || type === 'search hint' || type === 'search/official';
}

function scoreAliasAgainstCanonical(alias, canonicalFamilyName, canonicalTokens) {
  if (!isLatinAliasName(alias)) {
    return Number.NEGATIVE_INFINITY;
  }

  const aliasName = String(alias?.name || '').trim();
  const aliasTokens = splitTokens(aliasName);
  const aliasFamily = extractAliasFamilyName(alias);
  const aliasType = String(alias?.type || '').trim().toLowerCase();

  let score = 0;
  if (isEnglishLocaleAlias(alias)) score += 100;
  if (isAliasPrimary(alias)) score += 70;
  if (aliasType === 'artist name') score += 30;
  if (aliasType === 'search hint') score -= 40;

  if (canonicalFamilyName && aliasFamily === canonicalFamilyName) {
    score += 80;
  }

  if (canonicalTokens.length > 0) {
    const overlap = aliasTokens.filter((token) => canonicalTokens.includes(token)).length;
    score += overlap * 25;
  }

  return score;
}

function getPreferredMusicBrainzArtistName(artist) {
  const rawName = String(artist?.name || '').trim();
  const sortName = String(artist?.['sort-name'] || artist?.sortName || '').trim();

  const aliases = collectArtistAliases(artist);
  const rawNameIsNonLatin = rawName && hasCommonNonLatinCharacters(rawName);
  const rawNameIsLatin = rawName && hasLatinCharacters(rawName) && !rawNameIsNonLatin;

  // If caller already provided a Latin display name (for example from explicit user selection),
  // keep it and avoid alias fallback reordering.
  if (rawNameIsLatin) {
    return rawName;
  }

  const canonicalUnsorted = unsortMusicBrainzName(sortName) || '';
  const canonicalTokens = splitTokens(canonicalUnsorted);
  const canonicalFamilyName = extractFamilyNameFromSort(sortName);

  // Required behavior: if canonical name is non-Latin, prioritize English primary alias.
  let preferredAlias = null;
  if (rawNameIsNonLatin) {
    const rankedAliases = aliases
      .map((alias) => ({
        alias,
        score: scoreAliasAgainstCanonical(alias, canonicalFamilyName, canonicalTokens),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score);

    preferredAlias = rankedAliases[0]?.alias || null;
  }

  if (!preferredAlias) {
    preferredAlias = aliases.find(isPreferredAlias)
      || aliases.find((alias) => isLatinAliasName(alias));
  }

  if (preferredAlias?.name) {
    return preferredAlias.name.trim();
  }

  if (rawNameIsNonLatin) {
    const unsortedName = unsortMusicBrainzName(sortName);
    if (unsortedName && hasLatinCharacters(unsortedName)) {
      return unsortedName;
    }
  }

  return rawName || sortName || null;
}

module.exports = {
  getPreferredMusicBrainzArtistName,
  unsortMusicBrainzName,
};