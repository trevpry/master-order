import React from 'react';

/**
 * Front/back cover picker shared by the Discogs and MusicBrainz match panels.
 * images: [{ index, thumb, full, width?, height?, label? }]
 * selection: { front: index|null, back: index|null }
 */
const ArtworkPicker = ({ images = [], selection, onChange, disabled = false, loading = false, error = null }) => {
  const current = selection || { front: null, back: null };

  const toggle = (side, imageIndex) => {
    const next = { ...current, [side]: current[side] === imageIndex ? null : imageIndex };
    const otherSide = side === 'front' ? 'back' : 'front';
    if (next[side] === imageIndex && next[otherSide] === imageIndex) {
      next[otherSide] = null;
    }
    onChange(next);
  };

  const summary = [
    current.front !== null && current.front !== undefined ? 'front' : 'no front',
    current.back !== null && current.back !== undefined ? 'back' : null
  ].filter(Boolean).join(', ');

  return (
    <>
      <div className="mb-track-match-column-label">Album Art ({summary} selected)</div>
      {loading && <div className="mb-track-match-cell-meta">Loading cover art…</div>}
      {!loading && error && <div className="mb-track-match-cell-meta">{error}</div>}
      {!loading && !error && images.length === 0 && (
        <div className="mb-track-match-cell-meta">This release has no cover art.</div>
      )}
      {!loading && images.length > 0 && (
        <div className="discogs-artwork-grid">
          {images.map((image) => {
            const isSelected = current.front === image.index || current.back === image.index;
            return (
              <div key={image.index} className={`mb-track-match-cell discogs-artwork-cell ${isSelected ? 'matched' : ''}`}>
                <a href={image.full} target="_blank" rel="noopener noreferrer" title="Open full size">
                  <img src={image.thumb} alt={`Cover image ${image.index + 1}`} loading="lazy" />
                </a>
                <div className="mb-track-match-cell-meta">
                  {image.label || (image.width && image.height ? `${image.width}×${image.height}` : `Image ${image.index + 1}`)}
                </div>
                <div className="discogs-artwork-actions">
                  {['front', 'back'].map((side) => {
                    const selected = current[side] === image.index;
                    return (
                      <button
                        key={side}
                        type="button"
                        className={`album-artwork-side-btn ${selected ? 'active' : ''}`}
                        onClick={() => toggle(side, image.index)}
                        disabled={disabled}
                      >
                        {selected ? '✓ ' : ''}{side === 'front' ? 'Front' : 'Back'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ArtworkPicker;
