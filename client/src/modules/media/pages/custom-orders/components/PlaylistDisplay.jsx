import React from 'react';

const PlaylistDisplay = ({ order }) => {
  if (!order.plexPlaylist && !order.customPlaylist) {
    return null;
  }

  const playlistTitle = order.plexPlaylist 
    ? `${order.plexPlaylist.title} (Plex)`
    : `${order.customPlaylist.title} (Custom)`;

  return (
    <div className="order-playlist">
      🎵 Playlist: {playlistTitle}
    </div>
  );
};

export default PlaylistDisplay;
