import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import config from './config';

function Dashboard() {
  const [stats, setStats] = useState({
    media: {},
    reading: {},
    system: {},
    recent: {}
  });
  const [loading, setLoading] = useState(true);
  const [upNext, setUpNext] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch multiple API endpoints for dashboard data
      const [
        customOrdersRes,
        watchStatsRes,
        upNextRes,
        settingsRes
      ] = await Promise.allSettled([
        fetch(`${config.apiBaseUrl}/api/custom-orders`),
        fetch(`${config.apiBaseUrl}/api/watch-tracking/stats`),
        fetch(`${config.apiBaseUrl}/api/up-next`),
        fetch(`${config.apiBaseUrl}/api/settings`)
      ]);

      // Process custom orders data
      if (customOrdersRes.status === 'fulfilled' && customOrdersRes.value.ok) {
        const customOrders = await customOrdersRes.value.json();
        setStats(prev => ({
          ...prev,
          media: {
            ...prev.media,
            totalCustomOrders: customOrders.length,
            activeOrders: customOrders.filter(order => !order.isCompleted).length
          }
        }));
      }

      // Process watch stats data
      if (watchStatsRes.status === 'fulfilled' && watchStatsRes.value.ok) {
        const watchStats = await watchStatsRes.value.json();
        setStats(prev => ({
          ...prev,
          media: {
            ...prev.media,
            totalWatchTime: watchStats.totalWatchTime || 0,
            recentSessions: watchStats.recentSessions || 0
          }
        }));
      }

      // Process up next data
      if (upNextRes.status === 'fulfilled' && upNextRes.value.ok) {
        const upNextData = await upNextRes.value.json();
        setUpNext(upNextData);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
            <p className="text-xl text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="p-6 mx-auto max-w-7xl">
        
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="p-6 bg-white shadow-xl rounded-2xl">
            <h1 className="mb-2 text-4xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
              Welcome Back to Eddie
            </h1>
            <p className="text-lg text-gray-600">Your comprehensive life management dashboard</p>
            <div className="mt-4 text-sm text-gray-500">
              {formatDate(new Date())}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Media Stats */}
          <div className="p-6 bg-white shadow-lg rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Media Library</h3>
              <div className="p-2 text-blue-600 bg-blue-100 rounded-lg">
                🎬
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Custom Orders</span>
                <span className="font-bold text-blue-600">{stats.media.totalCustomOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Orders</span>
                <span className="font-bold text-green-600">{stats.media.activeOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Watch Time</span>
                <span className="font-bold text-purple-600">{formatTime(stats.media.totalWatchTime)}</span>
              </div>
            </div>
          </div>

          {/* Reading Stats */}
          <div className="p-6 bg-white shadow-lg rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Reading</h3>
              <div className="p-2 text-green-600 bg-green-100 rounded-lg">
                📚
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Books</span>
                <span className="font-bold text-green-600">{stats.reading.totalBooks || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comics</span>
                <span className="font-bold text-blue-600">{stats.reading.totalComics || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="font-bold text-orange-600">{stats.reading.inProgress || 0}</span>
              </div>
            </div>
          </div>

          {/* System Stats */}
          <div className="p-6 bg-white shadow-lg rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">System</h3>
              <div className="p-2 text-purple-600 bg-purple-100 rounded-lg">
                ⚙️
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Uptime</span>
                <span className="font-bold text-green-600">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Background Tasks</span>
                <span className="font-bold text-blue-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Sync</span>
                <span className="font-bold text-gray-600">Recent</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 bg-white shadow-lg rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
              <div className="p-2 text-orange-600 bg-orange-100 rounded-lg">
                ⚡
              </div>
            </div>
            <div className="space-y-2">
              <Link to="/media/up-next" className="block p-2 text-sm text-center text-white transition-colors bg-blue-500 rounded hover:bg-blue-600">
                Get Up Next
              </Link>
              <Link to="/media/custom-orders" className="block p-2 text-sm text-center text-white transition-colors bg-green-500 rounded hover:bg-green-600">
                Custom Orders
              </Link>
              <Link to="/media/settings" className="block p-2 text-sm text-center text-white transition-colors bg-purple-500 rounded hover:bg-purple-600">
                Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Up Next Section */}
        {upNext && (
          <div className="mb-8">
            <div className="p-6 text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-xl rounded-2xl">
              <h2 className="mb-4 text-2xl font-bold">🎯 Up Next</h2>
              <div className="p-4 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl">
                <h3 className="mb-2 text-xl font-semibold">{upNext.title}</h3>
                {upNext.type === 'episode' && (
                  <p className="mb-2 opacity-90">
                    Season {upNext.seasonNumber}, Episode {upNext.episodeNumber}
                  </p>
                )}
                <p className="opacity-80">{upNext.summary}</p>
                <div className="mt-4">
                  <Link 
                    to="/media/up-next" 
                    className="inline-block px-6 py-2 font-semibold text-blue-600 transition-colors bg-white rounded-lg hover:bg-gray-100"
                  >
                    Start Watching
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Module Quick Access */}
        <div className="mb-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-800">🏠 Eddie Modules</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            
            <Link to="/media" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-blue-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">🎬</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Media</div>
                <div className="text-sm text-gray-500">Movies & TV</div>
              </div>
            </Link>

            <Link to="/tasks" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-green-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">✅</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Tasks</div>
                <div className="text-sm text-gray-500">Todo & Projects</div>
              </div>
            </Link>

            <Link to="/notes" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-yellow-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">�</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Notes</div>
                <div className="text-sm text-gray-500">Ideas & Thoughts</div>
              </div>
            </Link>

            <Link to="/locations" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-red-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">📍</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Locations</div>
                <div className="text-sm text-gray-500">Places & Maps</div>
              </div>
            </Link>

            <Link to="/dating" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-pink-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">💕</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Dating</div>
                <div className="text-sm text-gray-500">Connections</div>
              </div>
            </Link>

            <Link to="/eddie/settings" className="transition-all duration-300 transform group hover:scale-105">
              <div className="p-6 text-center transition-all duration-300 bg-white border border-gray-200 shadow-lg hover:shadow-xl rounded-2xl hover:border-purple-300">
                <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">⚙️</div>
                <div className="mb-1 text-lg font-bold text-gray-800">Settings</div>
                <div className="text-sm text-gray-500">Configuration</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-800">📊 Recent Activity</h2>
          <div className="p-6 bg-white shadow-lg rounded-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 mr-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">System startup completed</span>
                </div>
                <span className="text-sm text-gray-500">Just now</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 mr-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">Dashboard loaded successfully</span>
                </div>
                <span className="text-sm text-gray-500">Just now</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 mr-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-700">Welcome to Eddie Life Management</span>
                </div>
                <span className="text-sm text-gray-500">Just now</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
