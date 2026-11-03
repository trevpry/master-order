// Pure helpers for adding/removing cut lines in the split modal's editable segments
// ({ uid, number, include, startText, endText, title, ... }).

let uidCounter = 0;
export const newSegmentUid = () => `seg-${Date.now().toString(36)}-${(uidCounter += 1)}`;

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isGenericTitle = (title, groupName) => !title
  || /^scene\s*\d+$/i.test(String(title).trim())
  || (groupName && new RegExp(`^${escapeRegExp(groupName)} - Scene \\d+$`).test(String(title).trim()));

/** Number segments 1..n in time order and keep generated "<group> - Scene N" titles in step. */
export const renumberSegments = (segments, parseClock, groupName) => {
  const ordered = [...segments].sort((a, b) => (parseClock(a.startText) || 0) - (parseClock(b.startText) || 0));
  return ordered.map((s, i) => {
    const number = i + 1;
    const title = isGenericTitle(s.title, groupName) && groupName ? `${groupName} - Scene ${number}` : s.title;
    return { ...s, number, title };
  });
};

const uniqueById = (items) => {
  const seen = new Set();
  return items.filter(x => (seen.has(x.id) ? false : seen.add(x.id)));
};

/**
 * Split segments at the given times. A time only becomes a cut when it falls inside a segment and leaves at
 * least `minLength` seconds on both sides. The new right-hand part copies the performers/tags/URLs of the
 * segment it came from (remove what doesn't apply) but gets a fresh title.
 */
export const insertCuts = (segments, times, { parseClock, formatTime, groupName, minLength = 1 }) => {
  let next = segments.map(s => ({ ...s }));
  const inserted = [];
  [...times].sort((a, b) => a - b).forEach(time => {
    const index = next.findIndex(s => {
      const start = parseClock(s.startText);
      const end = parseClock(s.endText);
      return Number.isFinite(start) && Number.isFinite(end) && time - start >= minLength && end - time >= minLength;
    });
    if (index < 0) return;
    const seg = next[index];
    const text = formatTime(time);
    const left = { ...seg, endText: text };
    const right = {
      ...seg,
      uid: newSegmentUid(),
      startText: text,
      title: '',
      details: null,
      image: null,
      listedDuration: null,
      inserted: true
    };
    next = [...next.slice(0, index), left, right, ...next.slice(index + 1)];
    inserted.push(time);
  });
  return { segments: inserted.length ? renumberSegments(next, parseClock, groupName) : segments, inserted };
};

/** Remove the cut between two adjacent segments, merging the second into the first. */
export const removeCut = (segments, leftIndex, rightIndex, { parseClock, groupName }) => {
  const left = segments[leftIndex];
  const right = segments[rightIndex];
  if (!left || !right) return segments;
  const merged = {
    ...left,
    endText: right.endText,
    include: left.include || right.include,
    listedDuration: left.listedDuration && right.listedDuration ? left.listedDuration + right.listedDuration : left.listedDuration || null,
    performers: uniqueById([...(left.performers || []), ...(right.performers || [])]),
    tags: uniqueById([...(left.tags || []), ...(right.tags || [])]),
    unmatchedPerformers: [...new Set([...(left.unmatchedPerformers || []), ...(right.unmatchedPerformers || [])])],
    unmatchedTags: [...new Set([...(left.unmatchedTags || []), ...(right.unmatchedTags || [])])],
    urls: [...new Set([...(left.urls || []), ...(right.urls || [])])],
    details: left.details || right.details || null
  };
  const next = segments.filter((_, i) => i !== rightIndex).map((s, i) => (i === leftIndex ? merged : s));
  return renumberSegments(next, parseClock, groupName);
};

/**
 * Cut candidates from black runs: the middle of each run of at least `minBlack` seconds that is at least
 * `minLength` seconds from every existing cut and segment edge.
 */
export const blackCutCandidates = (intervals, segments, { parseClock, minLength = 60, minBlack = 0.4 }) => {
  const edges = segments.flatMap(s => [parseClock(s.startText), parseClock(s.endText)]).filter(Number.isFinite);
  const candidates = [];
  intervals
    .filter(iv => iv.end - iv.start >= minBlack)
    .forEach(iv => {
      const middle = Math.round(((iv.start + iv.end) / 2) * 10) / 10;
      const tooClose = [...edges, ...candidates].some(t => Math.abs(t - middle) < minLength);
      const inside = segments.some(s => middle > parseClock(s.startText) && middle < parseClock(s.endText));
      if (!tooClose && inside) candidates.push(middle);
    });
  return candidates;
};
