import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import config from '../../../../../config';

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.25rem 0.6rem 0.25rem 0.25rem',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: 'inherit',
  textDecoration: 'none',
  fontSize: '0.9rem'
};

const avatarStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  objectFit: 'cover',
  background: 'rgba(255, 255, 255, 0.12)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  flexShrink: 0
};

const badgeStyle = (manual) => ({
  fontSize: '0.65rem',
  padding: '0.05rem 0.35rem',
  borderRadius: '4px',
  background: manual ? 'rgba(99, 179, 237, 0.25)' : 'rgba(160, 174, 192, 0.2)',
  color: manual ? '#90cdf4' : '#cbd5e0',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
});

/**
 * Performers attached to a Stash group: derived from the group's scenes ("from scenes") or attached
 * manually ("added"). Manual links can be removed; scene links follow the scenes.
 */
export default function GroupPerformers({ groupId, initialPerformers }) {
  const [performers, setPerformers] = useState(initialPerformers || []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (initialPerformers) setPerformers(initialPerformers);
  }, [initialPerformers]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/group-edit/lookup?type=performer&limit=10&q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (seq === searchSeq.current) setResults(json.success ? json.data : []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const applyResponse = async (res, successText) => {
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    setPerformers(json.data.performers);
    setMessage({
      type: json.data.mirroredToStash ? 'success' : 'warning',
      text: json.data.mirroredToStash ? successText : `${successText} (saved locally; Stash could not be updated)`
    });
  };

  const addPerformer = async (performer) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/groups/${groupId}/performers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performerIds: [performer.id] })
      });
      await applyResponse(res, `Added ${performer.name}`);
      setQuery('');
      setResults([]);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const removePerformer = async (performer) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/groups/${groupId}/performers/${performer.id}`, { method: 'DELETE' });
      await applyResponse(res, `Removed ${performer.name}`);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const attachedIds = new Set(performers.map(p => p.performerId));
  const messageColor = { success: '#68d391', warning: '#f6ad55', error: '#fc8181' };

  return (
    <div className="group-performers-section" style={{ marginTop: '1rem' }}>
      <h3>Performers ({performers.length})</h3>

      {performers.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {performers.map(({ performer, performerId, source }) => {
            const manual = source === 'manual';
            return (
              <span key={performerId} style={chipStyle}>
                <Link
                  to={`/media/stash/performers/${performerId}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'inherit', textDecoration: 'none' }}
                >
                  {performer?.image
                    ? <img src={performer.image} alt="" style={avatarStyle} />
                    : <span style={avatarStyle}>{(performer?.name || '?').charAt(0)}</span>}
                  <span>{performer?.name || performerId}</span>
                </Link>
                <span style={badgeStyle(manual)} title={manual ? 'Attached manually' : 'Appears in a scene in this group'}>
                  {manual ? 'added' : 'from scenes'}
                </span>
                {manual && (
                  <button
                    type="button"
                    onClick={() => removePerformer({ id: performerId, name: performer?.name || performerId })}
                    disabled={busy}
                    title="Remove from group"
                    style={{ background: 'none', border: 'none', color: '#fc8181', cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="muted">No performers yet. Performers in the group's scenes are added automatically.</p>
      )}

      <div style={{ position: 'relative', marginTop: '0.75rem', maxWidth: 360 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Add performer..."
          disabled={busy}
          style={{
            width: '100%',
            padding: '0.45rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'inherit'
          }}
        />
        {results.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              zIndex: 20,
              left: 0,
              right: 0,
              margin: '0.25rem 0 0',
              padding: '0.25rem 0',
              listStyle: 'none',
              background: '#1f2430',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              maxHeight: 260,
              overflowY: 'auto'
            }}
          >
            {results.map(result => {
              const attached = attachedIds.has(result.id);
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    disabled={busy || attached}
                    onClick={() => addPerformer(result)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.4rem 0.75rem',
                      background: 'none',
                      border: 'none',
                      color: attached ? '#718096' : 'inherit',
                      cursor: attached ? 'default' : 'pointer'
                    }}
                  >
                    {result.name}
                    {result.disambiguation && <span style={{ color: '#a0aec0' }}> ({result.disambiguation})</span>}
                    {attached && <span style={{ color: '#718096' }}> · attached</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {message && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: messageColor[message.type] }}>{message.text}</p>
      )}
    </div>
  );
}
