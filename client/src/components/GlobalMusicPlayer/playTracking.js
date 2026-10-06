export const createPlayRecorder = ({ apiBaseUrl, fetchImpl = fetch }) => {
  let playback = null;
  return {
    start: (track) => {
      playback = track?.ratingKey ? { ratingKey: track.ratingKey, request: null } : null;
    },
    complete: () => {
      const completed = playback;
      if (!completed) return Promise.resolve();
      if (!completed.request) {
        completed.request = Promise.resolve().then(async () => {
          const response = await fetchImpl(`${apiBaseUrl}/api/music/track/${encodeURIComponent(completed.ratingKey)}/scrobble`, { method: 'POST' });
          if (!response.ok) throw new Error('Failed to record music play');
        }).catch(error => {
          completed.request = null;
          throw error;
        });
      }
      return completed.request;
    }
  };
};

export const reportPlaybackState = async ({ apiBaseUrl, sessionId, track, isPlaying, fetchImpl = fetch }) => {
  const normalizedTrack = track ? {
    ...track,
    title: track.userTitle || track.title,
    artist: typeof track.artist === 'string' ? track.artist : track.grandparentTitle || track.album?.artist?.title || null,
    album: typeof track.album === 'string' ? track.album : track.album?.title || track.parentTitle || null,
    parentThumb: track.parentThumb || track.album?.thumb || null,
    grandparentThumb: track.grandparentThumb || track.album?.artist?.thumb || null
  } : null;
  const response = await fetchImpl(`${apiBaseUrl}/api/music/playback-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, track: normalizedTrack, isPlaying }),
    keepalive: true
  });
  if (!response.ok) throw new Error('Failed to report music playback state');
};