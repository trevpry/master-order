import React, { useState, useEffect } from 'react';
import './WatchStats.css';
import config from '../../../../config';
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
import LoadingState from '../../../../shared/components/LoadingState';
import GlobalFilters from './components/GlobalFilters';
import TabNavigation from './components/TabNavigation';
import OverviewTab from './components/OverviewTab';
import CustomTab from './components/CustomTab';
import StoriesTab from './components/StoriesTab';
import WebVideosTab from './components/WebVideosTab';
import TVTab from './components/TVTab';
import MoviesTab from './components/MoviesTab';
import AllActivityTab from './components/AllActivityTab';
import BooksTab from './components/BooksTab';
import ComicsTab from './components/ComicsTab';

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
  const [selectedMediaTypes, setSelectedMediaTypes] = useState(['tv', 'movie', 'book', 'comic', 'shortstory', 'webvideo']);
  const [globalPeriod, setGlobalPeriod] = useState('week');
  const [globalGroupBy, setGlobalGroupBy] = useState('day');
  const [chartPeriod, setChartPeriod] = useState('week'); // Independent chart period
  const [chartStats, setChartStats] = useState(null); // Separate stats for chart
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'custom-orders', 'all-activity', 'tv', 'movies', 'books', 'comics', 'shortstories', 'webvideos'
  const [customOrderStats, setCustomOrderStats] = useState(null);
  const [allActivityStats, setAllActivityStats] = useState(null);
  
  // Individual media type stats
  const [tvStats, setTvStats] = useState(null);
  const [movieStats, setMovieStats] = useState(null);
  const [bookStats, setBookStats] = useState(null);
  const [comicStats, setComicStats] = useState(null);
  const [shortStoryStats, setShortStoryStats] = useState(null);
  const [webvideoStats, setWebvideoStats] = useState(null);
  
  // Actor breakdown sorting state
  const [actorSortBy, setActorSortBy] = useState('playtime'); // 'playtime', 'episodes', 'series'
  const [movieActorSortBy, setMovieActorSortBy] = useState('playtime'); // 'playtime', 'episodes', 'series' (reused names for consistency)
  const [authorSortBy, setAuthorSortBy] = useState('readtime'); // 'readtime', 'pages', 'books'
  const [publisherSortBy, setPublisherSortBy] = useState('readtime'); // 'readtime', 'comics'
  const [characterSortBy, setCharacterSortBy] = useState('readtime'); // 'readtime', 'comics'
  
  // Settings state for timezone
  const [settings, setSettings] = useState(null);

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
    const allTypes = ['tv', 'movie', 'book', 'comic', 'shortstory', 'webvideo'];
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

  // Fetch settings (for timezone)
  const fetchSettings = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
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

  // Fetch all activity across all media types
  const fetchAllActivityStats = async (period = 'all') => {
    try {
      console.log('Fetching all activity stats for period:', period);
      const url = `${config.apiBaseUrl}/api/watch-stats/all-activity?period=${period}&groupBy=day`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status, response.ok);
      
      if (!response.ok) throw new Error('Failed to fetch all activity stats');
      
      const data = await response.json();
      console.log('All activity data received:', data);
      
      setAllActivityStats(data);
    } catch (err) {
      console.error('Error fetching all activity stats:', err);
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
      console.log(`Fetched ${mediaType} stats:`, data);
      
      switch (mediaType) {
        case 'tv':
          setTvStats(data);
          console.log('Set tvStats to:', data);
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
        case 'webvideo':
          setWebvideoStats(data);
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
      fetchMediaTypeStats('shortstory', period),
      fetchMediaTypeStats('webvideo', period)
    ]);
  };

  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchChartStats();
    fetchRecentActivity();
    fetchTodayStats();
    fetchCustomOrderStats();
    fetchAllMediaTypeStats(globalPeriod);
    fetchAllActivityStats(globalPeriod);
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

  const handleDeleteWatchLog = async (watchLogId, title) => {
    if (!window.confirm(`Are you sure you want to delete the activity entry for "${title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/watch-logs/${watchLogId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh the all activity stats to reflect the deletion
        fetchAllActivityStats(globalPeriod);
        
        // Also refresh other stats that might be affected
        fetchStats(globalPeriod);
        fetchRecentActivity();
        
        // Show success message (you might want to add a toast notification here)
        console.log(`Successfully deleted activity entry for "${title}"`);
      } else {
        const errorData = await response.json();
        console.error('Failed to delete watch log:', errorData.error);
        alert(`Failed to delete activity entry: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting watch log:', error);
      alert('An error occurred while deleting the activity entry');
    }
  };

  const formatDate = (dateString) => {
    const timezone = settings?.timezone || 'UTC';
    
    // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // For date-only strings, create date in local timezone to avoid shifting
      const [year, month, day] = dateString.split('-').map(num => parseInt(num));
      const date = new Date(year, month - 1, day); // month is 0-indexed
      
      if (groupBy === 'day') {
        return date.toLocaleDateString('en-US', { timeZone: timezone });
      } else if (groupBy === 'week') {
        return `Week of ${date.toLocaleDateString('en-US', { timeZone: timezone })}`;
      } else if (groupBy === 'month') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: timezone });
      } else if (groupBy === 'year') {
        return date.getFullYear().toString();
      }
    } else {
      // For other date formats, use the original logic
      const date = new Date(dateString);
      if (groupBy === 'day') {
        return date.toLocaleDateString('en-US', { timeZone: timezone });
      } else if (groupBy === 'week') {
        return `Week of ${date.toLocaleDateString('en-US', { timeZone: timezone })}`;
      } else if (groupBy === 'month') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: timezone });
      } else if (groupBy === 'year') {
        return date.getFullYear().toString();
      }
    }
    return dateString;
  };

  // Helper function for formatting any date with timezone
  const formatDateWithTimezone = (dateString) => {
    const timezone = settings?.timezone || 'UTC';
    return new Date(dateString).toLocaleDateString('en-US', { timeZone: timezone });
  };

  if (loading && !stats) {
    return (
      <div className="watch-stats-container">
        <LoadingState type="div" />
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
      { type: 'webvideo', label: 'Web Videos', value: filteredStats.totalStats.totalWebVideoViewTime || 0, bgColor: '#06b6d4', borderColor: '#0891b2' },
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

    // Sort grouped stats chronologically for the line chart (earliest first)
    const chronologicalStats = [...filteredStats.groupedStats].sort((a, b) => {
      return new Date(a.period) - new Date(b.period);
    });

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
    const labels = chronologicalStats.map(group => {
      const timezone = settings?.timezone || 'UTC';
      // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
      let date;
      if (typeof group.period === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(group.period)) {
        // For date-only strings, create date in local timezone to avoid shifting
        const [year, month, day] = group.period.split('-').map(num => parseInt(num));
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        date = new Date(group.period);
      }
      
      if (chartGroupBy === 'day') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
      } else if (chartGroupBy === 'week') {
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone })}`;
      } else if (chartGroupBy === 'month') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: timezone });
      } else if (chartGroupBy === 'year') {
        return date.getFullYear().toString();
      }
      return group.period;
    });

    const datasets = [];
    
    if (selectedMediaTypes.includes('tv')) {
      datasets.push({
        label: 'TV Shows',
        data: chronologicalStats.map(group => group.tvWatchTime || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('movie')) {
      datasets.push({
        label: 'Movies',
        data: chronologicalStats.map(group => group.movieWatchTime || 0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('webvideo')) {
      datasets.push({
        label: 'Web Videos',
        data: chronologicalStats.map(group => group.webVideoViewTime || 0),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('book')) {
      datasets.push({
        label: 'Books',
        data: chronologicalStats.map(group => group.bookReadTime || 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('comic')) {
      datasets.push({
        label: 'Comics',
        data: chronologicalStats.map(group => group.comicReadTime || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.1
      });
    }
    
    if (selectedMediaTypes.includes('shortstory')) {
      datasets.push({
        label: 'Short Stories',
        data: chronologicalStats.map(group => group.shortStoryReadTime || 0),
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
      totalWebVideoViewTime: selectedMediaTypes.includes('webvideo') ? stats.totalStats.totalWebVideoViewTime || 0 : 0,
      totalBookReadTime: selectedMediaTypes.includes('book') ? stats.totalStats.totalBookReadTime || 0 : 0,
      totalComicReadTime: selectedMediaTypes.includes('comic') ? stats.totalStats.totalComicReadTime || 0 : 0,
      totalShortStoryReadTime: selectedMediaTypes.includes('shortstory') ? stats.totalStats.totalShortStoryReadTime || 0 : 0,
      totalTvEpisodes: selectedMediaTypes.includes('tv') ? stats.totalStats.totalTvEpisodes : 0,
      totalMovies: selectedMediaTypes.includes('movie') ? stats.totalStats.totalMovies : 0,
      totalWebVideos: selectedMediaTypes.includes('webvideo') ? stats.totalStats.totalWebVideos || 0 : 0,
      totalBooks: selectedMediaTypes.includes('book') ? stats.totalStats.totalBooks || 0 : 0,
      totalComics: selectedMediaTypes.includes('comic') ? stats.totalStats.totalComics || 0 : 0,
      totalShortStories: selectedMediaTypes.includes('shortstory') ? stats.totalStats.totalShortStories || 0 : 0,
    };

    // Recalculate totals
    filteredTotalStats.totalWatchTime = filteredTotalStats.totalTvWatchTime + filteredTotalStats.totalMovieWatchTime + filteredTotalStats.totalWebVideoViewTime;
    filteredTotalStats.totalReadTime = filteredTotalStats.totalBookReadTime + filteredTotalStats.totalComicReadTime + filteredTotalStats.totalShortStoryReadTime;
    filteredTotalStats.totalActivityTime = filteredTotalStats.totalWatchTime + filteredTotalStats.totalReadTime;
    filteredTotalStats.totalItems = filteredTotalStats.totalTvEpisodes + filteredTotalStats.totalMovies + filteredTotalStats.totalWebVideos + filteredTotalStats.totalBooks + filteredTotalStats.totalComics + filteredTotalStats.totalShortStories;

    const filteredGroupedStats = stats.groupedStats.map(group => ({
      ...group,
      tvWatchTime: selectedMediaTypes.includes('tv') ? group.tvWatchTime : 0,
      movieWatchTime: selectedMediaTypes.includes('movie') ? group.movieWatchTime : 0,
      webVideoViewTime: selectedMediaTypes.includes('webvideo') ? group.webVideoViewTime || 0 : 0,
      bookReadTime: selectedMediaTypes.includes('book') ? group.bookReadTime || 0 : 0,
      comicReadTime: selectedMediaTypes.includes('comic') ? group.comicReadTime || 0 : 0,
      shortStoryReadTime: selectedMediaTypes.includes('shortstory') ? group.shortStoryReadTime || 0 : 0,
      tvEpisodes: selectedMediaTypes.includes('tv') ? group.tvEpisodes : 0,
      movies: selectedMediaTypes.includes('movie') ? group.movies : 0,
      webVideos: selectedMediaTypes.includes('webvideo') ? group.webVideos || 0 : 0,
      books: selectedMediaTypes.includes('book') ? group.books || 0 : 0,
      comics: selectedMediaTypes.includes('comic') ? group.comics || 0 : 0,
      shortStories: selectedMediaTypes.includes('shortstory') ? group.shortStories || 0 : 0,
    })).sort((a, b) => {
      // Sort by date in descending order (most recent first)
      return new Date(b.period) - new Date(a.period);
    });

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
      
      <GlobalFilters
        globalPeriod={globalPeriod}
        onGlobalPeriodChange={handleGlobalPeriodChange}
        selectedMediaTypes={selectedMediaTypes}
        onMediaTypeToggle={handleMediaTypeToggle}
        onSelectAllMediaTypes={handleSelectAllMediaTypes}
      />
      
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab 
          todayStats={todayStats}
          stats={stats}
          selectedMediaTypes={selectedMediaTypes}
          getFilteredStats={getFilteredStats}
          getChartData={getChartData}
          getChartOptions={getChartOptions}
          chartType={chartType}
          setChartType={setChartType}
          recentActivity={recentActivity}
          settings={settings}
          globalPeriod={globalPeriod}
          formatDate={formatDate}
        />
      )}
      
      {/* Custom Orders Tab */}
      {activeTab === 'custom' && (
        <CustomTab
          customPeriod={customPeriod}
          setCustomPeriod={setCustomPeriod}
          fetchCustomOrderStats={fetchCustomOrderStats}
          customOrderStats={customOrderStats}
          customOrderChartRef={customOrderChartRef}
          formatDateWithTimezone={formatDateWithTimezone}
        />
      )}

      {/* TV Shows Tab */}
      {activeTab === 'tv' && (
        <TVTab 
          tvStats={tvStats}
          formatDateWithTimezone={formatDateWithTimezone}
          actorSortBy={actorSortBy}
          setActorSortBy={setActorSortBy}
        />
      )}

      {/* Movies Tab */}
      {activeTab === 'movies' && (
        <MoviesTab 
          movieStats={movieStats}
          formatDateWithTimezone={formatDateWithTimezone}
          movieActorSortBy={movieActorSortBy}
          setMovieActorSortBy={setMovieActorSortBy}
        />
      )}

      {/* Books Tab */}
      {activeTab === 'books' && (
        <BooksTab
          bookStats={bookStats}
          formatDateWithTimezone={formatDateWithTimezone}
          authorSortBy={authorSortBy}
          setAuthorSortBy={setAuthorSortBy}
        />
      )}

      {/* Comics Tab */}
      {activeTab === 'comics' && (
        <ComicsTab
          comicStats={comicStats}
          formatDateWithTimezone={formatDateWithTimezone}
          publisherSortBy={publisherSortBy}
          setPublisherSortBy={setPublisherSortBy}
          characterSortBy={characterSortBy}
          setCharacterSortBy={setCharacterSortBy}
        />
      )}

      {/* All Activity Tab */}
      {activeTab === 'all-activity' && (
        <AllActivityTab 
          allActivityStats={allActivityStats}
          globalPeriod={globalPeriod}
          setGlobalPeriod={setGlobalPeriod}
          fetchAllActivityStats={fetchAllActivityStats}
          formatDateWithTimezone={formatDateWithTimezone}
          handleDeleteWatchLog={handleDeleteWatchLog}
        />
      )}

      {/* Stories Tab */}
      {activeTab === 'stories' && (
        <StoriesTab
          shortStoryStats={shortStoryStats}
          formatDateWithTimezone={formatDateWithTimezone}
        />
      )}
      
      {/* Custom Orders Tab */}
      {activeTab === 'custom-orders' && (
        <div className="tab-content">
          {customOrderStats ? (
            Array.isArray(customOrderStats) && customOrderStats.length > 0 ? (
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
                        {orderStat.totalWebVideos > 0 && (
                          <div className="breakdown-item">
                            <span className="media-type">Web Videos:</span>
                            <span>{orderStat.totalWebVideos} videos ({orderStat.totalWebVideoViewTimeFormatted})</span>
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
                  <h3>No Custom Order Data Available</h3>
                  <p>No activity has been logged for custom orders yet.</p>
                </div>
              </div>
            )
          ) : (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>Loading Custom Order Statistics...</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Web Videos Tab */}
      {activeTab === 'webvideos' && (
        <WebVideosTab
          webvideoStats={webvideoStats}
          formatDateWithTimezone={formatDateWithTimezone}
        />
      )}
    </div>
  );
};

export default WatchStats;
