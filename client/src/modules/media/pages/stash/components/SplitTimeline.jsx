import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { blackCutCandidates } from './splitSegmentEdits';

const MERGE_TOLERANCE = 0.25;
const MIN_GAP = 0.5;
const SEEK_THROTTLE_MS = 200;
const NUDGES = [-5, -1, -0.1, 0.1, 1, 5];
const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
const TRACK_HEIGHT = 140;
const FILM_HEIGHT = TRACK_HEIGHT - 16;
const SCAN_WINDOWS = [
  { value: '30', label: '±30s around each cut' },
  { value: '90', label: '±90s around each cut' },
  { value: '180', label: '±3 min around each cut' },
  { value: '300', label: '±5 min around each cut' },
  { value: 'full', label: 'Whole file (slow)' }
];
const FULL_SCAN_RADIUS = 180;
const MAX_AUTO_RECOVERIES = 4;
// Stash transcodes HLS on demand, so the first segment after a seek can take a while: be patient and retry.
const retryPolicy = (firstByteMs, loadMs, retries) => ({
  default: {
    maxTimeToFirstByteMs: firstByteMs,
    maxLoadTimeMs: loadMs,
    timeoutRetry: { maxNumRetry: retries, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
    errorRetry: { maxNumRetry: retries, retryDelayMs: 1000, maxRetryDelayMs: 8000 }
  }
});
const STASH_HLS_CONFIG = {
  manifestLoadPolicy: retryPolicy(30000, 60000, 4),
  playlistLoadPolicy: retryPolicy(30000, 60000, 4),
  fragLoadPolicy: retryPolicy(45000, 180000, 6),
  maxBufferLength: 30,
  backBufferLength: 30
};
const MIN_SCENE_OPTIONS = [30, 60, 120, 300];
const isTyping = (event) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName);

/** Nearest black interval to `time` within `radius`; the suggested cut is the middle of the black run. */
export const suggestBlackCut = (intervals, time, radius) => {
  let best = null;
  intervals.forEach(iv => {
    const distance = time < iv.start ? iv.start - time : (time > iv.end ? time - iv.end : 0);
    if (distance > radius) return;
    const suggested = Math.round(((iv.start + iv.end) / 2) * 10) / 10;
    if (!best || distance < best.distance || (distance === best.distance && iv.duration > best.interval.duration)) {
      best = { interval: iv, distance, suggested, delta: Math.round((suggested - time) * 10) / 10 };
    }
  });
  return best;
};

export const formatPreciseClock = (seconds) => {
  if (!Number.isFinite(seconds)) return '';
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  const base = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  return fraction ? `${base}.${fraction}` : base;
};

const parseVttTime = (text) => {
  const parts = text.trim().split(':').map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

// Stash sprite VTT: "00:00:00.000 --> 00:00:57.457" followed by "sprite.jpg#xywh=0,0,160,90"
export const parseSpriteVtt = (text, vttUrl) => {
  const cues = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!match) continue;
    const target = (lines[i + 1] || '').trim();
    const frag = target.match(/^(.*)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
    if (!frag) continue;
    let url = frag[1];
    try {
      url = new URL(frag[1], vttUrl).toString();
    } catch {
      // Keep the raw value
    }
    cues.push({
      start: parseVttTime(match[1]),
      end: parseVttTime(match[2]),
      url,
      x: Number(frag[2]),
      y: Number(frag[3]),
      w: Number(frag[4]),
      h: Number(frag[5])
    });
  }
  return cues;
};

const cueAt = (cues, time) => {
  if (!cues.length) return null;
  let lo = 0;
  let hi = cues.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cues[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  return cues[lo];
};

const boundaryKey = (refs) => refs.map(r => `${r.index}:${r.field}`).join('|');

const unionIntervals = (a, b) => {
  const sorted = [...a, ...b].sort((x, y) => x.start - y.start);
  const out = [];
  sorted.forEach(iv => {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end + 0.05) {
      last.end = Math.max(last.end, iv.end);
      last.duration = last.end - last.start;
    } else out.push({ ...iv, duration: iv.end - iv.start });
  });
  return out;
};

/**
 * Visual cut-point editor for the group scene split modal. Segments use the modal's editable
 * shape ({ uid, number, include, startText, endText }); edits are reported through onSetTimes /
 * onInsertCuts / onRemoveCut so the table and timeline always share one source of truth.
 */
export default function SplitTimeline({
  duration, segments, errors, media, preferHls, parseClock, onSetTimes, onInsertCuts, onRemoveCut, initialBlackFrames, scan: scanConfig
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const lastSeekRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState(null);
  const [usingHls, setUsingHls] = useState(false);
  const [cues, setCues] = useState([]);
  const [spriteSize, setSpriteSize] = useState(null);
  const [hover, setHover] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [scanWindow, setScanWindow] = useState('90');
  // Results stored by an earlier scan (e.g. the group-wide "Scan all clips") are shown straight away
  const [scan, setScan] = useState(() => (initialBlackFrames?.intervals ? {
    status: 'completed',
    stored: true,
    intervals: initialBlackFrames.intervals,
    fullScan: initialBlackFrames.fullScan,
    window: initialBlackFrames.fullScan ? FULL_SCAN_RADIUS : 90
  } : null));
  const [minSceneLength, setMinSceneLength] = useState(60);
  const [cutMessage, setCutMessage] = useState(null);
  const scanPollRef = useRef(null);
  const scanIdRef = useRef(null);
  const selectTimeRef = useRef(null);

  const total = Math.max(1, Number(duration) || 1);
  const pct = (t) => `${(Math.min(Math.max(t, 0), total) / total) * 100}%`;

  // ---- Video source: direct stream, falling back to Stash's transcoded HLS ----
  // Position/play state survive reloads, so a recovered stream resumes where it failed.
  const positionRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const recoveryRef = useRef({ attempts: 0, timer: null });
  const usingHlsRef = useRef(false);
  const directRetriedRef = useRef(false);
  const pendingResumeRef = useRef(false);
  const recoverRef = useRef(() => {});

  const clearRecoveryTimer = () => {
    clearTimeout(recoveryRef.current.timer);
    recoveryRef.current.timer = null;
  };

  const resumeAt = (video, position) => {
    pendingResumeRef.current = true;
    const apply = () => {
      pendingResumeRef.current = false;
      if (position > 0 && Math.abs(video.currentTime - position) > 0.5) video.currentTime = position;
      if (wasPlayingRef.current) video.play().catch(() => {});
    };
    if (video.readyState >= 1) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  };

  const attachHls = useCallback((startAt = positionRef.current) => {
    const video = videoRef.current;
    if (!video || !media?.hlsUrl) return false;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    usingHlsRef.current = true;
    setUsingHls(true);
    if (Hls.isSupported()) {
      const hls = new Hls({ startPosition: startAt || 0, ...STASH_HLS_CONFIG });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal || hlsRef.current !== hls) return;
        recoverRef.current(data.type === Hls.ErrorTypes.MEDIA_ERROR ? 'media' : 'network');
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (hlsRef.current === hls) recoveryRef.current.attempts = 0;
      });
      hls.loadSource(media.hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      resumeAt(video, startAt);
      return true;
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = media.hlsUrl;
      resumeAt(video, startAt);
      return true;
    }
    return false;
  }, [media?.hlsUrl]);

  const attachDirect = useCallback((startAt = positionRef.current) => {
    const video = videoRef.current;
    if (!video || !media?.directUrl) return false;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    usingHlsRef.current = false;
    setUsingHls(false);
    video.src = media.directUrl;
    video.load();
    resumeAt(video, startAt);
    return true;
  }, [media?.directUrl]);

  /** Automatic recovery: a few retries with back-off at the current position, then a manual Reload button. */
  const recoverStream = useCallback((kind) => {
    const state = recoveryRef.current;
    if (state.timer) return;
    if (state.attempts >= MAX_AUTO_RECOVERIES) {
      setVideoError('Preview stream failed to load. Use Reload preview to try again — cut points can still be edited.');
      return;
    }
    state.attempts += 1;
    setVideoError(`Preview stream interrupted — reconnecting (attempt ${state.attempts} of ${MAX_AUTO_RECOVERIES})…`);
    const hls = hlsRef.current;
    if (kind === 'media' && hls && state.attempts <= 2) {
      hls.recoverMediaError();
      setTimeout(() => setVideoError(null), 1500);
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      setVideoError(null);
      if (usingHlsRef.current) attachHls(positionRef.current);
      else attachDirect(positionRef.current);
    }, Math.min(1000 * state.attempts, 5000));
  }, [attachHls, attachDirect]);
  recoverRef.current = recoverStream;

  const reloadPreview = () => {
    clearRecoveryTimer();
    recoveryRef.current.attempts = 0;
    directRetriedRef.current = false;
    setVideoError(null);
    if (usingHlsRef.current || preferHls || !media?.directUrl) attachHls(positionRef.current);
    else attachDirect(positionRef.current);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return undefined;
    setVideoError(null);
    recoveryRef.current.attempts = 0;
    directRetriedRef.current = false;
    // Keep the playhead when the source changes (e.g. the transcoded stream is swapped for the converted MP4)
    const startAt = positionRef.current || 0;
    wasPlayingRef.current = false;
    if (preferHls && attachHls(startAt)) {
      // Transcoded source (AVI/WMV etc.)
    } else if (media.directUrl) {
      attachDirect(startAt);
    }
    return () => {
      clearRecoveryTimer();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [media, preferHls, attachHls, attachDirect]);

  const handleVideoError = (e) => {
    const code = e.currentTarget.error?.code;
    if (usingHlsRef.current) {
      // hls.js reports its own fatal errors; native HLS (Safari) lands here
      if (!hlsRef.current) recoverStream('network');
      return;
    }
    // A network/decode hiccup on the direct stream gets one retry before switching to the transcoded stream
    if (code !== 4 && !directRetriedRef.current && media?.directUrl) {
      directRetriedRef.current = true;
      attachDirect(positionRef.current);
      return;
    }
    if (attachHls(positionRef.current)) return;
    setVideoError('This file can\'t be previewed in the browser. Cut points can still be edited.');
  };

  const trackPosition = (video) => {
    if (!pendingResumeRef.current) positionRef.current = video.currentTime;
    setCurrentTime(video.currentTime);
  };

  // ---- Sprite thumbnails ----
  useEffect(() => {
    if (!media?.vttUrl) return undefined;
    let cancelled = false;
    fetch(media.vttUrl)
      .then(res => (res.ok ? res.text() : ''))
      .then(text => {
        if (cancelled) return;
        const parsed = parseSpriteVtt(text, media.vttUrl);
        setCues(parsed);
        if (parsed[0]) {
          const img = new Image();
          img.onload = () => !cancelled && setSpriteSize({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = parsed[0].url;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media?.vttUrl]);

  const spriteStyle = (cue, boxW, boxH) => {
    if (!cue || !spriteSize) return null;
    const sx = boxW / cue.w;
    const sy = boxH / cue.h;
    return {
      backgroundImage: `url("${cue.url}")`,
      backgroundSize: `${spriteSize.w * sx}px ${spriteSize.h * sy}px`,
      backgroundPosition: `-${cue.x * sx}px -${cue.y * sy}px`
    };
  };

  const filmstrip = useMemo(() => {
    if (!cues.length || !spriteSize) return [];
    const count = Math.round(20 * zoom);
    return Array.from({ length: count }, (_, i) => cueAt(cues, ((i + 0.5) / count) * total));
  }, [cues, spriteSize, zoom, total]);

  // ---- Segments and boundaries ----
  const timed = useMemo(() => segments.map((s, index) => ({
    ...s,
    index,
    start: parseClock(s.startText),
    end: parseClock(s.endText)
  })), [segments, parseClock]);

  const boundaries = useMemo(() => {
    const points = [];
    timed.forEach(s => {
      if (Number.isFinite(s.start)) points.push({ time: s.start, index: s.index, field: 'startText' });
      if (Number.isFinite(s.end)) points.push({ time: s.end, index: s.index, field: 'endText' });
    });
    points.sort((a, b) => a.time - b.time || (a.field === 'endText' ? -1 : 1));
    const groups = [];
    points.forEach(p => {
      const last = groups[groups.length - 1];
      if (last && Math.abs(p.time - last.time) <= MERGE_TOLERANCE) last.refs.push(p);
      else groups.push({ time: p.time, refs: [p] });
    });
    return groups.map(g => {
      const refs = g.refs.map(({ index, field }) => ({ index, field }));
      const included = refs.some(r => segments[r.index]?.include);
      return { ...g, refs, key: boundaryKey(refs), included };
    });
  }, [timed, segments]);

  const selectedIndex = boundaries.findIndex(b => b.key === selectedKey);
  const selected = selectedIndex >= 0 ? boundaries[selectedIndex] : null;

  // A cut can be removed when it is the shared end/start of two neighboring segments
  const mergePairFor = (boundary) => {
    if (!boundary) return null;
    const end = boundary.refs.find(r => r.field === 'endText');
    const start = end && boundary.refs.find(r => r.field === 'startText' && r.index === end.index + 1);
    return start ? { left: end.index, right: start.index } : null;
  };
  const selectedMerge = mergePairFor(selected);

  // Boundary keys are index based, so after inserting/removing a cut re-select by time
  useEffect(() => {
    if (selectTimeRef.current === null) return;
    const target = selectTimeRef.current;
    selectTimeRef.current = null;
    const match = boundaries.find(b => Math.abs(b.time - target) <= MERGE_TOLERANCE);
    setSelectedKey(match ? match.key : null);
  }, [boundaries]);

  const insertCutsAt = (times, { select = times.length === 1 } = {}) => {
    if (!onInsertCuts || !times.length) return 0;
    const added = onInsertCuts(times);
    if (added && select) selectTimeRef.current = Math.round(times[0] * 10) / 10;
    else if (added) {
      selectTimeRef.current = null;
      setSelectedKey(null);
    }
    setCutMessage(added
      ? `Added ${added} cut${added === 1 ? '' : 's'}.`
      : 'No cut added — the time must be inside a scene and at least 1s from its start and end.');
    return added;
  };

  const removeSelectedCut = () => {
    if (!selectedMerge || !onRemoveCut) return;
    onRemoveCut(selectedMerge.left, selectedMerge.right);
    setSelectedKey(null);
    setCutMessage(`Removed the cut at ${formatPreciseClock(selected.time)}; the two scenes were merged.`);
  };

  const limitsFor = (index) => ({
    min: index > 0 ? boundaries[index - 1].time + MIN_GAP : 0,
    max: index < boundaries.length - 1 ? boundaries[index + 1].time - MIN_GAP : total
  });

  const seekVideo = (time, force = false) => {
    const video = videoRef.current;
    setCurrentTime(time);
    if (!video) return;
    const now = Date.now();
    if (!force && now - lastSeekRef.current < SEEK_THROTTLE_MS) return;
    lastSeekRef.current = now;
    try {
      video.currentTime = time;
    } catch {
      // Media not ready yet
    }
  };

  const moveBoundary = (index, time, { seek = true, force = false } = {}) => {
    const boundary = boundaries[index];
    if (!boundary) return;
    const { min, max } = limitsFor(index);
    if (min > max) return;
    const clamped = Math.round(Math.min(Math.max(time, min), max) * 10) / 10;
    onSetTimes(boundary.refs, clamped);
    if (seek) seekVideo(clamped, force);
  };

  const timeFromEvent = (event) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.min(Math.max(ratio, 0), 1) * total;
  };

  // ---- Pointer interactions ----
  const startDrag = (event, index) => {
    event.preventDefault();
    event.stopPropagation();
    const boundary = boundaries[index];
    setSelectedKey(boundary.key);
    setDraggingKey(boundary.key);
    dragRef.current = { index, pointerId: event.pointerId };
    videoRef.current?.pause();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onHandleMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const time = timeFromEvent(event);
    setHover({ time, x: event.clientX });
    moveBoundary(dragRef.current.index, time);
  };

  const endDrag = (event) => {
    if (!dragRef.current) return;
    const time = timeFromEvent(event);
    moveBoundary(dragRef.current.index, time, { force: true });
    dragRef.current = null;
    setDraggingKey(null);
    setHover(null);
  };

  const onTrackClick = (event) => {
    if (dragRef.current) return;
    seekVideo(timeFromEvent(event), true);
  };

  const onTrackHover = (event) => {
    if (dragRef.current) return;
    setHover({ time: timeFromEvent(event), x: event.clientX });
  };

  const onKeyDown = (event) => {
    if (isTyping(event)) return;
    if ((event.key === 'c' || event.key === 'C') && !event.ctrlKey && !event.metaKey && onInsertCuts) {
      event.preventDefault();
      insertCutsAt([videoRef.current?.currentTime ?? currentTime]);
      return;
    }
    if (!selected) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMerge) {
      event.preventDefault();
      removeSelectedCut();
      return;
    }
    if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && suggestions[selected.key]) {
      event.preventDefault();
      applySuggestion(selectedIndex);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : (event.altKey || event.ctrlKey ? 0.1 : 1);
    moveBoundary(selectedIndex, selected.time + (event.key === 'ArrowLeft' ? -step : step), { force: true });
  };

  const previewCut = () => {
    if (!selected || !videoRef.current) return;
    seekVideo(Math.max(0, selected.time - 5), true);
    videoRef.current.play().catch(() => {});
  };

  const describeBoundary = (boundary) => boundary.refs
    .map(r => `${r.field === 'startText' ? 'start' : 'end'} of #${segments[r.index]?.number}`)
    .join(' / ');

  // ---- Black-frame scan and suggestions ----
  const stopScanPolling = () => {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    scanPollRef.current = null;
  };

  useEffect(() => () => {
    stopScanPolling();
    if (scanIdRef.current && scanConfig?.api) {
      fetch(`${scanConfig.api}/group-split-black-scans/${scanIdRef.current}/cancel`, { method: 'POST' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScan = async () => {
    if (!scanConfig) return;
    stopScanPolling();
    const fullScan = scanWindow === 'full';
    const previous = scan?.intervals || [];
    const previousWindow = scan?.window || 0;
    setScan({ status: 'running', progress: 0, intervals: previous, fullScan, window: fullScan ? FULL_SCAN_RADIUS : Number(scanWindow) });
    try {
      const res = await fetch(`${scanConfig.api}/groups/${scanConfig.groupId}/split/black-frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scanConfig.sceneId,
          cuts: boundaries.map(b => b.time),
          window: fullScan ? undefined : Number(scanWindow),
          fullScan
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Scan failed');
      scanIdRef.current = data.data.id;
      const radius = Math.max(previousWindow, fullScan ? FULL_SCAN_RADIUS : data.data.window);
      const tick = async () => {
        try {
          const r = await fetch(`${scanConfig.api}/group-split-black-scans/${data.data.id}`);
          const d = await r.json();
          if (!d.success) return;
          // Black runs of the same file never change, so earlier results stay valid alongside the new ones
          setScan({ ...d.data, window: radius, intervals: unionIntervals(previous, d.data.intervals || []) });
          if (d.data.status !== 'running') {
            stopScanPolling();
            scanIdRef.current = null;
          }
        } catch {
          // Transient; keep polling
        }
      };
      scanPollRef.current = setInterval(tick, 1500);
      tick();
    } catch (e) {
      setScan({ status: 'failed', error: e.message, intervals: previous, window: previousWindow });
    }
  };

  const cancelScan = () => {
    if (!scanIdRef.current || !scanConfig) return;
    fetch(`${scanConfig.api}/group-split-black-scans/${scanIdRef.current}/cancel`, { method: 'POST' }).catch(() => {});
    stopScanPolling();
    scanIdRef.current = null;
    setScan(prev => ({ ...prev, status: 'cancelled' }));
  };

  const blackIntervals = useMemo(() => scan?.intervals || [], [scan?.intervals]);
  const suggestions = useMemo(() => {
    if (!blackIntervals.length) return {};
    const result = {};
    boundaries.forEach(b => {
      const s = suggestBlackCut(blackIntervals, b.time, scan?.window || 90);
      if (s && Math.abs(s.delta) >= 0.1) result[b.key] = s;
    });
    return result;
  }, [blackIntervals, boundaries, scan?.window]);
  const pendingSuggestions = Object.keys(suggestions).length;
  const blackCandidates = useMemo(
    () => blackCutCandidates(blackIntervals, segments, { parseClock, minLength: minSceneLength }),
    [blackIntervals, segments, parseClock, minSceneLength]
  );

  const applySuggestion = (index) => {
    const s = suggestions[boundaries[index]?.key];
    if (s) moveBoundary(index, s.suggested, { force: true });
  };

  // Snap every cut to its suggestion, skipping any that would cross a neighbor. An end/start pair around a gap
  // may land on the same black run, which joins the two scenes at one shared cut.
  const applyAllSuggestions = () => {
    const targets = boundaries.map(b => suggestions[b.key]?.suggested ?? b.time);
    const isEnd = (b) => b.refs.every(r => r.field === 'endText');
    const isStart = (b) => b.refs.every(r => r.field === 'startText');
    const fits = (i, a, j, c) => (c - a >= MIN_GAP) || (Math.abs(c - a) < 0.05 && isEnd(boundaries[i]) && isStart(boundaries[j]));
    const placed = [];
    boundaries.forEach((b, i) => {
      const s = suggestions[b.key];
      const prev = i > 0 ? placed[i - 1] : -Infinity;
      const ok = s && (i === 0 || fits(i - 1, prev, i, s.suggested))
        && (i === boundaries.length - 1 || fits(i, s.suggested, i + 1, targets[i + 1]));
      placed[i] = ok ? s.suggested : b.time;
      if (ok) onSetTimes(b.refs, s.suggested);
      else targets[i] = b.time;
    });
  };

  const onBlackClick = (event, interval) => {
    event.stopPropagation();
    const middle = Math.round(((interval.start + interval.end) / 2) * 10) / 10;
    if (event.shiftKey && onInsertCuts) insertCutsAt([middle]);
    else if (selected) moveBoundary(selectedIndex, middle, { force: true });
    else seekVideo(middle, true);
  };

  const onTrackDoubleClick = (event) => {
    if (!onInsertCuts) return;
    insertCutsAt([Math.round(timeFromEvent(event) * 10) / 10]);
  };

  const selectedSuggestion = selected ? suggestions[selected.key] : null;

  const hoverCue = hover ? cueAt(cues, hover.time) : null;
  const trackRect = trackRef.current?.getBoundingClientRect();

  return (
    <div className="stl" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="stl-top">
        {media && (
          <div className="stl-video-wrap">
            <video
              ref={videoRef}
              className="stl-video"
              controls
              preload="metadata"
              playsInline
              onTimeUpdate={(e) => trackPosition(e.currentTarget)}
              onSeeking={(e) => { if (!pendingResumeRef.current) positionRef.current = e.currentTarget.currentTime; }}
              onSeeked={(e) => trackPosition(e.currentTarget)}
              onPlay={() => { wasPlayingRef.current = true; }}
              onPause={(e) => { if (!recoveryRef.current.timer && !pendingResumeRef.current && !e.currentTarget.error) wasPlayingRef.current = false; }}
              onPlaying={() => { if (!usingHlsRef.current) recoveryRef.current.attempts = 0; }}
              onError={handleVideoError}
            />
            {videoError && (
              <div className="stl-video-error">
                {videoError}
                <button type="button" className="stl-btn" onClick={reloadPreview}>↻ Reload preview</button>
              </div>
            )}
            <div className="stl-muted">
              {usingHls ? 'Transcoded preview (HLS)' : 'Direct preview'} · {formatPreciseClock(currentTime)}
              {' · '}
              <button type="button" className="stl-link-btn" onClick={reloadPreview} title="Reload the preview stream at the current position">↻ Reload</button>
            </div>
          </div>
        )}
        <div className="stl-panel">
          {selected ? (
            <>
              <div className="stl-panel-title">
                Cut at <strong>{formatPreciseClock(selected.time)}</strong>
              </div>
              <div className="stl-muted">{describeBoundary(selected)}</div>
              <div className="stl-nudges">
                {NUDGES.map(n => (
                  <button key={n} type="button" className="stl-btn" onClick={() => moveBoundary(selectedIndex, selected.time + n, { force: true })}>
                    {n > 0 ? '+' : '−'}{Math.abs(n)}s
                  </button>
                ))}
              </div>
              <div className="stl-nudges">
                {media && (
                  <button type="button" className="stl-btn" onClick={() => moveBoundary(selectedIndex, videoRef.current?.currentTime ?? currentTime, { seek: false })}>
                    ⤓ Set to video time ({formatPreciseClock(currentTime)})
                  </button>
                )}
                {media && <button type="button" className="stl-btn" onClick={previewCut}>▶ Preview cut</button>}
                <button type="button" className="stl-btn" disabled={selectedIndex <= 0} onClick={() => setSelectedKey(boundaries[selectedIndex - 1].key)}>◀ Prev cut</button>
                <button type="button" className="stl-btn" disabled={selectedIndex >= boundaries.length - 1} onClick={() => setSelectedKey(boundaries[selectedIndex + 1].key)}>Next cut ▶</button>
              </div>
              <div className="stl-muted">Drag the handle, use the buttons, or press ←/→ (Shift = 5s, Alt = 0.1s).</div>
              {selectedSuggestion && (
                <div className="stl-suggest">
                  ⬛ Black frames at {formatPreciseClock(selectedSuggestion.interval.start)}–{formatPreciseClock(selectedSuggestion.interval.end)}
                  <button type="button" className="stl-btn stl-btn-suggest" onClick={() => applySuggestion(selectedIndex)}>
                    Snap to {formatPreciseClock(selectedSuggestion.suggested)} ({selectedSuggestion.delta > 0 ? '+' : '−'}{Math.abs(selectedSuggestion.delta).toFixed(1)}s) · S
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="stl-muted">
              Click a cut handle on the timeline to select it, then drag or nudge it. Click anywhere on the timeline to seek the preview.
            </div>
          )}
          {onInsertCuts && (
            <div className="stl-cuts">
              <div className="stl-nudges">
                <button type="button" className="stl-btn" onClick={() => insertCutsAt([videoRef.current?.currentTime ?? currentTime])}>
                  ✚ Insert cut at {formatPreciseClock(currentTime)} · C
                </button>
                {selectedMerge && onRemoveCut && (
                  <button type="button" className="stl-btn stl-btn-danger" onClick={removeSelectedCut}>
                    🗑 Remove this cut (merge #{segments[selectedMerge.left]?.number} + #{segments[selectedMerge.right]?.number}) · Del
                  </button>
                )}
              </div>
              <div className="stl-muted">Double-click the timeline (or Shift+click a black-frame chip) to add a cut there.</div>
              {cutMessage && <div className="stl-cut-message">{cutMessage}</div>}
            </div>
          )}
          {scanConfig && (
            <div className="stl-scan">
              <div className="stl-scan-row">
                <strong>Suggest cuts from black frames</strong>
              </div>
              <div className="stl-scan-row">
                <select value={scanWindow} onChange={(e) => setScanWindow(e.target.value)} disabled={scan?.status === 'running'}>
                  {SCAN_WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
                {scan?.status === 'running' ? (
                  <button type="button" className="stl-btn" onClick={cancelScan}>Cancel</button>
                ) : (
                  <button type="button" className="stl-btn" disabled={!scanConfig.enabled} onClick={startScan} title={scanConfig.disabledReason || undefined}>
                    🔍 {scan ? 'Rescan' : 'Find black frames'}
                  </button>
                )}
              </div>
              {!scanConfig.enabled && scanConfig.disabledReason && <div className="stl-muted">{scanConfig.disabledReason}</div>}
              {scan?.status === 'running' && (
                <div className="stl-progress"><div style={{ width: `${Math.round((scan.progress || 0) * 100)}%` }} /></div>
              )}
              {scan?.status === 'failed' && <div className="stl-scan-error">{scan.error}</div>}
              {scan?.status === 'completed' && scan.warning && <div className="stl-scan-error">⚠️ {scan.warning}</div>}
              {scan && scan.status !== 'failed' && scan.status !== 'running' && (
                <div className="stl-muted">
                  {blackIntervals.length} black run{blackIntervals.length === 1 ? '' : 's'} found
                  {scan.status === 'cancelled' ? ' (cancelled)' : ''} · {pendingSuggestions} cut{pendingSuggestions === 1 ? '' : 's'} can snap
                </div>
              )}
              {pendingSuggestions > 0 && scan?.status !== 'running' && (
                <button type="button" className="stl-btn stl-btn-suggest" onClick={applyAllSuggestions}>
                  ⬛ Snap all cuts to black frames ({pendingSuggestions})
                </button>
              )}
              {onInsertCuts && blackIntervals.length > 0 && scan?.status !== 'running' && (
                <div className="stl-scan-row">
                  <button
                    type="button"
                    className="stl-btn stl-btn-suggest"
                    disabled={!blackCandidates.length}
                    onClick={() => insertCutsAt(blackCandidates, { select: false })}
                    title="Adds a cut in the middle of every black run that isn't near an existing cut"
                  >
                    ✚ Insert cuts at black frames ({blackCandidates.length})
                  </button>
                  <label className="stl-muted">
                    min scene
                    <select value={minSceneLength} onChange={(e) => setMinSceneLength(Number(e.target.value))}>
                      {MIN_SCENE_OPTIONS.map(v => <option key={v} value={v}>{v >= 60 ? `${v / 60} min` : `${v}s`}</option>)}
                    </select>
                  </label>
                </div>
              )}
              {scan?.stored && scan.status === 'completed' && (
                <div className="stl-muted">Showing stored results{scan.fullScan ? ' of a whole-file scan' : ''}.</div>
              )}
            </div>
          )}
          <label className="stl-zoom">
            Zoom
            <input type="range" min="1" max="10" step="1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            {zoom}×
          </label>
        </div>
      </div>

      <div className="stl-scroll">
        <div className="stl-inner" style={{ width: `${zoom * 100}%` }}>
          <div
            ref={trackRef}
            className="stl-track"
            onClick={onTrackClick}
            onDoubleClick={onTrackDoubleClick}
            onPointerMove={onTrackHover}
            onPointerLeave={() => !dragRef.current && setHover(null)}
          >
            {filmstrip.length > 0 && (
              <div className="stl-filmstrip">
                {filmstrip.map((cue, i) => (
                  <div key={i} className="stl-film" style={spriteStyle(cue, cue.w * (FILM_HEIGHT / cue.h), FILM_HEIGHT) || undefined} />
                ))}
              </div>
            )}
            {timed.map(s => {
              if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start) return null;
              const color = COLORS[s.index % COLORS.length];
              const len = s.end - s.start;
              return (
                <div
                  key={s.uid ?? s.number}
                  className={`stl-seg${s.include ? '' : ' stl-seg-off'}${errors[s.index] ? ' stl-seg-error' : ''}`}
                  style={{ left: pct(s.start), width: pct(len), '--seg-color': color }}
                  title={`#${s.number} ${s.title || ''} · ${formatPreciseClock(s.start)}–${formatPreciseClock(s.end)}${errors[s.index] ? ` · ${errors[s.index]}` : ''}`}
                >
                  <span className="stl-seg-label">#{s.number} · {formatPreciseClock(len)}</span>
                  {s.listedDuration ? (
                    <span
                      className="stl-listed"
                      style={{ left: `${Math.min(100, (s.listedDuration / len) * 100)}%` }}
                      title={`AEBN length ${formatPreciseClock(s.listedDuration)}`}
                    />
                  ) : null}
                </div>
              );
            })}
            {blackIntervals.map(iv => (
              <div key={`b${iv.start}`} className="stl-black" style={{ left: pct(iv.start), width: `max(2px, ${pct(iv.end - iv.start)})` }} />
            ))}
            {boundaries.map(b => {
              const s = suggestions[b.key];
              return s ? (
                <div key={`s${b.key}`} className="stl-suggest-mark" style={{ left: pct(s.suggested) }} title={`Suggested cut ${formatPreciseClock(s.suggested)}`} />
              ) : null;
            })}
            {boundaries.map((b, i) => (
              <div
                key={b.key}
                className={`stl-handle${b.key === selectedKey ? ' stl-handle-selected' : ''}${b.key === draggingKey ? ' stl-handle-dragging' : ''}${b.included ? '' : ' stl-handle-off'}`}
                style={{ left: pct(b.time) }}
                onPointerDown={(e) => startDrag(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                title={`${formatPreciseClock(b.time)} — ${describeBoundary(b)}`}
              >
                <span className="stl-handle-grip" />
              </div>
            ))}
            <div className="stl-playhead" style={{ left: pct(currentTime) }} />
          </div>
          {blackIntervals.length > 0 && (
            <div className="stl-black-lane" title="Black frames — click to snap the selected cut (or seek), Shift+click to insert a cut">
              {blackIntervals.map(iv => (
                <button
                  key={`l${iv.start}`}
                  type="button"
                  className="stl-black-chip"
                  style={{ left: pct(iv.start), width: `max(6px, ${pct(iv.end - iv.start)})` }}
                  onClick={(e) => onBlackClick(e, iv)}
                  title={`Black ${formatPreciseClock(iv.start)}–${formatPreciseClock(iv.end)} (${iv.duration.toFixed(1)}s)`}
                />
              ))}
            </div>
          )}
          <div className="stl-ruler">
            {Array.from({ length: 10 * zoom + 1 }, (_, i) => (
              <span key={i} style={{ left: `${(i / (10 * zoom)) * 100}%` }}>{formatPreciseClock(Math.round((i / (10 * zoom)) * total))}</span>
            ))}
          </div>
        </div>
      </div>

      {hover && trackRect && (
        <div className="stl-hover" style={{ left: hover.x, top: trackRect.top - 8 }}>
          {hoverCue && spriteSize && <div className="stl-hover-thumb" style={spriteStyle(hoverCue, 160, 90)} />}
          <div>{formatPreciseClock(hover.time)}</div>
        </div>
      )}

      <style>{`
        .stl { position: relative; outline: none; margin: 0.75rem 0 1rem; padding: 0.75rem; border: 1px solid rgba(124,58,237,0.25); border-radius: 0.5rem; background: rgba(124,58,237,0.04); }
        .stl:focus-visible { box-shadow: 0 0 0 2px rgba(124,58,237,0.5); }
        .stl-top { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 1rem; margin-bottom: 0.75rem; }
        .stl-top:has(> .stl-panel:only-child) { grid-template-columns: 1fr; }
        .stl-video-wrap { position: relative; }
        .stl-video { width: 100%; max-height: 320px; background: #000; border-radius: 0.375rem; display: block; }
        .stl-video-error { position: absolute; inset: 0 0 1.5rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: center; text-align: center; padding: 1rem; color: #fff; background: rgba(0,0,0,0.7); border-radius: 0.375rem; font-size: 0.9rem; }
        .stl-video-error .stl-btn { color: #111827; background: #fff; }
        .stl-link-btn { padding: 0; border: none; background: none; color: #2563eb; cursor: pointer; font-size: inherit; text-decoration: underline; }
        .stl-panel { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; }
        .stl-panel-title { font-size: 1.05rem; }
        .stl-muted { color: #6b7280; font-size: 0.8rem; }
        .stl-nudges { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .stl-btn { padding: 0.3rem 0.55rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: var(--bg-secondary, #fff); color: inherit; cursor: pointer; font-size: 0.82rem; }
        .stl-btn:hover:not(:disabled) { border-color: #7c3aed; }
        .stl-btn:disabled { opacity: 0.45; cursor: default; }
        .stl-zoom { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; margin-top: auto; }
        .stl-scroll { overflow-x: auto; overflow-y: hidden; padding-bottom: 0.25rem; }
        .stl-inner { position: relative; min-width: 100%; }
        .stl-track { position: relative; height: ${TRACK_HEIGHT}px; background: #1f2937; border-radius: 0.5rem; cursor: crosshair; user-select: none; touch-action: none; }
        .stl-filmstrip { position: absolute; inset: 8px 0; display: flex; overflow: hidden; opacity: 0.6; pointer-events: none; }
        .stl-film { flex: 1 1 0; min-width: 0; height: ${FILM_HEIGHT}px; background-repeat: no-repeat; }
        .stl-seg { position: absolute; top: 4px; bottom: 4px; background: color-mix(in srgb, var(--seg-color) 45%, transparent); border: 2px solid var(--seg-color); border-radius: 0.3rem; box-sizing: border-box; overflow: hidden; pointer-events: none; }
        .stl-seg-off { background: repeating-linear-gradient(45deg, rgba(107,114,128,0.35) 0 6px, rgba(107,114,128,0.15) 6px 12px); border-color: #6b7280; border-style: dashed; }
        .stl-seg-error { border-color: #ef4444; box-shadow: inset 0 0 0 2px #ef4444; }
        .stl-seg-label { position: absolute; left: 8px; top: 6px; color: #fff; font-size: 0.95rem; font-weight: 700; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.95); }
        .stl-listed { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px dotted rgba(255,255,255,0.75); }
        .stl-handle { position: absolute; top: -8px; bottom: -8px; width: 22px; margin-left: -11px; cursor: ew-resize; z-index: 2; touch-action: none; }
        .stl-handle::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 3px; background: #fbbf24; }
        .stl-handle-grip { position: absolute; left: 2px; top: 50%; width: 19px; height: 48px; margin-top: -24px; border-radius: 5px; background: #fbbf24; border: 1px solid #92400e; box-sizing: border-box; }
        .stl-handle-off::before, .stl-handle-off .stl-handle-grip { background: #9ca3af; border-color: #4b5563; }
        .stl-handle:hover .stl-handle-grip, .stl-handle-selected .stl-handle-grip { background: #fff; border-color: #7c3aed; box-shadow: 0 0 0 2px #7c3aed; }
        .stl-handle-selected::before { background: #fff; }
        .stl-handle-dragging { z-index: 3; }
        .stl-playhead { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #ef4444; pointer-events: none; z-index: 1; }
        .stl-ruler { position: relative; height: 22px; margin-top: 2px; font-size: 0.8rem; color: #6b7280; }
        .stl-black { position: absolute; top: 0; bottom: 0; background: rgba(0,0,0,0.75); pointer-events: none; z-index: 1; }
        .stl-suggest-mark { position: absolute; top: 0; bottom: 0; width: 0; border-left: 3px dashed #22d3ee; pointer-events: none; z-index: 1; }
        .stl-black-lane { position: relative; height: 18px; margin-top: 4px; background: rgba(107,114,128,0.15); border-radius: 0.25rem; }
        .stl-black-chip { position: absolute; top: 2px; bottom: 2px; padding: 0; background: #111827; border: 1px solid #22d3ee; border-radius: 3px; cursor: pointer; }
        .stl-black-chip:hover { background: #22d3ee; }
        .stl-scan { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.5rem; border-top: 1px solid rgba(107,114,128,0.25); }
        .stl-scan-row { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
        .stl-scan select { padding: 0.3rem 0.4rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: var(--bg-secondary, #fff); color: inherit; font-size: 0.82rem; }
        .stl-scan-error { color: #dc2626; font-size: 0.8rem; }
        .stl-progress { height: 6px; border-radius: 3px; background: rgba(107,114,128,0.25); overflow: hidden; }
        .stl-progress > div { height: 100%; background: #22d3ee; transition: width 0.4s; }
        .stl-suggest { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.82rem; }
        .stl-btn-suggest { border-color: #22d3ee; }
        .stl-btn-danger { border-color: #f87171; color: #dc2626; }
        .stl-cuts { display: flex; flex-direction: column; gap: 0.35rem; padding-top: 0.5rem; border-top: 1px solid rgba(107,114,128,0.25); }
        .stl-cut-message { font-size: 0.8rem; color: #7c3aed; }
        .stl-ruler span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
        .stl-ruler span:first-child { transform: none; }
        .stl-ruler span:last-child { transform: translateX(-100%); }
        .stl-hover { position: fixed; transform: translate(-50%, -100%); pointer-events: none; background: rgba(17,24,39,0.92); color: #fff; padding: 0.25rem; border-radius: 0.375rem; font-size: 0.75rem; text-align: center; z-index: 1100; }
        .stl-hover-thumb { width: 160px; height: 90px; background-repeat: no-repeat; border-radius: 0.25rem; margin-bottom: 0.2rem; }
      `}</style>
    </div>
  );
}
