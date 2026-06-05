import React, { useState, useEffect } from 'react';
import LoadingState from '../../../../../shared/components/LoadingState';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import config from '../../../../../config';
import './TracksPlaylistPlayer.css';

const MusicTracksView = ({ 
  tracks: propTracks, 
  tracksLoading, 
  tracksHasMore,
  selectedAlbum,
  selectedArtist,
  selectedSection,
  searchQuery,
  currentTrack,
  isPlaying,
  playlists,
  onGoBackFromTracks,
  onPlayTrack,
  onSelectArtist,
  onSelectTrack,
  onLoadMoreTracks,
  onAddTrackToCustomPlaylist,
  formatDuration,
  formatFileSize
}) => {
  const [tracks, setTracks] = useState(propTracks);

  const formatTrackNumberLabel = (track, fallbackIndex) => {
    const trackNumber = Number.isInteger(track?.trackNumber)
      ? track.trackNumber
      : (Number.isInteger(track?.index) ? track.index : fallbackIndex);
    const discNumber = Number.isInteger(track?.discNumber) ? track.discNumber : null;

    if (discNumber && trackNumber) {
      return `D${discNumber}-T${trackNumber}`;
    }

    return trackNumber || fallbackIndex;
  };
  
  useEffect(() => {
    setTracks(propTracks);
  }, [propTracks]);
  
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
        // Update local state
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
  return (
    <div className="tracks-section">
      <div className="section-header">
        <button 
          className="back-button" 
          onClick={onGoBackFromTracks}
          title={selectedAlbum ? `Back to ${selectedAlbum.title}` : selectedArtist ? `Back to ${selectedArtist.title}` : 'Back to Artists'}
        >
          ← Back
        </button>
        
        {/* Album/Artist Header with Artwork */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
          {selectedAlbum?.thumb && (
            <img 
              src={`${config.plexUrl}${selectedAlbum.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={selectedAlbum.title}
              style={{
                width: '150px',
                height: '150px',
                objectFit: 'cover',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
              }}
            />
          )}
          {selectedArtist?.thumb && !selectedAlbum && (
            <img 
              src={`${config.plexUrl}${selectedArtist.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={selectedArtist.title}
              style={{
                width: '150px',
                height: '150px',
                objectFit: 'cover',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
              }}
            />
          )}
          <div>
            <h2 style={{ margin: '0 0 10px 0' }}>
              {selectedAlbum ? selectedAlbum.title : 
               selectedArtist ? `All tracks by ${selectedArtist.title}` : 
               'All Tracks'}
            </h2>
            {selectedAlbum && (
              <p style={{ margin: '0', color: '#888', fontSize: '14px' }}>
                <span 
                  onClick={() => {
                    if (onSelectArtist && (selectedAlbum.parentRatingKey || selectedArtist)) {
                      const artist = selectedArtist || { 
                        ratingKey: selectedAlbum.parentRatingKey, 
                        title: selectedAlbum.parentTitle 
                      };
                      onSelectArtist(artist);
                    }
                  }}
                  style={{
                    cursor: onSelectArtist ? 'pointer' : 'default',
                    color: onSelectArtist ? '#007bff' : '#888',
                    textDecoration: 'none'
                  }}
                  title={onSelectArtist ? `View ${selectedAlbum.parentTitle || selectedArtist?.title || 'artist'}'s albums` : ''}
                  onMouseEnter={(e) => {
                    if (onSelectArtist) e.target.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                  {selectedAlbum.parentTitle || selectedArtist?.title || 'Unknown Artist'}
                </span>
                {selectedAlbum.year && ` • ${selectedAlbum.year}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Player for all tracks */}
      {tracks && tracks.length > 0 && (
        <TracksPlaylistPlayer
          tracks={tracks}
          selectedSection={selectedSection}
          searchQuery={searchQuery}
          onPlayTrack={onPlayTrack}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          selectedAlbum={selectedAlbum}
          selectedArtist={selectedArtist}
        />
      )}

      <div className="tracks-list">
        {!Array.isArray(tracks) || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found{selectedAlbum ? ` for ${selectedAlbum.title}` : ''}.</p>
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
              <div key={track.ratingKey} className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}>
                <button 
                  className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                  onClick={() => onPlayTrack(track)}
                  title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                >
                  {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                </button>
                <span className="track-number">{formatTrackNumberLabel(track, index + 1)}</span>
                <div className="track-title">
                  <button 
                    className="track-title-link"
                    onClick={() => onSelectTrack && onSelectTrack(track)}
                  >
                    <strong>{track.title}</strong>
                  </button>
                  {track.originalTitle && track.originalTitle !== track.title && (
                    <span className="original-title">({track.originalTitle})</span>
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
                <span className="track-duration">
                  {formatDuration(track.duration)}
                </span>
                <span className="track-size">
                  {formatFileSize(track.media?.[0]?.parts?.[0]?.size)}
                </span>
                <div className="track-playlist">
                  <div className="playlist-dropdown">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onAddTrackToCustomPlaylist(parseInt(e.target.value), track);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">+ Add to...</option>
                      {playlists
                        .filter(p => p.type === 'custom')
                        .map(playlist => (
                          <option key={playlist.id} value={playlist.id}>
                            {playlist.title}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tracksHasMore && (
          <div className="pagination-section">
            <button 
              onClick={onLoadMoreTracks}
              className="load-more-button"
              disabled={tracksLoading}
            >
              {tracksLoading ? (
                <>
                  <LoadingState type="spinner" />
                  Loading...
                </>
              ) : (
                'Load More Tracks'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicTracksView;
