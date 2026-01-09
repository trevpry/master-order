import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import IdentifyModal from '../../../../../components/IdentifyModal';
import MetadataEditor from '../../../../../components/MetadataEditor';
import './AlbumDetail.css';

const AlbumDetail = ({
  album,
  tracks: initialTracks,
  currentTrack,
  isPlaying,
  playlists,
  selectedSection,
  onGoBack,
  onPlayTrack,
  onSelectArtist,
  onSelectTrack,
  onAddTrackToCustomPlaylist,
  formatDuration,
  formatFileSize
}) => {
  if (!album) return null;
  
  const [tracks, setTracks] = useState(initialTracks);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMusicBrainzData, setShowMusicBrainzData] = useState(false);
  const [albumData, setAlbumData] = useState(album);
  
  // Sync local state when prop changes
  useEffect(() => {
    setTracks(initialTracks);
  }, [initialTracks]);
  
  // Sync album data when prop changes
  useEffect(() => {
    setAlbumData(album);
  }, [album]);
  
  const handleRatingChange = async (trackRatingKey, newRating) => {
    try {
      console.log('📊 Setting rating:', { trackRatingKey, rating: newRating });
      
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${trackRatingKey}/rating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Rating updated successfully:', data.track.userRating);
        // Update local state with new rating
        setTracks(prevTracks =>
          prevTracks.map(t =>
            t.ratingKey === trackRatingKey
              ? { ...t, userRating: data.track.userRating }
              : t
          )
        );
      } else {
        console.error('Failed to update rating:', await response.text());
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };
  
  const handleAlbumUpdate = (updatedAlbum) => {
    setAlbumData(updatedAlbum);
    console.log('Album updated with MusicBrainz metadata:', updatedAlbum);
  };

  return (
    <div className="album-detail">
      {/* Header with Back Button */}
      <div className="album-detail-header">
        <button className="back-button" onClick={onGoBack}>
          ← Back to Albums
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="musicbrainz-search-btn"
            onClick={() => setShowIdentifyModal(true)}
            title="Identify album with MusicBrainz"
            style={{ backgroundColor: '#3b82f6' }}
          >
            🔍 Identify Album
          </button>
          <button 
            className="musicbrainz-search-btn"
            onClick={() => setIsEditMode(!isEditMode)}
            title="Edit album metadata"
            style={{ backgroundColor: isEditMode ? '#10b981' : '#8b5cf6' }}
          >
            {isEditMode ? '✓ Done' : '✏️ Edit Metadata'}
          </button>
        </div>
      </div>

      {/* Album Info Section */}
      <div className="album-info">
        {album.thumb && (
          <div className="album-artwork">
            <img 
              src={`${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={album.title}
              onError={(e) => {
                console.error('Album artwork failed to load');
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="album-metadata">
          {/* Identification Status Badge */}
          {albumData.identificationStatus && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                backgroundColor: albumData.identificationStatus === 'identified' ? '#065f46' : 
                                albumData.identificationStatus === 'pending_review' ? '#78350f' :
                                albumData.identificationStatus === 'manual' ? '#581c87' : '#374151',
                color: albumData.identificationStatus === 'identified' ? '#d1fae5' :
                      albumData.identificationStatus === 'pending_review' ? '#fde68a' :
                      albumData.identificationStatus === 'manual' ? '#e9d5ff' : '#d1d5db'
              }}>
                {albumData.identificationStatus === 'identified' && '✓ Identified'}
                {albumData.identificationStatus === 'pending_review' && '⏳ Pending Review'}
                {albumData.identificationStatus === 'unidentified' && 'Not Identified'}
                {albumData.identificationStatus === 'manual' && '✏️ Manual Entry'}
                {albumData.identificationConfidence && ` (${Math.round(albumData.identificationConfidence * 100)}% match)`}
              </span>
            </div>
          )}

          {/* Metadata Editing Mode */}
          {isEditMode ? (
            <div style={{ 
              backgroundColor: '#1f2937', 
              padding: '1.5rem', 
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="title"
                label="Album Title"
                currentValue={albumData.title}
                onUpdate={(val) => setAlbumData({ ...albumData, title: val })}
              />
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="releaseDate"
                label="Release Date"
                currentValue={albumData.originallyAvailableAt || albumData.year?.toString()}
                onUpdate={(val) => setAlbumData({ ...albumData, originallyAvailableAt: val })}
              />
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="label"
                label="Record Label"
                currentValue={albumData.studio}
                onUpdate={(val) => setAlbumData({ ...albumData, studio: val })}
              />
            </div>
          ) : (
            <>
              <h1 className="album-title">{albumData.title}</h1>
              <p 
                className="album-artist"
                onClick={() => {
                  if (album.parentRatingKey && onSelectArtist) {
                    onSelectArtist({ ratingKey: album.parentRatingKey, title: album.parentTitle });
                  }
                }}
                style={{
                  cursor: onSelectArtist && album.parentRatingKey ? 'pointer' : 'default',
                  color: onSelectArtist && album.parentRatingKey ? '#007bff' : '#666'
                }}
                title={onSelectArtist && album.parentRatingKey ? `View ${album.parentTitle || 'artist'}'s albums` : ''}
                onMouseEnter={(e) => {
                  if (onSelectArtist && album.parentRatingKey) {
                    e.target.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {album.parentTitle || album.artist?.title || 'Various Artists'}
              </p>
            </>
          )}
          
          <div className="album-details">
            {album.year && <span className="album-year">{album.year}</span>}
            {tracks && tracks.length > 0 && (
              <span className="album-track-count">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
            )}
            {album.totalPlayCount !== undefined && album.totalPlayCount > 0 && (
              <span className="album-play-count">• {album.totalPlayCount} {album.totalPlayCount === 1 ? 'play' : 'plays'}</span>
            )}
            {(albumData.musicBrainzId || album.musicBrainzId) && (
              <span className="album-mbid">
                • <a 
                  href={`https://musicbrainz.org/release/${albumData.musicBrainzId || album.musicBrainzId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mbid-link"
                  title="View release on MusicBrainz"
                >
                  🏷️ MusicBrainz
                </a>
              </span>
            )}
          </div>

          {console.log('Album MusicBrainz ID:', albumData.musicBrainzId, album.musicBrainzId)}

          {album.summary && (
            <p className="album-summary">{album.summary}</p>
          )}
        </div>
      </div>

      {/* Playlist Player */}
      {tracks && tracks.length > 0 && (
        <TracksPlaylistPlayer
          tracks={tracks}
          selectedSection={selectedSection}
          searchQuery=""
          onPlayTrack={onPlayTrack}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          selectedAlbum={album}
          selectedArtist={null}
        />
      )}

      {/* Tracks List */}
      <div className="album-tracks">
        <h2>Tracks</h2>
        {!tracks || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found for this album.</p>
          </div>
        ) : (
          <div className="tracks-table">
            <div className="tracks-header">
              <span className="track-controls">▶</span>
              <span className="track-number">#</span>
              <span className="track-title">Title</span>
              <span className="track-rating">Rating</span>
              <span className="track-plays">Plays</span>
              <span className="track-duration">Duration</span>
              <span className="track-size">Size</span>
              <span className="track-playlist">Playlist</span>
            </div>
            {tracks.map((track, index) => (
              <div 
                key={track.ratingKey} 
                className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}
              >
                <button 
                  className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                  onClick={() => onPlayTrack(track)}
                  title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                >
                  {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                </button>
                <span className="track-number">{track.index || index + 1}</span>
                <div className="track-title">
                  <div 
                    className="track-name track-name-link"
                    onClick={() => onSelectTrack && onSelectTrack(track)}
                  >
                    {track.title || 'Untitled'}
                  </div>
                  {track.originalTitle && (
                    <div className="track-subtitle">{track.originalTitle}</div>
                  )}
                  {track.musicBrainzTrackId && (
                    <div className="track-mbid">
                      <a 
                        href={`https://musicbrainz.org/recording/${track.musicBrainzTrackId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mbid-link"
                        title="View on MusicBrainz"
                      >
                        🏷️ MB
                      </a>
                    </div>
                  )}
                </div>
                <div className="track-rating">
                  <StarRating
                    value={track.userRating || 0}
                    onChange={(rating) => handleRatingChange(track.ratingKey, rating)}
                    size="small"
                  />
                </div>
                <span className="track-plays">
                  {track.viewCount > 0 ? `${track.viewCount} ${track.viewCount === 1 ? 'play' : 'plays'}` : '—'}
                </span>
                <span className="track-duration">{formatDuration(track.duration)}</span>
                <span className="track-size">{formatFileSize(track.size)}</span>
                <div className="track-playlist">
                  {playlists && playlists.length > 0 ? (
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          onAddTrackToCustomPlaylist(parseInt(e.target.value), track);
                          e.target.value = '';
                        }
                      }}
                      className="playlist-select"
                    >
                      <option value="">+ Add to Playlist</option>
                      {playlists.map(playlist => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="no-playlists">No playlists</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* MusicBrainz Metadata Section */}
      {albumData.musicBrainzId && (
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
                {albumData.musicBrainzCountry && (
                  <div className="metadata-item">
                    <span className="metadata-label">Country:</span>
                    <span className="metadata-value">{albumData.musicBrainzCountry}</span>
                  </div>
                )}
                
                {albumData.musicBrainzReleaseDate && (
                  <div className="metadata-item">
                    <span className="metadata-label">Release Date:</span>
                    <span className="metadata-value">{new Date(albumData.musicBrainzReleaseDate).toLocaleDateString()}</span>
                  </div>
                )}
                
                {albumData.musicBrainzStatus && (
                  <div className="metadata-item">
                    <span className="metadata-label">Status:</span>
                    <span className="metadata-value">{albumData.musicBrainzStatus}</span>
                  </div>
                )}
                
                {albumData.musicBrainzPackaging && (
                  <div className="metadata-item">
                    <span className="metadata-label">Packaging:</span>
                    <span className="metadata-value">{albumData.musicBrainzPackaging}</span>
                  </div>
                )}
                
                {albumData.musicBrainzLabel && (
                  <div className="metadata-item">
                    <span className="metadata-label">Label:</span>
                    <span className="metadata-value">{albumData.musicBrainzLabel}</span>
                  </div>
                )}
                
                {albumData.musicBrainzBarcode && (
                  <div className="metadata-item">
                    <span className="metadata-label">Barcode:</span>
                    <span className="metadata-value">{albumData.musicBrainzBarcode}</span>
                  </div>
                )}
                
                {albumData.musicBrainzAsin && (
                  <div className="metadata-item">
                    <span className="metadata-label">ASIN:</span>
                    <span className="metadata-value">{albumData.musicBrainzAsin}</span>
                  </div>
                )}
                
                <div className="metadata-item">
                  <span className="metadata-label">MusicBrainz ID:</span>
                  <a 
                    href={`https://musicbrainz.org/release/${albumData.musicBrainzId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="metadata-link"
                  >
                    {albumData.musicBrainzId}
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Identify Modal */}
      <IdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        entityType="album"
        entityKey={album.ratingKey}
        entityTitle={albumData.title}
        onIdentified={(updatedAlbum) => {
          setAlbumData(updatedAlbum);
          setShowIdentifyModal(false);
        }}
      />
    </div>
  );
};

export default AlbumDetail;
