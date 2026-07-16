import React, { useEffect, useMemo, useState } from 'react';
import config from '../../../../config';
import './TvBrowser.css';

const statusLabel = {
  watched: 'Watched',
  'in-progress': 'In Progress',
  unwatched: 'Unwatched'
};

function TvBrowser() {
  const [data, setData] = useState({ shows: [], allCollections: [], totalShows: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

      const url = `${config.apiBaseUrl}/api/plex/tv-browser${queryString ? `?${queryString}` : ''}`;
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
        Showing {data.totalShows} series
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
    </main>
  );
}

export default TvBrowser;
