import React, { useState } from 'react';
import './EventDetail.css';

const EventDetail = ({ event, onBack, onEventUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!event) {
    return (
      <div className="event-detail">
        <div className="error-state">
          <h2>Event not found</h2>
          <button onClick={onBack} className="back-button">
            ← Back to Events
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'books', label: '📚 Books', icon: '📚', count: event.books?.length || 0 },
    { id: 'chapters', label: '📖 Chapters', icon: '📖', count: event.chapters?.length || 0 },
    { id: 'sections', label: '📄 Sections', icon: '📄', count: event.sections?.length || 0 },
    { id: 'videos', label: '🎬 Videos', icon: '🎬', count: event.videos?.length || 0 }
  ];

  return (
    <div className="event-detail">
      <header className="event-detail-header">
        <div className="header-top">
          <button onClick={onBack} className="back-button">
            ← Back to Events
          </button>
          <div className="header-actions">
            <button className="edit-button">
              ✏️ Edit Event
            </button>
          </div>
        </div>
        
        <div className="event-info">
          <h1 className="event-title">{event.title}</h1>
          <div className="event-meta">
            <span className="event-category">{event.category}</span>
            <span className="event-period">
              {event.startDate} {event.endDate ? `- ${event.endDate}` : '- Ongoing'}
            </span>
          </div>
          {event.details && (
            <p className="event-description">{event.details}</p>
          )}
        </div>
      </header>

      <nav className="event-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="tab-count">({tab.count})</span>
            )}
          </button>
        ))}
      </nav>

      <main className="event-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-summary">
              <div className="summary-card">
                <h3>📚 Books</h3>
                <div className="summary-number">{event.books?.length || 0}</div>
                <p>Historical books and texts</p>
              </div>
              <div className="summary-card">
                <h3>📖 Chapters</h3>
                <div className="summary-number">{event.chapters?.length || 0}</div>
                <p>Book chapters</p>
              </div>
              <div className="summary-card">
                <h3>📄 Sections</h3>
                <div className="summary-number">{event.sections?.length || 0}</div>
                <p>Chapter sections</p>
              </div>
              <div className="summary-card">
                <h3>🎬 Videos</h3>
                <div className="summary-number">{event.videos?.length || 0}</div>
                <p>Educational videos and documentaries</p>
              </div>
              <div className="summary-card">
                <h3>✅ Status</h3>
                <div className="summary-status">
                  {event.user_event_reviews?.[0]?.reviewed ? (
                    <span className="status-reviewed">Reviewed</span>
                  ) : (
                    <span className="status-pending">In Progress</span>
                  )}
                </div>
                <p>Learning progress</p>
              </div>
            </div>

            {!event.user_event_reviews?.[0]?.reviewed && (
              <div className="review-section">
                <h3>📝 Mark as Reviewed</h3>
                <p>Mark this event as reviewed when you've completed studying all related materials.</p>
                <button className="review-button">
                  ✅ Mark as Reviewed
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'books' && (
          <div className="books-tab">
            <div className="tab-header">
              <h2>📚 Books ({event.books?.length || 0})</h2>
              <button className="add-button">
                ➕ Add Book
              </button>
            </div>
            
            {event.books && event.books.length > 0 ? (
              <div className="content-grid">
                {event.books.map(book => (
                  <div key={book.id} className="content-card">
                    <div className="content-header">
                      <h4>{book.title}</h4>
                      {book.user_book_reads?.[0]?.read && (
                        <span className="read-badge">✅ Read</span>
                      )}
                    </div>
                    {book.author && <p className="book-author">by {book.author}</p>}
                    {book.description && (
                      <p className="content-description">
                        {book.description.length > 150 
                          ? `${book.description.substring(0, 150)}...` 
                          : book.description
                        }
                      </p>
                    )}
                    <div className="content-actions">
                      {!book.user_book_reads?.[0]?.read && (
                        <button className="mark-read-button">
                          📖 Mark as Read
                        </button>
                      )}
                      <button className="view-button">
                        👁️ View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📚</div>
                <h3>No Books Added</h3>
                <p>Add books related to this historical event to track your reading progress.</p>
                <button className="add-first-button">
                  ➕ Add First Book
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="videos-tab">
            <div className="tab-header">
              <h2>🎬 Videos ({event.videos?.length || 0})</h2>
              <button className="add-button">
                ➕ Add Video
              </button>
            </div>
            
            {event.videos && event.videos.length > 0 ? (
              <div className="content-grid">
                {event.videos.map(video => (
                  <div key={video.id} className="content-card">
                    <div className="content-header">
                      <h4>{video.title || 'Untitled Video'}</h4>
                      {video.user_video_watches?.[0]?.watched && (
                        <span className="watched-badge">✅ Watched</span>
                      )}
                    </div>
                    <div className="video-meta">
                      <span className="video-type">{video.type}</span>
                      {video.duration && <span className="video-duration">{video.duration}</span>}
                    </div>
                    {video.description && (
                      <p className="content-description">
                        {video.description.length > 150 
                          ? `${video.description.substring(0, 150)}...` 
                          : video.description
                        }
                      </p>
                    )}
                    <div className="content-actions">
                      {video.url && (
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="watch-button">
                          ▶️ Watch
                        </a>
                      )}
                      {!video.user_video_watches?.[0]?.watched && (
                        <button className="mark-watched-button">
                          ✅ Mark as Watched
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">🎬</div>
                <h3>No Videos Added</h3>
                <p>Add educational videos and documentaries related to this historical event.</p>
                <button className="add-first-button">
                  ➕ Add First Video
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="chapters-tab">
            <div className="tab-header">
              <h2>📖 Chapters ({event.chapters?.length || 0})</h2>
            </div>
            
            {event.chapters && event.chapters.length > 0 ? (
              <div className="content-grid">
                {event.chapters.map(chapter => (
                  <div key={chapter.id} className="content-card">
                    <div className="content-header">
                      <h4>{chapter.title}</h4>
                      {chapter.user_chapter_reads?.read && (
                        <span className="read-badge">✅ Read</span>
                      )}
                    </div>
                    <div className="chapter-meta">
                      <span className="book-title">📚 {chapter.book?.title}</span>
                      <span className="chapter-number">Chapter {chapter.chapterNumber}</span>
                    </div>
                    {chapter.description && (
                      <p className="content-description">
                        {chapter.description.length > 150 
                          ? `${chapter.description.substring(0, 150)}...` 
                          : chapter.description
                        }
                      </p>
                    )}
                    <div className="content-actions">
                      {!chapter.user_chapter_reads?.read && (
                        <button className="mark-read-button">
                          📖 Mark as Read
                        </button>
                      )}
                      <button className="view-button">
                        👁️ View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📖</div>
                <h3>No Chapters Linked</h3>
                <p>No chapters are directly linked to this historical event.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="sections-tab">
            <div className="tab-header">
              <h2>📄 Sections ({event.sections?.length || 0})</h2>
            </div>
            
            {event.sections && event.sections.length > 0 ? (
              <div className="content-grid">
                {event.sections.map(section => (
                  <div key={section.id} className="content-card">
                    <div className="content-header">
                      <h4>{section.title}</h4>
                      {section.user_section_reads?.read && (
                        <span className="read-badge">✅ Read</span>
                      )}
                    </div>
                    <div className="section-meta">
                      <span className="book-title">📚 {section.chapter?.book?.title}</span>
                      <span className="chapter-title">📖 {section.chapter?.title}</span>
                    </div>
                    {section.description && (
                      <p className="content-description">
                        {section.description.length > 150 
                          ? `${section.description.substring(0, 150)}...` 
                          : section.description
                        }
                      </p>
                    )}
                    <div className="content-actions">
                      {!section.user_section_reads?.read && (
                        <button className="mark-read-button">
                          📄 Mark as Read
                        </button>
                      )}
                      <button className="view-button">
                        👁️ View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📄</div>
                <h3>No Sections Linked</h3>
                <p>No sections are directly linked to this historical event.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default EventDetail;
