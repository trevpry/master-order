import React, { useState } from 'react';
import config from '../../../../../config';
import ArtistTypesManager from './ArtistTypesManager';
import MusicBrainzSearchModal from '../../../../../components/music/MusicBrainzSearchModal';
import IdentifyModal from '../../../../../components/IdentifyModal';
import MetadataEditor from '../../../../../components/MetadataEditor';
import EmbeddedPicardTagsPanel from './EmbeddedPicardTagsPanel';
import './ArtistDetail.css';

const ArtistDetail = ({
  artist,
  albums,
  stats,
  onGoBack,
  onSelectAlbum,
  onSelectWork,
  onSelectTrack,
  onArtistUpdate,
  onExtractArtistMetadata,
  isExtractingMetadata = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(artist?.title || '');
  const [editedTitleSort, setEditedTitleSort] = useState(artist?.titleSort || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showMusicBrainzModal, setShowMusicBrainzModal] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [isMetadataEditMode, setIsMetadataEditMode] = useState(false);
  const [showMusicBrainzData, setShowMusicBrainzData] = useState(false);
  const [artistData, setArtistData] = useState(artist);

  const linkedAlbums = artist?.linkedAlbums || [];
  const linkedTracks = artist?.linkedTracks || [];
  const works = artist?.works || [];

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="musicbrainz-button"
            onClick={() => onExtractArtistMetadata && onExtractArtistMetadata(artist)}
            title="Extract metadata for all albums by this artist"
            style={{ backgroundColor: '#0f766e' }}
            disabled={isExtractingMetadata}
          >
            {isExtractingMetadata ? 'Extracting…' : '🏷️ Extract All Album Metadata'}
          </button>
          <button 
            className="musicbrainz-button"
            onClick={() => setShowIdentifyModal(true)}
            title="Identify artist with MusicBrainz"
            style={{ backgroundColor: '#3b82f6' }}
          >
            🔍 Identify Artist
          </button>
          <button 
            className="musicbrainz-button"
            onClick={() => setIsMetadataEditMode(!isMetadataEditMode)}
            title="Edit artist metadata"
            style={{ backgroundColor: isMetadataEditMode ? '#10b981' : '#8b5cf6' }}
          >
            {isMetadataEditMode ? '✓ Done' : '✏️ Edit Metadata'}
          </button>
          <button 
            className="musicbrainz-button" 
            onClick={() => setShowMusicBrainzModal(true)}
            title="Search MusicBrainz for metadata"
          >
            🎵 MusicBrainz Search
          </button>
        </div>
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
          {/* Identification Status Badge */}
          {artistData.identificationStatus && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                backgroundColor: artistData.identificationStatus === 'identified' ? '#065f46' : 
                                artistData.identificationStatus === 'pending_review' ? '#78350f' :
                                artistData.identificationStatus === 'manual' ? '#581c87' : '#374151',
                color: artistData.identificationStatus === 'identified' ? '#d1fae5' :
                      artistData.identificationStatus === 'pending_review' ? '#fde68a' :
                      artistData.identificationStatus === 'manual' ? '#e9d5ff' : '#d1d5db'
              }}>
                {artistData.identificationStatus === 'identified' && '✓ Identified'}
                {artistData.identificationStatus === 'pending_review' && '⏳ Pending Review'}
                {artistData.identificationStatus === 'unidentified' && 'Not Identified'}
                {artistData.identificationStatus === 'manual' && '✏️ Manual Entry'}
                {artistData.identificationConfidence && ` (${Math.round(artistData.identificationConfidence * 100)}% match)`}
              </span>
            </div>
          )}

          {/* Metadata Edit Mode */}
          {isMetadataEditMode ? (
            <div style={{ 
              backgroundColor: '#1f2937', 
              padding: '1.5rem', 
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <MetadataEditor
                entityType="artist"
                entityKey={artist.ratingKey}
                field="title"
                label="Artist Name"
                currentValue={artistData.title}
                onUpdate={(val) => setArtistData({ ...artistData, title: val })}
              />
              <MetadataEditor
                entityType="artist"
                entityKey={artist.ratingKey}
                field="sortName"
                label="Sort Name"
                currentValue={artistData.titleSort}
                onUpdate={(val) => setArtistData({ ...artistData, titleSort: val })}
              />
              <MetadataEditor
                entityType="artist"
                entityKey={artist.ratingKey}
                field="country"
                label="Country"
                currentValue={artistData.country}
                onUpdate={(val) => setArtistData({ ...artistData, country: val })}
              />
            </div>
          ) : null}

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

              <EmbeddedPicardTagsPanel entityType="artist" entityKey={artist.ratingKey} />

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

      {works.length > 0 && (
        <div className="artist-linked-section">
          <h2>Works</h2>
          <div className="artist-works-list">
            {works.map((work) => (
              <div
                key={`artist-work-${work.id}`}
                className="artist-work-row"
                onClick={() => onSelectWork && onSelectWork(work)}
              >
                <div className="artist-work-main">
                  <div className="artist-work-title">{work.title}</div>
                  <div className="artist-work-subtitle">
                    {work.partsCount || 0} part{work.partsCount !== 1 ? 's' : ''}
                    {' • '}
                    {work.tracksCount || 0} track{work.tracksCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="artist-work-meta">
                  {work.totalPlayCount > 0 && (
                    <div>{work.totalPlayCount} {work.totalPlayCount === 1 ? 'play' : 'plays'}</div>
                  )}
                  {work.linkedArtistTypes?.length > 0 && (
                    <div>Roles: {work.linkedArtistTypes.join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {linkedAlbums.length > 0 && (
        <div className="artist-linked-section">
          <h2>Linked Albums</h2>
          <div className="albums-grid">
            {linkedAlbums.map((album) => (
              <div
                key={`linked-album-${album.ratingKey}`}
                className="album-card"
                onClick={() => onSelectAlbum && onSelectAlbum(album)}
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
                  <p className="linked-meta-line">
                    {album.artist?.title || album.parentTitle || 'Unknown Artist'}
                  </p>
                  <p className="linked-meta-line">
                    Linked as: {(album.linkedArtistTypes || []).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {linkedTracks.length > 0 && (
        <div className="artist-linked-section">
          <h2>Linked Tracks</h2>
          <div className="linked-tracks-list">
            {linkedTracks.map((track) => (
              <div
                key={`linked-track-${track.ratingKey}`}
                className="linked-track-row"
                onClick={() => onSelectTrack && onSelectTrack(track)}
              >
                <div className="linked-track-main">
                  <div className="linked-track-title">{track.title || 'Untitled'}</div>
                  <div className="linked-track-subtitle">
                    {track.album?.title || 'Unknown Album'}
                    {track.album?.artist?.title ? ` • ${track.album.artist.title}` : ''}
                  </div>
                </div>
                <div className="linked-track-meta">
                  Linked as: {(track.linkedArtistTypes || []).join(', ')}
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

      {/* Identify Modal */}
      <IdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        entityType="artist"
        entityKey={artist.ratingKey}
        entityTitle={artistData.title}
        onIdentified={(updatedArtist) => {
          setArtistData(updatedArtist);
          if (onArtistUpdate) {
            onArtistUpdate(updatedArtist);
          }
          setShowIdentifyModal(false);
        }}
      />
    </div>
  );
};

export default ArtistDetail;
