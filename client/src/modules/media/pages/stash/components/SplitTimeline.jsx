import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';

const MERGE_TOLERANCE = 0.25;
const MIN_GAP = 0.5;
const SEEK_THROTTLE_MS = 200;
const NUDGES = [-5, -1, -0.1, 0.1, 1, 5];
const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777', '#0891b2', '#65a30d', '#dc2626'];

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

/**
 * Visual cut-point editor for the group scene split modal. Segments use the modal's editable
 * shape ({ number, include, startText, endText }); edits are reported through onSetTimes so the
 * table and timeline always share one source of truth.
 */
export default function SplitTimeline({ duration, segments, errors, media, preferHls, parseClock, onSetTimes }) {
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

  const total = Math.max(1, Number(duration) || 1);
  const pct = (t) => `${(Math.min(Math.max(t, 0), total) / total) * 100}%`;

  // ---- Video source: direct stream, falling back to Stash's transcoded HLS ----
  const attachHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !media?.hlsUrl) return false;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setUsingHls(true);
    if (Hls.isSupported()) {
      const hls = new Hls({ startPosition: video.currentTime || 0 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setVideoError('Preview stream failed to load. Cut points can still be edited.');
      });
      hls.loadSource(media.hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      return true;
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = media.hlsUrl;
      return true;
    }
    return false;
  }, [media?.hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return undefined;
    setVideoError(null);
    if (preferHls && attachHls()) {
      // Transcoded source (AVI/WMV etc.)
    } else if (media.directUrl) {
      setUsingHls(false);
      video.src = media.directUrl;
    }
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [media, preferHls, attachHls]);

  const handleVideoError = () => {
    if (!usingHls && attachHls()) return;
    setVideoError('This file can\'t be previewed in the browser. Cut points can still be edited.');
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
    if (!selected || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
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
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onError={handleVideoError}
            />
            {videoError && <div className="stl-video-error">{videoError}</div>}
            <div className="stl-muted">{usingHls ? 'Transcoded preview (HLS)' : 'Direct preview'} · {formatPreciseClock(currentTime)}</div>
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
            </>
          ) : (
            <div className="stl-muted">
              Click a cut handle on the timeline to select it, then drag or nudge it. Click anywhere on the timeline to seek the preview.
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
            onPointerMove={onTrackHover}
            onPointerLeave={() => !dragRef.current && setHover(null)}
          >
            {filmstrip.length > 0 && (
              <div className="stl-filmstrip">
                {filmstrip.map((cue, i) => (
                  <div key={i} className="stl-film" style={spriteStyle(cue, cue.w * (54 / cue.h), 54) || undefined} />
                ))}
              </div>
            )}
            {timed.map(s => {
              if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start) return null;
              const color = COLORS[s.index % COLORS.length];
              const len = s.end - s.start;
              return (
                <div
                  key={s.number}
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
                title={`${formatPreciseClock(b.time)} — ${describeBoundary(b)}`}
              >
                <span className="stl-handle-grip" />
              </div>
            ))}
            <div className="stl-playhead" style={{ left: pct(currentTime) }} />
          </div>
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
        .stl-video-error { position: absolute; inset: 0 0 1.5rem 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 1rem; color: #fff; background: rgba(0,0,0,0.7); border-radius: 0.375rem; font-size: 0.9rem; }
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
        .stl-track { position: relative; height: 72px; background: #1f2937; border-radius: 0.375rem; cursor: crosshair; user-select: none; touch-action: none; }
        .stl-filmstrip { position: absolute; inset: 9px 0; display: flex; overflow: hidden; opacity: 0.55; pointer-events: none; }
        .stl-film { flex: 1 1 0; min-width: 0; height: 54px; background-repeat: no-repeat; }
        .stl-seg { position: absolute; top: 4px; bottom: 4px; background: color-mix(in srgb, var(--seg-color) 45%, transparent); border: 2px solid var(--seg-color); border-radius: 0.3rem; box-sizing: border-box; overflow: hidden; pointer-events: none; }
        .stl-seg-off { background: repeating-linear-gradient(45deg, rgba(107,114,128,0.35) 0 6px, rgba(107,114,128,0.15) 6px 12px); border-color: #6b7280; border-style: dashed; }
        .stl-seg-error { border-color: #ef4444; box-shadow: inset 0 0 0 2px #ef4444; }
        .stl-seg-label { position: absolute; left: 6px; top: 3px; color: #fff; font-size: 0.75rem; font-weight: 700; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
        .stl-listed { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px dotted rgba(255,255,255,0.75); }
        .stl-handle { position: absolute; top: -6px; bottom: -6px; width: 16px; margin-left: -8px; cursor: ew-resize; z-index: 2; touch-action: none; }
        .stl-handle::before { content: ''; position: absolute; left: 7px; top: 0; bottom: 0; width: 2px; background: #fbbf24; }
        .stl-handle-grip { position: absolute; left: 2px; top: 50%; width: 12px; height: 26px; margin-top: -13px; border-radius: 4px; background: #fbbf24; border: 1px solid #92400e; box-sizing: border-box; }
        .stl-handle-off::before, .stl-handle-off .stl-handle-grip { background: #9ca3af; border-color: #4b5563; }
        .stl-handle:hover .stl-handle-grip, .stl-handle-selected .stl-handle-grip { background: #fff; border-color: #7c3aed; box-shadow: 0 0 0 2px #7c3aed; }
        .stl-handle-selected::before { background: #fff; }
        .stl-handle-dragging { z-index: 3; }
        .stl-playhead { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #ef4444; pointer-events: none; z-index: 1; }
        .stl-ruler { position: relative; height: 18px; font-size: 0.7rem; color: #6b7280; }
        .stl-ruler span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
        .stl-ruler span:first-child { transform: none; }
        .stl-ruler span:last-child { transform: translateX(-100%); }
        .stl-hover { position: fixed; transform: translate(-50%, -100%); pointer-events: none; background: rgba(17,24,39,0.92); color: #fff; padding: 0.25rem; border-radius: 0.375rem; font-size: 0.75rem; text-align: center; z-index: 1100; }
        .stl-hover-thumb { width: 160px; height: 90px; background-repeat: no-repeat; border-radius: 0.25rem; margin-bottom: 0.2rem; }
      `}</style>
    </div>
  );
}
