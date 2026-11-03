/**
 * Persistent store for black-frame scan results, keyed by Stash scene id. Records are tied to the file
 * (path + size), so a replaced file invalidates its old results. Partial scans (windows around cuts) are
 * merged: `ranges` lists the parts of the file that have been scanned.
 */
const fs = require('fs');
const path = require('path');

const round = (n) => Math.round(n * 1000) / 1000;

function defaultStorePath() {
  const dataDir = process.env.DATA_PATH || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..', 'data'));
  return path.join(dataDir, 'stash-black-frames.json');
}

function mergeRanges(ranges) {
  const sorted = ranges.filter(([a, b]) => b > a).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + 0.5) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged.map(([a, b]) => [round(a), round(b)]);
}

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end + 0.15) last.end = Math.max(last.end, iv.end);
    else merged.push({ start: iv.start, end: iv.end });
  }
  return merged.map(iv => ({ start: round(iv.start), end: round(iv.end), duration: round(iv.end - iv.start) }));
}

const coversWholeFile = (ranges, duration) => duration > 0 && ranges.length === 1 && ranges[0][0] <= 0.5 && ranges[0][1] >= duration - 0.5;

/**
 * Combine an existing record with a new scan of `ranges`. Old intervals inside the newly scanned ranges are
 * replaced by the new results; the rest are kept.
 */
function mergeRecord(existing, { ranges, intervals, duration }) {
  const inNewRange = (iv) => ranges.some(([a, b]) => iv.start >= a - 0.05 && iv.end <= b + 0.05);
  const kept = (existing?.intervals || []).filter(iv => !inNewRange(iv));
  const allRanges = mergeRanges([...(existing?.ranges || []), ...ranges]);
  return {
    intervals: mergeIntervals([...kept, ...intervals]),
    ranges: allRanges,
    fullScan: coversWholeFile(allRanges, duration)
  };
}

class BlackFrameStore {
  constructor(filePath = defaultStorePath()) {
    this.filePath = filePath;
    this.records = null;
    this.writeChain = Promise.resolve();
  }

  async load() {
    if (this.records) return this.records;
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.records = parsed && typeof parsed === 'object' && parsed.scenes ? parsed.scenes : {};
    } catch {
      this.records = {};
    }
    return this.records;
  }

  /** Stored record for a scene, or null if missing or the file has changed since it was scanned. */
  async get(sceneId, file = null) {
    const records = await this.load();
    const record = records[String(sceneId)];
    if (!record) return null;
    if (file && (record.path !== file.path || (file.size && record.size && Number(record.size) !== Number(file.size)))) return null;
    return record;
  }

  async getMany(sceneIds) {
    const records = await this.load();
    const result = {};
    for (const id of sceneIds) {
      if (records[String(id)]) result[String(id)] = records[String(id)];
    }
    return result;
  }

  /** Merge a finished (or partially finished) scan into the scene's record and persist it. */
  async save(sceneId, file, { ranges, intervals }) {
    const records = await this.load();
    const duration = Number(file.duration) || 0;
    const existing = await this.get(sceneId, file);
    const merged = mergeRecord(existing, { ranges, intervals, duration });
    const record = {
      sceneId: String(sceneId),
      path: file.path,
      size: file.size ? Number(file.size) : null,
      duration,
      ...merged,
      scannedAt: new Date().toISOString()
    };
    records[String(sceneId)] = record;
    await this.persist();
    return record;
  }

  persist() {
    this.writeChain = this.writeChain.then(async () => {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify({ version: 1, scenes: this.records }));
      await fs.promises.rename(tmp, this.filePath);
    }).catch(error => console.warn(`⬛ Could not save black-frame results: ${error.message}`));
    return this.writeChain;
  }
}

module.exports = { BlackFrameStore, mergeRecord, mergeRanges, mergeIntervals, defaultStorePath };
