import React, { useState, useEffect } from 'react';
import './EventDetail.css';

const EventDetail = ({ event, onBack, onEventUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showBookLinker, setShowBookLinker] = useState(false);
  const [linkType, setLinkType] = useState('book'); // 'book', 'chapter', 'section'
  const [allBooks, setAllBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [selectedLinkBook, setSelectedLinkBook] = useState(null);
  const [selectedLinkChapter, setSelectedLinkChapter] = useState(null);

  const openBookLinker = async (type) => {
    setLinkType(type);
    setShowBookLinker(true);
    setBookSearchQuery('');
    setSelectedLinkBook(null);
    setSelectedLinkChapter(null);
    setBooksLoading(true);
    try {
      const response = await fetch('/api/books?includeChapters=true');
      const data = await response.json();
      setAllBooks(data.data?.books || data.data || []);
    } catch (err) {
      console.error('Error fetching books:', err);
      setAllBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  const handleLinkBook = async (bookId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/link-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId })
      });
      const data = await response.json();
      if (data.success) {
        setShowBookLinker(false);
        onEventUpdate();
      } else {
        alert(data.error || 'Failed to link book');
      }
    } catch (err) {
      alert(`Failed to link book: ${err.message}`);
    }
  };

  const handleLinkChapter = async (chapterId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/link-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId })
      });
      const data = await response.json();
      if (data.success) {
        setShowBookLinker(false);
        onEventUpdate();
      } else {
        alert(data.error || 'Failed to link chapter');
      }
    } catch (err) {
      alert(`Failed to link chapter: ${err.message}`);
    }
  };

  const handleLinkSection = async (sectionId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/link-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId })
      });
      const data = await response.json();
      if (data.success) {
        setShowBookLinker(false);
        onEventUpdate();
      } else {
        alert(data.error || 'Failed to link section');
      }
    } catch (err) {
      alert(`Failed to link section: ${err.message}`);
    }
  };

  const handleUnlinkBook = async (bookId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/unlink-book/${bookId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) onEventUpdate();
    } catch (err) {
      alert(`Failed to unlink: ${err.message}`);
    }
  };

  const handleUnlinkChapter = async (chapterId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/unlink-chapter/${chapterId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) onEventUpdate();
    } catch (err) {
      alert(`Failed to unlink: ${err.message}`);
    }
  };

  const handleUnlinkSection = async (sectionId) => {
    try {
      const response = await fetch(`/api/books/history-events/${event.id}/unlink-section/${sectionId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) onEventUpdate();
    } catch (err) {
      alert(`Failed to unlink: ${err.message}`);
    }
  };

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
    { id: 'books', label: '📚 Books', icon: '📚', count: event.bookLinks?.length || 0 },
    { id: 'chapters', label: '📖 Chapters', icon: '📖', count: event.bookChapters?.length || 0 },
    { id: 'sections', label: '📄 Sections', icon: '📄', count: event.bookSections?.length || 0 },
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
                <div className="summary-number">{event.bookLinks?.length || 0}</div>
                <p>Historical books and texts</p>
              </div>
              <div className="summary-card">
                <h3>📖 Chapters</h3>
                <div className="summary-number">{event.bookChapters?.length || 0}</div>
                <p>Book chapters</p>
              </div>
              <div className="summary-card">
                <h3>📄 Sections</h3>
                <div className="summary-number">{event.bookSections?.length || 0}</div>
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
              <h2>📚 Books ({event.bookLinks?.length || 0})</h2>
              <button className="add-button" onClick={() => openBookLinker('book')}>
                ➕ Add Book
              </button>
            </div>
            
            {event.bookLinks && event.bookLinks.length > 0 ? (
              <div className="content-grid">
                {event.bookLinks.map(link => {
                  const book = link.book;
                  const isRead = book.bookCompletions?.[0]?.isCompleted;
                  return (
                    <div key={link.id} className="content-card">
                      <div className="content-header">
                        <h4>{book.title}</h4>
                        {isRead && <span className="read-badge">✅ Read</span>}
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
                        <button className="view-button" onClick={() => handleUnlinkBook(book.id)}>
                          🗑️ Unlink
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📚</div>
                <h3>No Books Added</h3>
                <p>Add books related to this historical event to track your reading progress.</p>
                <button className="add-first-button" onClick={() => openBookLinker('book')}>
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
                      {video.user_video_watches?.watched && (
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
                      {!video.user_video_watches?.watched && (
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
              <h2>📖 Chapters ({event.bookChapters?.length || 0})</h2>
              <button className="add-button" onClick={() => openBookLinker('chapter')}>
                ➕ Add Chapter
              </button>
            </div>
            
            {event.bookChapters && event.bookChapters.length > 0 ? (
              <div className="content-grid">
                {event.bookChapters.map(chapter => {
                  const isRead = chapter.chapterCompletions?.[0]?.isCompleted;
                  return (
                    <div key={chapter.id} className="content-card">
                      <div className="content-header">
                        <h4>Chapter {chapter.chapterNumber}: {chapter.title}</h4>
                        {isRead && <span className="read-badge">✅ Read</span>}
                      </div>
                      <div className="chapter-meta">
                        <span className="book-title">📚 {chapter.book?.title}</span>
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
                        <button className="view-button" onClick={() => handleUnlinkChapter(chapter.id)}>
                          🗑️ Unlink
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📖</div>
                <h3>No Chapters Linked</h3>
                <p>Link specific chapters from your books to this historical event.</p>
                <button className="add-first-button" onClick={() => openBookLinker('chapter')}>
                  ➕ Add First Chapter
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="sections-tab">
            <div className="tab-header">
              <h2>📄 Sections ({event.bookSections?.length || 0})</h2>
              <button className="add-button" onClick={() => openBookLinker('section')}>
                ➕ Add Section
              </button>
            </div>
            
            {event.bookSections && event.bookSections.length > 0 ? (
              <div className="content-grid">
                {event.bookSections.map(section => {
                  const isRead = section.sectionCompletions?.[0]?.isCompleted;
                  return (
                    <div key={section.id} className="content-card">
                      <div className="content-header">
                        <h4>Section {section.sectionNumber}: {section.title}</h4>
                        {isRead && <span className="read-badge">✅ Read</span>}
                      </div>
                      <div className="section-meta">
                        <span className="book-title">📚 {section.chapter?.book?.title}</span>
                        <span className="chapter-title">📖 Ch. {section.chapter?.chapterNumber}: {section.chapter?.title}</span>
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
                        <button className="view-button" onClick={() => handleUnlinkSection(section.id)}>
                          🗑️ Unlink
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-content">
                <div className="empty-icon">📄</div>
                <h3>No Sections Linked</h3>
                <p>Link specific sections from your books to this historical event.</p>
                <button className="add-first-button" onClick={() => openBookLinker('section')}>
                  ➕ Add First Section
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Book/Chapter/Section Linker Modal */}
      {showBookLinker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-2">
              {linkType === 'book' ? 'Link a Book' : linkType === 'chapter' ? 'Link a Chapter' : 'Link a Section'}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {linkType === 'book' 
                ? 'Select a book from your library to link to this event.'
                : linkType === 'chapter'
                ? 'Select a book, then choose a chapter to link.'
                : 'Select a book, then a chapter, then a section to link.'}
            </p>
            <input
              type="text"
              placeholder="Search books..."
              value={bookSearchQuery}
              onChange={(e) => setBookSearchQuery(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            />
            <div className="flex-1 overflow-y-auto min-h-0">
              {booksLoading ? (
                <p className="text-center text-gray-500 py-4">Loading books...</p>
              ) : linkType === 'book' ? (
                <div className="space-y-1">
                  {allBooks
                    .filter(b => !bookSearchQuery || b.title?.toLowerCase().includes(bookSearchQuery.toLowerCase()) || b.author?.toLowerCase().includes(bookSearchQuery.toLowerCase()))
                    .map(book => (
                      <button
                        key={book.id}
                        onClick={() => handleLinkBook(book.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                      >
                        <div className="font-medium text-sm">{book.title}</div>
                        {book.author && <div className="text-xs text-gray-500">by {book.author}</div>}
                      </button>
                    ))}
                </div>
              ) : !selectedLinkBook ? (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Step 1: Select a book</p>
                  {allBooks
                    .filter(b => !bookSearchQuery || b.title?.toLowerCase().includes(bookSearchQuery.toLowerCase()))
                    .filter(b => b.chapters && b.chapters.length > 0)
                    .map(book => (
                      <button
                        key={book.id}
                        onClick={() => setSelectedLinkBook(book)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                      >
                        <div className="font-medium text-sm">{book.title}</div>
                        {book.author && <div className="text-xs text-gray-500">by {book.author} · {book.chapters?.length || 0} chapters</div>}
                      </button>
                    ))}
                </div>
              ) : linkType === 'chapter' ? (
                <div className="space-y-1">
                  <button onClick={() => setSelectedLinkBook(null)} className="text-xs text-blue-600 hover:underline mb-2">
                    ← Back to books
                  </button>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Step 2: Select a chapter from "{selectedLinkBook.title}"</p>
                  {(selectedLinkBook.chapters || []).map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => handleLinkChapter(chapter.id)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                    >
                      <div className="font-medium text-sm">Chapter {chapter.chapterNumber}: {chapter.title}</div>
                      {chapter.pageStart && <div className="text-xs text-gray-500">Pages {chapter.pageStart}-{chapter.pageEnd}</div>}
                    </button>
                  ))}
                </div>
              ) : !selectedLinkChapter ? (
                <div className="space-y-1">
                  <button onClick={() => setSelectedLinkBook(null)} className="text-xs text-blue-600 hover:underline mb-2">
                    ← Back to books
                  </button>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Step 2: Select a chapter from "{selectedLinkBook.title}"</p>
                  {(selectedLinkBook.chapters || [])
                    .filter(ch => ch.sections && ch.sections.length > 0)
                    .map(chapter => (
                      <button
                        key={chapter.id}
                        onClick={() => setSelectedLinkChapter(chapter)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                      >
                        <div className="font-medium text-sm">Chapter {chapter.chapterNumber}: {chapter.title}</div>
                        <div className="text-xs text-gray-500">{chapter.sections?.length || 0} sections</div>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <button onClick={() => setSelectedLinkChapter(null)} className="text-xs text-blue-600 hover:underline mb-2">
                    ← Back to chapters
                  </button>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Step 3: Select a section from "Ch. {selectedLinkChapter.chapterNumber}: {selectedLinkChapter.title}"</p>
                  {(selectedLinkChapter.sections || []).map(section => (
                    <button
                      key={section.id}
                      onClick={() => handleLinkSection(section.id)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                    >
                      <div className="font-medium text-sm">Section {section.sectionNumber}: {section.title}</div>
                      {section.pageStart && <div className="text-xs text-gray-500">Pages {section.pageStart}-{section.pageEnd}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4 border-t mt-3">
              <button
                onClick={() => { setShowBookLinker(false); setSelectedLinkBook(null); setSelectedLinkChapter(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetail;
