import React from 'react';

const MusicViewNavigation = ({
  activeView,
  selectedArtist,
  selectedAlbum,
  artistRatingKey,
  albumRatingKey,
  onNavigateToView,
  onLoadAlbumsView,
  onLoadTracksView
}) => {
  return (
    <div className="view-navigation">
      <button 
        onClick={() => onNavigateToView('artists')}
        className={`nav-button ${activeView === 'artists' ? 'active' : ''}`}
      >
        Artists
      </button>
      <button 
        onClick={() => onNavigateToView('collections')}
        className={`nav-button ${activeView === 'collections' ? 'active' : ''}`}
      >
        Collections
      </button>
      <button 
        onClick={() => onNavigateToView('playlists')}
        className={`nav-button ${activeView === 'playlists' ? 'active' : ''}`}
      >
        Playlists
      </button>
      <button 
        onClick={async () => {
          await onLoadAlbumsView();
          onNavigateToView('albums');
        }}
        className={`nav-button ${activeView === 'albums' ? 'active' : ''}`}
      >
        Albums
      </button>
      <button 
        onClick={async () => {
          await onLoadTracksView();
          onNavigateToView('tracks');
        }}
        className={`nav-button ${activeView === 'tracks' ? 'active' : ''}`}
      >
        Tracks
      </button>
      {selectedArtist && (
        <button 
          onClick={() => onNavigateToView('albums', { artist: selectedArtist.ratingKey })}
          className={`nav-button ${activeView === 'albums' && artistRatingKey ? 'active' : ''}`}
        >
          Albums ({selectedArtist.title})
        </button>
      )}
      {selectedAlbum && (
        <button 
          onClick={() => onNavigateToView('tracks', { 
            artist: selectedArtist?.ratingKey || artistRatingKey,
            album: selectedAlbum.ratingKey 
          })}
          className={`nav-button ${activeView === 'tracks' && albumRatingKey ? 'active' : ''}`}
        >
          Tracks ({selectedAlbum.title})
        </button>
      )}
    </div>
  );
};

export default MusicViewNavigation;
