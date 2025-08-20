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

  useEffect(() => {
    fetchStats();
    fetchChartStats();
    fetchRecentActivity();
    fetchTodayStats();
  }, []);

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
  );
};

export default WatchStats;
