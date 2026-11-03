import React, { useCallback, useEffect, useRef, useState } from 'react';
import config from '../../../../../config';
import SplitTimeline, { formatPreciseClock } from './SplitTimeline';
import { insertCuts, newSegmentUid, removeCut } from './splitSegmentEdits';

const formatClock = (seconds) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '';
  const total = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

// Accepts H:MM:SS, MM:SS or plain seconds
const parseClock = (text) => {
  const value = String(text).trim();
  if (!value) return NaN;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

const toEditable = (segments) => segments.map(seg => ({
  ...seg,
  uid: newSegmentUid(),
  include: true,
  startText: formatClock(seg.start),
  endText: formatClock(seg.end)
}));

const ACTIVE = ['queued', 'running'];

export default function SplitSceneModal({ groupId, scene, onClose, onFinished }) {
  const api = `${config.apiBaseUrl}/api/stash`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [aebnUrl, setAebnUrl] = useState('');
  const [geviUrl, setGeviUrl] = useState('');
  const [offsetText, setOffsetText] = useState('0');
  const [plan, setPlan] = useState(null);
  const [segments, setSegments] = useState([]);
  const [originalAction, setOriginalAction] = useState('unlink');
  const [forceTranscode, setForceTranscode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);
  const finishedRef = useRef(false);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const pollJob = useCallback((jobId) => {
    stopPolling();
    const tick = async () => {
      try {
        const res = await fetch(`${api}/group-split-jobs/${jobId}`);
        const data = await res.json();
        if (!data.success) return;
        setJob(data.data);
        if (!ACTIVE.includes(data.data.status)) {
          stopPolling();
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished?.(data.data);
          }
        }
      } catch {
        // Transient network error; keep polling
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2000);
  }, [api, onFinished]);

  const loadPreview = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const offset = parseClock(overrides.offsetText ?? offsetText);
      const res = await fetch(`${api}/groups/${groupId}/split/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          aebnUrl: (overrides.aebnUrl ?? aebnUrl).trim() || null,
          geviUrl: (overrides.geviUrl ?? geviUrl).trim() || null,
          offset: Number.isFinite(offset) ? offset : 0
        })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Preview failed');
        setErrorCode(data.code || null);
        return;
      }
      setPlan(data.data);
      setSegments(toEditable(data.data.segments));
      if (!aebnUrl && data.data.aebnUrl) setAebnUrl(data.data.aebnUrl);
      if (!geviUrl && data.data.geviUrl) setGeviUrl(data.data.geviUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, groupId, scene.id, aebnUrl, geviUrl, offsetText]);

  // Resume an in-flight job for this scene, otherwise build a fresh preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${api}/groups/${groupId}/split-jobs`);
        const data = await res.json();
        const active = data.success && data.data.find(j => j.sceneId === String(scene.id) && ACTIVE.includes(j.status));
        if (!cancelled && active) {
          setJob(active);
          setLoading(false);
          pollJob(active.id);
          return;
        }
      } catch {
        // Fall through to preview
      }
      if (!cancelled) loadPreview();
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSegment = (index, patch) => {
    setSegments(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const setCutTimes = useCallback((refs, seconds) => {
    const text = formatPreciseClock(seconds);
    setSegments(prev => prev.map((s, i) => {
      const fields = refs.filter(r => r.index === i);
      if (!fields.length) return s;
      return fields.reduce((acc, r) => ({ ...acc, [r.field]: text }), s);
    }));
  }, []);

  const groupName = plan?.group?.name || '';

  // Returns how many of the requested cuts were added (times too close to an existing cut are ignored)
  const insertCutsAt = useCallback((times) => {
    const result = insertCuts(segments, times, { parseClock, formatTime: formatPreciseClock, groupName });
    if (result.inserted.length) setSegments(result.segments);
    return result.inserted.length;
  }, [segments, groupName]);

  const removeCutBetween = useCallback((leftIndex, rightIndex) => {
    setSegments(prev => removeCut(prev, leftIndex, rightIndex, { parseClock, groupName }));
  }, [groupName]);

  const removeChip = (index, key, id) => {
    setSegments(prev => prev.map((s, i) => (i === index ? { ...s, [key]: s[key].filter(x => x.id !== id) } : s)));
  };

  const included = segments.filter(s => s.include);
  const segmentErrors = (() => {
    const errors = {};
    const duration = plan?.source?.duration || 0;
    let previousEnd = -1;
    segments.forEach((s, i) => {
      if (!s.include) return;
      const start = parseClock(s.startText);
      const end = parseClock(s.endText);
      if (!Number.isFinite(start) || !Number.isFinite(end)) errors[i] = 'Invalid time';
      else if (end <= start) errors[i] = 'End must be after start';
      else if (duration && end > duration + 1) errors[i] = 'Ends after the file';
      else if (start < previousEnd - 0.5) errors[i] = 'Overlaps previous scene';
      if (Number.isFinite(end)) previousEnd = end;
    });
    return errors;
  })();
  const duration = plan?.source?.duration || 0;
  const wholeFileOnly = segments.length === 1 && included.length === 1
    && parseClock(segments[0].startText) <= 1 && parseClock(segments[0].endText) >= duration - 1;
  const canStart = plan && included.length > 0 && !wholeFileOnly && Object.keys(segmentErrors).length === 0
    && plan.fileAccess?.readable && plan.fileAccess?.writable && plan.ffmpegAvailable;

  const startSplit = async () => {
    if (originalAction === 'delete' && !window.confirm('Delete the original full-movie scene AND its file once every scene has been created?')) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${api}/groups/${groupId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          studioId: plan.studio?.id || null,
          originalAction,
          forceTranscode,
          segments: included.map(s => ({
            number: s.number,
            start: parseClock(s.startText),
            end: parseClock(s.endText),
            title: s.title,
            details: s.details,
            date: s.date,
            image: s.image,
            urls: s.urls,
            performers: s.performers,
            tags: s.tags
          }))
        })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Could not start the split');
        return;
      }
      finishedRef.current = false;
      setJob(data.data);
      pollJob(data.data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const cancelSplit = async () => {
    if (!job) return;
    const res = await fetch(`${api}/group-split-jobs/${job.id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) setError(data.error);
  };

  const running = job && ACTIVE.includes(job.status);

  return (
    <div className="ssm-overlay" onClick={() => !running && onClose()}>
      <div className="ssm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ssm-header">
          <h2>✂️ Split into Scenes</h2>
          <button className="ssm-close" onClick={onClose} title={running ? 'Close (the split keeps running on the server)' : 'Close'}>×</button>
        </div>
        <p className="ssm-subtitle">{scene.title || `Scene ${scene.id}`}</p>

        {job ? (
          <div className="ssm-job">
            <div className="ssm-job-status">
              <strong className={`ssm-status ssm-status-${job.status}`}>{job.status.replace(/_/g, ' ')}</strong>
              <span>{job.step}</span>
            </div>
            <div className="ssm-progress"><div style={{ width: `${Math.round(job.progress || 0)}%` }} /></div>
            {job.transcodeReason && <p className="ssm-note">🔄 {job.transcodeReason} — scenes are converted to MP4{job.encoding ? ` (${job.encoding})` : ''}.</p>}
            {job.error && <p className="ssm-error">{job.error}</p>}
            <table className="ssm-table">
              <thead><tr><th>#</th><th>Time</th><th>Title</th><th>Status</th></tr></thead>
              <tbody>
                {job.segments.map(s => (
                  <tr key={s.number}>
                    <td>{s.number}</td>
                    <td>{formatClock(s.start)}–{formatClock(s.end)}</td>
                    <td>
                      {s.newSceneId ? <a href={`/media/stash/scenes/${s.newSceneId}`}>{s.title}</a> : s.title}
                      {s.error && <div className="ssm-error-small">{s.error}</div>}
                    </td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {job.log?.length > 0 && <pre className="ssm-log">{job.log.join('\n')}</pre>}
            <div className="ssm-actions">
              {running && job.status !== 'queued' && job.progress < 80 && !job.cancelRequested && (
                <button className="ssm-btn ssm-btn-danger" onClick={cancelSplit}>Cancel</button>
              )}
              <button className="ssm-btn" onClick={onClose}>{running ? 'Close (keeps running)' : 'Close'}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ssm-sources">
              <label>
                AEBN movie URL
                <input value={aebnUrl} onChange={(e) => setAebnUrl(e.target.value)} placeholder="https://gay.aebn.com/gay/movies/…" />
              </label>
              <label>
                GEVI movie URL (optional)
                <input value={geviUrl} onChange={(e) => setGeviUrl(e.target.value)} placeholder="https://www.gayeroticvideoindex.com/video/…" />
              </label>
              <label className="ssm-offset" title="Shift every cut point, e.g. when the file has an intro AEBN doesn't count">
                Start offset
                <input value={offsetText} onChange={(e) => setOffsetText(e.target.value)} placeholder="0:00" />
              </label>
              <button className="ssm-btn" disabled={loading} onClick={() => loadPreview()}>
                {loading ? 'Loading…' : plan ? 'Rebuild' : 'Load'}
              </button>
            </div>

            {loading && <p className="ssm-note">⏳ Loading the clip and scraping AEBN scene lengths / GEVI scene details when available (this can take ~20 seconds)…</p>}
            {error && (
              <p className="ssm-error">
                {error}
                {errorCode === 'NO_AEBN_URL' && ' Paste the AEBN movie URL above and click Load.'}
              </p>
            )}

            {plan && !loading && (
              <>
                <div className="ssm-info">
                  <div><strong>File:</strong> {plan.source.basename} · {formatClock(plan.source.duration)} · {plan.source.width}×{plan.source.height} · {plan.source.videoCodec}/{plan.source.audioCodec || 'no audio'} · {formatBytes(plan.source.size)}</div>
                  <div><strong>Studio:</strong> {plan.studio?.name || '—'} · <strong>Sources:</strong>{' '}
                    {plan.aebnUrl ? <a href={plan.aebnUrl} target="_blank" rel="noreferrer">AEBN</a> : 'none'}
                    {plan.geviUrl && <> · <a href={plan.geviUrl} target="_blank" rel="noreferrer">GEVI</a></>}
                  </div>
                </div>
                {plan.transcodeReason
                  ? <p className="ssm-note">🔄 {plan.transcodeReason} — each scene will be converted to MP4 at near-source quality (same resolution, frame rate and audio tracks; MP4-compatible audio is copied untouched). This takes a while.</p>
                  : (
                    <label className="ssm-check">
                      <input type="checkbox" checked={forceTranscode} onChange={(e) => setForceTranscode(e.target.checked)} />
                      Re-encode for frame-accurate cuts (slower, high-quality re-encode in the source's codec; otherwise cuts snap to the nearest keyframe with no quality loss)
                    </label>
                  )}
                {!plan.ffmpegAvailable && <p className="ssm-error">ffmpeg is not available on the server.</p>}
                {plan.fileAccess && (!plan.fileAccess.readable || !plan.fileAccess.writable) && (
                  <p className="ssm-error">Can't access the video file from the server: {plan.fileAccess.error}</p>
                )}
                {plan.warnings?.map((w, i) => <p key={i} className="ssm-warning">⚠️ {w}</p>)}
                {plan.mode === 'manual' && (
                  <p className="ssm-note">✍️ Manual mode: there are no AEBN scene lengths, so the clip starts as one scene. Insert cut lines on the timeline (playhead, double-click, or from black frames) to split it.</p>
                )}

                <SplitTimeline
                  duration={plan.source.duration}
                  segments={segments}
                  errors={segmentErrors}
                  media={plan.source.media}
                  preferHls={Boolean(plan.transcodeReason)}
                  parseClock={parseClock}
                  onSetTimes={setCutTimes}
                  onInsertCuts={insertCutsAt}
                  onRemoveCut={removeCutBetween}
                  initialBlackFrames={plan.blackFrames}
                  scan={{
                    api,
                    groupId,
                    sceneId: scene.id,
                    enabled: Boolean(plan.ffmpegAvailable && plan.fileAccess?.readable),
                    disabledReason: !plan.ffmpegAvailable
                      ? 'ffmpeg is not available on the server.'
                      : (!plan.fileAccess?.readable ? 'The server can\'t read the video file, so it can\'t be scanned.' : null)
                  }}
                />

                <table className="ssm-table">
                  <thead>
                    <tr><th></th><th>#</th><th>Start</th><th>End</th><th>Length</th><th>Title / metadata</th></tr>
                  </thead>
                  <tbody>
                    {segments.map((s, i) => {
                      const start = parseClock(s.startText);
                      const end = parseClock(s.endText);
                      return (
                        <tr key={s.uid} className={s.include ? '' : 'ssm-excluded'}>
                          <td><input type="checkbox" checked={s.include} onChange={(e) => updateSegment(i, { include: e.target.checked })} /></td>
                          <td>{s.number}</td>
                          <td><input className="ssm-time" value={s.startText} onChange={(e) => updateSegment(i, { startText: e.target.value })} /></td>
                          <td><input className="ssm-time" value={s.endText} onChange={(e) => updateSegment(i, { endText: e.target.value })} /></td>
                          <td>
                            {Number.isFinite(end - start) ? formatClock(end - start) : '—'}
                            {s.listedDuration ? <div className="ssm-muted">AEBN {formatClock(s.listedDuration)}</div> : null}
                            {segmentErrors[i] && <div className="ssm-error-small">{segmentErrors[i]}</div>}
                          </td>
                          <td className="ssm-meta">
                            <input className="ssm-title" value={s.title} onChange={(e) => updateSegment(i, { title: e.target.value })} />
                            <div className="ssm-chips">
                              {s.performers.map(p => (
                                <span key={p.id} className="ssm-chip ssm-chip-performer" title={p.scrapedName !== p.name ? `Scraped as ${p.scrapedName}` : undefined}>
                                  {p.name}{p.actionCode ? ` (${p.actionCode})` : ''}
                                  <button onClick={() => removeChip(i, 'performers', p.id)}>×</button>
                                </span>
                              ))}
                              {s.unmatchedPerformers.map(name => (
                                <span key={name} className="ssm-chip ssm-chip-missing" title="Not in your Stash library">{name}?</span>
                              ))}
                            </div>
                            <div className="ssm-chips">
                              {s.tags.map(t => (
                                <span key={t.id} className="ssm-chip">
                                  {t.name}
                                  <button onClick={() => removeChip(i, 'tags', t.id)}>×</button>
                                </span>
                              ))}
                              {s.unmatchedTags.length > 0 && <span className="ssm-muted">+{s.unmatchedTags.length} unmatched tag(s)</span>}
                            </div>
                            {s.details && <div className="ssm-details">{s.details}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {wholeFileOnly && <p className="ssm-note">Insert at least one cut line to split this clip.</p>}
                <div className="ssm-footer">
                  <label>
                    After splitting, the original scene should
                    <select value={originalAction} onChange={(e) => setOriginalAction(e.target.value)}>
                      <option value="unlink">be removed from this group (keep file)</option>
                      <option value="keep">stay in the group</option>
                      <option value="delete">be deleted along with its file</option>
                    </select>
                  </label>
                  <div className="ssm-actions">
                    <button className="ssm-btn" onClick={onClose}>Cancel</button>
                    <button className="ssm-btn ssm-btn-primary" disabled={!canStart || starting} onClick={startSplit}>
                      {starting ? 'Starting…' : `Split into ${included.length} scene${included.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        .ssm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-start; justify-content: center; z-index: 1000; overflow-y: auto; padding: 2rem 1rem; }
        .ssm-modal { background: var(--bg-primary, #fff); color: var(--text-primary, #111827); border-radius: 0.75rem; width: min(1200px, 100%); padding: 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .ssm-header { display: flex; justify-content: space-between; align-items: center; }
        .ssm-header h2 { margin: 0; }
        .ssm-close { background: none; border: none; font-size: 1.75rem; cursor: pointer; color: inherit; }
        .ssm-subtitle { margin: 0.25rem 0 1rem; color: #6b7280; }
        .ssm-sources { display: grid; grid-template-columns: 2fr 2fr 110px auto; gap: 0.75rem; align-items: end; margin-bottom: 1rem; }
        .ssm-sources label, .ssm-footer label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; }
        .ssm-sources input, .ssm-footer select, .ssm-table input { padding: 0.4rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; background: var(--bg-secondary, #fff); color: inherit; }
        .ssm-info { background: rgba(124,58,237,0.08); border-radius: 0.5rem; padding: 0.75rem; font-size: 0.9rem; display: grid; gap: 0.25rem; margin-bottom: 0.75rem; word-break: break-all; }
        .ssm-note { background: rgba(59,130,246,0.1); padding: 0.5rem 0.75rem; border-radius: 0.375rem; }
        .ssm-warning { background: rgba(245,158,11,0.15); padding: 0.4rem 0.75rem; border-radius: 0.375rem; margin: 0.25rem 0; }
        .ssm-error { background: rgba(239,68,68,0.12); color: #b91c1c; padding: 0.5rem 0.75rem; border-radius: 0.375rem; }
        .ssm-error-small { color: #dc2626; font-size: 0.8rem; }
        .ssm-muted { color: #6b7280; font-size: 0.8rem; }
        .ssm-check { display: flex; gap: 0.5rem; align-items: center; margin: 0.5rem 0; font-size: 0.9rem; }
        .ssm-table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
        .ssm-table th, .ssm-table td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; vertical-align: top; }
        .ssm-time { width: 80px; }
        .ssm-title { width: 100%; box-sizing: border-box; font-weight: 600; }
        .ssm-meta { min-width: 380px; }
        .ssm-excluded { opacity: 0.45; }
        .ssm-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; align-items: center; }
        .ssm-chip { background: #e5e7eb; color: #111827; border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; }
        .ssm-chip button { background: none; border: none; cursor: pointer; padding: 0; font-size: 0.9rem; line-height: 1; color: #6b7280; }
        .ssm-chip-performer { background: #ede9fe; color: #5b21b6; }
        .ssm-chip-missing { background: #fef3c7; color: #92400e; }
        .ssm-details { margin-top: 0.35rem; font-size: 0.8rem; color: #6b7280; max-height: 4.5em; overflow: hidden; }
        .ssm-footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
        .ssm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.75rem; }
        .ssm-btn { padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: var(--bg-secondary, #f3f4f6); color: inherit; cursor: pointer; font-weight: 600; }
        .ssm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ssm-btn-primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
        .ssm-btn-danger { background: #ef4444; border-color: #ef4444; color: #fff; }
        .ssm-job-status { display: flex; gap: 1rem; align-items: center; }
        .ssm-status { text-transform: capitalize; }
        .ssm-status-completed { color: #16a34a; }
        .ssm-status-failed, .ssm-status-cancelled { color: #dc2626; }
        .ssm-status-completed_with_errors { color: #d97706; }
        .ssm-progress { height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin: 0.75rem 0; }
        .ssm-progress div { height: 100%; background: #7c3aed; transition: width 0.5s ease; }
        .ssm-log { background: #111827; color: #d1d5db; padding: 0.75rem; border-radius: 0.375rem; max-height: 220px; overflow: auto; font-size: 0.8rem; white-space: pre-wrap; }
        @media (max-width: 800px) { .ssm-sources { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
