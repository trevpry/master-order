import React, { useEffect, useState } from 'react';
import config from '../../../../../config';

const ENDPOINT_BUILDERS = {
  artist: (entityKey) => `${config.apiBaseUrl}/api/music/artists/${entityKey}/picard-tags`,
  album: (entityKey) => `${config.apiBaseUrl}/api/music/albums/${entityKey}/picard-tags`,
  track: (entityKey) => `${config.apiBaseUrl}/api/music/track/${entityKey}/picard-tags`,
};

function EmbeddedPicardTagsPanel({ entityType, entityKey, dark = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    setIsOpen(false);
    setLoading(false);
    setError(null);
    setPayload(null);
  }, [entityType, entityKey]);

  const palette = dark
    ? {
        background: '#20242b',
        border: '1px solid #3b424f',
        heading: '#f8fafc',
        text: '#cbd5e1',
        muted: '#94a3b8',
        accent: '#60a5fa',
        pillBg: 'rgba(96, 165, 250, 0.12)',
        cardBg: '#161b22',
        error: '#fca5a5',
      }
    : {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        heading: '#0f172a',
        text: '#334155',
        muted: '#64748b',
        accent: '#2563eb',
        pillBg: '#dbeafe',
        cardBg: 'white',
        error: '#dc2626',
      };

  const loadPicardTags = async () => {
    const endpointBuilder = ENDPOINT_BUILDERS[entityType];
    if (!endpointBuilder || !entityKey) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(endpointBuilder(entityKey));
      if (!response.ok) {
        throw new Error('Failed to load embedded Picard tags');
      }

      const result = await response.json();
      setPayload(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && !payload && !loading && !error) {
      loadPicardTags();
    }
  };

  return (
    <div
      style={{
        marginTop: '1.5rem',
        background: palette.background,
        border: palette.border,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.1rem',
          border: 'none',
          background: 'transparent',
          color: palette.heading,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>Embedded Picard Tags</div>
          <div style={{ fontSize: '0.85rem', color: palette.muted, marginTop: '0.2rem' }}>
            MusicBrainz Picard tag mapping from embedded file metadata
          </div>
        </div>
        <span style={{ color: palette.accent, fontSize: '0.95rem', fontWeight: 700 }}>{isOpen ? 'Hide' : 'Show'}</span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 1.1rem 1.1rem' }}>
          {loading && (
            <div style={{ color: palette.muted, fontSize: '0.9rem' }}>
              Scanning embedded tags...
            </div>
          )}

          {error && (
            <div style={{ color: palette.error, fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {!loading && !error && payload && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ background: palette.pillBg, color: palette.accent, borderRadius: 9999, padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>
                  {payload.summary?.tracksParsed || 0}/{payload.summary?.tracksScanned || 0} tracks parsed
                </span>
                {payload.summary?.tracksFailed > 0 && (
                  <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: dark ? '#fca5a5' : '#b91c1c', borderRadius: 9999, padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>
                    {payload.summary.tracksFailed} failed
                  </span>
                )}
              </div>

              {payload.sections?.length === 0 && payload.rawTags?.length === 0 && (
                <div style={{ color: palette.muted, fontSize: '0.9rem' }}>
                  No embedded Picard tags were found in the scanned files.
                </div>
              )}

              {payload.sections?.map((section) => (
                <div key={section.title} style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.55rem', color: palette.heading, fontSize: '0.95rem' }}>{section.title}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {section.tags.map((tag) => (
                      <div key={tag.key} style={{ background: palette.cardBg, border: palette.border, borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ color: palette.heading, fontWeight: 700, fontSize: '0.88rem' }}>{tag.label}</div>
                        <div style={{ color: palette.muted, fontSize: '0.72rem', marginTop: '0.15rem' }}>{tag.key}</div>
                        <div style={{ color: palette.text, fontSize: '0.85rem', marginTop: '0.45rem', wordBreak: 'break-word' }}>
                          {tag.values.join(', ')}
                        </div>
                        {payload.entityType !== 'track' && (
                          <div style={{ color: palette.muted, fontSize: '0.72rem', marginTop: '0.45rem' }}>
                            Present on {tag.trackCount} track{tag.trackCount === 1 ? '' : 's'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {payload.rawTags?.length > 0 && (
                <div style={{ marginTop: '1.1rem' }}>
                  <h4 style={{ margin: '0 0 0.55rem', color: palette.heading, fontSize: '0.95rem' }}>Raw Embedded Picard Tags</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {payload.rawTags.map((tag) => (
                      <div key={tag.key} style={{ background: palette.cardBg, border: palette.border, borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ color: palette.heading, fontWeight: 700, fontSize: '0.82rem', wordBreak: 'break-word' }}>{tag.key}</div>
                        <div style={{ color: palette.text, fontSize: '0.82rem', marginTop: '0.45rem', wordBreak: 'break-word' }}>
                          {tag.values.join(', ')}
                        </div>
                        <div style={{ color: palette.muted, fontSize: '0.72rem', marginTop: '0.45rem' }}>
                          {tag.formats.join(', ')}
                          {payload.entityType !== 'track' && ` · ${tag.trackCount} track${tag.trackCount === 1 ? '' : 's'}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payload.errors?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.55rem', color: palette.heading, fontSize: '0.95rem' }}>Scan Errors</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {payload.errors.slice(0, 5).map((entry) => (
                      <div key={entry.ratingKey} style={{ color: palette.muted, fontSize: '0.82rem' }}>
                        {entry.title}: {entry.error}
                      </div>
                    ))}
                    {payload.errors.length > 5 && (
                      <div style={{ color: palette.muted, fontSize: '0.82rem' }}>
                        {payload.errors.length - 5} more errors not shown
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EmbeddedPicardTagsPanel;