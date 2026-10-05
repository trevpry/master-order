import config from '../config';

/**
 * Album artwork URL: artwork stored in the database (e.g. from Discogs) wins, falling back
 * to the Plex thumb for the front cover.
 */
export const getAlbumArtworkUrl = (album, type = 'front') => {
  const version = album?.artwork?.[type];
  if (version && album?.ratingKey) {
    return `${config.apiBaseUrl}/api/music/albums/${encodeURIComponent(album.ratingKey)}/artwork/${type}?v=${encodeURIComponent(version)}`;
  }

  if (type === 'front' && album?.thumb) {
    return `${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`;
  }

  return null;
};
