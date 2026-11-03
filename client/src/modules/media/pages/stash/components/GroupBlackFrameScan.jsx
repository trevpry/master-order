import React, { useCallback, useEffect, useRef, useState } from 'react';
import config from '../../../../../config';

const formatClock = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/**
 * Black-frame scans for the clips of a group, one clip at a time. Each scan covers the whole file and its
 * results are stored on the server, so the clip's split editor opens with its black frames (and cut suggestions).
 */
export default function GroupBlackFrameScan({ groupId, scenes, onOpenScene, refreshToken = 0 }) {
  const api = `${config.apiBaseUrl}/api/stash`;
  const [results, setResults] = useState({});
  const [activeScan, setActiveScan] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef(null);
  const sceneIds = scenes.map(s => String(s.id)).join(',');

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const loadResults = useCallback(async () => {
    try {
      const res = await fetch(`${api}/groups/${groupId}/black-frames?sceneIds=${encodeURIComponent(sceneIds)}`);
      const data = await res.json();
      if (!data.success) return null;
      setResults(data.data.results || {});
      return data.data.activeScan;
    } catch {
      return null;
    }
  }, [api, groupId, sceneIds]);

  const pollScan = useCallback((scanId) => {
    stopPolling();
    const tick = async () => {
      try {
        const res = await fetch(`${api}/group-split-black-scans/${scanId}`);
        const data = await res.json();
        if (!data.success) {
          stopPolling();
          setActiveScan(null);
          return;
        }
        if (data.data.status === 'running') {
          setActiveScan(data.data);
          return;
        }
        stopPolling();
        setActiveScan(null);
        setLastScan(data.data);
        loadResults();
      } catch {
        // Transient; keep polling
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2000);
  }, [api, loadResults]);

  // Show stored results and pick up a scan that is still running (e.g. after a page reload)
  useEffect(() => {
    loadResults().then(active => {
      if (active) {
        setActiveScan(active);
        setExpanded(true);
        pollScan(active.id);
      }
    });
    return stopPolling;
  }, [loadResults, pollScan]);

  // Scans run from a clip's split editor are stored too
  useEffect(() => {
    if (refreshToken) loadResults();
  }, [refreshToken, loadResults]);

  const scanClip = async (sceneId) => {
    setStarting(sceneId);
    setError(null);
    setLastScan(null);
    try {
      const res = await fetch(`${api}/groups/${groupId}/split/black-frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, fullScan: true })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not start the scan');
      setActiveScan(data.data);
      pollScan(data.data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(null);
    }
  };

  const cancelScan = async () => {
    if (!activeScan) return;
    try {
      await fetch(`${api}/group-split-black-scans/${activeScan.id}/cancel`, { method: 'POST' });
    } finally {
      stopPolling();
      setActiveScan(null);
      loadResults();
    }
  };

  const busy = Boolean(activeScan || starting);
  const scannedCount = scenes.filter(s => results[String(s.id)]?.fullScan).length;
  const titleOf = (sceneId) => {
    const scene = scenes.find(s => String(s.id) === String(sceneId));
    return scene?.title || `Scene ${sceneId}`;
  };

  return (
    <div className="gbf">
      <div className="gbf-bar">
        <strong>⬛ Black frames</strong>
        <span className="gbf-muted">{scannedCount} of {scenes.length} clip{scenes.length === 1 ? '' : 's'} scanned · scan a clip to get cut suggestions in its split editor</span>
        {activeScan && (
          <>
            <span className="gbf-muted">Scanning “{titleOf(activeScan.sceneId)}”</span>
            <div className="gbf-progress"><div style={{ width: `${Math.round((activeScan.progress || 0) * 100)}%` }} /></div>
            <span className="gbf-muted">{Math.round((activeScan.progress || 0) * 100)}% · {activeScan.intervals?.length || 0} found</span>
            <button type="button" className="gbf-btn" onClick={cancelScan}>Cancel</button>
          </>
        )}
        <button type="button" className="gbf-btn" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide clips' : 'Show clips'}</button>
      </div>
      {error && <div className="gbf-error">{error}</div>}
      {lastScan && lastScan.status === 'failed' && <div className="gbf-error">Scan of “{titleOf(lastScan.sceneId)}” failed: {lastScan.error}</div>}
      {expanded && (
        <table className="gbf-table">
          <thead><tr><th>Clip</th><th>Length</th><th>Black frames</th><th></th></tr></thead>
          <tbody>
            {scenes.map(scene => {
              const id = String(scene.id);
              const result = results[id];
              const scanning = activeScan?.sceneId === id;
              const duration = result?.duration || scene.files?.[0]?.duration;
              return (
                <tr key={id}>
                  <td>{scene.title || `Scene ${id}`}</td>
                  <td>{duration ? formatClock(duration) : '—'}</td>
                  <td>
                    {scanning ? (
                      <div className="gbf-progress gbf-progress-small"><div style={{ width: `${Math.round((activeScan.progress || 0) * 100)}%` }} /></div>
                    ) : result ? (
                      <span className={`gbf-status ${result.fullScan ? 'gbf-status-done' : 'gbf-status-partial'}`}>
                        {result.blackRuns} run{result.blackRuns === 1 ? '' : 's'}{result.fullScan ? '' : ` (${formatClock(result.scannedSeconds)} scanned)`}
                      </span>
                    ) : (
                      <span className="gbf-status">Not scanned</span>
                    )}
                  </td>
                  <td className="gbf-actions">
                    <button
                      type="button"
                      className="gbf-btn gbf-btn-primary"
                      disabled={busy}
                      title={busy && !scanning ? 'Another clip is being scanned' : 'Scan the whole clip for black frames'}
                      onClick={() => scanClip(id)}
                    >
                      {starting === id ? 'Starting…' : scanning ? 'Scanning…' : result?.fullScan ? '🔍 Rescan' : '🔍 Scan'}
                    </button>
                    <button type="button" className="gbf-btn" onClick={() => onOpenScene(scene)} title="Open the split editor for this clip">
                      ✂️ Edit cuts
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <style>{`
        .gbf { margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(34, 211, 238, 0.07); border: 1px solid rgba(34, 211, 238, 0.3); }
        .gbf-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
        .gbf-muted { color: #6b7280; font-size: 0.85rem; }
        .gbf-btn { padding: 0.35rem 0.7rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: var(--bg-secondary, #fff); color: inherit; cursor: pointer; font-size: 0.85rem; }
        .gbf-btn:disabled { opacity: 0.5; cursor: default; }
        .gbf-btn-primary { background: #0891b2; border-color: #0891b2; color: #fff; font-weight: 600; }
        .gbf-progress { width: 160px; height: 8px; border-radius: 4px; background: rgba(107,114,128,0.25); overflow: hidden; }
        .gbf-progress > div { height: 100%; background: #0891b2; transition: width 0.3s; }
        .gbf-progress-small { width: 100px; }
        .gbf-error { color: #dc2626; margin-top: 0.5rem; font-size: 0.9rem; }
        .gbf-table { width: 100%; margin-top: 0.75rem; border-collapse: collapse; font-size: 0.88rem; }
        .gbf-table th, .gbf-table td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid rgba(107,114,128,0.2); }
        .gbf-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
        .gbf-status { font-size: 0.8rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: rgba(107,114,128,0.15); }
        .gbf-status-done { background: rgba(5,150,105,0.15); color: #059669; }
        .gbf-status-partial { background: rgba(217,119,6,0.15); color: #d97706; }
      `}</style>
    </div>
  );
}
