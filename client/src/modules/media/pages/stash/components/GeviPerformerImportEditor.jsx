import React, { useEffect, useState } from 'react';

const candidateLabel = (c) => {
  let label = c.name;
  if (c.disambiguation) label += ` (${c.disambiguation})`;
  if (c.matchedVia === 'alias' && c.matchedAlias) label += ` — via alias: ${c.matchedAlias}`;
  return label;
};

function choiceValue(choice) {
  if (!choice || choice.type === 'skip') return 'skip';
  if (choice.type === 'new') return 'new';
  return `lib:${choice.id}`;
}

function PerformerSearch({ initialQuery, onPick, onCancel }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/stash/performers/search?q=${encodeURIComponent(query.trim())}&limit=15`);
        const data = await response.json();
        if (!cancelled) setResults(Array.isArray(data.data) ? data.data : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div style={{ marginTop: '0.35rem', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb' }}>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your performers..."
          style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
        />
        <button type="button" onClick={onCancel} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
          Cancel
        </button>
      </div>
      {loading && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Searching…</div>}
      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>No performers found</div>
      )}
      {results.length > 0 && (
        <div style={{ maxHeight: '10rem', overflowY: 'auto', marginTop: '0.25rem' }}>
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick({ id: String(p.id), name: p.name, disambiguation: p.disambiguation || null })}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.25rem 0.4rem', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {candidateLabel(p)}
              {p.alias ? <span style={{ color: '#9ca3af' }}> · {p.alias}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lets the user switch the library performer chosen for each GEVI performer, add it as a new performer,
 * or skip it, before GEVI performers are imported into a scene that has none.
 */
export default function GeviPerformerImportEditor({ entries, onChange }) {
  const [searchingKey, setSearchingKey] = useState(null);

  const updateEntry = (key, changes) => {
    onChange(entries.map((entry) => (entry.key === key ? { ...entry, ...changes } : entry)));
  };

  const candidatesFor = (entry) => {
    const list = [entry.match, ...(entry.alternatives || []), ...(entry.picked ? [entry.picked] : [])].filter(Boolean);
    const seen = new Set();
    return list.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {entries.map((entry) => {
        const candidates = candidatesFor(entry);
        const value = choiceValue(entry.choice);
        const type = entry.choice?.type || 'skip';
        const badge = type === 'library'
          ? { text: 'Matched', bg: '#dcfce7', fg: '#166534' }
          : type === 'new'
            ? { text: 'New', bg: '#ede9fe', fg: '#5b21b6' }
            : { text: 'Skipped', bg: '#f3f4f6', fg: '#6b7280' };

        return (
          <div key={entry.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: badge.bg, color: badge.fg }}>
                {badge.text}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#374151', minWidth: '8rem' }} title={entry.url || undefined}>
                {entry.scrapedName}
                {entry.actionCode ? <span style={{ color: '#10b981' }}> ({entry.actionCode})</span> : null}
              </span>
              <select
                value={value}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === 'search') {
                    setSearchingKey(entry.key);
                    return;
                  }
                  setSearchingKey(null);
                  if (next === 'skip') updateEntry(entry.key, { choice: { type: 'skip' } });
                  else if (next === 'new') updateEntry(entry.key, { choice: { type: 'new', name: entry.scrapedName } });
                  else {
                    const picked = candidates.find((c) => `lib:${c.id}` === next);
                    if (picked) updateEntry(entry.key, { choice: { type: 'library', id: picked.id, name: picked.name } });
                  }
                }}
                style={{ fontSize: '0.8rem', padding: '0.15rem 0.3rem', maxWidth: '20rem' }}
              >
                {candidates.map((c) => (
                  <option key={c.id} value={`lib:${c.id}`}>
                    {c.id === entry.match?.id ? `✓ ${candidateLabel(c)}` : candidateLabel(c)}
                  </option>
                ))}
                <option value="search">🔍 Choose another performer…</option>
                <option value="new">➕ Add &quot;{entry.scrapedName}&quot; as new performer</option>
                <option value="skip">✕ Don&apos;t import</option>
              </select>
            </div>
            {searchingKey === entry.key && (
              <PerformerSearch
                initialQuery={entry.scrapedName}
                onCancel={() => setSearchingKey(null)}
                onPick={(picked) => {
                  setSearchingKey(null);
                  updateEntry(entry.key, { picked, choice: { type: 'library', id: picked.id, name: picked.name } });
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
