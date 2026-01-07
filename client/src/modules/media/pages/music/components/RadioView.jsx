import React, { useState } from 'react';
import config from '../../../../../config';

const RadioView = ({ selectedSection }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unplayedOnly, setUnplayedOnly] = useState(false);
  const [unplayedAlbumsOnly, setUnplayedAlbumsOnly] = useState(false);
  const [unplayedArtistsOnly, setUnplayedArtistsOnly] = useState(false);
  const [unplayedWorksOnly, setUnplayedWorksOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [minRatingPercent, setMinRatingPercent] = useState(0);
  const [playCompleteWork, setPlayCompleteWork] = useState(false);

  const playRadio = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build the API endpoint
      let endpoint = `${config.apiBaseUrl}/api/music/tracks/random?limit=100`;
      
      // Add section filter if not "all"
      if (selectedSection && selectedSection !== 'all') {
        endpoint = `${config.apiBaseUrl}/api/music/tracks/random/section/${selectedSection}?limit=100`;
      }

      // Add unplayed filter if enabled
      if (unplayedOnly) {
        endpoint += '&unplayed=true';
      }

      // Add unplayed albums filter if enabled
      if (unplayedAlbumsOnly) {
        endpoint += '&unplayedAlbums=true';
      }

      // Add unplayed artists filter if enabled
      if (unplayedArtistsOnly) {
        endpoint += '&unplayedArtists=true';
      }

      // Add unplayed works filter if enabled
      if (unplayedWorksOnly) {
        endpoint += '&unplayedWorks=true';
      }

      // Add rating filter if selected
      if (minRating > 0) {
        endpoint += `&minRating=${minRating}`;
      }

      // Add rating percentage if selected
      if (minRatingPercent > 0 && minRating > 0) {
        endpoint += `&minRatingPercent=${minRatingPercent}`;
      }

      // Add play complete work flag
      if (playCompleteWork) {
        endpoint += '&playCompleteWork=true';
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch random tracks');
      }

      const data = await response.json();
      
      if (data.tracks && data.tracks.length > 0) {
        console.log(`🎲 Radio: Loaded ${data.tracks.length} tracks`);
        
        // Create playlist data for GlobalMusicPlayer (same format as TracksPlaylistPlayer)
        const playlistData = {
          id: `radio-playlist-${Date.now()}`,
          title: `Radio - ${selectedSection === 'all' ? 'All Music' : 'Section'}`,
          tracks: data.tracks.map(track => {
            const albumThumb = track.album?.thumb || track.parentThumb;
            const artistThumb = track.album?.artist?.thumb || track.grandparentThumb;
            const artistTitle = track.album?.artist?.title || track.grandparentTitle || 'Unknown Artist';
            const albumTitle = track.album?.title || track.parentTitle || 'Unknown Album';
            
            return {
              id: track.ratingKey,
              ratingKey: track.ratingKey,
              title: track.title,
              artist: artistTitle,
              album: albumTitle,
              duration: track.duration,
              thumb: track.thumb,
              art: track.art,
              parentThumb: albumThumb,
              grandparentThumb: artistThumb,
              userRating: track.userRating,
              rating: track.rating,
              type: 'plex',
              grandparentRatingKey: track.grandparentRatingKey || track.album?.artist?.ratingKey,
              parentRatingKey: track.parentRatingKey || track.album?.ratingKey,
              grandparentTitle: artistTitle,
              parentTitle: albumTitle
            };
          })
        };

        // Dispatch event to trigger GlobalMusicPlayer
        const event = new CustomEvent('startMusicPlayback', {
          detail: {
            playlist: playlistData,
            shuffle: !playCompleteWork, // Don't shuffle if playing complete works (backend already randomized and ordered them)
            autoplay: true, // Start playing immediately
            sessionId: `radio-session-${Date.now()}`
          }
        });
        
        window.dispatchEvent(event);
        console.log(`🎲 Radio: Dispatched startMusicPlayback event for GlobalMusicPlayer (shuffle: ${!playCompleteWork})`);
      } else {
        setError('No tracks available for radio play');
      }
    } catch (err) {
      console.error('Error playing radio:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="radio-view">
      <div className="radio-content">
        <div className="radio-header">
          <h2>🎲 Music Radio</h2>
          <p className="radio-description">
            Play 100 random tracks from {selectedSection === 'all' ? 'your entire library' : 'the selected section'}
          </p>
        </div>

        <div className="radio-filters">
          <label className="radio-filter-checkbox">
            <input
              type="checkbox"
              checked={unplayedOnly}
              onChange={(e) => setUnplayedOnly(e.target.checked)}
            />
            <span>Unplayed Tracks Only</span>
          </label>

          <label className="radio-filter-checkbox">
            <input
              type="checkbox"
              checked={unplayedAlbumsOnly}
              onChange={(e) => setUnplayedAlbumsOnly(e.target.checked)}
            />
            <span>Unplayed Albums Only</span>
          </label>

          <label className="radio-filter-checkbox">
            <input
              type="checkbox"
              checked={unplayedArtistsOnly}
              onChange={(e) => setUnplayedArtistsOnly(e.target.checked)}
            />
            <span>Unplayed Artists Only</span>
          </label>

          <label className="radio-filter-checkbox">
            <input
              type="checkbox"
              checked={unplayedWorksOnly}
              onChange={(e) => setUnplayedWorksOnly(e.target.checked)}
            />
            <span>Unplayed Works Only</span>
          </label>

          <label className="radio-filter-checkbox">
            <input
              type="checkbox"
              checked={playCompleteWork}
              onChange={(e) => setPlayCompleteWork(e.target.checked)}
            />
            <span>Play Complete Work</span>
          </label>
          {playCompleteWork && (
            <small className="percent-help-text" style={{ marginLeft: '1.5rem', marginTop: '-0.5rem' }}>
              Multi-movement works will be played in full from their album
            </small>
          )}

          <div className="radio-filter-rating">
            <label htmlFor="min-rating">Minimum Rating:</label>
            <select
              id="min-rating"
              value={minRating}
              onChange={(e) => setMinRating(parseInt(e.target.value))}
            >
              <option value="0">Any Rating</option>
              <option value="1">⭐ 1+ Stars</option>
              <option value="2">⭐⭐ 2+ Stars</option>
              <option value="3">⭐⭐⭐ 3+ Stars</option>
              <option value="4">⭐⭐⭐⭐ 4+ Stars</option>
              <option value="5">⭐⭐⭐⭐⭐ 5+ Stars</option>
              <option value="6">⭐⭐⭐⭐⭐⭐ 6+ Stars</option>
              <option value="7">⭐⭐⭐⭐⭐⭐⭐ 7+ Stars</option>
              <option value="8">⭐⭐⭐⭐⭐⭐⭐⭐ 8+ Stars</option>
              <option value="9">⭐⭐⭐⭐⭐⭐⭐⭐⭐ 9+ Stars</option>
              <option value="10">⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐ 10 Stars</option>
            </select>
          </div>

          {minRating > 0 && (
            <div className="radio-filter-percent">
              <label htmlFor="min-rating-percent">
                Rated Tracks Percentage: {minRatingPercent}%
              </label>
              <input
                id="min-rating-percent"
                type="range"
                min="0"
                max="100"
                step="5"
                value={minRatingPercent}
                onChange={(e) => setMinRatingPercent(parseInt(e.target.value))}
              />
              {minRatingPercent > 0 && (
                <small className="percent-help-text">
                  {minRatingPercent}% rated {minRating}+ stars, {100 - minRatingPercent}% {
                    unplayedOnly ? 'unplayed tracks' : 
                    unplayedAlbumsOnly ? 'unplayed albums' :
                    unplayedArtistsOnly ? 'unplayed artists' :
                    unplayedWorksOnly ? 'unplayed works' :
                    'any tracks'
                  }
                </small>
              )}
            </div>
          )}
        </div>

        <div className="radio-actions">
          <button 
            className="play-radio-button"
            onClick={playRadio}
            disabled={loading}
          >
            {loading ? 'Loading...' : '▶ Play Radio'}
          </button>
        </div>

        {error && (
          <div className="radio-error">
            <p>⚠️ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RadioView;
