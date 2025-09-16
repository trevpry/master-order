import React, { useState, useEffect } from 'react';
import { 
  BarChart3,
  Play,
  Film,
  Tv,
  Book,
  Music,
  Camera,
  Clock,
  Loader2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import config from '../../../config';

const DailyWatchStats = ({ date, timezone }) => {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (date && timezone) {
      fetchDailyStats();
    }
  }, [date, timezone]);

  const fetchDailyStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if the date is today to use the specific today endpoint
      const today = new Date().toISOString().split('T')[0];
      const isToday = date === today;
      
      let response;
      if (isToday) {
        // Use the today-specific endpoint for current day
        response = await fetch(`${config.apiBaseUrl}/api/watch-stats/today`);
      } else {
        // For historical dates, use custom period with start and end date
        const startDate = `${date}T00:00:00.000Z`;
        const endDate = `${date}T23:59:59.999Z`;
        response = await fetch(
          `${config.apiBaseUrl}/api/watch-stats?period=custom&startDate=${startDate}&endDate=${endDate}&groupBy=day`
        );
      }
      
      if (response.ok) {
        const result = await response.json();
        
        // Handle different response formats between today endpoint and general endpoint
        if (isToday) {
          setStatsData(result.totalStats || result.data || result || {});
        } else {
          // For custom period, the data might be in different format
          const data = result.data || result || {};
          if (data.chronologicalStats && data.chronologicalStats.length > 0) {
            // Extract data from chronological stats for the specific day
            const dayData = data.chronologicalStats[0];
            setStatsData(dayData || {});
          } else {
            setStatsData({});
          }
        }
      } else {
        setError('Failed to load watch statistics');
      }
    } catch (err) {
      console.error('Error fetching daily stats:', err);
      setError('Failed to load watch statistics');
    } finally {
      setLoading(false);
    }
  };

  const getMediaIcon = (type) => {
    switch (type) {
      case 'movie':
        return <Film className="h-5 w-5" />;
      case 'tv':
        return <Tv className="h-5 w-5" />;
      case 'book':
        return <Book className="h-5 w-5" />;
      case 'music':
        return <Music className="h-5 w-5" />;
      case 'webvideo':
        return <Camera className="h-5 w-5" />;
      default:
        return <Play className="h-5 w-5" />;
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Check if we have any stats data
  const hasData = statsData && (
    statsData.totalWatchTime > 0 || 
    statsData.totalActivityTime > 0 ||
    (statsData.mediaTypes && Object.keys(statsData.mediaTypes).length > 0) ||
    (statsData.recentActivity && statsData.recentActivity.length > 0) ||
    (statsData.activities && statsData.activities.length > 0)
  );

  if (!hasData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity</h3>
        <p className="text-gray-600 mb-4">
          No watch activity was recorded for this date.
        </p>
        <p className="text-sm text-gray-500">
          Media consumption data will appear here when available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Time */}
      {(statsData.totalWatchTime > 0 || statsData.totalActivityTime > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-8 w-8 text-blue-600 mr-3" />
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {formatDuration(statsData.totalWatchTime || statsData.totalActivityTime || 0)}
              </div>
              <div className="text-sm text-gray-600">Total watch time</div>
            </div>
          </div>
        </div>
      )}

      {/* Media Types Breakdown */}
      {statsData.mediaTypes && Object.keys(statsData.mediaTypes).length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            By Media Type
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(statsData.mediaTypes).map(([type, data]) => (
              <div
                key={type}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getMediaIcon(type)}
                    <span className="font-medium text-gray-900 capitalize">{type}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {data.count} item{data.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatDuration(data.totalTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {((statsData.recentActivity && statsData.recentActivity.length > 0) || 
        (statsData.activities && statsData.activities.length > 0)) && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Play className="h-5 w-5 mr-2" />
            Activity Timeline
          </h4>
          <div className="space-y-3">
            {(statsData.recentActivity || statsData.activities || []).slice(0, 5).map((activity, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                {getMediaIcon(activity.mediaType)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {activity.title}
                  </div>
                  <div className="text-sm text-gray-500">
                    {activity.duration && formatDuration(activity.duration)} • 
                    {new Date(activity.createdAt || activity.timestamp).toLocaleTimeString('en-US', {
                      timeZone: timezone,
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {(statsData.recentActivity || statsData.activities || []).length > 5 && (
            <div className="text-center mt-4">
              <p className="text-sm text-gray-500">
                Showing 5 of {(statsData.recentActivity || statsData.activities || []).length} activities
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Daily Summary</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {(statsData.totalWatchTime > 0 || statsData.totalActivityTime > 0) && (
            <p>Total time spent: <span className="font-medium">{formatDuration(statsData.totalWatchTime || statsData.totalActivityTime || 0)}</span></p>
          )}
          {statsData.mediaTypes && (
            <p>
              Media types watched: <span className="font-medium">{Object.keys(statsData.mediaTypes).length}</span>
            </p>
          )}
          {(statsData.recentActivity || statsData.activities) && (
            <p>
              Total activities: <span className="font-medium">{(statsData.recentActivity || statsData.activities || []).length}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyWatchStats;