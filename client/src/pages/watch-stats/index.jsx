import React, { useState, useEffect } from 'react';
import './WatchStats.css';
import config from '../../config';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const WatchStats = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [groupBy, setGroupBy] = useState('day');
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('bar'); // 'bar' or 'line'
  
  // Global filter states
  const [selectedMediaTypes, setSelectedMediaTypes] = useState(['tv', 'movie', 'book', 'comic', 'shortstory']);
  const [globalPeriod, setGlobalPeriod] = useState('week');
  const [globalGroupBy, setGlobalGroupBy] = useState('day');
  const [chartPeriod, setChartPeriod] = useState('week'); // Independent chart period
  const [chartStats, setChartStats] = useState(null); // Separate stats for chart
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'custom-orders', 'tv', 'movies', 'books', 'comics', 'shortstories'
  const [customOrderStats, setCustomOrderStats] = useState(null);
  
  // Individual media type stats
  const [tvStats, setTvStats] = useState(null);
  const [movieStats, setMovieStats] = useState(null);
  const [bookStats, setBookStats] = useState(null);
  const [comicStats, setComicStats] = useState(null);
  const [shortStoryStats, setShortStoryStats] = useState(null);
  
  // Actor breakdown sorting state
  const [actorSortBy, setActorSortBy] = useState('playtime'); // 'playtime', 'episodes', 'series'
  const [movieActorSortBy, setMovieActorSortBy] = useState('playtime'); // 'playtime', 'episodes', 'series' (reused names for consistency)
  const [authorSortBy, setAuthorSortBy] = useState('readtime'); // 'readtime', 'pages', 'books'

  // Fetch watch statistics
  const fetchStats = async (selectedPeriod = globalPeriod, selectedGroupBy = globalGroupBy) => {
    try {
      setLoading(true);
      setError(null);

      // Determine appropriate groupBy based on the period for chart data
      let chartGroupBy = 'day';
      switch (selectedPeriod) {
        case 'today':
        case 'week':
        case 'month':
          chartGroupBy = 'day';
          break;
        case 'year':
          chartGroupBy = 'month';
          break;
        case 'all':
          chartGroupBy = 'year';
          break;
      }

      const response = await fetch(`${config.apiBaseUrl}/api/watch-stats?period=${selectedPeriod}&groupBy=${chartGroupBy}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle global period change
  const handleGlobalPeriodChange = (newPeriod) => {
    setGlobalPeriod(newPeriod);
    setPeriod(newPeriod); // Keep local state in sync for compatibility
    fetchStats(newPeriod, globalGroupBy);
    fetchAllMediaTypeStats(newPeriod); // Fetch media type stats with new period
  };

  // Handle global group by change
  const handleGlobalGroupByChange = (newGroupBy) => {
    setGlobalGroupBy(newGroupBy);
    setGroupBy(newGroupBy); // Keep local state in sync for compatibility
    fetchStats(globalPeriod, newGroupBy);
  };

  // Handle media type selection
  const handleMediaTypeToggle = (mediaType) => {
    setSelectedMediaTypes(prev => {
      if (prev.includes(mediaType)) {
        return prev.filter(type => type !== mediaType);
      } else {
        return [...prev, mediaType];
      }
    });
  };

  // Toggle all media types
  const handleSelectAllMediaTypes = () => {
    const allTypes = ['tv', 'movie', 'book', 'comic', 'shortstory'];
    if (selectedMediaTypes.length === allTypes.length) {
      setSelectedMediaTypes([]);
    } else {
      setSelectedMediaTypes(allTypes);
    }
  };

  // Fetch chart-specific statistics
  const fetchChartStats = async (selectedPeriod = chartPeriod) => {
    try {
      // Determine appropriate groupBy for chart period
      let chartGroupBy = 'day';
      switch (selectedPeriod) {
        case 'today':
          chartGroupBy = 'day';
          break;
        case 'week':
          chartGroupBy = 'day';
          break;
        case 'month':
          chartGroupBy = 'day';
          break;
        case 'year':
          chartGroupBy = 'month';
          break;
        case 'all':
          chartGroupBy = 'year';
          break;
      }

      const response = await fetch(`${config.apiBaseUrl}/api/watch-stats?period=${selectedPeriod}&groupBy=${chartGroupBy}`);
      if (!response.ok) throw new Error('Failed to fetch chart stats');
      const data = await response.json();
      setChartStats(data);
    } catch (err) {
      console.error('Error fetching chart stats:', err);
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/watch-stats/recent?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch recent activity');
      const data = await response.json();
      setRecentActivity(data);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  // Fetch today's stats
  const fetchTodayStats = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/watch-stats/today`);
      if (!response.ok) throw new Error('Failed to fetch today stats');
      const data = await response.json();
      setTodayStats(data);
    } catch (err) {
      console.error('Error fetching today stats:', err);
    }
  };

  // Fetch custom order statistics
  const fetchCustomOrderStats = async (period = 'all') => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/watch-stats/custom-orders?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch custom order stats');
      const data = await response.json();
      setCustomOrderStats(data);
    } catch (err) {
      console.error('Error fetching custom order stats:', err);
    }
  };

  // Fetch individual media type statistics
  const fetchMediaTypeStats = async (mediaType, period = 'all') => {
    try {
      let url = `${config.apiBaseUrl}/api/watch-stats/media-type/${mediaType}?period=${period}&groupBy=day`;
      
      // Add actor sort parameters for TV and movies
      if (mediaType === 'tv' && actorSortBy) {
        url += `&actorSortBy=${actorSortBy}`;
      }
      if (mediaType === 'movie' && movieActorSortBy) {
        url += `&movieActorSortBy=${movieActorSortBy}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${mediaType} stats`);
      const data = await response.json();
      
      switch (mediaType) {
        case 'tv':
          setTvStats(data);
          break;
        case 'movie':
          setMovieStats(data);
          break;
        case 'book':
          setBookStats(data);
          break;
        case 'comic':
          setComicStats(data);
          break;
        case 'shortstory':
          setShortStoryStats(data);
          break;
      }
    } catch (err) {
      console.error(`Error fetching ${mediaType} stats:`, err);
    }
  };

  // Fetch all media type stats
  const fetchAllMediaTypeStats = async (period = 'all') => {
    await Promise.all([
      fetchMediaTypeStats('tv', period),
      fetchMediaTypeStats('movie', period),
      fetchMediaTypeStats('book', period),
      fetchMediaTypeStats('comic', period),
      fetchMediaTypeStats('shortstory', period)
    ]);
  };

  useEffect(() => {
    fetchStats();
    fetchChartStats();
    fetchRecentActivity();
    fetchTodayStats();
    fetchCustomOrderStats();
    fetchAllMediaTypeStats(globalPeriod);
  }, []);

  // Re-fetch TV stats when actor sort changes
  useEffect(() => {
    if (actorSortBy) {
      fetchMediaTypeStats('tv', globalPeriod);
    }
  }, [actorSortBy]);

  // Re-fetch movie stats when movie actor sort changes
  useEffect(() => {
    if (movieActorSortBy) {
      fetchMediaTypeStats('movie', globalPeriod);
    }
  }, [movieActorSortBy]);

  const handlePeriodChange = (newPeriod) => {
    handleGlobalPeriodChange(newPeriod);
  };

  const handleGroupByChange = (newGroupBy) => {
    handleGlobalGroupByChange(newGroupBy);
  };

  const handleChartPeriodChange = (newChartPeriod) => {
    setChartPeriod(newChartPeriod);
    fetchChartStats(newChartPeriod);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (groupBy === 'day') {
      return date.toLocaleDateString();
    } else if (groupBy === 'week') {
      return `Week of ${date.toLocaleDateString()}`;
    } else if (groupBy === 'month') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else if (groupBy === 'year') {
      return date.getFullYear().toString();
    }
    return dateString;
  };

  if (loading && !stats) {
    return (
      <div className="watch-stats-container">
        <div className="loading">Loading watch statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="watch-stats-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  // Prepare chart data for activity comparison
  const getBarChartData = () => {
    const filteredStats = getFilteredStats();
    if (!filteredStats || !filteredStats.totalStats) return null;

    // Filter labels and data based on selected media types
    const mediaTypeMapping = [
      { type: 'tv', label: 'TV Shows', value: filteredStats.totalStats.totalTvWatchTime || 0, bgColor: '#3b82f6', borderColor: '#2563eb' },
      { type: 'movie', label: 'Movies', value: filteredStats.totalStats.totalMovieWatchTime || 0, bgColor: '#ef4444', borderColor: '#dc2626' },
      { type: 'book', label: 'Books', value: filteredStats.totalStats.totalBookReadTime || 0, bgColor: '#10b981', borderColor: '#059669' },
      { type: 'comic', label: 'Comics', value: filteredStats.totalStats.totalComicReadTime || 0, bgColor: '#f59e0b', borderColor: '#d97706' },
      { type: 'shortstory', label: 'Short Stories', value: filteredStats.totalStats.totalShortStoryReadTime || 0, bgColor: '#8b5cf6', borderColor: '#7c3aed' }
    ];

    const filteredData = mediaTypeMapping.filter(item => selectedMediaTypes.includes(item.type));

    const data = {
      labels: filteredData.map(item => item.label),
      datasets: [
        {
          label: 'Activity Time (minutes)',
          data: filteredData.map(item => item.value),
          backgroundColor: filteredData.map(item => item.bgColor),
          borderColor: filteredData.map(item => item.borderColor),
          borderWidth: 2
        }
      ]
    };

    return data;
  };

  // Prepare line chart data showing activity over time periods
  const getLineChartData = () => {
    const filteredStats = getFilteredStats();
    if (!filteredStats || !filteredStats.groupedStats || filteredStats.groupedStats.length === 0) return null;

    // Determine appropriate groupBy based on the global period
    let chartGroupBy = 'day';
    switch (globalPeriod) {
      case 'today':
      case 'week':
      case 'month':
        chartGroupBy = 'day';
        break;
      case 'year':
        chartGroupBy = 'month';
        break;
      case 'all':
        chartGroupBy = 'year';
        break;
    }

    // Extract labels (time periods) and format them based on the appropriate groupBy
    const labels = filteredStats.groupedStats.map(group => {
      const date = new Date(group.period);
      if (chartGroupBy === 'day') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (chartGroupBy === 'week') {
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (chartGroupBy === 'month') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      } else if (chartGroupBy === 'year') {
        return date.getFullYear().toString();
      }
      return group.period;
    });

    const datasets = [];
    
    if (selectedMediaTypes.includes('tv')) {
      datasets.push({
        label: 'TV Shows',
        data: filteredStats.groupedStats.map(group => group.tvWatchTime || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('movie')) {
      datasets.push({
        label: 'Movies',
        data: filteredStats.groupedStats.map(group => group.movieWatchTime || 0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('book')) {
      datasets.push({
        label: 'Books',
        data: filteredStats.groupedStats.map(group => group.bookReadTime || 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('comic')) {
      datasets.push({
        label: 'Comics',
        data: filteredStats.groupedStats.map(group => group.comicReadTime || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('shortstory')) {
      datasets.push({
        label: 'Short Stories',
        data: filteredStats.groupedStats.map(group => group.shortStoryReadTime || 0),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.1
      });
    }

    return {
      labels,
      datasets
    };
  };

  // Get the appropriate chart data based on chart type
  const getChartData = () => {
    return chartType === 'bar' ? getBarChartData() : getLineChartData();
  };

  // Filter data based on selected media types
  const getFilteredStats = () => {
    if (!stats) return null;

    const filteredTotalStats = {
      ...stats.totalStats,
      totalTvWatchTime: selectedMediaTypes.includes('tv') ? stats.totalStats.totalTvWatchTime : 0,
      totalMovieWatchTime: selectedMediaTypes.includes('movie') ? stats.totalStats.totalMovieWatchTime : 0,
      totalBookReadTime: selectedMediaTypes.includes('book') ? stats.totalStats.totalBookReadTime || 0 : 0,
      totalComicReadTime: selectedMediaTypes.includes('comic') ? stats.totalStats.totalComicReadTime || 0 : 0,
      totalShortStoryReadTime: selectedMediaTypes.includes('shortstory') ? stats.totalStats.totalShortStoryReadTime || 0 : 0,
      totalTvEpisodes: selectedMediaTypes.includes('tv') ? stats.totalStats.totalTvEpisodes : 0,
      totalMovies: selectedMediaTypes.includes('movie') ? stats.totalStats.totalMovies : 0,
      totalBooks: selectedMediaTypes.includes('book') ? stats.totalStats.totalBooks || 0 : 0,
      totalComics: selectedMediaTypes.includes('comic') ? stats.totalStats.totalComics || 0 : 0,
      totalShortStories: selectedMediaTypes.includes('shortstory') ? stats.totalStats.totalShortStories || 0 : 0,
    };

    // Recalculate totals
    filteredTotalStats.totalWatchTime = filteredTotalStats.totalTvWatchTime + filteredTotalStats.totalMovieWatchTime;
    filteredTotalStats.totalReadTime = filteredTotalStats.totalBookReadTime + filteredTotalStats.totalComicReadTime + filteredTotalStats.totalShortStoryReadTime;
    filteredTotalStats.totalActivityTime = filteredTotalStats.totalWatchTime + filteredTotalStats.totalReadTime;
    filteredTotalStats.totalItems = filteredTotalStats.totalTvEpisodes + filteredTotalStats.totalMovies + filteredTotalStats.totalBooks + filteredTotalStats.totalComics + filteredTotalStats.totalShortStories;

    const filteredGroupedStats = stats.groupedStats.map(group => ({
      ...group,
      tvWatchTime: selectedMediaTypes.includes('tv') ? group.tvWatchTime : 0,
      movieWatchTime: selectedMediaTypes.includes('movie') ? group.movieWatchTime : 0,
      bookReadTime: selectedMediaTypes.includes('book') ? group.bookReadTime || 0 : 0,
      comicReadTime: selectedMediaTypes.includes('comic') ? group.comicReadTime || 0 : 0,
      shortStoryReadTime: selectedMediaTypes.includes('shortstory') ? group.shortStoryReadTime || 0 : 0,
      tvEpisodes: selectedMediaTypes.includes('tv') ? group.tvEpisodes : 0,
      movies: selectedMediaTypes.includes('movie') ? group.movies : 0,
      books: selectedMediaTypes.includes('book') ? group.books || 0 : 0,
      comics: selectedMediaTypes.includes('comic') ? group.comics || 0 : 0,
      shortStories: selectedMediaTypes.includes('shortstory') ? group.shortStories || 0 : 0,
    }));

    return {
      ...stats,
      totalStats: filteredTotalStats,
      groupedStats: filteredGroupedStats
    };
  };

  // Chart options
  const getChartOptions = () => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: chartType === 'bar' 
            ? 'Activity Time by Media Type' 
            : `Activity Time Over Time (${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)})`,
          font: {
            size: 16
          }
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time (minutes)'
          }
        }
      },
    };

    if (chartType === 'line') {
      baseOptions.scales.x = {
        title: {
          display: true,
          text: groupBy.charAt(0).toUpperCase() + groupBy.slice(1)
        }
      };
    }

    return baseOptions;
  };

  return (
    <div className="watch-stats-container">
      <h1>Watch Statistics</h1>
      
      {/* Global Filters */}
      <div className="global-filters">
        <div className="filter-section">
          <h3>Time Period</h3>
          <div className="control-group">
            <select value={globalPeriod} onChange={(e) => handleGlobalPeriodChange(e.target.value)}>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
        
        <div className="filter-section">
          <h3>Media Types</h3>
          <div className="media-type-filters">
            <label className="media-filter">
              <input 
                type="checkbox" 
                checked={selectedMediaTypes.includes('tv')} 
                onChange={() => handleMediaTypeToggle('tv')}
              />
              TV Shows
            </label>
            <label className="media-filter">
              <input 
                type="checkbox" 
                checked={selectedMediaTypes.includes('movie')} 
                onChange={() => handleMediaTypeToggle('movie')}
              />
              Movies
            </label>
            <label className="media-filter">
              <input 
                type="checkbox" 
                checked={selectedMediaTypes.includes('book')} 
                onChange={() => handleMediaTypeToggle('book')}
              />
              Books
            </label>
            <label className="media-filter">
              <input 
                type="checkbox" 
                checked={selectedMediaTypes.includes('comic')} 
                onChange={() => handleMediaTypeToggle('comic')}
              />
              Comics
            </label>
            <label className="media-filter">
              <input 
                type="checkbox" 
                checked={selectedMediaTypes.includes('shortstory')} 
                onChange={() => handleMediaTypeToggle('shortstory')}
              />
              Short Stories
            </label>
          </div>
          <button onClick={handleSelectAllMediaTypes} className="select-all-btn">
            {selectedMediaTypes.length === 5 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'custom-orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom-orders')}
        >
          By Custom Order
        </button>
        <button 
          className={`tab-button ${activeTab === 'tv' ? 'active' : ''}`}
          onClick={() => setActiveTab('tv')}
        >
          📺 TV Shows
        </button>
        <button 
          className={`tab-button ${activeTab === 'movies' ? 'active' : ''}`}
          onClick={() => setActiveTab('movies')}
        >
          🎬 Movies
        </button>
        <button 
          className={`tab-button ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          📚 Books
        </button>
        <button 
          className={`tab-button ${activeTab === 'comics' ? 'active' : ''}`}
          onClick={() => setActiveTab('comics')}
        >
          📖 Comics
        </button>
        <button 
          className={`tab-button ${activeTab === 'shortstories' ? 'active' : ''}`}
          onClick={() => setActiveTab('shortstories')}
        >
          📝 Stories
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          {/* Today's Stats Card */}
      {todayStats && todayStats.totalStats.totalItems > 0 && (
        selectedMediaTypes.some(type => {
          if (type === 'tv' && todayStats.totalStats.totalTvEpisodes > 0) return true;
          if (type === 'movie' && todayStats.totalStats.totalMovies > 0) return true;
          if (type === 'book' && (todayStats.totalStats.totalBooks || 0) > 0) return true;
          if (type === 'comic' && (todayStats.totalStats.totalComics || 0) > 0) return true;
          if (type === 'shortstory' && (todayStats.totalStats.totalShortStories || 0) > 0) return true;
          return false;
        })
      ) && (
        <div className="stats-card today-stats">
          <h2>Today's Activity</h2>
          <div className="stats-grid">
            {(selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie')) && (
              <div className="stat-item">
                <span className="stat-label">Total Watch Time</span>
                <span className="stat-value">{todayStats.totalStats.totalWatchTimeFormatted}</span>
              </div>
            )}
            {(selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) && (
              <div className="stat-item">
                <span className="stat-label">Total Read Time</span>
                <span className="stat-value">{todayStats.totalStats.totalReadTimeFormatted || '0m'}</span>
              </div>
            )}
            {selectedMediaTypes.includes('tv') && (
              <div className="stat-item">
                <span className="stat-label">TV Episodes</span>
                <span className="stat-value">{todayStats.totalStats.totalTvEpisodes}</span>
              </div>
            )}
            {selectedMediaTypes.includes('movie') && (
              <div className="stat-item">
                <span className="stat-label">Movies</span>
                <span className="stat-value">{todayStats.totalStats.totalMovies}</span>
              </div>
            )}
            {selectedMediaTypes.includes('book') && (
              <div className="stat-item">
                <span className="stat-label">Books</span>
                <span className="stat-value">{todayStats.totalStats.totalBooks || 0}</span>
              </div>
            )}
            {selectedMediaTypes.includes('comic') && (
              <div className="stat-item">
                <span className="stat-label">Comics</span>
                <span className="stat-value">{todayStats.totalStats.totalComics || 0}</span>
              </div>
            )}
            {selectedMediaTypes.includes('shortstory') && (
              <div className="stat-item">
                <span className="stat-label">Stories</span>
                <span className="stat-value">{todayStats.totalStats.totalShortStories || 0}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Stats */}
      {stats && (
        <div className="stats-card">
          <h2>Overall Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Activity Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalActivityTimeFormatted}</span>
            </div>
            {(selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie')) && (
              <div className="stat-item">
                <span className="stat-label">Total Watch Time</span>
                <span className="stat-value">{getFilteredStats()?.totalStats.totalWatchTimeFormatted}</span>
              </div>
            )}
            {(selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) && (
              <div className="stat-item">
                <span className="stat-label">Total Read Time</span>
                <span className="stat-value">{getFilteredStats()?.totalStats.totalReadTimeFormatted || '0m'}</span>
              </div>
            )}
            {selectedMediaTypes.includes('tv') && (
              <>
                <div className="stat-item">
                  <span className="stat-label">TV Watch Time</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalTvWatchTimeFormatted}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">TV Episodes Watched</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalTvEpisodes}</span>
                </div>
              </>
            )}
            {selectedMediaTypes.includes('movie') && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Movie Watch Time</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalMovieWatchTimeFormatted}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Movies Watched</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalMovies}</span>
                </div>
              </>
            )}
            {selectedMediaTypes.includes('book') && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Book Read Time</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalBookReadTimeFormatted || '0m'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Books Read</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalBooks || 0}</span>
                </div>
              </>
            )}
            {selectedMediaTypes.includes('comic') && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Comic Read Time</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalComicReadTimeFormatted || '0m'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Comics Read</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalComics || 0}</span>
                </div>
              </>
            )}
            {selectedMediaTypes.includes('shortstory') && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Story Read Time</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalShortStoryReadTimeFormatted || '0m'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Stories Read</span>
                  <span className="stat-value">{getFilteredStats()?.totalStats.totalShortStories || 0}</span>
                </div>
              </>
            )}
            <div className="stat-item">
              <span className="stat-label">Total Items</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalItems}</span>
            </div>
          </div>
        </div>
      )}

      {/* No Media Types Selected Message */}
      {selectedMediaTypes.length === 0 && (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>No Media Types Selected</h3>
            <p>Please select at least one media type from the filters above to view statistics.</p>
          </div>
        </div>
      )}

      {/* Activity Comparison Chart */}
      {stats && getChartData() && selectedMediaTypes.length > 0 && (
        <div className="stats-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Activity Comparison</h2>
            <div className="chart-controls">
              <button 
                className={`chart-toggle ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
              >
                📊 Bar Chart
              </button>
              <button 
                className={`chart-toggle ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
              >
                📈 Line Chart
              </button>
            </div>
          </div>
          {chartType === 'line' && (
            <div className="chart-info">
              <small style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                Time axis automatically adjusts: Days for week/month periods, Months for year period, Years for all-time
              </small>
            </div>
          )}
          <div style={{ height: '400px', padding: '20px' }}>
            {chartType === 'bar' ? (
              <Bar data={getChartData()} options={getChartOptions()} />
            ) : (
              <Line data={getChartData()} options={getChartOptions()} />
            )}
          </div>
        </div>
      )}

      {/* Time-based Breakdown */}
      {stats && stats.groupedStats.length > 0 && selectedMediaTypes.length > 0 && (
        <div className="stats-card">
          <h2>Activity by {
            globalPeriod === 'today' || globalPeriod === 'week' || globalPeriod === 'month' 
              ? 'Day' 
              : globalPeriod === 'year' 
                ? 'Month' 
                : 'Year'
          }</h2>
          <div className="time-breakdown">
            {getFilteredStats().groupedStats.map((group, index) => {
              // Calculate total activity time for filtered media types only
              let totalActivityTime = 0;
              if (selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie')) {
                totalActivityTime += (group.totalWatchTime || 0);
              }
              if (selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) {
                totalActivityTime += (group.totalReadTime || 0);
              }
              
              const formatTime = (minutes) => {
                if (!minutes) return '0m';
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                if (hours > 0) {
                  return `${hours}h ${mins}m`;
                }
                return `${mins}m`;
              };
              
              // Skip periods with no activity for selected media types
              if (totalActivityTime === 0) return null;
              
              return (
                <div key={index} className="time-period">
                  <div className="period-header">
                    <h3>{formatDate(group.period)}</h3>
                    <span className="period-total">{formatTime(totalActivityTime)}</span>
                  </div>
                  <div className="period-stats">
                    {selectedMediaTypes.includes('tv') && (
                      <div className="period-stat">
                        <span className="stat-type">TV:</span>
                        <span>{group.tvEpisodes || 0} episodes ({group.tvWatchTimeFormatted || '0m'})</span>
                      </div>
                    )}
                    {selectedMediaTypes.includes('movie') && (
                      <div className="period-stat">
                        <span className="stat-type">Movies:</span>
                        <span>{group.movies || 0} movies ({group.movieWatchTimeFormatted || '0m'})</span>
                      </div>
                    )}
                    {selectedMediaTypes.includes('book') && (
                      <div className="period-stat">
                        <span className="stat-type">Books:</span>
                        <span>{group.books || 0} books ({group.bookReadTimeFormatted || '0m'})</span>
                      </div>
                    )}
                    {selectedMediaTypes.includes('comic') && (
                      <div className="period-stat">
                        <span className="stat-type">Comics:</span>
                        <span>{group.comics || 0} comics ({group.comicReadTimeFormatted || '0m'})</span>
                      </div>
                    )}
                    {selectedMediaTypes.includes('shortstory') && (
                      <div className="period-stat">
                        <span className="stat-type">Stories:</span>
                        <span>{group.shortStories || 0} stories ({group.shortStoryReadTimeFormatted || '0m'})</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && recentActivity.filter(log => selectedMediaTypes.includes(log.mediaType)).length > 0 && (
        <div className="stats-card">
          <h2>Recent Activity</h2>
          <div className="recent-activity">
            {recentActivity
              .filter(log => selectedMediaTypes.includes(log.mediaType))
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by when activity was logged
              .map((log, index) => (
                <div key={log.id} className="activity-item">
                  <div className="activity-info">
                    <div className="activity-title">
                      {log.mediaType === 'tv' && log.seriesTitle && (
                        <span className="series-title">{log.seriesTitle} - </span>
                      )}
                      <span className="title">{log.title}</span>
                      {log.mediaType === 'tv' && log.seasonNumber && log.episodeNumber && (
                        <span className="episode-info"> (S{log.seasonNumber}E{log.episodeNumber})</span>
                      )}
                    </div>
                    <div className="activity-meta">
                      <span className="media-type">{log.mediaType.toUpperCase()}</span>
                      <span className="separator">•</span>
                      <span className="duration">
                        {log.activityType === 'read' 
                          ? log.totalWatchTimeFormatted 
                          : log.durationFormatted}
                      </span>
                      <span className="separator">•</span>
                      <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data State */}
      {stats && stats.totalStats.totalItems === 0 && (
        <div className="stats-card">
          <div className="no-data">
            <h2>No Watch Data</h2>
            <p>Start watching TV shows and movies to see your statistics here!</p>
          </div>
        </div>
      )}
        </div>
      )}
      
      {/* Custom Orders Tab */}
      {activeTab === 'custom' && (
        <div className="tab-content">
          <div className="row">
            {/* Time Period Filter for Custom Orders */}
            <div className="col-12 mb-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Filter Custom Order Statistics</h5>
                  <div className="btn-group" role="group">
                    <button 
                      type="button" 
                      className={`btn ${customPeriod === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setCustomPeriod('all');
                        fetchCustomOrderStats('all');
                      }}
                    >
                      All Time
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${customPeriod === 'today' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setCustomPeriod('today');
                        fetchCustomOrderStats('today');
                      }}
                    >
                      Today
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${customPeriod === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setCustomPeriod('week');
                        fetchCustomOrderStats('week');
                      }}
                    >
                      This Week
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${customPeriod === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setCustomPeriod('month');
                        fetchCustomOrderStats('month');
                      }}
                    >
                      This Month
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${customPeriod === 'year' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setCustomPeriod('year');
                        fetchCustomOrderStats('year');
                      }}
                    >
                      This Year
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Order Statistics */}
            <div className="col-md-6 mb-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Custom Order Overview ({customPeriod.charAt(0).toUpperCase() + customPeriod.slice(1)})</h5>
                  {customOrderStats ? (
                    <div>
                      <p><strong>Total Entries:</strong> {customOrderStats.totalEntries}</p>
                      <p><strong>Total Activity Time:</strong> {customOrderStats.totalStats?.totalActivityTimeFormatted || '0 minutes'}</p>
                      <p><strong>Total Watch Time:</strong> {customOrderStats.totalStats?.totalWatchTimeFormatted || '0 minutes'}</p>
                      <p><strong>Total Read Time:</strong> {customOrderStats.totalStats?.totalReadTimeFormatted || '0 minutes'}</p>
                      <p><strong>Custom Orders Accessed:</strong> {customOrderStats.totalStats?.uniqueCustomOrders || 0}</p>
                    </div>
                  ) : (
                    <p>Loading custom order statistics...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Order Activity Chart */}
            <div className="col-md-6 mb-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Custom Order Activity Over Time</h5>
                  <canvas ref={customOrderChartRef} width="400" height="200"></canvas>
                </div>
              </div>
            </div>

            {/* Recent Custom Order Activity */}
            <div className="col-12">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Recent Custom Order Activity</h5>
                  {customOrderStats && customOrderStats.logs && customOrderStats.logs.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Custom Order</th>
                            <th>Media Type</th>
                            <th>Activity</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customOrderStats.logs.slice(0, 10).map((log, index) => (
                            <tr key={index}>
                              <td>{new Date(log.startTime).toLocaleDateString()}</td>
                              <td>{log.title}</td>
                              <td>{log.customOrderItem?.customOrder?.name || 'N/A'}</td>
                              <td className="text-capitalize">{log.mediaType}</td>
                              <td className="text-capitalize">{log.activityType}</td>
                              <td>{Math.round(log.totalWatchTime)} min</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No custom order activity found for the selected period.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TV Shows Tab */}
      {activeTab === 'tv' && (
        <div className="tab-content">
          {tvStats ? (
            <>
              {/* Overall TV Statistics */}
              <div className="stats-card">
                <h2>📺 TV Show Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Episodes</span>
                    <span className="stat-value">{tvStats.totalStats?.totalTvEpisodes || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Watch Time</span>
                    <span className="stat-value">{tvStats.totalStats?.totalTvWatchTimeFormatted || '0 minutes'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Unique Shows</span>
                    <span className="stat-value">{tvStats.totalStats?.uniqueShows || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Unique Seasons</span>
                    <span className="stat-value">{tvStats.totalStats?.uniqueSeasons || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Collections</span>
                    <span className="stat-value">{tvStats.totalStats?.uniqueCollections || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Custom Orders</span>
                    <span className="stat-value">{tvStats.totalStats?.uniqueCustomOrders || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Episode Length</span>
                    <span className="stat-value">
                      {tvStats.totalStats?.totalTvEpisodes > 0 
                        ? Math.round((tvStats.totalStats?.totalTvWatchTime || 0) / tvStats.totalStats.totalTvEpisodes) + ' min'
                        : '0 min'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent TV Episodes */}
              {tvStats.logs && tvStats.logs.length > 0 && (
                <div className="stats-card">
                  <h2>Recent TV Episodes</h2>
                  <div className="recent-activity">
                    {tvStats.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            {log.seriesTitle && (
                              <span className="series-title">{log.seriesTitle} - </span>
                            )}
                            <span className="title">{log.title}</span>
                            {log.seasonNumber && log.episodeNumber && (
                              <span className="episode-info"> (S{log.seasonNumber}E{log.episodeNumber})</span>
                            )}
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">TV</span>
                            <span className="separator">•</span>
                            <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                            <span className="separator">•</span>
                            <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collections Breakdown */}
              {tvStats.totalStats?.collectionBreakdown && tvStats.totalStats.collectionBreakdown.length > 0 && (
                <div className="stats-card">
                  <h2>Collections Breakdown</h2>
                  <div className="time-breakdown">
                    {tvStats.totalStats.collectionBreakdown.map((collection, index) => (
                      <div key={index} className="time-period">
                        <div className="period-header">
                          <h3>{collection.name}</h3>
                          <span className="period-total">
                            {collection.totalWatchTimeFormatted}
                          </span>
                        </div>
                        <div className="period-stats">
                          <div className="period-stat">
                            <span className="stat-type">Shows:</span>
                            <span>{collection.uniqueShows}</span>
                          </div>
                          <div className="period-stat">
                            <span className="stat-type">Episodes:</span>
                            <span>{collection.totalEpisodes}</span>
                          </div>
                          <div className="period-stat">
                            <span className="stat-type">Seasons:</span>
                            <span>{collection.uniqueSeasons}</span>
                          </div>
                        </div>
                        {collection.shows && collection.shows.length > 0 && (
                          <div className="collection-shows">
                            <h4>Shows in Collection:</h4>
                            <div className="shows-list">
                              {collection.shows.map((show, showIndex) => (
                                <span key={showIndex} className="show-tag">{show}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series Breakdown */}
              {tvStats.totalStats?.seriesBreakdown && tvStats.totalStats.seriesBreakdown.length > 0 && (
                <div className="stats-card">
                  <h2>Series Breakdown</h2>
                  <div className="time-breakdown">
                    {tvStats.totalStats.seriesBreakdown.map((series, index) => (
                      <div key={index} className="time-period">
                        <div className="period-header">
                          <h3>{series.name}</h3>
                          <span className="period-total">
                            {series.totalWatchTimeFormatted}
                          </span>
                        </div>
                        <div className="period-stats">
                          <div className="period-stat">
                            <span className="stat-type">Episodes:</span>
                            <span>{series.totalEpisodes}</span>
                          </div>
                          <div className="period-stat">
                            <span className="stat-type">Seasons:</span>
                            <span>{series.uniqueSeasons}</span>
                          </div>
                          <div className="period-stat">
                            <span className="stat-type">Avg Episode:</span>
                            <span>{series.averageEpisodeLength} min</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 10 Actors with Toggle */}
              {tvStats.totalStats?.actorBreakdown && (
                <div className="stats-card">
                  <div className="actor-header">
                    <h2>🎭 Top 10 Actors</h2>
                    <div className="actor-toggle-controls">
                      <button
                        className={`toggle-btn ${actorSortBy === 'playtime' ? 'active' : ''}`}
                        onClick={() => setActorSortBy('playtime')}
                      >
                        By Playtime
                      </button>
                      <button
                        className={`toggle-btn ${actorSortBy === 'episodes' ? 'active' : ''}`}
                        onClick={() => setActorSortBy('episodes')}
                      >
                        By Episodes
                      </button>
                      <button
                        className={`toggle-btn ${actorSortBy === 'series' ? 'active' : ''}`}
                        onClick={() => setActorSortBy('series')}
                      >
                        By Series
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const getActorData = () => {
                      switch (actorSortBy) {
                        case 'playtime':
                          return tvStats.totalStats.actorBreakdown.byPlaytime || [];
                        case 'episodes':
                          return tvStats.totalStats.actorBreakdown.byEpisodeCount || [];
                        case 'series':
                          return tvStats.totalStats.actorBreakdown.bySeriesCount || [];
                        default:
                          return [];
                      }
                    };
                    
                    const actorData = getActorData();
                    const sortLabel = actorSortBy === 'playtime' ? 'Total Playtime' : 
                                     actorSortBy === 'episodes' ? 'Episode Count' : 
                                     'Series Count';
                    
                    return actorData.length > 0 ? (
                      <div className="time-breakdown">
                        {actorData.map((actor, index) => (
                          <div key={`${actorSortBy}-${index}`} className="time-period">
                            <div className="period-header">
                              <div className="actor-info">
                                <span className="actor-rank">#{index + 1}</span>
                                <h3>{actor.name}</h3>
                              </div>
                              <span className="period-total">
                                {actorSortBy === 'playtime' && actor.totalWatchTimeFormatted}
                                {actorSortBy === 'episodes' && `${actor.episodeCount} episodes`}
                                {actorSortBy === 'series' && `${actor.seriesCount} series`}
                              </span>
                            </div>
                            <div className="period-stats">
                              {actorSortBy !== 'playtime' && (
                                <div className="period-stat">
                                  <span className="stat-type">Playtime:</span>
                                  <span>{actor.totalWatchTimeFormatted}</span>
                                </div>
                              )}
                              {actorSortBy !== 'episodes' && (
                                <div className="period-stat">
                                  <span className="stat-type">Episodes:</span>
                                  <span>{actor.episodeCount}</span>
                                </div>
                              )}
                              {actorSortBy !== 'series' && (
                                <div className="period-stat">
                                  <span className="stat-type">Series:</span>
                                  <span>{actor.seriesCount}</span>
                                </div>
                              )}
                            </div>
                            {actor.series && actor.series.length > 0 && actorSortBy === 'series' && (
                              <div className="collection-shows">
                                <h4>Series Appeared In:</h4>
                                <div className="shows-list">
                                  {actor.series.map((series, seriesIndex) => (
                                    <span key={seriesIndex} className="show-tag">{series}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                        <p>No actor data available</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading TV Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Movies Tab */}
      {activeTab === 'movies' && (
        <div className="tab-content">
          {movieStats ? (
            <>
              {/* Overall Movie Statistics */}
              <div className="stats-card">
                <h2>🎬 Movie Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Movies</span>
                    <span className="stat-value">{movieStats.totalStats?.totalMovies || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Watch Time</span>
                    <span className="stat-value">{movieStats.totalStats?.totalMovieWatchTimeFormatted || '0 minutes'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Custom Orders</span>
                    <span className="stat-value">{movieStats.totalStats?.uniqueCustomOrders || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Duration</span>
                    <span className="stat-value">
                      {movieStats.totalStats?.totalMovies > 0 
                        ? Math.round((movieStats.totalStats?.totalMovieWatchTime || 0) / movieStats.totalStats.totalMovies) + ' min' 
                        : '0 min'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Movies */}
              {movieStats.logs && movieStats.logs.length > 0 && (
                <div className="stats-card">
                  <h2>Recent Movies</h2>
                  <div className="recent-activity">
                    {movieStats.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="title">{log.title}</span>
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">MOVIE</span>
                            <span className="separator">•</span>
                            <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                            <span className="separator">•</span>
                            <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 10 Actors with Toggle for Movies */}
              {movieStats.totalStats?.actorBreakdown && (
                <div className="stats-card">
                  <div className="actor-header">
                    <h2>🎭 Top 10 Movie Actors</h2>
                    <div className="actor-toggle-controls">
                      <button
                        className={`toggle-btn ${movieActorSortBy === 'playtime' ? 'active' : ''}`}
                        onClick={() => setMovieActorSortBy('playtime')}
                      >
                        By Playtime
                      </button>
                      <button
                        className={`toggle-btn ${movieActorSortBy === 'episodes' ? 'active' : ''}`}
                        onClick={() => setMovieActorSortBy('episodes')}
                      >
                        By Movies
                      </button>
                      <button
                        className={`toggle-btn ${movieActorSortBy === 'series' ? 'active' : ''}`}
                        onClick={() => setMovieActorSortBy('series')}
                      >
                        By Collections
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const getActorData = () => {
                      switch (movieActorSortBy) {
                        case 'playtime':
                          return movieStats.totalStats.actorBreakdown.byPlaytime || [];
                        case 'episodes':
                          return movieStats.totalStats.actorBreakdown.byMovieCount || [];
                        case 'series':
                          return movieStats.totalStats.actorBreakdown.byCollectionCount || [];
                        default:
                          return [];
                      }
                    };
                    
                    const actorData = getActorData();
                    
                    return actorData.length > 0 ? (
                      <div className="time-breakdown">
                        {actorData.map((actor, index) => (
                          <div key={`movie-${movieActorSortBy}-${index}`} className="time-period">
                            <div className="period-header">
                              <div className="actor-info">
                                <span className="actor-rank">#{index + 1}</span>
                                <h3>{actor.name}</h3>
                              </div>
                              <span className="period-total">
                                {movieActorSortBy === 'playtime' && actor.totalWatchTimeFormatted}
                                {movieActorSortBy === 'episodes' && `${actor.movieCount} movies`}
                                {movieActorSortBy === 'series' && `${actor.collectionCount} collections`}
                              </span>
                            </div>
                            <div className="period-stats">
                              {movieActorSortBy !== 'playtime' && (
                                <div className="period-stat">
                                  <span className="stat-type">Playtime:</span>
                                  <span>{actor.totalWatchTimeFormatted}</span>
                                </div>
                              )}
                              {movieActorSortBy !== 'episodes' && (
                                <div className="period-stat">
                                  <span className="stat-type">Movies:</span>
                                  <span>{actor.movieCount}</span>
                                </div>
                              )}
                              {movieActorSortBy !== 'series' && (
                                <div className="period-stat">
                                  <span className="stat-type">Collections:</span>
                                  <span>{actor.collectionCount}</span>
                                </div>
                              )}
                            </div>
                            {actor.collections && actor.collections.length > 0 && movieActorSortBy === 'series' && (
                              <div className="collection-shows">
                                <h4>Collections Appeared In:</h4>
                                <div className="shows-list">
                                  {actor.collections.map((collection, collectionIndex) => (
                                    <span key={collectionIndex} className="show-tag">{collection}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {actor.movies && actor.movies.length > 0 && movieActorSortBy === 'episodes' && (
                              <div className="collection-shows">
                                <h4>Movies Appeared In:</h4>
                                <div className="shows-list">
                                  {actor.movies.map((movie, movieIndex) => (
                                    <span key={movieIndex} className="show-tag">{movie}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                        <p>No actor data available</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Movie Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="tab-content">
          {bookStats ? (
            <>
              {/* Overall Book Statistics */}
              <div className="stats-card">
                <h2>📚 Book Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Books</span>
                    <span className="stat-value">{bookStats.totalStats?.totalBooks || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Completed Books</span>
                    <span className="stat-value">{bookStats.totalStats?.totalCompletedBooks || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Read Time</span>
                    <span className="stat-value">{bookStats.totalStats?.totalBookReadTimeFormatted || '0 minutes'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Pages Read</span>
                    <span className="stat-value">{bookStats.totalStats?.totalPagesRead || 0} pages</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Custom Orders</span>
                    <span className="stat-value">{bookStats.totalStats?.uniqueCustomOrders || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Read Time</span>
                    <span className="stat-value">
                      {bookStats.totalStats?.totalBooks > 0 
                        ? Math.round((bookStats.totalStats?.totalBookReadTime || 0) / bookStats.totalStats.totalBooks) + ' min' 
                        : '0 min'
                      }
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Pages per Book</span>
                    <span className="stat-value">
                      {bookStats.totalStats?.totalBooks > 0 && bookStats.totalStats?.totalPagesRead > 0
                        ? Math.round(bookStats.totalStats.totalPagesRead / bookStats.totalStats.totalBooks) + ' pages'
                        : '0 pages'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Author Breakdown */}
              {bookStats.totalStats?.authorBreakdown && (
                <div className="stats-card">
                  <div className="breakdown-header">
                    <h2>📖 Top Authors</h2>
                    <div className="toggle-group">
                      <button
                        className={`toggle-btn ${authorSortBy === 'readtime' ? 'active' : ''}`}
                        onClick={() => setAuthorSortBy('readtime')}
                      >
                        By Read Time
                      </button>
                      <button
                        className={`toggle-btn ${authorSortBy === 'pages' ? 'active' : ''}`}
                        onClick={() => setAuthorSortBy('pages')}
                      >
                        By Pages Read
                      </button>
                      <button
                        className={`toggle-btn ${authorSortBy === 'books' ? 'active' : ''}`}
                        onClick={() => setAuthorSortBy('books')}
                      >
                        By Book Count
                      </button>
                      <button
                        className={`toggle-btn ${authorSortBy === 'completed' ? 'active' : ''}`}
                        onClick={() => setAuthorSortBy('completed')}
                      >
                        By Completed Books
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const getAuthorData = () => {
                      switch (authorSortBy) {
                        case 'readtime':
                          return bookStats.totalStats.authorBreakdown.byReadTime || [];
                        case 'pages':
                          return bookStats.totalStats.authorBreakdown.byPagesRead || [];
                        case 'books':
                          return bookStats.totalStats.authorBreakdown.byBookCount || [];
                        case 'completed':
                          return bookStats.totalStats.authorBreakdown.byCompletedBooks || [];
                        default:
                          return [];
                      }
                    };
                    
                    const authorData = getAuthorData();
                    const sortLabel = authorSortBy === 'readtime' ? 'Total Read Time' : 
                                     authorSortBy === 'pages' ? 'Pages Read' : 
                                     authorSortBy === 'books' ? 'Book Count' :
                                     authorSortBy === 'completed' ? 'Completed Books' :
                                     'Book Count';
                    
                    return authorData.length > 0 ? (
                      <div className="time-breakdown">
                        {authorData.map((author, index) => (
                          <div key={`book-${authorSortBy}-${index}`} className="time-period">
                            <div className="period-header">
                              <div className="actor-info">
                                <span className="actor-rank">#{index + 1}</span>
                                <h3>{author.name}</h3>
                              </div>
                              <span className="period-total">
                                {authorSortBy === 'readtime' && author.totalReadTimeFormatted}
                                {authorSortBy === 'pages' && `${author.totalPagesRead} pages`}
                                {authorSortBy === 'books' && `${author.bookCount} books`}
                                {authorSortBy === 'completed' && `${author.completedBooks} completed`}
                              </span>
                            </div>
                            <div className="period-stats">
                              {authorSortBy !== 'readtime' && (
                                <div className="period-stat">
                                  <span className="stat-type">Read Time:</span>
                                  <span>{author.totalReadTimeFormatted}</span>
                                </div>
                              )}
                              {authorSortBy !== 'pages' && (
                                <div className="period-stat">
                                  <span className="stat-type">Pages Read:</span>
                                  <span>{author.totalPagesRead}</span>
                                </div>
                              )}
                              {authorSortBy !== 'books' && (
                                <div className="period-stat">
                                  <span className="stat-type">Books:</span>
                                  <span>{author.bookCount}</span>
                                </div>
                              )}
                              {authorSortBy !== 'completed' && author.completedBooks && (
                                <div className="period-stat">
                                  <span className="stat-type">Completed:</span>
                                  <span>{author.completedBooks}</span>
                                </div>
                              )}
                              {author.averagePagesPerBook > 0 && (
                                <div className="period-stat">
                                  <span className="stat-type">Avg Pages/Book:</span>
                                  <span>{author.averagePagesPerBook}</span>
                                </div>
                              )}
                            </div>
                            {author.books && author.books.length > 0 && authorSortBy === 'books' && (
                              <div className="collection-shows">
                                <h4>Books Read:</h4>
                                <div className="shows-list">
                                  {author.books.map((book, bookIndex) => (
                                    <span key={bookIndex} className="show-tag">{book.title}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {author.completedBooks && author.completedBooksList && author.completedBooksList.length > 0 && authorSortBy === 'completed' && (
                              <div className="collection-shows">
                                <h4>Completed Books:</h4>
                                <div className="shows-list">
                                  {author.completedBooksList.map((book, bookIndex) => (
                                    <span key={bookIndex} className="show-tag">{book.title}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                        <p>No author data available</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Completed Books */}
              {bookStats.totalStats?.completedBooks && bookStats.totalStats.completedBooks.length > 0 && (
                <div className="stats-card">
                  <h2>📖 Completed Books ({bookStats.totalStats.totalCompletedBooks})</h2>
                  <div className="recent-activity">
                    {bookStats.totalStats.completedBooks.slice(0, 15).map((book, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="title">{book.title}</span>
                            {book.author && book.author !== 'Unknown Author' && (
                              <span className="subtitle">by {book.author}</span>
                            )}
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">BOOK</span>
                            <span className="separator">•</span>
                            <span className="completion-status">{book.percentRead}% Complete</span>
                            {book.pageCount && (
                              <>
                                <span className="separator">•</span>
                                <span className="page-count">{book.pageCount} pages</span>
                              </>
                            )}
                            {book.year && (
                              <>
                                <span className="separator">•</span>
                                <span className="year">{book.year}</span>
                              </>
                            )}
                            <span className="separator">•</span>
                            <span className="date">{new Date(book.completedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {bookStats.totalStats.totalCompletedBooks > 15 && (
                      <div className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="subtitle">
                              ... and {bookStats.totalStats.totalCompletedBooks - 15} more completed books
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Books */}
              {bookStats.logs && bookStats.logs.length > 0 && (
                <div className="stats-card">
                  <h2>Recent Books</h2>
                  <div className="recent-activity">
                    {bookStats.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="title">{log.title}</span>
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">BOOK</span>
                            <span className="separator">•</span>
                            <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                            <span className="separator">•</span>
                            <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Book Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comics Tab */}
      {activeTab === 'comics' && (
        <div className="tab-content">
          {comicStats ? (
            <>
              {/* Overall Comic Statistics */}
              <div className="stats-card">
                <h2>📖 Comic Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Comics</span>
                    <span className="stat-value">{comicStats.totalStats?.totalComics || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Read Time</span>
                    <span className="stat-value">{comicStats.totalStats?.totalComicReadTimeFormatted || '0 minutes'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Custom Orders</span>
                    <span className="stat-value">{comicStats.totalStats?.uniqueCustomOrders || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Read Time</span>
                    <span className="stat-value">
                      {comicStats.totalStats?.totalComics > 0 
                        ? Math.round((comicStats.totalStats?.totalComicReadTime || 0) / comicStats.totalStats.totalComics) + ' min' 
                        : '0 min'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Comics */}
              {comicStats.logs && comicStats.logs.length > 0 && (
                <div className="stats-card">
                  <h2>Recent Comics</h2>
                  <div className="recent-activity">
                    {comicStats.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="title">{log.title}</span>
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">COMIC</span>
                            <span className="separator">•</span>
                            <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                            <span className="separator">•</span>
                            <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Comic Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stories Tab */}
      {activeTab === 'stories' && (
        <div className="tab-content">
          {shortStoryStats ? (
            <>
              {/* Overall Short Story Statistics */}
              <div className="stats-card">
                <h2>📝 Short Story Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Stories</span>
                    <span className="stat-value">{shortStoryStats.totalStats?.totalShortStories || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Read Time</span>
                    <span className="stat-value">{shortStoryStats.totalStats?.totalShortStoryReadTimeFormatted || '0 minutes'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Custom Orders</span>
                    <span className="stat-value">{shortStoryStats.totalStats?.uniqueCustomOrders || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average Read Time</span>
                    <span className="stat-value">
                      {shortStoryStats.totalStats?.totalShortStories > 0 
                        ? Math.round((shortStoryStats.totalStats?.totalShortStoryReadTime || 0) / shortStoryStats.totalStats.totalShortStories) + ' min' 
                        : '0 min'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Short Stories */}
              {shortStoryStats.logs && shortStoryStats.logs.length > 0 && (
                <div className="stats-card">
                  <h2>Recent Short Stories</h2>
                  <div className="recent-activity">
                    {shortStoryStats.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-info">
                          <div className="activity-title">
                            <span className="title">{log.title}</span>
                          </div>
                          <div className="activity-meta">
                            <span className="media-type">STORY</span>
                            <span className="separator">•</span>
                            <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                            <span className="separator">•</span>
                            <span className="date">{new Date(log.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Short Story Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Custom Orders Tab */}
      {activeTab === 'custom-orders' && (
        <div className="tab-content">
          {customOrderStats ? (
            <div className="stats-card">
              <h2>Statistics by Custom Order</h2>
              <div className="custom-order-stats">
                {customOrderStats.map((orderStat, index) => (
                  <div key={index} className="custom-order-item">
                    <div className="order-header">
                      <h3>{orderStat.customOrderName || 'Unknown Order'}</h3>
                      <span className="order-total">
                        {orderStat.totalWatchTimeFormatted} watch • {orderStat.totalReadTimeFormatted} read
                      </span>
                    </div>
                    <div className="order-breakdown">
                      {orderStat.totalTvEpisodes > 0 && (
                        <div className="breakdown-item">
                          <span className="media-type">TV:</span>
                          <span>{orderStat.totalTvEpisodes} episodes ({orderStat.totalTvWatchTimeFormatted})</span>
                        </div>
                      )}
                      {orderStat.totalMovies > 0 && (
                        <div className="breakdown-item">
                          <span className="media-type">Movies:</span>
                          <span>{orderStat.totalMovies} movies ({orderStat.totalMovieWatchTimeFormatted})</span>
                        </div>
                      )}
                      {orderStat.totalBooks > 0 && (
                        <div className="breakdown-item">
                          <span className="media-type">Books:</span>
                          <span>{orderStat.totalBooks} books ({orderStat.totalBookReadTimeFormatted})</span>
                        </div>
                      )}
                      {orderStat.totalComics > 0 && (
                        <div className="breakdown-item">
                          <span className="media-type">Comics:</span>
                          <span>{orderStat.totalComics} comics ({orderStat.totalComicReadTimeFormatted})</span>
                        </div>
                      )}
                      {orderStat.totalShortStories > 0 && (
                        <div className="breakdown-item">
                          <span className="media-type">Stories:</span>
                          <span>{orderStat.totalShortStories} stories ({orderStat.totalShortStoryReadTimeFormatted})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Custom Order Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchStats;
