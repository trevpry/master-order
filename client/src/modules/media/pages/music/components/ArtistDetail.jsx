import React, { useState } from 'react';
import config from '../../../../../config';
import ArtistTypesManager from './ArtistTypesManager';
import MusicBrainzSearchModal from '../../../../../components/music/MusicBrainzSearchModal';
import './ArtistDetail.css';

const ArtistDetail = ({
  artist,
  albums,
  stats,
  onGoBack,
  onSelectAlbum,
  onArtistUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(artist?.title || '');
  const [editedTitleSort, setEditedTitleSort] = useState(artist?.titleSort || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showMusicBrainzModal, setShowMusicBrainzModal] = useState(false);
  const [showMusicBrainzData, setShowMusicBrainzData] = useState(false);

  if (!artist) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/music/artists/${artist.ratingKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editedTitle,
          titleSort: editedTitleSort
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update artist');
      }

      const updatedArtist = await response.json();
      
      // Update successful - notify parent component
      if (onArtistUpdate) {
        onArtistUpdate(updatedArtist.artist);
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating artist:', error);
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTitle(artist.title);
    setEditedTitleSort(artist.titleSort || '');
    setIsEditing(false);
    setSaveError(null);
  };

  return (
    <div className="artist-detail">
      {/* Header with Back Button */}
      <div className="artist-detail-header">
        <button className="back-button" onClick={onGoBack}>
          ← Back to Artists
        </button>
        <button 
          className="musicbrainz-button" 
          onClick={() => setShowMusicBrainzModal(true)}
          title="Search MusicBrainz for metadata"
        >
          🎵 MusicBrainz Search
        </button>
      </div>

      {/* Artist Info Section */}
      <div className="artist-info-section">
        {artist.thumb && (
          <div className="artist-artwork">
            <img 
              src={`${config.plexUrl}${artist.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={artist.title}
              onError={(e) => {
                console.error('Artist artwork failed to load');
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="artist-metadata">
          {isEditing ? (
            <div className="artist-edit-form">
              <div className="form-group">
                <label htmlFor="artist-title">Artist Name</label>
                <input
                  id="artist-title"
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="form-input"
                  placeholder="Artist Name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="artist-sort">Sort Name</label>
                <input
                  id="artist-sort"
                  type="text"
                  value={editedTitleSort}
                  onChange={(e) => setEditedTitleSort(e.target.value)}
                  className="form-input"
                  placeholder="Sort Name (e.g., 'Beatles, The')"
                />
                <small className="form-help">Used for alphabetical sorting. Leave blank to use artist name.</small>
              </div>
              {saveError && (
                <div className="error-message">{saveError}</div>
              )}
              <div className="form-actions">
                <button 
                  className="btn-save" 
                  onClick={handleSave}
                  disabled={isSaving || !editedTitle.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  className="btn-cancel" 
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="artist-title-row">
                <h1 className="artist-title">{artist.title}</h1>
                <button 
                  className="btn-edit-icon" 
                  onClick={() => setIsEditing(true)}
                  title="Edit artist name"
                >
                  ✏️
                </button>
              </div>
              {artist.titleSort && artist.titleSort !== artist.title && (
                <div className="artist-sort-name">
                  Sort: {artist.titleSort}
                </div>
              )}
              
              <div className="artist-stats">
                {albums && albums.length > 0 && (
                  <span className="stat-item">{albums.length} album{albums.length !== 1 ? 's' : ''}</span>
                )}
                {stats?.totalTracks > 0 && (
                  <span className="stat-item">{stats.totalTracks} track{stats.totalTracks !== 1 ? 's' : ''}</span>
                )}
                {artist.totalPlayCount !== undefined && artist.totalPlayCount > 0 && (
                  <span className="stat-item">{artist.totalPlayCount} {artist.totalPlayCount === 1 ? 'play' : 'plays'}</span>
                )}
              </div>

              {artist.summary && (
                <p className="artist-summary">{artist.summary}</p>
              )}

              {/* MusicBrainz Metadata Section */}
              {artist.musicBrainzId && (
                <div className="musicbrainz-metadata">
                  <div 
                    className="metadata-header" 
                    onClick={() => setShowMusicBrainzData(!showMusicBrainzData)}
                  >
                    <h3 className="metadata-heading">MusicBrainz Information</h3>
                    <button className="metadata-toggle">
                      {showMusicBrainzData ? '▼' : '▶'}
                    </button>
                  </div>
                  
                  {showMusicBrainzData && (
                    <>
                      <div className="metadata-grid">
                        {artist.musicBrainzCountry && (
                          <div className="metadata-item">
                            <span className="metadata-label">Country:</span>
                            <span className="metadata-value">{artist.musicBrainzCountry}</span>
                          </div>
                        )}
                        
                        {(artist.musicBrainzBeginDate || artist.musicBrainzEndDate) && (
                          <div className="metadata-item">
                            <span className="metadata-label">Active:</span>
                            <span className="metadata-value">
                              {artist.musicBrainzBeginDate || '?'} - {artist.musicBrainzEnded ? artist.musicBrainzEndDate || '?' : 'present'}
                            </span>
                          </div>
                        )}
                        
                        <div className="metadata-item">
                          <span className="metadata-label">MusicBrainz ID:</span>
                          <a 
                            href={`https://musicbrainz.org/artist/${artist.musicBrainzId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="metadata-link"
                          >
                            {artist.musicBrainzId}
                          </a>
                        </div>
                      </div>

                      {artist.musicBrainzAliases && JSON.parse(artist.musicBrainzAliases).length > 0 && (
                        <div className="metadata-section">
                          <h4 className="metadata-subheading">Aliases</h4>
                          <div className="aliases-list">
                            {JSON.parse(artist.musicBrainzAliases).map((alias, idx) => (
                              <span key={idx} className="alias-tag">
                                {alias.name}
                                {alias.locale && <span className="alias-locale"> ({alias.locale})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {artist.musicBrainzLinks && JSON.parse(artist.musicBrainzLinks).length > 0 && (
                        <div className="metadata-section">
                          <h4 className="metadata-subheading">External Links</h4>
                          <div className="external-links">
                            {JSON.parse(artist.musicBrainzLinks).map((link, idx) => (
                              <a
                                key={idx}
                                href={link.url?.resource || link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="external-link"
                              >
                                {link.type || 'Link'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Artist Types Manager */}
      {!isEditing && (
        <ArtistTypesManager artistKey={artist.ratingKey} />
      )}

      {/* Albums Grid */}
      {albums && albums.length > 0 && (
        <div className="artist-albums-section">
          <h2>Albums</h2>
          <div className="albums-grid">
            {albums.map(album => (
              <div 
                key={album.ratingKey} 
                className="album-card"
                onClick={() => onSelectAlbum(album)}
              >
                {album.thumb && (
                  <div className="album-image">
                    <img 
                      src={`${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`}
                      alt={album.title}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
                <div className="album-info">
                  <h3 className="album-title-line">
                    {album.title}
                    {album.year && <span className="album-year"> ({album.year})</span>}
                  </h3>
                  {album.totalPlayCount !== undefined && album.totalPlayCount > 0 && (
                    <p className="album-play-count">
                      {album.totalPlayCount} {album.totalPlayCount === 1 ? 'play' : 'plays'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* MusicBrainz Search Modal */}
      {showMusicBrainzModal && (
        <MusicBrainzSearchModal
          artistName={artist.title}
          artistRatingKey={artist.ratingKey}
          onClose={() => setShowMusicBrainzModal(false)}
          onArtistUpdated={onArtistUpdate}
        />
      )}
    </div>
  );
};

export default ArtistDetail;
