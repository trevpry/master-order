import React from 'react';
import AICategorization from './AICategorization';
import './EventsList.css';

const EventsList = ({ events, onEventSelect, onEventsUpdate }) => {
  // Check if an event needs AI categorization
  const needsAICategorization = (event) => {
    // Check if event has no category or has a generic/unassigned category
    const unassignedCategories = ['Unassigned', 'General', 'Uncategorized', '', null, undefined];
    const hasUnassignedCategory = unassignedCategories.includes(event.category);
    
    // Check if event has YouTube videos that could be analyzed
    const hasYouTubeVideos = event.videos && event.videos.some(video => 
      video.url && video.url.includes('youtube.com')
    );
    
    return hasUnassignedCategory && hasYouTubeVideos;
  };

  const handleAICategorizationSuccess = (eventId, data) => {
    console.log('✅ AI categorization successful for event:', eventId, data);
    
    // If a category was applied, refresh the events list
    if (data.applied || data.updatedEvent) {
      if (onEventsUpdate) {
        onEventsUpdate();
      }
    }
  };

  const handleAICategorizationError = (eventId, error) => {
    console.error('❌ AI categorization failed for event:', eventId, error);
  };

  const handleEventCardClick = (event, e) => {
    // Don't trigger event selection if clicking on AI categorization area
    if (e.target.closest('.ai-categorization')) {
      e.stopPropagation();
      return;
    }
    onEventSelect(event);
  };
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
            onClick={(e) => handleEventCardClick(event, e)}
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

            {/* AI Categorization for unassigned events */}
            {needsAICategorization(event) && (
              <div className="ai-categorization-section">
                <AICategorization
                  variant="event"
                  eventId={event.id}
                  eventTitle={event.title}
                  currentCategory={event.category}
                  onSuccess={(data) => handleAICategorizationSuccess(event.id, data)}
                  onError={(error) => handleAICategorizationError(event.id, error)}
                  className="event-ai-categorization"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsList;
