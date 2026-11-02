import React, { useEffect, useMemo, useRef, useState } from 'react';
import config from '../../../../../config';

const parseUrls = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (e) {
    // Plain single URL
  }
  return [value];
};

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || seconds === '') return '';
  const total = Math.round(Number(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Accepts H:MM:SS, MM:SS or plain minutes
const parseDuration = (text) => {
  const value = text.trim();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60);
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const fieldStyle = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #cbd5e0',
  borderRadius: '4px',
  fontSize: '0.95rem',
  boxSizing: 'border-box'
};
const labelStyle = { display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: '#2d3748' };
const rowStyle = { marginBottom: '1rem' };
const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.2rem 0.6rem',
  background: '#e9d8fd',
  color: '#44337a',
  borderRadius: '999px',
  fontSize: '0.85rem'
};
const dropdownStyle = {
  position: 'absolute',
  zIndex: 10,
  left: 0,
  right: 0,
  maxHeight: '220px',
  overflowY: 'auto',
  background: 'white',
  border: '1px solid #cbd5e0',
  borderRadius: '4px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

function useLookup(type, query, enabled) {
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, q: query, limit: '20' });
        const res = await fetch(`${config.apiBaseUrl}/api/stash/group-edit/lookup?${params}`, { signal: controller.signal });
        const json = await res.json();
        setResults(json.success ? json.data : []);
      } catch (e) {
        if (e.name !== 'AbortError') setResults([]);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, query, enabled]);
  return results;
}

function LookupInput({ type, placeholder, onSelect, excludeIds = [] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useLookup(type, query, open);
  const visible = results.filter(item => !excludeIds.includes(item.id));

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (visible[0]) {
              onSelect(visible[0]);
              setQuery('');
            }
          }
        }}
        style={fieldStyle}
      />
      {open && visible.length > 0 && (
        <div style={dropdownStyle}>
          {visible.map(item => (
            <div
              key={item.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
                setQuery('');
              }}
              style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', borderBottom: '1px solid #edf2f7' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f7fafc'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageField({ label, currentUrl, value, onChange }) {
  const fileRef = useRef(null);
  const [urlText, setUrlText] = useState('');
  // value: undefined = unchanged, '' = remove, string = new image (URL or data URI)
  const preview = value === undefined ? currentUrl : value;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{
        aspectRatio: '2/3',
        background: '#edf2f7',
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.5rem',
        color: '#a0aec0'
      }}>
        {preview ? <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No image'}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
        <input
          type="text"
          placeholder="Image URL"
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          style={{ ...fieldStyle, fontSize: '0.8rem' }}
        />
        <button
          type="button"
          disabled={!urlText.trim()}
          onClick={() => { onChange(urlText.trim()); setUrlText(''); }}
          style={{ padding: '0.3rem 0.6rem', border: '1px solid #cbd5e0', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
        >
          Use
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ padding: '0.3rem 0.6rem', border: '1px solid #cbd5e0', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
        >
          Upload…
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ padding: '0.3rem 0.6rem', border: '1px solid #feb2b2', color: '#c53030', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
          >
            Remove
          </button>
        )}
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={{ padding: '0.3rem 0.6rem', border: '1px solid #cbd5e0', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
          >
            Undo
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > 7 * 1024 * 1024) {
              alert('Image is too large (max 7 MB)');
              return;
            }
            onChange(await readFileAsDataUrl(file));
          }}
        />
      </div>
    </div>
  );
}

/**
 * Edits a Stash group. Saving sends only changed fields to PATCH /api/stash/groups/:id, which
 * applies them in Stash (groupUpdate) and then mirrors the result locally.
 */
export default function EditGroupModal({ group, onClose, onSaved }) {
  const initial = useMemo(() => ({
    name: group.name || '',
    aliases: group.aliases || '',
    date: group.date || '',
    duration: formatDuration(group.duration),
    director: group.director || '',
    rating: group.rating ?? '',
    synopsis: group.synopsis || '',
    urls: parseUrls(group.url).join('\n'),
    studio: group.studio ? { id: group.studio.id, name: group.studio.name } : null,
    tags: (group.tags || []).map(wrapper => wrapper.tag).filter(Boolean).map(tag => ({ id: tag.id, name: tag.name }))
  }), [group]);

  const [form, setForm] = useState(initial);
  const [frontImage, setFrontImage] = useState(undefined);
  const [backImage, setBackImage] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const buildChanges = () => {
    const changes = {};
    for (const key of ['name', 'aliases', 'date', 'director', 'synopsis']) {
      if (form[key].trim() !== initial[key].trim()) changes[key] = form[key].trim();
    }
    if (String(form.rating).trim() !== String(initial.rating)) {
      changes.rating = String(form.rating).trim() === '' ? null : Number(form.rating);
    }
    if (form.duration.trim() !== initial.duration) {
      const seconds = parseDuration(form.duration);
      if (Number.isNaN(seconds)) throw new Error('Duration must be H:MM:SS, MM:SS or a number of minutes');
      changes.duration = seconds;
    }
    const urls = form.urls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.join('\n') !== initial.urls) changes.urls = urls;
    if ((form.studio?.id || null) !== (initial.studio?.id || null)) changes.studioId = form.studio?.id || null;
    const tagIds = form.tags.map(tag => tag.id);
    const initialTagIds = initial.tags.map(tag => tag.id);
    if ([...tagIds].sort().join(',') !== [...initialTagIds].sort().join(',')) changes.tagIds = tagIds;
    if (frontImage !== undefined) changes.frontImage = frontImage || null;
    if (backImage !== undefined) changes.backImage = backImage || null;
    return changes;
  };

  const handleSave = async () => {
    setError(null);
    let changes;
    try {
      changes = buildChanges();
    } catch (e) {
      setError(e.message);
      return;
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (changes.name !== undefined && !changes.name) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || `Save failed (${res.status})`);
      }
      await onSaved(json.data);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div
      onClick={() => { if (!saving) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
    >
      <div
        role="dialog"
        aria-label="Edit group"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '10px',
          width: 'min(900px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '1.5rem',
          color: '#1a202c',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}
      >
        <h2 style={{ marginTop: 0 }}>✏️ Edit Group</h2>
        <p style={{ marginTop: '-0.5rem', color: '#718096', fontSize: '0.875rem' }}>
          Changes are saved to Stash and then synced to Master Order.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <ImageField label="Front cover" currentUrl={group.frontImage} value={frontImage} onChange={setFrontImage} />
            <ImageField label="Back cover" currentUrl={group.backImage} value={backImage} onChange={setBackImage} />
          </div>

          <div>
            <div style={rowStyle}>
              <label style={labelStyle} htmlFor="group-edit-name">Name *</label>
              <input id="group-edit-name" type="text" value={form.name} onChange={set('name')} style={fieldStyle} autoFocus />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle} htmlFor="group-edit-aliases">Aliases</label>
              <input id="group-edit-aliases" type="text" value={form.aliases} onChange={set('aliases')} style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              <div style={rowStyle}>
                <label style={labelStyle} htmlFor="group-edit-date">Release date</label>
                <input id="group-edit-date" type="text" placeholder="YYYY-MM-DD" value={form.date} onChange={set('date')} style={fieldStyle} />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle} htmlFor="group-edit-duration">Duration</label>
                <input id="group-edit-duration" type="text" placeholder="H:MM:SS" value={form.duration} onChange={set('duration')} style={fieldStyle} />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle} htmlFor="group-edit-rating">Rating (0–100)</label>
                <input id="group-edit-rating" type="number" min="0" max="100" value={form.rating} onChange={set('rating')} style={fieldStyle} />
              </div>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle} htmlFor="group-edit-director">Director</label>
              <input id="group-edit-director" type="text" value={form.director} onChange={set('director')} style={fieldStyle} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Studio</label>
              {form.studio ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ ...chipStyle, background: '#bee3f8', color: '#2a4365' }}>
                    {form.studio.name}
                    <button
                      type="button"
                      aria-label="Clear studio"
                      onClick={() => setForm(prev => ({ ...prev, studio: null }))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ) : (
                <LookupInput type="studio" placeholder="Search studios…" onSelect={(studio) => setForm(prev => ({ ...prev, studio }))} />
              )}
            </div>
          </div>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Tags</label>
          {form.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {form.tags.map(tag => (
                <span key={tag.id} style={chipStyle}>
                  {tag.name}
                  <button
                    type="button"
                    aria-label={`Remove ${tag.name}`}
                    onClick={() => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t.id !== tag.id) }))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <LookupInput
            type="tag"
            placeholder="Add a tag…"
            excludeIds={form.tags.map(tag => tag.id)}
            onSelect={(tag) => setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }))}
          />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle} htmlFor="group-edit-urls">URLs (one per line)</label>
          <textarea id="group-edit-urls" rows={3} value={form.urls} onChange={set('urls')} style={{ ...fieldStyle, fontFamily: 'inherit' }} />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle} htmlFor="group-edit-synopsis">Synopsis</label>
          <textarea id="group-edit-synopsis" rows={6} value={form.synopsis} onChange={set('synopsis')} style={{ ...fieldStyle, fontFamily: 'inherit' }} />
        </div>

        {error && (
          <div style={{ background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '4px', padding: '0.6rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.55rem 1.1rem', background: '#e2e8f0', color: '#2d3748', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '0.55rem 1.1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving to Stash…' : '💾 Save to Stash'}
          </button>
        </div>
      </div>
    </div>
  );
}
