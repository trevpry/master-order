import React, { useState, useRef } from 'react';

// Fields where values from multiple sources can be combined rather than one-or-nothing.
const MERGE_FIELDS = new Set(['aliases', 'tattoos', 'details', 'url']);

const FIELDS = [
  { key: 'name',          label: 'Name' },
  { key: 'disambiguation',label: 'Disambiguation' },
  { key: 'aliases',       label: 'Aliases',      format: (v) => (Array.isArray(v) ? v.join(', ') : v) },
  { key: 'gender',        label: 'Gender',       hidden: true },
  { key: 'birthdate',     label: 'Birthdate' },
  { key: 'death_date',    label: 'Death date' },
  { key: 'country',       label: 'Country' },
  { key: 'ethnicity',     label: 'Ethnicity' },
  { key: 'height',        label: 'Height' },
  { key: 'weight',        label: 'Weight' },
  { key: 'measurements',  label: 'Measurements' },
  { key: 'penis_length',  label: 'Penis length' },
  { key: 'circumcised',   label: 'Circumcised' },
  { key: 'fake_tits',     label: 'Fake tits',    hidden: true },
  { key: 'career_length', label: 'Career length' },
  { key: 'tattoos',       label: 'Tattoos' },
  { key: 'piercings',     label: 'Piercings' },
  { key: 'details',       label: 'Details',      multiline: true },
  { key: 'url',           label: 'URL' },
  { key: 'twitter',       label: 'Twitter' },
  { key: 'instagram',     label: 'Instagram' },
  { key: 'image',         label: 'Image',        isImage: true },
];

function displayValue(field, value) {
  if (value == null || value === '') return null;
  if (field.format) return field.format(value);
  // images array → use first entry
  if (field.key === 'image') {
    const img = Array.isArray(value) ? value[0] : value;
    return img || null;
  }
  return String(value);
}

function ChoiceCard({ selected, onClick, label, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        flex: 1,
        minWidth: '180px',
        padding: '0.65rem 0.75rem',
        borderRadius: '10px',
        border: selected ? '2px solid #10b981' : '1px solid #d1d5db',
        background: selected ? '#dcfce7' : '#f9fafb',
        cursor: 'pointer',
        boxShadow: selected ? '0 2px 8px rgba(16,185,129,.18)' : 'none',
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, color: selected ? '#166534' : '#9ca3af', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function PerformerScrapeAllReviewModal({
  isOpen,
  onClose,
  performerData,       // current DB performer object
  sources,             // [{ id, name, results: [scraped,...] }]
  onApply,             // (fieldSelections, mainImage, additionalImages) => void
}) {
  // view: 'list' → 'compare' → 'images'
  const [view, setView] = useState('list');
  // selectedResultPerSource: { sourceId: number | null }  null = deselected
  const [selectedResultPerSource, setSelectedResultPerSource] = useState({});
  // fieldSelections: { fieldKey: 'existing' | sourceId }  (single-pick fields)
  const [fieldSelections, setFieldSelections] = useState({});
  // mergeSelections: { fieldKey: Set<sourceId> }  (multi-pick fields — merge values)
  const [mergeSelections, setMergeSelections] = useState({});
  // tagSelections: Set<sourceId> — which sources' matched tags to include
  const [tagSourceSelections, setTagSourceSelections] = useState(new Set());
  // image selection: one main image URL + set of additional image URLs
  const [mainImage, setMainImage] = useState(null);
  const mainImageRef = useRef(null); // ref so handleApply always reads the latest value
  const [additionalImages, setAdditionalImages] = useState(new Set());
  const additionalImagesRef = useRef(new Set());

  const setMainImageSync = (url) => {
    mainImageRef.current = url;
    setMainImage(url);
  };
  const toggleAdditionalSync = (url, add) => {
    const next = new Set(additionalImagesRef.current);
    add ? next.add(url) : next.delete(url);
    additionalImagesRef.current = next;
    setAdditionalImages(next);
  };

  if (!isOpen) return null;

  const sourcesWithResults = (sources || []).filter((s) => s.hasResults && s.results?.length > 0);

  // Build the set of selected scraped objects — skip deselected sources (null index).
  const selectedScrapedBySrc = {};
  for (const src of sourcesWithResults) {
    const idx = selectedResultPerSource[src.id];
    if (idx === null) continue; // explicitly deselected
    const effectiveIdx = idx ?? 0;
    selectedScrapedBySrc[src.id] = src.results[effectiveIdx] || null;
  }

  const activeSources = sourcesWithResults.filter((s) => selectedScrapedBySrc[s.id] != null);

  const getFieldSel = (fieldKey) => fieldSelections[fieldKey] ?? 'existing';

  const getDisplayText = (value, field) => {
    const d = displayValue(field, value);
    return d ?? '—';
  };

  const handleGoToCompare = () => {
    // Default each field to the first active source that has a value
    const defaults = {};
    for (const field of FIELDS) {
      defaults[field.key] = 'existing';
      for (const src of activeSources) {
        const scraped = selectedScrapedBySrc[src.id];
        if (!scraped) continue;
        const raw = field.key === 'image' ? (scraped.images?.[0] || scraped.image) : scraped[field.key];
        if (raw != null && raw !== '') { defaults[field.key] = src.id; break; }
      }
    }
    setFieldSelections(defaults);

    // Default merge-fields: check every active source that has a value.
    const defaultMerge = {};
    for (const field of FIELDS) {
      if (!MERGE_FIELDS.has(field.key)) continue;
      const selected = new Set();
      for (const src of activeSources) {
        const scraped = selectedScrapedBySrc[src.id];
        if (!scraped) continue;
        const raw = scraped[field.key];
        if (raw != null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)) {
          selected.add(src.id);
        }
      }
      defaultMerge[field.key] = selected;
    }
    setMergeSelections(defaultMerge);

    // Default tag sources: select all that have matched tags.
    const defaultTagSrcs = new Set();
    for (const src of activeSources) {
      const scraped = selectedScrapedBySrc[src.id];
      const matched = scraped?._matchedTags || scraped?.matched?.tags || [];
      if (matched.length > 0) defaultTagSrcs.add(src.id);
    }
    setTagSourceSelections(defaultTagSrcs);

    setView('compare');
  };

  const allSourceImages = () => {
    const seen = new Set();
    const items = [];
    for (const src of activeSources) {
      const scraped = selectedScrapedBySrc[src.id];
      if (!scraped) continue;
      const imgs = [
        ...(Array.isArray(scraped.images) ? scraped.images : []),
        ...(scraped.image && !scraped.images?.includes(scraped.image) ? [scraped.image] : [])
      ].filter(Boolean);
      imgs.forEach((url) => {
        if (!seen.has(url)) { seen.add(url); items.push({ url, sourceName: src.name }); }
      });
    }
    return items;
  };

  const handleGoToImages = () => {
    // Pre-select the image that was chosen in the compare step so the user
    // sees their compare choice highlighted and can change it if needed.
    if (!mainImageRef.current) {
      const compareImgSrcId = fieldSelections.image;
      let preselect = null;
      if (compareImgSrcId && compareImgSrcId !== 'existing') {
        const scraped = selectedScrapedBySrc[compareImgSrcId];
        preselect = scraped?.images?.[0] || scraped?.image || null;
      }
      if (!preselect) {
        const imgs = allSourceImages();
        preselect = imgs[0]?.url || null;
      }
      if (preselect) setMainImageSync(preselect);
    }
    setView('images');
  };

  const toggleImage = (url) => {
    if (url === mainImageRef.current) {
      setMainImageSync(null);
    } else {
      toggleAdditionalSync(url, false);
      setMainImageSync(url);
    }
  };

  const toggleAdditional = (e, url) => {
    e.stopPropagation();
    if (url === mainImageRef.current) return;
    const isAdditional = additionalImagesRef.current.has(url);
    toggleAdditionalSync(url, !isAdditional);
  };

  const getRawFieldValue = (field, scraped) => {
    if (!scraped) return null;
    if (field.key === 'image') return scraped.images?.[0] || scraped.image || null;
    return scraped[field.key] ?? null;
  };

  const handleApply = () => {
    const result = {};
    for (const field of FIELDS) {
      if (MERGE_FIELDS.has(field.key)) {
        const srcIds = mergeSelections[field.key];
        if (!srcIds || srcIds.size === 0) {
          // Nothing checked — keep existing
          result[field.key] = performerData?.[field.key] ?? null;
          continue;
        }
        const raws = [];
        for (const src of activeSources) {
          if (!srcIds.has(src.id)) continue;
          const scraped = selectedScrapedBySrc[src.id];
          const raw = getRawFieldValue(field, scraped);
          if (raw != null && raw !== '') raws.push(raw);
        }
        if (field.key === 'aliases') {
          // Flatten all alias arrays/strings, deduplicate
          const all = raws.flatMap((v) => Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean));
          result[field.key] = [...new Set(all)];
        } else if (field.key === 'url') {
          // Collect all URLs
          result[field.key] = raws[0] || null;
          result._mergedUrls = raws;
        } else {
          // Text fields: join with separator
          const separator = field.key === 'details' ? '\n\n' : '\n';
          result[field.key] = raws.join(separator) || null;
        }
      } else {
        const sel = getFieldSel(field.key);
        if (sel === 'existing') {
          result[field.key] = field.key === 'image' ? null : (performerData?.[field.key] ?? null);
        } else {
          const scraped = selectedScrapedBySrc[sel];
          if (!scraped) { result[field.key] = null; continue; }
          result[field.key] = getRawFieldValue(field, scraped) ?? null;
        }
      }
    }
    // Collect matched tag IDs from all checked tag sources (deduplicated).
    const tagIdMap = new Map();
    for (const src of activeSources) {
      if (!tagSourceSelections.has(src.id)) continue;
      const scraped = selectedScrapedBySrc[src.id];
      const matched = scraped?._matchedTags || scraped?.matched?.tags || [];
      for (const tag of matched) {
        if (tag?.id) tagIdMap.set(tag.id, tag);
      }
    }
    result._matchedTagIds = [...tagIdMap.keys()];

    // Always read from refs so the latest selection is used regardless of closure age
    onApply?.(result, mainImageRef.current, Array.from(additionalImagesRef.current));
  };

  const modalStyle = {
    position: 'fixed', inset: 0, zIndex: 1200,
    background: 'rgba(0,0,0,.55)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '1.5rem 1rem',
    overflowY: 'auto',
  };
  const panelStyle = {
    background: '#fff', borderRadius: '14px',
    width: '100%', maxWidth: '900px',
    padding: '1.5rem', boxShadow: '0 8px 40px rgba(0,0,0,.18)',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>🔎 Scrape All — Performer</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {view === 'images' && (
              <>
                <button type="button" className="btn-cancel" style={{ padding: '0.35rem 0.75rem' }} onClick={() => setView('compare')}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={handleApply}>
                  Apply Scrape
                </button>
              </>
            )}
            {view === 'compare' && (
              <>
                <button type="button" className="btn-cancel" style={{ padding: '0.35rem 0.75rem' }} onClick={() => setView('list')}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={handleGoToImages}>
                  Next →
                </button>
              </>
            )}
            {view === 'list' && sourcesWithResults.length > 0 && (
              <button type="button" className="btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={handleGoToCompare}
                disabled={activeSources.length === 0}>
                Next →
              </button>
            )}
            <button type="button" className="btn-cancel" style={{ padding: '0.35rem 0.75rem' }} onClick={onClose}>✕</button>
          </div>
        </div>

        {sourcesWithResults.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            No results found from any stash-box source.
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && sourcesWithResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {sourcesWithResults.map((src) => {
              const storedIdx = selectedResultPerSource[src.id];
              const isDeselected = storedIdx === null;
              const selectedIdx = isDeselected ? -1 : (storedIdx ?? 0);
              const toggle = (idx) => setSelectedResultPerSource((prev) => ({
                ...prev,
                // clicking the already-selected row deselects it
                [src.id]: prev[src.id] === idx ? null : idx
              }));
              return (
                <div key={src.id}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {src.name}
                    <span style={{ fontWeight: 400, color: '#9ca3af' }}>({src.results.length} result{src.results.length !== 1 ? 's' : ''})</span>
                    {isDeselected && (
                      <span style={{ fontSize: '11px', padding: '0.1rem 0.4rem', borderRadius: '999px', background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>skipped</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {src.results.map((result, idx) => {
                      const isSelected = selectedIdx === idx;
                      const img = result.images?.[0] || result.image;
                      return (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(idx)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(idx)}
                          title={isSelected ? 'Click to deselect' : 'Click to select'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                            border: isSelected ? '2px solid #10b981' : '1px solid #e5e7eb',
                            background: isSelected ? '#f0fdf4' : '#f9fafb',
                            opacity: isDeselected && !isSelected ? 0.5 : 1,
                          }}
                        >
                          {img && (
                            <img src={img} alt="" style={{ width: '44px', height: '54px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{result.name || '—'}</div>
                            {result.disambiguation && (
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>{result.disambiguation}</div>
                            )}
                            {(() => {
                              const aliases = Array.isArray(result.aliases)
                                ? result.aliases
                                : typeof result.aliases === 'string' && result.aliases
                                  ? result.aliases.split(',').map((a) => a.trim()).filter(Boolean)
                                  : result.alias
                                    ? String(result.alias).split(',').map((a) => a.trim()).filter(Boolean)
                                    : [];
                              return aliases.length > 0 ? (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px', fontStyle: 'italic' }}>
                                  aka {aliases.join(', ')}
                                </div>
                              ) : null;
                            })()}
                            <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '2px' }}>
                              {result.gender && <span>{result.gender}</span>}
                              {result.birthdate && <span>b. {result.birthdate}</span>}
                              {result.country && <span>{result.country}</span>}
                            </div>
                          </div>
                          {isSelected && <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* IMAGE SELECTION VIEW */}
        {view === 'images' && (() => {
          const imgs = allSourceImages();
          return (
            <div>
              <p style={{ margin: '0 0 1rem', fontSize: '13px', color: '#6b7280' }}>
                <strong>Click</strong> an image to set it as the main image. Use the <strong>+</strong> button on any non-main image to also download it as an extra image.
              </p>
              {imgs.length === 0 ? (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No images found in selected results.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {imgs.map(({ url, sourceName }) => {
                    const isMain = url === mainImage;
                    const isAdditional = additionalImages.has(url);
                    const isSelected = isMain || isAdditional;
                    return (
                      <div
                        key={url}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleImage(url)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleImage(url)}
                        title={isMain ? 'Click to deselect main image' : 'Click to set as main image'}
                        style={{
                          position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden',
                          border: isMain ? '3px solid #10b981' : isAdditional ? '3px solid #3b82f6' : '3px solid transparent',
                          boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,.08)' : 'none',
                        }}
                      >
                        <img
                          src={url}
                          alt=""
                          style={{ width: '220px', maxHeight: '400px', objectFit: 'contain', display: 'block', background: '#f3f4f6' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        {isMain && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,185,129,.85)', color: '#fff', fontSize: '10px', fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>
                            MAIN
                          </div>
                        )}
                        {isAdditional && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(59,130,246,.85)', color: '#fff', fontSize: '10px', fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>
                            +EXTRA
                          </div>
                        )}
                        {!isMain && (
                          <button
                            type="button"
                            onClick={(e) => toggleAdditional(e, url)}
                            title={isAdditional ? 'Remove from extra downloads' : 'Also download as extra image'}
                            style={{
                              position: 'absolute', top: 4, left: 4,
                              width: '22px', height: '22px', borderRadius: '50%',
                              border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isAdditional ? 'rgba(59,130,246,.9)' : 'rgba(0,0,0,.45)',
                              color: '#fff',
                            }}
                          >
                            {isAdditional ? '−' : '+'}
                          </button>
                        )}
                        <div style={{ position: 'absolute', top: 2, right: 3, fontSize: '9px', color: 'rgba(255,255,255,.75)', textShadow: '0 1px 2px rgba(0,0,0,.8)' }}>
                          {sourceName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* COMPARE VIEW */}
        {view === 'compare' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FIELDS.map((field) => {
              const existingRaw = performerData?.[field.key] ?? null;
              const existingDisplay = getDisplayText(existingRaw, field);

              const sourceColumns = activeSources
                .map((src) => {
                  const scraped = selectedScrapedBySrc[src.id];
                  const raw = getRawFieldValue(field, scraped);
                  return { src, raw, display: getDisplayText(raw, field) };
                });

              if (field.hidden) return null;
              if (existingDisplay === '—' && sourceColumns.every((c) => c.display === '—')) return null;

              if (MERGE_FIELDS.has(field.key)) {
                // Checkbox UI — any combination of sources can be selected and merged.
                const checked = mergeSelections[field.key] || new Set();
                const toggleSrc = (srcId) => setMergeSelections((prev) => {
                  const next = new Set(prev[field.key] || []);
                  next.has(srcId) ? next.delete(srcId) : next.add(srcId);
                  return { ...prev, [field.key]: next };
                });
                const anyChecked = checked.size > 0;

                return (
                  <div key={field.key} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.85rem' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.45rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {field.label}
                      <span style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>select multiple to merge</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {/* Existing value (read-only preview) */}
                      {existingDisplay !== '—' && (
                        <div style={{ flex: 1, minWidth: '180px', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb', opacity: anyChecked ? 0.5 : 1 }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Existing</div>
                          <div style={{ fontSize: '13px', color: '#111827', whiteSpace: field.key === 'details' ? 'pre-wrap' : 'normal', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto' }}>{existingDisplay}</div>
                        </div>
                      )}
                      {/* Per-source checkboxes */}
                      {sourceColumns.filter((c) => c.display !== '—').map(({ src, display }) => {
                        const isChecked = checked.has(src.id);
                        return (
                          <div
                            key={src.id}
                            role="checkbox"
                            aria-checked={isChecked}
                            tabIndex={0}
                            onClick={() => toggleSrc(src.id)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSrc(src.id)}
                            style={{
                              flex: 1, minWidth: '180px', padding: '0.65rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                              border: isChecked ? '2px solid #6366f1' : '1px solid #d1d5db',
                              background: isChecked ? '#eef2ff' : '#f9fafb',
                              boxShadow: isChecked ? '0 2px 8px rgba(99,102,241,.15)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: isChecked ? '#4338ca' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em' }}>{src.name}</div>
                              <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: isChecked ? '2px solid #6366f1' : '2px solid #d1d5db', background: isChecked ? '#6366f1' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isChecked && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: '13px', color: '#111827', whiteSpace: field.key === 'details' ? 'pre-wrap' : 'normal', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto' }}>{display}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Standard radio-card UI for all other fields.
              const sel = getFieldSel(field.key);
              const filteredCols = sourceColumns.filter((col) => col.display !== '—' || sel === col.src.id);
              return (
                <div key={field.key} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.85rem' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.45rem' }}>
                    {field.label}
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <ChoiceCard selected={sel === 'existing'} onClick={() => setFieldSelections((p) => ({ ...p, [field.key]: 'existing' }))} label="Existing">
                      {field.isImage && existingRaw ? (
                        <img src={existingRaw} alt="" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ fontSize: '13px', color: existingDisplay === '—' ? '#d1d5db' : '#111827', whiteSpace: field.multiline ? 'pre-wrap' : 'normal', wordBreak: 'break-word', maxHeight: field.multiline ? '120px' : 'none', overflowY: field.multiline ? 'auto' : 'visible' }}>
                          {existingDisplay}
                        </div>
                      )}
                    </ChoiceCard>
                    {filteredCols.map(({ src, raw, display }) => (
                      <ChoiceCard key={src.id} selected={sel === src.id} onClick={() => setFieldSelections((p) => ({ ...p, [field.key]: src.id }))} label={src.name}>
                        {field.isImage && raw ? (
                          <img src={raw} alt="" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                        ) : (
                          <div style={{ fontSize: '13px', color: display === '—' ? '#d1d5db' : '#111827', whiteSpace: field.multiline ? 'pre-wrap' : 'normal', wordBreak: 'break-word', maxHeight: field.multiline ? '120px' : 'none', overflowY: field.multiline ? 'auto' : 'visible' }}>
                            {display}
                          </div>
                        )}
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Tags — checkbox selection of which sources' matched tags to apply */}
            {(() => {
              const tagSources = activeSources
                .map((src) => {
                  const scraped = selectedScrapedBySrc[src.id];
                  const matched = scraped?._matchedTags || scraped?.matched?.tags || [];
                  const unmatched = scraped?._unmatchedTags || scraped?.unmatched?.tags || [];
                  return { src, matched, unmatched };
                })
                .filter((s) => s.matched.length > 0 || s.unmatched.length > 0);
              if (tagSources.length === 0) return null;
              return (
                <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.85rem' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.45rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    Tags
                    <span style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>select sources to include</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {tagSources.map(({ src, matched, unmatched }) => {
                      const isChecked = tagSourceSelections.has(src.id);
                      const toggleSel = () => setTagSourceSelections((prev) => { const next = new Set(prev); next.has(src.id) ? next.delete(src.id) : next.add(src.id); return next; });
                      return (
                        <div key={src.id} role="checkbox" aria-checked={isChecked} tabIndex={0} onClick={toggleSel} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSel()}
                          style={{ flex: 1, minWidth: '180px', padding: '0.65rem 0.75rem', borderRadius: '10px', cursor: 'pointer', border: isChecked ? '2px solid #6366f1' : '1px solid #d1d5db', background: isChecked ? '#eef2ff' : '#f9fafb', boxShadow: isChecked ? '0 2px 8px rgba(99,102,241,.15)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: isChecked ? '#4338ca' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em' }}>{src.name}</div>
                            <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: isChecked ? '2px solid #6366f1' : '2px solid #d1d5db', background: isChecked ? '#6366f1' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isChecked && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {matched.map((tag) => <span key={tag.id} style={{ fontSize: '12px', padding: '0.15rem 0.4rem', borderRadius: '999px', background: '#dcfce7', color: '#166534', display: 'inline-block', width: 'fit-content' }}>✓ {tag.name}</span>)}
                            {unmatched.map((tag, i) => <span key={i} style={{ fontSize: '12px', padding: '0.15rem 0.4rem', borderRadius: '999px', background: '#f3f4f6', color: '#6b7280', display: 'inline-block', width: 'fit-content' }}>{typeof tag === 'string' ? tag : tag?.name || String(tag)}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
