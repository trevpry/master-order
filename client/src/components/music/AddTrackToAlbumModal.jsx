import React, { useEffect, useState } from 'react';
import config from '../../config';
import { mergeModalStyles as styles } from './MergeArtistsModal';

export default function AddTrackToAlbumModal({ track, onClose, onSuccess }) {
  const [scope, setScope] = useState('artists');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumKey, setSelectedAlbumKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadAlbums = async () => {
      setLoading(true);
      setError(null);
      setSelectedAlbumKey('');
      setAlbums([]);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (query) params.set('search', query);
        const url = scope === 'artists'
          ? `${config.apiBaseUrl}/api/music/tracks/${encodeURIComponent(track.ratingKey)}/artist-albums`
          : `${config.apiBaseUrl}/api/music/albums?${params}`;
        const response = await fetch(url, {
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to load albums');
        setAlbums(Array.isArray(result) ? result : result.albums);
        setTotalPages(Array.isArray(result) ? 1 : result.totalPages);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error loading albums:', err);
        setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadAlbums();
    return () => controller.abort();
  }, [query, page, scope, track.ratingKey]);

  const changeScope = nextScope => {
    setScope(nextScope);
    setPage(1);
    setSearch('');
    setQuery('');
    setSelectedAlbumKey('');
  };

  const handleAdd = async () => {
    if (!selectedAlbumKey || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${encodeURIComponent(track.ratingKey)}/album`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumRatingKey: selectedAlbumKey })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add track to album');
      onSuccess(result.track);
    } catch (err) {
      console.error('Error adding track to album:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-track-album-title" onClick={event => event.stopPropagation()}>
        <div style={styles.header}>
          <h2 id="add-track-album-title" style={styles.title}>Add to Album</h2>
          <p style={styles.subtitle}>{track.title} - existing artist and metadata will be preserved.</p>
        </div>
        <div style={styles.body}>
          <div role="group" aria-label="Album source">
            <button type="button" onClick={() => changeScope('artists')} disabled={saving}
              aria-pressed={scope === 'artists'}>Track artists' albums</button>
            <button type="button" onClick={() => changeScope('all')} disabled={saving}
              aria-pressed={scope === 'all'}>Search all albums</button>
          </div>
          {scope === 'all' ? <form onSubmit={event => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}>
            <label htmlFor="track-album-search">Search all albums</label>
            <input id="track-album-search" value={search} onChange={event => setSearch(event.target.value)} disabled={saving} />
            <button type="submit" disabled={saving}>Search</button>
          </form> : <p>Albums associated with this track's artists, including linked artist credits.</p>}
          {error && <p role="alert">{error}</p>}
          {loading ? <p>Loading albums...</p> : (
            <div style={styles.artistsList}>
              {albums.length === 0 && <p>{scope === 'artists'
                ? "No albums found for this track's artists. Use Search all albums to choose another album."
                : 'No albums found.'}</p>}
              {albums.map(album => (
                <label key={album.ratingKey} style={{
                  ...styles.artistOption,
                  ...(selectedAlbumKey === album.ratingKey ? styles.artistOptionSelected : {})
                }}>
                  <input type="radio" name="target-album" value={album.ratingKey}
                    checked={selectedAlbumKey === album.ratingKey}
                    onChange={() => setSelectedAlbumKey(album.ratingKey)} disabled={saving} />
                  <div style={styles.artistInfo}>
                    <div style={styles.artistName}>{album.userTitle || album.title}{album.year ? ` (${album.year})` : ''}</div>
                    <div style={styles.artistStats}>{album.artist?.userTitle || album.artist?.title || album.albumArtist || 'Unknown Artist'}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {scope === 'all' && !query && totalPages > 1 && (
            <div>
              <button disabled={loading || saving || page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span> Page {page} of {totalPages} </span>
              <button disabled={loading || saving || page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={handleAdd} disabled={loading || saving || !selectedAlbumKey}>
            {saving ? 'Adding...' : 'Add to Album'}
          </button>
        </div>
      </div>
    </div>
  );
}
