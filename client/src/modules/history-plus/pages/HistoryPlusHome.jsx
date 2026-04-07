import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { historyPlusApi } from '../services/historyPlusApi';
import EventsList from '../components/EventsList';
import EventDetail from '../components/EventDetail';
import StatsOverview from '../components/StatsOverview';
import SearchBar from '../components/SearchBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './HistoryPlusHome.css';

const HistoryPlusHome = () => {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, events, event-detail
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [eventsData, statsData] = await Promise.all([
        historyPlusApi.getAllEvents(),
        historyPlusApi.getStatistics()
      ]);
      
      setEvents(eventsData.data || eventsData);
      setStatistics(statsData.data || statsData);
    } catch (err) {
      setError('Failed to load History Plus data');
      console.error('Error loading History Plus data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSelect = async (event) => {
    try {
      setLoading(true);
      // Fetch the full event details with books, chapters, sections, etc.
      const eventDetails = await historyPlusApi.getEventById(event.id);
      setSelectedEvent(eventDetails.data || eventDetails);
      setCurrentView('event-detail');
    } catch (err) {
      setError('Failed to load event details');
      console.error('Error loading event details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEvents = () => {
    setCurrentView('events');
    setSelectedEvent(null);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedEvent(null);
    setSearchResults(null);
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const results = await historyPlusApi.searchContent(query);
      setSearchResults(results.data || results);
      setCurrentView('search-results');
    } catch (err) {
      setError('Search failed');
      console.error('Search error:', err);
    }
  };

  const handleEventUpdate = async () => {
    // Reload events list
    loadInitialData();
    // Also reload selected event details if viewing one
    if (selectedEvent) {
      try {
        const eventDetails = await historyPlusApi.getEventById(selectedEvent.id);
        setSelectedEvent(eventDetails.data || eventDetails);
      } catch (err) {
        console.error('Error reloading event details:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="history-plus-container">
        <LoadingSpinner text="Loading History Plus..." />
      </div>
    );
  }

  return (
    <div className="history-plus-home">
      <header className="history-plus-header">
        <div className="header-top">
          <h1 className="page-title">📚 History Plus</h1>
          <SearchBar onSearch={handleSearch} />
        </div>
        
        <nav className="history-plus-nav">
          <button 
            className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={handleBackToDashboard}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-button ${currentView === 'events' ? 'active' : ''}`}
            onClick={() => setCurrentView('events')}
          >
            📅 Events
          </button>
        </nav>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <main className="history-plus-content">
        {currentView === 'dashboard' && (
          <div className="dashboard-view">
            <StatsOverview statistics={statistics} />
            
            <div className="quick-actions">
              <h2>Quick Actions</h2>
              <div className="action-grid">
                <Link to="/history-plus/timeline" className="action-card">
                  <span className="action-icon">📊</span>
                  <div className="action-content">
                    <h3>Timeline View</h3>
                    <p>Browse events in timeline format</p>
                  </div>
                </Link>
                
                <button 
                  className="action-card"
                  onClick={() => setCurrentView('events')}
                >
                  <span className="action-icon">📅</span>
                  <div className="action-content">
                    <h3>Browse Events</h3>
                    <p>View all historical events</p>
                  </div>
                </button>
                
                <button 
                  className="action-card"
                  onClick={() => {/* TODO: Add new event */}}
                >
                  <span className="action-icon">➕</span>
                  <div className="action-content">
                    <h3>Add Event</h3>
                    <p>Create a new historical event</p>
                  </div>
                </button>
                
                <Link to="/history-plus/categories" className="action-card">
                  <span className="action-icon">🏷️</span>
                  <div className="action-content">
                    <h3>Manage Categories</h3>
                    <p>Create and edit event categories</p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="recent-activity">
              <h2>Recent Events</h2>
              <div className="recent-events-grid">
                {events.slice(0, 6).map(event => (
                  <div 
                    key={event.id} 
                    className="recent-event-card"
                    onClick={() => handleEventSelect(event)}
                  >
                    <h3>{event.title}</h3>
                    <p className="event-period">{event.startDate} - {event.endDate || 'Ongoing'}</p>
                    <p className="event-category">{event.category}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'events' && (
          <EventsList 
            events={events}
            onEventSelect={handleEventSelect}
            onEventsUpdate={handleEventUpdate}
          />
        )}

        {currentView === 'event-detail' && selectedEvent && (
          <EventDetail 
            event={selectedEvent}
            onBack={handleBackToEvents}
            onEventUpdate={handleEventUpdate}
          />
        )}

        {currentView === 'search-results' && searchResults && (
          <div className="search-results">
            <div className="search-header">
              <h2>Search Results</h2>
              <button onClick={handleBackToDashboard} className="back-button">
                ← Back to Dashboard
              </button>
            </div>
            
            {searchResults.events?.length > 0 && (
              <div className="search-section">
                <h3>Events ({searchResults.events.length})</h3>
                <div className="search-results-grid">
                  {searchResults.events.map(event => (
                    <div 
                      key={event.id} 
                      className="search-result-card"
                      onClick={() => handleEventSelect(event)}
                    >
                      <h4>{event.title}</h4>
                      <p>{event.category} • {event.startDate}</p>
                      {event.details && <p className="result-details">{event.details.substring(0, 100)}...</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.videos?.length > 0 && (
              <div className="search-section">
                <h3>Videos ({searchResults.videos.length})</h3>
                <div className="search-results-grid">
                  {searchResults.videos.map(video => (
                    <div key={video.id} className="search-result-card">
                      <h4>{video.title || 'Untitled Video'}</h4>
                      <p>{video.type} • {video.duration}</p>
                      {video.event && <p className="result-event">Event: {video.event.title}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryPlusHome;
