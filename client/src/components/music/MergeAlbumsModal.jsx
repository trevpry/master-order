import React, { useState } from 'react';
import axios from 'axios';
import { mergeModalStyles as styles } from './MergeArtistsModal';
import { getAlbumArtworkUrl } from '../../utils/albumArtwork';

export default function MergeAlbumsModal({ albums, onClose, onSuccess }) {
  const [mainAlbumKey, setMainAlbumKey] = useState(albums[0]?.ratingKey || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleMerge = async () => {
    if (!mainAlbumKey) {
      setError('Please select a main album');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mergeAlbumKeys = albums
        .filter(album => album.ratingKey !== mainAlbumKey)
        .map(album => album.ratingKey);

      const response = await axios.post('/api/music/albums/merge', {
        mainAlbumKey,
        mergeAlbumKeys,
      });

      setSuccess(response.data.data.message || 'Albums merged successfully!');

      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.data);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error merging albums:', err);
      setError(err.response?.data?.error || 'Failed to merge albums');
    } finally {
      setLoading(false);
    }
  };

  const mainAlbum = albums.find(album => album.ratingKey === mainAlbumKey);
  const mergeAlbums = albums.filter(album => album.ratingKey !== mainAlbumKey);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Merge Albums</h2>
          <p style={styles.subtitle}>
            Select which album should be the main album
          </p>
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Select Main Album
            </div>
            <div style={styles.artistsList}>
              {albums.map((album) => {
                const isSelected = album.ratingKey === mainAlbumKey;
                const imageUrl = getAlbumArtworkUrl(album);

                return (
                  <div
                    key={album.ratingKey}
                    style={{
                      ...styles.artistOption,
                      ...(isSelected ? styles.artistOptionSelected : {}),
                    }}
                    onClick={() => setMainAlbumKey(album.ratingKey)}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={album.title}
                        style={styles.artistImage}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={styles.artistImagePlaceholder}>💿</div>
                    )}

                    <div style={styles.artistInfo}>
                      <div style={styles.artistName}>
                        {album.title}{album.year ? ` (${album.year})` : ''}
                      </div>
                      <div style={styles.artistStats}>
                        {[
                          album.trackCount !== undefined ? `${album.trackCount} track${album.trackCount !== 1 ? 's' : ''}` : null,
                          album.totalPlayCount ? `${album.totalPlayCount} plays` : 'No plays yet',
                          album.identificationStatus === 'identified' ? 'Identified' : null
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ color: '#3b82f6', fontSize: '1.25rem' }}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoTitle}>What will happen:</div>
            <ul style={styles.infoList}>
              <li>All tracks from {mergeAlbums.length} album{mergeAlbums.length !== 1 ? 's' : ''} will be moved to <strong>{mainAlbum?.title}</strong></li>
              <li>Album artist credits will be combined</li>
              <li>Missing details (year, label, barcode, MusicBrainz ID, …) will be filled from the merged albums</li>
              <li>Stored cover art is kept from the main album; a merged album&apos;s front/back cover is used only where the main album has none</li>
              <li>Merged albums will be deleted</li>
            </ul>
          </div>

          <div style={styles.warningBox}>
            <p style={styles.warningText}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. {mergeAlbums.length} album{mergeAlbums.length !== 1 ? 's' : ''} will be permanently deleted after merging.
            </p>
          </div>

          {error && (
            <div style={styles.errorMessage}>
              <p style={styles.errorText}>{error}</p>
            </div>
          )}

          {success && (
            <div style={styles.successMessage}>
              <p style={styles.successText}>✓ {success}</p>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.mergeButton,
              ...(loading || !mainAlbumKey ? styles.mergeButtonDisabled : {}),
            }}
            onClick={handleMerge}
            disabled={loading || !mainAlbumKey}
          >
            {loading ? 'Merging...' : `Merge ${albums.length} Albums`}
          </button>
        </div>
      </div>
    </div>
  );
}
