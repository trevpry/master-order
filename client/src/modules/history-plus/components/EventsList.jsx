import React from 'react';
import './EventsList.css';

const EventsList = ({ events, onEventSelect, onEventsUpdate }) => {
  if (!events || events.length === 0) {
    return (
      <div className="events-list">
        <div className="events-header">
          <h2>📅 Historical Events</h2>
          <button className="add-event-button">
            ➕ Add Event
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No Events Found</h3>
          <p>Start by creating your first historical event to track books, videos, and progress.</p>
          <button className="create-first-button">
            ➕ Create First Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="events-list">
      <div className="events-header">
        <h2>📅 Historical Events ({events.length})</h2>
        <button className="add-event-button">
          ➕ Add Event
        </button>
      </div>
      
      <div className="events-grid">
        {events.map(event => (
          <div 
            key={event.id} 
            className="event-card"
            onClick={() => onEventSelect(event)}
          >
            <div className="event-header">
              <h3 className="event-title">{event.title}</h3>
              <span className="event-category">{event.category}</span>
            </div>
            
            <div className="event-period">
              {event.startDate} {event.endDate ? `- ${event.endDate}` : '- Ongoing'}
            </div>
            
            {event.details && (
              <p className="event-description">
                {event.details.length > 120 
                  ? `${event.details.substring(0, 120)}...` 
                  : event.details
                }
              </p>
            )}
            
            <div className="event-stats">
              <div className="stat-item">
                <span className="stat-icon">📚</span>
                <span>{event.books?.length || 0} books</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🎬</span>
                <span>{event.videos?.length || 0} videos</span>
              </div>
              {event.user_event_reviews?.[0]?.reviewed && (
                <div className="stat-item reviewed">
                  <span className="stat-icon">✅</span>
                  <span>Reviewed</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsList;
