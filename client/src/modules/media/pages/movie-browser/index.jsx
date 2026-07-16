import React, { useEffect, useMemo, useState } from 'react';
import config from '../../../../config';
import './MovieBrowser.css';

const statusLabel = {
  watched: 'Watched',
  unwatched: 'Unwatched'
};

function MovieBrowser() {
  const [data, setData] = useState({
    movies: [],
    allCollections: [],
    totalMovies: 0,
    watchedMovies: 0,
    unwatchedMovies: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('');
  const [status, setStatus] = useState('all');
  const [viewMode, setViewMode] = useState('flat');
  const [expandedGroups, setExpandedGroups] = useState({});

  const groupedMovies = useMemo(() => {
    const groups = new Map();

    data.movies.forEach((movie) => {
      const targetCollections = movie.collections.length > 0 ? movie.collections : ['No Collection'];

      targetCollections.forEach((collectionName) => {
        if (!groups.has(collectionName)) {
          groups.set(collectionName, []);
        }

        groups.get(collectionName).push(movie);
      });
    });

    return Array.from(groups.entries())
      .map(([name, movies]) => {
        const watchedCount = movies.filter((movie) => movie.playStatus === 'watched').length;
        return {
          name,
          movies,
          watchedCount,
          unwatchedCount: movies.length - watchedCount
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.movies]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = {};

      groupedMovies.forEach((group) => {
        next[group.name] = prev[group.name] ?? true;
      });

      return next;
    });
  }, [groupedMovies]);

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

      const url = `${config.apiBaseUrl}/api/plex/movie-browser${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setData({
        movies: json.movies || [],
        allCollections: json.allCollections || [],
        totalMovies: json.totalMovies || 0,
        watchedMovies: json.watchedMovies || 0,
        unwatchedMovies: json.unwatchedMovies || 0
      });
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load movie browser data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrowserData();
  }, [queryString]);

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const setAllGroupsExpanded = (isExpanded) => {
    const next = {};
    groupedMovies.forEach((group) => {
      next[group.name] = isExpanded;
    });
    setExpandedGroups(next);
  };

  return (
    <main className="movie-browser-main">
      <div className="movie-browser-header">
        <h1>Movie Browser</h1>
        <p>Browse movies, collections, and play status from Plex sync data.</p>
      </div>

      <div className="movie-browser-filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search movies, year, or section"
          className="movie-filter-input"
        />

        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className="movie-filter-select"
        >
          <option value="">All Collections</option>
          {data.allCollections.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="movie-filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="unwatched">Unwatched</option>
          <option value="watched">Watched</option>
        </select>

        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          className="movie-filter-select"
        >
          <option value="flat">Flat Table</option>
          <option value="grouped">Grouped by Collection</option>
        </select>

        <button className="movie-refresh-button" onClick={fetchBrowserData}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="movie-browser-error">{error}</div>
      )}

      <div className="movie-browser-summary">
        Showing {data.totalMovies} movies · {data.watchedMovies} watched · {data.unwatchedMovies} unwatched
      </div>

      {viewMode === 'grouped' && !loading && groupedMovies.length > 0 && (
        <div className="movie-group-toolbar">
          <button
            className="movie-group-action"
            onClick={() => setAllGroupsExpanded(true)}
            type="button"
          >
            Expand all
          </button>
          <button
            className="movie-group-action"
            onClick={() => setAllGroupsExpanded(false)}
            type="button"
          >
            Collapse all
          </button>
        </div>
      )}

      {loading ? (
        <div className="movie-browser-loading">Loading movie browser...</div>
      ) : viewMode === 'flat' ? (
        <div className="movie-table-wrap">
          <table className="movie-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Year</th>
                <th>Release Date</th>
                <th>Collections</th>
                <th>Section</th>
                <th>Play Status</th>
              </tr>
            </thead>
            <tbody>
              {data.movies.map((movie) => (
                <tr key={movie.ratingKey}>
                  <td>{movie.title}</td>
                  <td>{movie.year || '-'}</td>
                  <td>{movie.originallyAvailableAt || '-'}</td>
                  <td>
                    <div className="movie-collection-list">
                      {movie.collections.length > 0 ? (
                        movie.collections.map((name) => (
                          <span key={`${movie.ratingKey}-${name}`} className="movie-collection-pill">{name}</span>
                        ))
                      ) : (
                        <span className="movie-collection-empty">No collections</span>
                      )}
                    </div>
                  </td>
                  <td>{movie.sectionTitle || '-'}</td>
                  <td>
                    <span className={`movie-status movie-status-${movie.playStatus}`}>
                      {statusLabel[movie.playStatus] || movie.playStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && data.movies.length === 0 && (
            <div className="movie-browser-empty">No movies match the current filters.</div>
          )}
        </div>
      ) : groupedMovies.length === 0 ? (
        <div className="movie-browser-empty">No movies match the current filters.</div>
      ) : (
        <div className="movie-group-list">
          {groupedMovies.map((group) => {
            const isExpanded = expandedGroups[group.name] ?? true;

            return (
              <section key={group.name} className="movie-group-card">
                <button
                  type="button"
                  className="movie-group-header"
                  onClick={() => toggleGroup(group.name)}
                >
                  <div>
                    <h2>{group.name}</h2>
                    <p>
                      {group.movies.length} movies · {group.watchedCount} watched · {group.unwatchedCount} unwatched
                    </p>
                  </div>
                  <span className="movie-group-chevron">{isExpanded ? '▾' : '▸'}</span>
                </button>

                {isExpanded && (
                  <div className="movie-table-wrap movie-group-table-wrap">
                    <table className="movie-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Release Date</th>
                          <th>Section</th>
                          <th>Play Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.movies.map((movie) => (
                          <tr key={`${group.name}-${movie.ratingKey}`}>
                            <td>{movie.title}</td>
                            <td>{movie.year || '-'}</td>
                            <td>{movie.originallyAvailableAt || '-'}</td>
                            <td>{movie.sectionTitle || '-'}</td>
                            <td>
                              <span className={`movie-status movie-status-${movie.playStatus}`}>
                                {statusLabel[movie.playStatus] || movie.playStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default MovieBrowser;
