import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Calendar, 
  Users, 
  BarChart3,
  Plus,
  Filter,
  Search,
  MapPin,
  Star,
  Clock,
  TrendingUp,
  Edit,
  Map,
  ExternalLink,
  Trash2,
  Activity,
  Target,
  Zap,
  Award,
  Percent,
  Timer,
  Globe,
  Smartphone,
  UserCheck,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Sparkles
} from 'lucide-react';
import Button from '../components/Button';
import ConnectionForm from '../components/ConnectionForm';
import DateForm from '../components/DateForm';
import EncounterForm from '../components/EncounterForm';
import ConnectionsMap from '../components/ConnectionsMap';
import EnhancedConnectionManager from '../components/EnhancedConnectionManager';

const API_BASE = 'http://localhost:3001/api/dating';

const Dating = () => {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [dates, setDates] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [datingApps, setDatingApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalConnections: 0,
    activeConnections: 0,
    totalDates: 0,
    totalEncounters: 0,
    averageRating: 0,
    successRate: 0
  });

  // Form states
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showDateForm, setShowDateForm] = useState(false);
  const [showEncounterForm, setShowEncounterForm] = useState(false);
  const [showEnhancedConnectionManager, setShowEnhancedConnectionManager] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [editingEncounter, setEditingEncounter] = useState(null);
  
  // Filter states
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // User state
  const [userId, setUserId] = useState(1);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load dating apps first
      const appsResponse = await fetch(`${API_BASE}/dating-apps`);
      const appsData = await appsResponse.json();
      setDatingApps(appsData);
      
      // If no apps exist, seed them
      if (appsData.length === 0) {
        await fetch(`${API_BASE}/dating-apps/seed`, { method: 'POST' });
        const newAppsResponse = await fetch(`${API_BASE}/dating-apps`);
        const newAppsData = await newAppsResponse.json();
        setDatingApps(newAppsData.apps || newAppsData);
      }

      // Load user data
      await Promise.all([
        loadConnections(userId),
        loadDates(userId),
        loadEncounters(userId),
        loadStats(userId)
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const response = await fetch(`${API_BASE}/connections?userId=${userId}`);
      const data = await response.json();
      setConnections(data.connections || data);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const loadDates = async () => {
    try {
      const response = await fetch(`${API_BASE}/dates?userId=${userId}`);
      const data = await response.json();
      setDates(data.dates || data);
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const loadEncounters = async () => {
    try {
      const response = await fetch(`${API_BASE}/encounters?userId=${userId}`);
      const data = await response.json();
      setEncounters(data.encounters || data);
    } catch (error) {
      console.error('Error loading encounters:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats?userId=${userId}`);
      const data = await response.json();
      setStats(data.stats || data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Form handlers
  const openAddForm = (type) => {
    if (type === 'connection') setShowEnhancedConnectionManager(true);
    else if (type === 'date') setShowDateForm(true);
    else if (type === 'encounter') setShowEncounterForm(true);
  };

  const handleConnectionSaved = (savedConnection) => {
    if (editingConnection) {
      setConnections(connections.map(conn => 
        conn.id === savedConnection.id ? savedConnection : conn
      ));
      setEditingConnection(null);
    } else {
      setConnections([...connections, savedConnection]);
    }
    setShowConnectionForm(false);
    setShowEnhancedConnectionManager(false);
    loadStats(); // Refresh stats
  };

  const handleDateSaved = (savedDate) => {
    if (editingDate) {
      setDates(dates.map(date => 
        date.id === savedDate.id ? savedDate : date
      ));
      setEditingDate(null);
    } else {
      setDates([...dates, savedDate]);
    }
    setShowDateForm(false);
    loadStats(); // Refresh stats
  };

  const handleEncounterSaved = (savedEncounter) => {
    if (editingEncounter) {
      setEncounters(encounters.map(enc => 
        enc.id === savedEncounter.id ? savedEncounter : enc
      ));
      setEditingEncounter(null);
    } else {
      setEncounters([...encounters, savedEncounter]);
    }
    setShowEncounterForm(false);
    loadStats(); // Refresh stats
  };

  const handleDeleteConnection = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/connections/${id}`, { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setConnections(connections.filter(conn => conn.id !== id));
        loadStats(); // Refresh stats
      } else {
        throw new Error('Failed to delete connection');
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Failed to delete connection');
    }
  };

  const handleDeleteDate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this date?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/dates/${id}`, { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setDates(dates.filter(date => date.id !== id));
        loadStats(); // Refresh stats
      } else {
        throw new Error('Failed to delete date');
      }
    } catch (error) {
      console.error('Error deleting date:', error);
      alert('Failed to delete date');
    }
  };

  const handleDeleteEncounter = async (id) => {
    if (!window.confirm('Are you sure you want to delete this encounter?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/encounters/${id}`, { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setEncounters(encounters.filter(enc => enc.id !== id));
        loadStats(); // Refresh stats
      } else {
        throw new Error('Failed to delete encounter');
      }
    } catch (error) {
      console.error('Error deleting encounter:', error);
      alert('Failed to delete encounter');
    }
  };

  // Filter functions
  const filteredConnections = connections.filter(connection => {
    const matchesSearch = !searchQuery || 
      connection.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connection.app?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = connectionFilter === 'all' || 
      (connectionFilter === 'active' && connection.status === 'ACTIVE') ||
      (connectionFilter === 'inactive' && connection.status !== 'ACTIVE');
    
    return matchesSearch && matchesFilter;
  });

  const filteredDates = dates.filter(date => {
    const matchesSearch = !searchQuery || 
      date.guyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      date.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = dateFilter === 'all' || 
      (dateFilter === 'positive' && date.outcome === 'POSITIVE') ||
      (dateFilter === 'negative' && date.outcome === 'NEGATIVE') ||
      (dateFilter === 'neutral' && date.outcome === 'NEUTRAL');
    
    return matchesSearch && matchesFilter;
  });

  const filteredEncounters = encounters.filter(encounter => {
    const matchesSearch = !searchQuery || 
      encounter.guyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      encounter.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });
    try {
      const response = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setConnections(connections.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Error deleting connection:', err);
    }
  };

  const filteredConnections = connections.filter(connection => {
    const matchesSearch = connection.guyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (connection.location && connection.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = connectionFilter === 'all' || connection.status === connectionFilter.toUpperCase();
    
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.guyName.localeCompare(b.guyName);
      case 'age':
        return (b.age || 0) - (a.age || 0);
      case 'lastContact':
        return new Date(b.lastContact) - new Date(a.lastContact);
      case 'responseRate':
        return (b.responseRate || 0) - (a.responseRate || 0);
      default:
        return 0;
    }
  });

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "text-blue-600" }) => (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center">
        <Icon className={`h-8 w-8 ${color}`} />
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  const ConnectionCard = ({ connection }) => {
    const lastContactDays = Math.floor((Date.now() - new Date(connection.lastContact)) / (1000 * 60 * 60 * 24));
    
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {connection.guyName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{connection.guyName}</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                {connection.age && <span>{connection.age} years old</span>}
                {connection.location && (
                  <span className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {connection.location}
                  </span>
                )}
                {connection.distance && <span>{connection.distance}</span>}
              </div>
              <div className="flex items-center space-x-4 text-sm mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  connection.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  connection.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                  connection.status === 'MET' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {connection.status}
                </span>
                {connection.app && (
                  <span className="text-gray-500">{connection.app.name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingConnection(connection);
                setShowConnectionForm(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteConnection(connection.id)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        
        {connection.bio && (
          <p className="text-gray-600 text-sm mt-3 line-clamp-2">{connection.bio}</p>
        )}
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center">
              <MessageCircle className="h-3 w-3 mr-1" />
              {connection.messagesExchanged} messages
            </span>
            <span className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {lastContactDays === 0 ? 'Today' : `${lastContactDays}d ago`}
            </span>
            {connection.responseRate > 0 && (
              <span className="flex items-center">
                <Percent className="h-3 w-3 mr-1" />
                {Math.round(connection.responseRate)}% response
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dating data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Heart className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg">{error}</p>
          <Button onClick={fetchData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Heart className="h-8 w-8 text-pink-600 mr-3" />
                Dating Manager
              </h1>
              <p className="text-gray-600 mt-1">Track your connections, dates, and encounters</p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={() => setShowConnectionForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Connection
              </Button>
              <Button onClick={() => setShowDateForm(true)} variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Log Date
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            icon={Users} 
            title="Total Connections" 
            value={stats.totalConnections}
            subtitle={`${stats.activeConnections} active`}
            color="text-blue-600"
          />
          <StatCard 
            icon={Calendar} 
            title="Total Dates" 
            value={stats.totalDates}
            color="text-green-600"
          />
          <StatCard 
            icon={Activity} 
            title="Encounters" 
            value={stats.totalEncounters}
            color="text-purple-600"
          />
          <StatCard 
            icon={Timer} 
            title="Avg Response" 
            value={stats.avgResponseTime ? `${stats.avgResponseTime}m` : 'N/A'}
            subtitle={`${Math.round(stats.responseRate)}% rate`}
            color="text-orange-600"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'connections', label: 'Connections', icon: Users },
                { key: 'dates', label: 'Dates', icon: Calendar },
                { key: 'encounters', label: 'Encounters', icon: Activity },
                { key: 'analytics', label: 'Analytics', icon: BarChart3 }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === key
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'connections' && (
              <div>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search connections..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                    <select
                      value={connectionFilter}
                      onChange={(e) => setConnectionFilter(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="met">Met</option>
                      <option value="relationship">Relationship</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="lastContact">Last Contact</option>
                      <option value="name">Name</option>
                      <option value="age">Age</option>
                      <option value="responseRate">Response Rate</option>
                    </select>
                  </div>
                </div>

                {/* Connections Grid */}
                {filteredConnections.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No connections found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm || connectionFilter !== 'all' 
                        ? 'Try adjusting your filters' 
                        : 'Start by adding your first connection'
                      }
                    </p>
                    <Button onClick={() => setShowConnectionForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Connection
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredConnections.map(connection => (
                      <ConnectionCard key={connection.id} connection={connection} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dates' && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Dates Coming Soon</h3>
                <p className="text-gray-500">Date tracking and management features will be available soon.</p>
              </div>
            )}

            {activeTab === 'encounters' && (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Encounters Coming Soon</h3>
                <p className="text-gray-500">Encounter tracking features will be available soon.</p>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-500">Detailed analytics and insights will be available soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Form */}
      <ConnectionForm
        isOpen={showConnectionForm}
        onClose={() => {
          setShowConnectionForm(false);
          setEditingConnection(null);
        }}
        onSave={(savedConnection) => {
          if (editingConnection) {
            setConnections(connections.map(c => 
              c.id === savedConnection.id ? savedConnection : c
            ));
          } else {
            setConnections([...connections, savedConnection]);
          }
          fetchData(); // Refresh data to get updated stats
        }}
        connection={editingConnection}
        userId={1}
      />

      {showDateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Log New Date</h3>
            <p className="text-gray-600 mb-4">Date form coming soon...</p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowDateForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowDateForm(false)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dating;
