// Flexible artist-name matching shared by artist search and metadata imports.

const normalizeArtistName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokenizeArtistName = (value) => normalizeArtistName(value).split(' ').filter(Boolean);

// "Antonio Mazzoni — Composer" / "Antonio Mazzoni -- Composer" -> { name, typeName }
const splitArtistNameAndType = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(.+?)\s+(?:—|–|--)\s+(.+)$/);
  return match
    ? { name: match[1].trim(), typeName: match[2].trim() }
    : { name: text, typeName: null };
};

// "Mazzoni, Antonio" -> "Antonio Mazzoni"
const naturalOrderName = (value) => {
  const text = String(value || '').trim();
  if (!text.includes(',')) return text;
  const [last, ...rest] = text.split(',');
  return `${rest.join(',').trim()} ${last.trim()}`.trim();
};

const diceSimilarity = (left, right) => {
  const grams = (text) => {
    const map = new Map();
    for (let i = 0; i < text.length - 1; i++) {
      const gram = text.slice(i, i + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };
  const a = grams(left.replace(/\s+/g, ''));
  const b = grams(right.replace(/\s+/g, ''));
  const sizeA = [...a.values()].reduce((sum, n) => sum + n, 0);
  const sizeB = [...b.values()].reduce((sum, n) => sum + n, 0);
  if (sizeA === 0 || sizeB === 0) return 0;
  let overlap = 0;
  for (const [gram, count] of a) overlap += Math.min(count, b.get(gram) || 0);
  return (2 * overlap) / (sizeA + sizeB);
};

const tokensMatch = (shortToken, longToken) => (
  shortToken === longToken || (shortToken.length === 1 && longToken.startsWith(shortToken))
);

/**
 * Scores how likely two artist names refer to the same person (0..1).
 * Handles accents, sort-name order, middle names ("Antonio Mazzoni" vs "Antonio Maria Mazzoni")
 * and initials ("J. S. Bach" vs "Johann Sebastian Bach").
 */
const scoreArtistNameMatch = (leftName, rightName) => {
  const left = normalizeArtistName(naturalOrderName(leftName));
  const right = normalizeArtistName(naturalOrderName(rightName));
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = left.split(' ');
  const rightTokens = right.split(' ');
  const [shorter, longer] = leftTokens.length <= rightTokens.length
    ? [leftTokens, rightTokens]
    : [rightTokens, leftTokens];

  const sameSurname = shorter[shorter.length - 1] === longer[longer.length - 1];
  if (sameSurname && shorter.length >= 2) {
    let cursor = 0;
    const allPresentInOrder = shorter.every((token) => {
      while (cursor < longer.length && !tokensMatch(token, longer[cursor])) cursor++;
      return cursor++ < longer.length;
    });
    if (allPresentInOrder) {
      return shorter.some(token => token.length === 1) ? 0.85 : 0.9;
    }
  }

  const similarity = diceSimilarity(left, right);
  return similarity >= 0.85 ? similarity * 0.95 : similarity * 0.7;
};

module.exports = {
  normalizeArtistName,
  tokenizeArtistName,
  splitArtistNameAndType,
  naturalOrderName,
  scoreArtistNameMatch
};
