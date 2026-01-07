import React, { useState } from 'react';
import axios from 'axios';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    backgroundColor: 'white',
    zIndex: 1,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  body: {
    padding: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.75rem',
  },
  artistsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  artistOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  artistOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  artistImage: {
    width: '48px',
    height: '48px',
    borderRadius: '0.375rem',
    objectFit: 'cover',
    backgroundColor: '#f3f4f6',
  },
  artistImagePlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '0.375rem',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: '#9ca3af',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '0.25rem',
  },
  artistStats: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    marginTop: '1rem',
  },
  infoTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: '0.5rem',
  },
  infoList: {
    fontSize: '0.875rem',
    color: '#1e40af',
    margin: 0,
    paddingLeft: '1.25rem',
  },
  warningBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    marginTop: '1rem',
  },
  warningText: {
    fontSize: '0.875rem',
    color: '#991b1b',
    margin: 0,
  },
  footer: {
    padding: '1.5rem',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    position: 'sticky',
    bottom: 0,
    backgroundColor: 'white',
  },
  button: {
    padding: '0.625rem 1.25rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  mergeButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  mergeButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  successMessage: {
    backgroundColor: '#d1fae5',
    border: '1px solid #6ee7b7',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    marginTop: '1rem',
  },
  successText: {
    fontSize: '0.875rem',
    color: '#065f46',
    margin: 0,
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    marginTop: '1rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#991b1b',
    margin: 0,
  },
};

export default function MergeArtistsModal({ 
  artists, 
  onClose, 
  onSuccess,
  plexUrl,
  plexToken
}) {
  const [mainArtistKey, setMainArtistKey] = useState(artists[0]?.ratingKey || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleMerge = async () => {
    if (!mainArtistKey) {
      setError('Please select a main artist');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mergeArtistKeys = artists
        .filter(a => a.ratingKey !== mainArtistKey)
        .map(a => a.ratingKey);

      const response = await axios.post('/api/music/artists/merge', {
        mainArtistKey,
        mergeArtistKeys,
      });

      setSuccess(response.data.data.message || 'Artists merged successfully!');
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.data);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error merging artists:', err);
      setError(err.response?.data?.error || 'Failed to merge artists');
    } finally {
      setLoading(false);
    }
  };

  const mainArtist = artists.find(a => a.ratingKey === mainArtistKey);
  const mergeArtists = artists.filter(a => a.ratingKey !== mainArtistKey);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Merge Artists</h2>
          <p style={styles.subtitle}>
            Select which artist should be the main artist
          </p>
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Select Main Artist
            </div>
            <div style={styles.artistsList}>
              {artists.map((artist) => {
                const isSelected = artist.ratingKey === mainArtistKey;
                const imageUrl = artist.thumb ? `${plexUrl}${artist.thumb}?X-Plex-Token=${plexToken}` : null;

                return (
                  <div
                    key={artist.ratingKey}
                    style={{
                      ...styles.artistOption,
                      ...(isSelected ? styles.artistOptionSelected : {}),
                    }}
                    onClick={() => setMainArtistKey(artist.ratingKey)}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={artist.title}
                        style={styles.artistImage}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <div style={styles.artistImagePlaceholder}>
                        🎵
                      </div>
                    )}
                    
                    <div style={styles.artistInfo}>
                      <div style={styles.artistName}>{artist.title}</div>
                      <div style={styles.artistStats}>
                        {artist.totalPlayCount ? `${artist.totalPlayCount} plays` : 'No plays yet'}
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
              <li>All albums from {mergeArtists.length} artist{mergeArtists.length !== 1 ? 's' : ''} will be transferred to <strong>{mainArtist?.title}</strong></li>
              <li>All works (compositions) will be transferred</li>
              <li>All artist type assignments will be transferred</li>
              <li>All track artist relationships will be transferred</li>
              <li>Merged artists will be deleted</li>
            </ul>
          </div>

          <div style={styles.warningBox}>
            <p style={styles.warningText}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. {mergeArtists.length} artist{mergeArtists.length !== 1 ? 's' : ''} will be permanently deleted after merging.
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
            style={{
              ...styles.button,
              ...styles.cancelButton,
            }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.mergeButton,
              ...(loading || !mainArtistKey ? styles.mergeButtonDisabled : {}),
            }}
            onClick={handleMerge}
            disabled={loading || !mainArtistKey}
          >
            {loading ? 'Merging...' : `Merge ${artists.length} Artists`}
          </button>
        </div>
      </div>
    </div>
  );
}
