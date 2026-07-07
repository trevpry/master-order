import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';
import StashVideoPlayer from './components/StashVideoPlayer';

const parseTagFilter = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((tagId) => tagId.trim())
    .filter(Boolean);
};

const formatTimestamp = (seconds) => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getFilenameWithoutExtension = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return '';

  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';
  return filename.replace(/\.[^.]+$/, '').trim();
};

export default function ClipsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clips, setClips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClipPlayLoading, setIsClipPlayLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [clipTags, setClipTags] = useState([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({ stashUrl: null });
  const [videoPlayer, setVideoPlayer] = useState({
    isOpen: false,
    clip: null,
    scene: null,
    playbackInfo: null
  });
  const [videoPlayerFullscreen, setVideoPlayerFullscreen] = useState(false);
  const [videoPlayerControlsVisible, setVideoPlayerControlsVisible] = useState(true);
  const [videoPlayerControlsTimeout, setVideoPlayerControlsTimeout] = useState(null);
  const [autoSkipRetries, setAutoSkipRetries] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 24
  });

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchFromParams = searchParams.get('search') || '';
  const watchedFilter = searchParams.get('watched') || 'all'; // all | played | unplayed
  const ratingFilter = searchParams.get('rating') || 'all'; // all | 1..5 | unrated
  const includeHigherRatings = searchParams.get('includeHigherRatings') === 'true';
  const tagFilter = parseTagFilter(searchParams.get('tags'));

  useEffect(() => {
    loadClipTags();
  }, []);

  useEffect(() => {
    setSearchQuery(searchFromParams);
  }, [searchFromParams]);

  useEffect(() => {
    loadClips();
  }, [currentPage, searchFromParams, watchedFilter, ratingFilter, includeHigherRatings, tagFilter.join(',')]);

  const appendCurrentClipFilters = (params) => {
    const search = searchFromParams;
    if (search) params.set('search', search);

    if (watchedFilter === 'played') {
      params.set('watched', 'true');
    } else if (watchedFilter === 'unplayed') {
      params.set('watched', 'false');
    }

    if (ratingFilter !== 'all') {
      params.set('rating', ratingFilter);
      if (includeHigherRatings && ratingFilter !== 'unrated') {
        params.set('includeHigherRatings', 'true');
      }
    }

    if (tagFilter.length > 0) {
      params.set('tags', tagFilter.join(','));
    }
  };

  const getCurrentClipFilterQuery = () => {
    const params = new URLSearchParams();
    appendCurrentClipFilters(params);
    return params.toString();
  };

  const getStashBaseUrlFromStream = (streamUrl) => {
    if (!streamUrl || typeof streamUrl !== 'string') return null;
    const marker = '/scene/';
    const markerIndex = streamUrl.indexOf(marker);
    if (markerIndex === -1) return null;
    return streamUrl.slice(0, markerIndex).replace(/\/+$/, '');
  };

  const buildUrlParams = ({
    page = currentPage,
    search = searchFromParams,
    watched = watchedFilter,
    rating = ratingFilter,
    includeHigher = includeHigherRatings,
    tags = tagFilter
  } = {}) => {
    const next = { page: String(page) };

    if (search && search.trim()) next.search = search.trim();
    if (watched && watched !== 'all') next.watched = watched;
    if (rating && rating !== 'all') next.rating = rating;
    if (includeHigher && rating && rating !== 'all' && rating !== 'unrated') {
      next.includeHigherRatings = 'true';
    }
    if (tags && tags.length > 0) next.tags = tags.join(',');

    return next;
  };

  const loadClipTags = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/tags`);
      const result = await response.json();
      if (result.success) {
        setClipTags(result.data || []);
      }
    } catch (err) {
      console.error('Error loading clip tags:', err);
    }
  };

  const loadClips = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', pagination.perPage);
      params.set('sortBy', 'createdAt');
      params.set('sortDirection', 'desc');
      appendCurrentClipFilters(params);

      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to load clips');
      }

      const paginationData = result.pagination || {};
      setClips(result.data || []);
      setPagination({
        page: paginationData.page || currentPage,
        total: paginationData.total || 0,
        totalPages: paginationData.totalPages || 1,
        hasMore: (paginationData.page || currentPage) < (paginationData.totalPages || 1),
        perPage: paginationData.perPage || pagination.perPage
      });
    } catch (err) {
      console.error('Error loading clips:', err);
      setError(err.message || 'Failed to load clips');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClipPlay = async () => {
    try {
      setIsClipPlayLoading(true);
      setError(null);

      const params = new URLSearchParams();
      appendCurrentClipFilters(params);

      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result?.playbackInfo?.streamUrl) {
        throw new Error(result?.error || 'Failed to start Clip Play');
      }

      const streamUrl = result.playbackInfo.streamUrl;
      const stashBaseUrl = getStashBaseUrlFromStream(streamUrl);
      if (stashBaseUrl) {
        setConnectionStatus({ stashUrl: stashBaseUrl });
      }

      setVideoPlayer({
        isOpen: true,
        clip: result.clip,
        scene: {
          ...result.clip.scene,
          streamUrl
        },
        playbackInfo: {
          ...result.playbackInfo,
          autoplay: true
        }
      });
    } catch (err) {
      console.error('Error starting Clip Play:', err);
      setError(err.message || 'Failed to start Clip Play');
    } finally {
      setIsClipPlayLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(buildUrlParams({
      page: 1,
      search: searchQuery
    }));
  };

  const goToPage = (page) => {
    setSearchParams(buildUrlParams({ page }));
  };

  const handleWatchFilterChange = (e) => {
    const watched = e.target.value;
    setSearchParams(buildUrlParams({ page: 1, watched }));
  };

  const handleRatingFilterChange = (e) => {
    const rating = e.target.value;
    const shouldKeepIncludeHigher = includeHigherRatings && rating !== 'all' && rating !== 'unrated';
    setSearchParams(buildUrlParams({
      page: 1,
      rating,
      includeHigher: shouldKeepIncludeHigher
    }));
  };

  const handleIncludeHigherRatingsChange = (e) => {
    const includeHigher = e.target.checked;
    setSearchParams(buildUrlParams({
      page: 1,
      includeHigher
    }));
  };

  const addTagFilter = (tagId) => {
    if (!tagFilter.includes(tagId)) {
      setSearchParams(buildUrlParams({
        page: 1,
        tags: [...tagFilter, tagId]
      }));
    }
  };

  const removeTagFilter = (tagId) => {
    setSearchParams(buildUrlParams({
      page: 1,
      tags: tagFilter.filter((id) => id !== tagId)
    }));
  };

  const clearTagFilter = () => {
    setSearchParams(buildUrlParams({ page: 1, tags: [] }));
  };

  return (
    <div className="page pad clips-page">
      <StashVideoPlayer
        videoPlayer={videoPlayer}
        setVideoPlayer={setVideoPlayer}
        videoPlayerFullscreen={videoPlayerFullscreen}
        setVideoPlayerFullscreen={setVideoPlayerFullscreen}
        videoPlayerControlsVisible={videoPlayerControlsVisible}
        setVideoPlayerControlsVisible={setVideoPlayerControlsVisible}
        videoPlayerControlsTimeout={videoPlayerControlsTimeout}
        setVideoPlayerControlsTimeout={setVideoPlayerControlsTimeout}
        autoSkipRetries={autoSkipRetries}
        setAutoSkipRetries={setAutoSkipRetries}
        connectionStatus={connectionStatus}
        mixedMode={false}
        MAX_AUTO_SKIP_RETRIES={10}
        clipsNextQueryString={getCurrentClipFilterQuery()}
      />

      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🎞️ Clips</h1>
        <p className="muted">Browse your clip library</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="search-section">
        <input
          type="text"
          placeholder="Search clips..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <Button type="submit">Search</Button>
        <Button
          type="button"
          onClick={handleClipPlay}
          disabled={isClipPlayLoading || isLoading || clips.length === 0}
          className="clip-play-button"
        >
          {isClipPlayLoading ? '🎬 Loading...' : '🎬 Clip Play'}
        </Button>
        <select
          value={watchedFilter}
          onChange={handleWatchFilterChange}
          className="clip-filter-select"
        >
          <option value="all">All clips</option>
          <option value="played">Played</option>
          <option value="unplayed">Unplayed</option>
        </select>
        <select
          value={ratingFilter}
          onChange={handleRatingFilterChange}
          className="clip-filter-select"
        >
          <option value="all">All ratings</option>
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★☆ (4)</option>
          <option value="3">★★★☆☆ (3)</option>
          <option value="2">★★☆☆☆ (2)</option>
          <option value="1">★☆☆☆☆ (1)</option>
          <option value="unrated">Unrated</option>
        </select>
        <label className="clip-filter-checkbox-label">
          <input
            type="checkbox"
            className="clip-filter-checkbox"
            checked={includeHigherRatings}
            onChange={handleIncludeHigherRatingsChange}
            disabled={ratingFilter === 'all' || ratingFilter === 'unrated'}
          />
          Include higher ratings
        </label>
        {searchQuery && (
          <Button type="button" onClick={() => {
            setSearchQuery('');
            setSearchParams(buildUrlParams({ page: 1, search: '' }));
          }}>
            Clear
          </Button>
        )}
      </form>

      {/* Tag Filter */}
      <div className="tag-filter-section">
        <div className="tag-filter-header">
          <button
            type="button"
            className="tag-filter-toggle-btn"
            onClick={() => setIsTagFilterOpen((prev) => !prev)}
            aria-expanded={isTagFilterOpen}
          >
            🏷️ Filter by Tags {isTagFilterOpen ? '▾' : '▸'}
          </button>
          {tagFilter.length > 0 && (
            <button 
              type="button"
              className="clear-tag-filter-btn"
              onClick={clearTagFilter}
            >
              Clear all ({tagFilter.length})
            </button>
          )}
        </div>
        {isTagFilterOpen && (
          <div className="tag-filter-list">
            {clipTags.length === 0 ? (
              <p className="tag-filter-empty">No clip tags available yet.</p>
            ) : (
              clipTags.map(tag => (
                <button
                  key={tag.id}
                  className={`tag-filter-item ${tagFilter.includes(tag.id) ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    if (tagFilter.includes(tag.id)) {
                      removeTagFilter(tag.id);
                    } else {
                      addTagFilter(tag.id);
                    }
                  }}
                >
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={loadClips}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading clips...</p>
        </div>
      )}

      {/* Clips Grid */}
      {!isLoading && !error && (
        <>
          <div className="clips-grid">
            {clips.length === 0 ? (
              <div className="empty-state">
                <p>No clips found</p>
              </div>
            ) : (
              clips.map((clip) => {
                const sceneTitle = (clip.scene?.title || clip.sceneTitle || '').trim();
                const sceneFilenameTitle = getFilenameWithoutExtension(clip.scene?.path);
                const performerNames = (clip.scene?.performers || [])
                  .map((entry) => entry?.performer?.name)
                  .filter(Boolean);
                const clipTitle = sceneTitle || sceneFilenameTitle || clip.name || 'Untitled Clip';

                return (
                  <Link 
                    key={clip.id} 
                    to={`/media/stash/clips/${clip.id}`}
                    className="clip-card"
                  >
                    <div className="clip-card-body">
                      <div className="title">{clipTitle}</div>
                      {clip.tags && clip.tags.length > 0 && (
                        <div className="clip-tags">
                          {clip.tags.map(tag => (
                            <span key={tag.id} className="clip-tag-badge">{tag.name}</span>
                          ))}
                        </div>
                      )}
                      <div className="clip-meta">
                        <span>⏱️ {formatTimestamp(clip.startTime)} - {formatTimestamp(clip.endTime)}</span>
                        {performerNames.length > 0 && (
                          <span>👥 {performerNames.join(', ')}</span>
                        )}
                        <span>{clip.watched ? '✅ Played' : '🕒 Unplayed'}</span>
                        <span>{clip.rating ? `⭐ ${clip.rating}/5` : '☆ Unrated'}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <Button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </Button>
              <span className="page-info">
                Page {currentPage} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <Button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
