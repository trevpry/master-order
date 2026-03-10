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
import config from '../config';

const API_BASE = `${config.apiBaseUrl}/api/dating`;

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
      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        setDatingApps(appsData);
      }

      // Load user data
      await Promise.all([
        loadConnections(),
        loadDates(),
        loadEncounters(),
        loadStats()
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
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || data);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const loadDates = async () => {
    try {
      const response = await fetch(`${API_BASE}/dates?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDates(data.dates || data);
      }
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const loadEncounters = async () => {
    try {
      const response = await fetch(`${API_BASE}/encounters?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setEncounters(data.encounters || data);
      }
    } catch (error) {
      console.error('Error loading encounters:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || data);
      }
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
    loadStats();
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
    loadStats();
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
    loadStats();
  };

  const handleDeleteConnection = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/connections/${id}`, { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setConnections(connections.filter(conn => conn.id !== id));
        loadStats();
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
        loadStats();
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
        loadStats();
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

  // Card components
  const ConnectionCard = ({ connection }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {connection.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
            <p className="text-sm text-gray-600">{connection.app}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              setEditingConnection(connection);
              setShowConnectionForm(true);
            }}
            className="text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteConnection(connection.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        {connection.age && (
          <div className="flex items-center text-sm text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            Age: {connection.age}
          </div>
        )}
        
        {connection.location && (
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            {connection.location}
          </div>
        )}
        
        {connection.lastContact && (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            Last contact: {new Date(connection.lastContact).toLocaleDateString()}
          </div>
        )}
      </div>
      
      {connection.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{connection.notes}</p>
        </div>
      )}
    </div>
  );

  const DateCard = ({ date }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{date.guyName}</h3>
          <p className="text-sm text-gray-600">{date.location}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              setEditingDate(date);
              setShowDateForm(true);
            }}
            className="text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteDate(date.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          {new Date(date.dateTime).toLocaleDateString()}
        </div>
        
        {date.rating && (
          <div className="flex items-center text-sm text-gray-600">
            <Star className="w-4 h-4 mr-2" />
            {date.rating}/5 stars
          </div>
        )}
        
        {date.cost && (
          <div className="flex items-center text-sm text-gray-600">
            <span className="w-4 h-4 mr-2">$</span>
            ${date.cost}
          </div>
        )}
      </div>
      
      {date.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{date.notes}</p>
        </div>
      )}
    </div>
  );

  const EncounterCard = ({ encounter }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{encounter.guyName}</h3>
          <p className="text-sm text-gray-600">{encounter.type}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              setEditingEncounter(encounter);
              setShowEncounterForm(true);
            }}
            className="text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteEncounter(encounter.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          {new Date(encounter.dateTime).toLocaleDateString()}
        </div>
        
        {encounter.satisfaction && (
          <div className="flex items-center text-sm text-gray-600">
            <Star className="w-4 h-4 mr-2" />
            {encounter.satisfaction}/5 satisfaction
          </div>
        )}
        
        {encounter.location && (
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            {encounter.location}
          </div>
        )}
      </div>
      
      {encounter.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{encounter.notes}</p>
        </div>
      )}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-xl text-gray-600">Loading dating data...</div>
    </div>
  );

  if (error) return (
    <div className="text-center py-8">
      <div className="text-red-600 mb-2">Error: {error}</div>
      <Button onClick={loadInitialData}>Try Again</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dating Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Manage your connections, dates, and encounters
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {/* Add Button */}
              <Button onClick={() => {
                if (activeTab === 'connections') openAddForm('connection');
                else if (activeTab === 'dates') openAddForm('date');
                else if (activeTab === 'encounters') openAddForm('encounter');
                else if (activeTab === 'map') openAddForm('connection');
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add New
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'connections', label: 'Connections', icon: MessageCircle },
              { id: 'dates', label: 'Dates', icon: Calendar },
              { id: 'encounters', label: 'Encounters', icon: Heart },
              { id: 'map', label: 'Map', icon: Map },
              { id: 'stats', label: 'Statistics', icon: BarChart3 }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Connection Locations</h2>
            </div>
            <ConnectionsMap connections={filteredConnections} />
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Dating Statistics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalConnections}</p>
                    <p className="text-gray-600">Total Connections</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalDates}</p>
                    <p className="text-gray-600">Total Dates</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Heart className="h-8 w-8 text-red-500" />
                  <div className="ml-4">
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalEncounters}</p>
                    <p className="text-gray-600">Total Encounters</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Star className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-2xl font-semibold text-gray-900">{stats.averageRating || 0}</p>
                    <p className="text-gray-600">Average Rating</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Connections</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={connectionFilter}
                  onChange={(e) => setConnectionFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500"
                >
                  <option value="all">All Connections</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredConnections.map(connection => (
                <ConnectionCard key={connection.id} connection={connection} />
              ))}
              {filteredConnections.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No connections found. Add your first connection!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dates Tab */}
        {activeTab === 'dates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Dates</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500"
                >
                  <option value="all">All Dates</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDates.map(date => (
                <DateCard key={date.id} date={date} />
              ))}
              {filteredDates.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No dates found. Log your first date!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Encounters Tab */}
        {activeTab === 'encounters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Encounters</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEncounters.map(encounter => (
                <EncounterCard key={encounter.id} encounter={encounter} />
              ))}
              {filteredEncounters.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No encounters found. Log your first encounter!
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Forms */}
      <ConnectionForm
        isOpen={showConnectionForm}
        onClose={() => {
          setShowConnectionForm(false);
          setEditingConnection(null);
        }}
        onSave={handleConnectionSaved}
        connection={editingConnection}
        userId={userId}
      />

      <DateForm
        isOpen={showDateForm}
        onClose={() => {
          setShowDateForm(false);
          setEditingDate(null);
        }}
        onSave={handleDateSaved}
        date={editingDate}
        userId={userId}
      />

      <EncounterForm
        isOpen={showEncounterForm}
        onClose={() => {
          setShowEncounterForm(false);
          setEditingEncounter(null);
        }}
        onSave={handleEncounterSaved}
        encounter={editingEncounter}
        userId={userId}
      />

      {showEnhancedConnectionManager && (
        <EnhancedConnectionManager
          onConnectionCreated={handleConnectionSaved}
          onClose={() => setShowEnhancedConnectionManager(false)}
        />
      )}
    </div>
  );
};

export default Dating;
