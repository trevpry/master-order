import React, { useEffect, useMemo, useState } from 'react';
import config from '../../../../config';
import StashVideoPlayer from '../stash/components/StashVideoPlayer';
import './TvBrowser.css';

const statusLabel = {
  watched: 'Watched',
  'in-progress': 'In Progress',
  unwatched: 'Unwatched'
};

function TvBrowser() {
  const [libraryProvider, setLibraryProvider] = useState('plex');
  const [data, setData] = useState({ shows: [], allCollections: [], totalShows: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [browserVideoPlayer, setBrowserVideoPlayer] = useState(null);
  const [activePlaybackItem, setActivePlaybackItem] = useState(null);
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('');
  const [status, setStatus] = useState('all');
  const [expandedShows, setExpandedShows] = useState({});
  const [expandedSeasons, setExpandedSeasons] = useState({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (collection) params.set('collection', collection);
    if (status) params.set('status', status);
    return params.toString();
  }, [search, collection, status]);

  const fetchBrowserData = async () => {
    try {
      setLoading(true);
      setError('');

      const settingsResponse = await fetch(`${config.apiBaseUrl}/api/settings`);
      const settings = settingsResponse.ok ? await settingsResponse.json() : {};
      const provider = settings?.libraryProvider === 'arr' ? 'arr' : 'plex';
      setLibraryProvider(provider);

      const url = provider === 'arr'
        ? `${config.apiBaseUrl}/api/library/tv${queryString ? `?${queryString}` : ''}`
        : `${config.apiBaseUrl}/api/plex/tv-browser${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setData({
        shows: json.shows || [],
        allCollections: json.allCollections || [],
        totalShows: json.totalShows || 0
      });
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load TV browser data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrowserData();
  }, [queryString]);

  const getArtworkUrl = (item) => {
    if (item?.posterUrl) {
      return item.posterUrl;
    }

    if (item?.localArtworkPath) {
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/')
        ? item.localArtworkPath.split(/[\\/]/).pop()
        : item.localArtworkPath;
      return `${config.apiBaseUrl}/api/artwork/${filename}`;
    }

    return null;
  };

  const reportBrowserPlaybackProgress = async ({ currentTime, duration }) => {
    if (!activePlaybackItem || activePlaybackItem.libraryProvider !== 'arr' || !activePlaybackItem.mediaId) {
      return;
    }

    await fetch(`${config.apiBaseUrl}/api/watch-progress/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'episode',
        id: activePlaybackItem.mediaId,
        positionSeconds: Math.floor(currentTime),
        durationSeconds: Number.isFinite(duration) ? Math.floor(duration) : undefined,
      }),
    });
  };

  const handleBrowserPlaybackComplete = async (completedVideo) => {
    const item = activePlaybackItem || completedVideo;
    setActivePlaybackItem(null);

    if (!item || item.libraryProvider !== 'arr' || !item.mediaId) {
      return;
    }

    try {
      await fetch(`${config.apiBaseUrl}/api/watch-progress/episode/${item.mediaId}/complete`, {
        method: 'POST',
      });

      await fetch(`${config.apiBaseUrl}/api/mark-media-watched`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: 'episode',
          mediaId: item.mediaId,
          ratingKey: item.ratingKey,
          episodeRatingKey: item.ratingKey,
          libraryProvider: 'arr',
        }),
      });
    } catch (playbackError) {
      console.error('Failed to complete episode playback state:', playbackError);
    } finally {
      fetchBrowserData();
    }
  };

  const openBrowserPlayer = async (show, season, episode) => {
    if (!episode?.streamUrl || episode.libraryProvider !== 'arr' || !episode.mediaId) {
      return;
    }

    setPlaying(true);
    setError('');

    try {
      const [infoResponse, progressResponse] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/stream/episode/${episode.mediaId}/info`),
        fetch(`${config.apiBaseUrl}/api/watch-progress/episode/${episode.mediaId}`),
      ]);

      let preferredMode = 'direct';
      let startPositionSeconds = 0;

      if (infoResponse.ok) {
        const info = await infoResponse.json();
        preferredMode = info.recommendedMode === 'direct' ? 'direct' : 'hls';
      }

      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        startPositionSeconds = progress.positionSeconds || 0;
      }

      const playbackItem = {
        mediaId: episode.mediaId,
        libraryProvider: episode.libraryProvider,
        ratingKey: episode.ratingKey,
      };
      setActivePlaybackItem(playbackItem);
      setBrowserVideoPlayer({
        isOpen: true,
        title: episode.title || `${show.title} S${season.seasonNumber}E${episode.episodeNumber}`,
        subtitle: `${show.title} • S${season.seasonNumber}E${episode.episodeNumber}`,
        posterUrl: getArtworkUrl(show),
        directUrl: episode.streamUrl,
        hlsUrl: `${config.apiBaseUrl}/api/stream/episode/${episode.mediaId}/hls/master.m3u8`,
        preferredMode,
        startPositionSeconds,
        autoplay: true,
        ...playbackItem,
      });
    } catch (playError) {
      console.error('Failed to open browser playback for episode:', playError);
      setError('Failed to open browser playback');
    } finally {
      setPlaying(false);
    }
  };

  const toggleShow = (ratingKey) => {
    setExpandedShows((prev) => ({ ...prev, [ratingKey]: !prev[ratingKey] }));
  };

  const toggleSeason = (showRatingKey, seasonRatingKey) => {
    const key = `${showRatingKey}:${seasonRatingKey}`;
    setExpandedSeasons((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="tv-browser-main">
      <div className="tv-browser-header">
        <h1>TV Series Browser</h1>
        <p>Browse series, seasons, episodes, collections, and play status from Plex sync data.</p>
      </div>

      <div className="tv-browser-filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search series, season, or episode"
          className="tv-filter-input"
        />

        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className="tv-filter-select"
        >
          <option value="">All Collections</option>
          {data.allCollections.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="tv-filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="unwatched">Unwatched</option>
          <option value="in-progress">In Progress</option>
          <option value="watched">Watched</option>
        </select>

        <button className="tv-refresh-button" onClick={fetchBrowserData}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="tv-browser-error">{error}</div>
      )}

      <div className="tv-browser-summary">
        Showing {data.totalShows} series · Source: {libraryProvider.toUpperCase()}
      </div>

      {loading ? (
        <div className="tv-browser-loading">Loading TV browser...</div>
      ) : (
        <div className="tv-series-list">
          {data.shows.map((show) => {
            const showExpanded = Boolean(expandedShows[show.ratingKey]);
            return (
              <div key={show.ratingKey} className="tv-show-card">
                <button className="tv-show-header" onClick={() => toggleShow(show.ratingKey)}>
                  <div className="tv-show-title-wrap">
                    <span className="tv-expander">{showExpanded ? '-' : '+'}</span>
                    <h3 className="tv-show-title">{show.title}{show.year ? ` (${show.year})` : ''}</h3>
                  </div>
                  <div className="tv-show-meta">
                    <span className={`tv-status tv-status-${show.playStatus}`}>{statusLabel[show.playStatus] || show.playStatus}</span>
                    <span>{show.viewedLeafCount}/{show.leafCount} watched</span>
                  </div>
                </button>

                <div className="tv-show-collections">
                  {show.collections.length > 0 ? (
                    show.collections.map((name) => (
                      <span key={`${show.ratingKey}-${name}`} className="tv-collection-pill">{name}</span>
                    ))
                  ) : (
                    <span className="tv-collection-empty">No collections</span>
                  )}
                </div>

                {showExpanded && (
                  <div className="tv-season-list">
                    {show.seasons.map((season) => {
                      const seasonKey = `${show.ratingKey}:${season.ratingKey}`;
                      const seasonExpanded = Boolean(expandedSeasons[seasonKey]);
                      return (
                        <div key={season.ratingKey} className="tv-season-card">
                          <button
                            className="tv-season-header"
                            onClick={() => toggleSeason(show.ratingKey, season.ratingKey)}
                          >
                            <div>
                              <span className="tv-expander">{seasonExpanded ? '-' : '+'}</span>
                              <span className="tv-season-title">{season.title || `Season ${season.seasonNumber}`}</span>
                            </div>
                            <div className="tv-show-meta">
                              <span className={`tv-status tv-status-${season.playStatus}`}>{statusLabel[season.playStatus] || season.playStatus}</span>
                              <span>{season.watchedEpisodeCount}/{season.totalEpisodeCount} watched</span>
                            </div>
                          </button>

                          {seasonExpanded && (
                            <div className="tv-episode-table-wrap">
                              <table className="tv-episode-table">
                                <thead>
                                  <tr>
                                    <th>Episode</th>
                                    <th>Title</th>
                                    <th>Air Date</th>
                                    <th>Play Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {season.episodes.map((episode) => (
                                    <tr key={episode.ratingKey}>
                                      <td>S{season.seasonNumber}E{episode.episodeNumber}</td>
                                      <td>{episode.title}</td>
                                      <td>{episode.originallyAvailableAt || '-'}</td>
                                      <td>
                                        <span className={`tv-status tv-status-${episode.playStatus}`}>
                                          {statusLabel[episode.playStatus] || episode.playStatus}
                                        </span>
                                      </td>
                                      <td>
                                        {episode.streamUrl && episode.libraryProvider === 'arr' ? (
                                          <button
                                            type="button"
                                            className="tv-play-button"
                                            onClick={() => openBrowserPlayer(show, season, episode)}
                                            disabled={playing}
                                          >
                                            {playing ? 'Opening...' : 'Play'}
                                          </button>
                                        ) : (
                                          <span className="tv-action-empty">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && data.shows.length === 0 && (
            <div className="tv-browser-empty">No series match the current filters.</div>
          )}
        </div>
      )}

      <StashVideoPlayer
        genericVideo={browserVideoPlayer}
        setGenericVideo={setBrowserVideoPlayer}
        onGenericProgress={reportBrowserPlaybackProgress}
        onGenericComplete={handleBrowserPlaybackComplete}
      />
    </main>
  );
}

export default TvBrowser;
