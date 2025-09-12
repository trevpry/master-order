import React, { useState, useEffect } from 'react';
import { Plus, Book, FileText, List, CheckCircle, Circle, Edit, Calendar, ExternalLink, Search } from 'lucide-react';
import '../styles/Books.css';

const Books = () => {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showBookSearchImport, setShowBookSearchImport] = useState(false);
  
  // Editing states
  const [editingBook, setEditingBook] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  
  // Linked events states
  const [linkedEvents, setLinkedEvents] = useState({});
  const [showLinkedEvents, setShowLinkedEvents] = useState({});
  const [eventCounts, setEventCounts] = useState({});

  // Fetch books on component mount
  useEffect(() => {
    fetchBooks();
  }, []);

  // Fetch all books
  const fetchBooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/history-plus/books');
      const data = await response.json();
      const booksData = data.books || [];
      setBooks(booksData);
      
      // Fetch event counts for all books
      booksData.forEach(book => {
        fetchEventCount('book', book.id);
      });
    } catch (err) {
      setError('Failed to fetch books');
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch book details with chapters and sections
  const fetchBookDetails = async (bookId) => {
    try {
      const response = await fetch(`/api/history-plus/books/${bookId}`);
      const data = await response.json();
      setSelectedBook(data);
      setSelectedChapter(null); // Reset chapter selection
      
      // Fetch event counts for chapters
      if (data.chapters) {
        data.chapters.forEach(chapter => {
          fetchEventCount('chapter', chapter.id);
        });
      }
    } catch (err) {
      console.error('Error fetching book details:', err);
    }
  };

  // Fetch chapter details with sections
  const fetchChapterDetails = async (chapterId) => {
    try {
      const response = await fetch(`/api/history-plus/chapters/${chapterId}`);
      const data = await response.json();
      setSelectedChapter(data);
      
      // Fetch event counts for sections
      if (data.sections) {
        data.sections.forEach(section => {
          fetchEventCount('section', section.id);
        });
      }
    } catch (err) {
      console.error('Error fetching chapter details:', err);
    }
  };

  // Fetch event count for a given type and ID
  const fetchEventCount = async (type, id) => {
    try {
      const response = await fetch(`/api/history-plus/events?${type}Id=${id}`);
      const data = await response.json();
      setEventCounts(prev => ({
        ...prev,
        [`${type}_${id}`]: data.events ? data.events.length : 0
      }));
    } catch (err) {
      console.error('Error fetching event count:', err);
    }
  };

  // Toggle read status for book, chapter, or section
  const toggleReadStatus = async (type, id) => {
    try {
      const endpoint = `/api/history-plus/${type}s/${id}/toggle-read`;
      const response = await fetch(endpoint, { method: 'POST' });
      
      if (response.ok) {
        // Refresh appropriate data
        if (type === 'book') {
          fetchBooks();
          if (selectedBook?.id === id) {
            fetchBookDetails(id);
          }
        } else if (type === 'chapter') {
          if (selectedBook) {
            fetchBookDetails(selectedBook.id);
          }
        } else if (type === 'section') {
          if (selectedChapter) {
            fetchChapterDetails(selectedChapter.id);
          }
        }
      }
    } catch (err) {
      console.error('Error toggling read status:', err);
    }
  };

  // Toggle linked events visibility
  const toggleLinkedEvents = async (type, id) => {
    const key = `${type}_${id}`;
    
    if (!showLinkedEvents[key]) {
      // Fetch linked events
      try {
        const response = await fetch(`/api/history-plus/events?${type}Id=${id}`);
        const data = await response.json();
        setLinkedEvents(prev => ({
          ...prev,
          [key]: data.events || []
        }));
      } catch (err) {
        console.error('Error fetching linked events:', err);
      }
    }
    
    setShowLinkedEvents(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className="books-page">
        <div className="loading-container">
          <div className="loading-text">Loading books...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="books-page">
        <div className="error-container">
          <div className="error-text">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="books-page">
      <div className="books-header">
        <h1 className="books-title">Books</h1>
        
        {/* Summary Stats */}
        <div className="books-stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-header">
              <Book className="stat-icon" />
              <span className="stat-label">Total Books</span>
            </div>
            <div className="stat-value">{books.length}</div>
          </div>
          
          <div className="stat-card stat-card-green">
            <div className="stat-header">
              <CheckCircle className="stat-icon" />
              <span className="stat-label">Books Read</span>
            </div>
            <div className="stat-value">
              {books.filter(book => book.read).length}
            </div>
          </div>
          
          <div className="stat-card stat-card-purple">
            <div className="stat-header">
              <FileText className="stat-icon" />
              <span className="stat-label">Total Chapters</span>
            </div>
            <div className="stat-value">
              {books.reduce((sum, book) => sum + (book.stats?.chaptersTotal || 0), 0)}
            </div>
          </div>
          
          <div className="stat-card stat-card-orange">
            <div className="stat-header">
              <List className="stat-icon" />
              <span className="stat-label">Total Sections</span>
            </div>
            <div className="stat-value">
              {books.reduce((sum, book) => sum + (book.stats?.sectionsTotal || 0), 0)}
            </div>
          </div>
        </div>
        
        <div className="books-actions">
          <button 
            onClick={() => setShowCreateBook(true)}
            className="btn btn-primary"
          >
            <Plus className="btn-icon" />
            Add Book
          </button>
          <button 
            onClick={() => setShowBookSearchImport(true)}
            className="btn btn-outline"
          >
            <Search className="btn-icon" />
            Import from Open Library
          </button>
        </div>
      </div>

      <div className="books-content">
        {/* Books List */}
        <div className="books-section">
          <h2 className="section-title">
            <Book className="section-icon" />
            Books ({books.length})
          </h2>
          
          <div className="books-list">
            {books.length > 0 ? (
              books.map((book) => (
                <div
                  key={book.id}
                  className={`book-card ${selectedBook?.id === book.id ? 'selected' : ''}`}
                >
                  <div className="book-content" onClick={() => fetchBookDetails(book.id)}>
                    <h3 className="book-title">{book.title}</h3>
                    <p className="book-author">{book.author}</p>
                    {book.description && (
                      <p className="book-description">{book.description}</p>
                    )}
                    {book.stats && (
                      <div className="book-progress">
                        <div className="progress-header">
                          <span>Progress</span>
                          <span>{book.stats.progressPercentage}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${book.stats.progressPercentage}%` }}
                          ></div>
                        </div>
                        <div className="progress-details">
                          <span>{book.stats.chaptersRead}/{book.stats.chaptersTotal} chapters</span>
                          <span>{book.stats.sectionsRead}/{book.stats.sectionsTotal} sections</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="book-actions">
                    <button
                      onClick={() => setEditingBook(book)}
                      className="action-btn"
                      title="Edit book"
                    >
                      <Edit className="action-icon" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReadStatus('book', book.id);
                      }}
                      className="action-btn"
                    >
                      {book.read ? (
                        <CheckCircle className="action-icon read" />
                      ) : (
                        <Circle className="action-icon unread" />
                      )}
                    </button>
                  </div>
                  
                  {/* Linked Events Section */}
                  {eventCounts[`book_${book.id}`] > 0 && (
                    <div className="linked-events-section">
                      <button
                        onClick={() => toggleLinkedEvents('book', book.id)}
                        className="linked-events-toggle"
                      >
                        <Calendar className="linked-events-icon" />
                        {showLinkedEvents[`book_${book.id}`] ? 'Hide' : 'Show'} Linked Events ({eventCounts[`book_${book.id}`]})
                      </button>
                      
                      {showLinkedEvents[`book_${book.id}`] && (
                        <div className="linked-events-content">
                          <LinkedEvents 
                            events={linkedEvents[`book_${book.id}`]} 
                            type="book" 
                            id={book.id} 
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Book className="empty-icon" />
                <p>No books yet</p>
                <p className="empty-subtitle">Click "Add Book" to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Chapters List */}
        <div className="chapters-section">
          <div className="section-header">
            <h2 className="section-title">
              <FileText className="section-icon" />
              Chapters
            </h2>
            {selectedBook && (
              <button
                onClick={() => setShowCreateChapter(true)}
                className="btn btn-sm btn-primary"
              >
                <Plus className="btn-icon" />
                Add Chapter
              </button>
            )}
          </div>
          
          {selectedBook ? (
            <div className="chapters-list">
              <div className="selected-book-info">
                <strong>{selectedBook.title}</strong> by {selectedBook.author}
              </div>
              
              {selectedBook.chapters && selectedBook.chapters.length > 0 ? (
                selectedBook.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className={`chapter-card ${selectedChapter?.id === chapter.id ? 'selected' : ''}`}
                  >
                    <div className="chapter-content" onClick={() => fetchChapterDetails(chapter.id)}>
                      <h4 className="chapter-title">
                        Chapter {chapter.chapterNumber}: {chapter.title}
                      </h4>
                      {chapter.description && (
                        <p className="chapter-description">{chapter.description}</p>
                      )}
                      <div className="chapter-meta">
                        {chapter._count?.sections || 0} sections
                      </div>
                    </div>
                    
                    <div className="chapter-actions">
                      <button
                        onClick={() => setEditingChapter(chapter)}
                        className="action-btn"
                        title="Edit chapter"
                      >
                        <Edit className="action-icon" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReadStatus('chapter', chapter.id);
                        }}
                        className="action-btn"
                      >
                        {chapter.read ? (
                          <CheckCircle className="action-icon read" />
                        ) : (
                          <Circle className="action-icon unread" />
                        )}
                      </button>
                    </div>
                    
                    {/* Linked Events Section */}
                    {eventCounts[`chapter_${chapter.id}`] > 0 && (
                      <div className="linked-events-section">
                        <button
                          onClick={() => toggleLinkedEvents('chapter', chapter.id)}
                          className="linked-events-toggle"
                        >
                          <Calendar className="linked-events-icon" />
                          {showLinkedEvents[`chapter_${chapter.id}`] ? 'Hide' : 'Show'} Linked Events ({eventCounts[`chapter_${chapter.id}`]})
                        </button>
                        
                        {showLinkedEvents[`chapter_${chapter.id}`] && (
                          <div className="linked-events-content">
                            <LinkedEvents 
                              events={linkedEvents[`chapter_${chapter.id}`]} 
                              type="chapter" 
                              id={chapter.id} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <FileText className="empty-icon" />
                  <p>No chapters yet</p>
                  <p className="empty-subtitle">Click "Add Chapter" to get started</p>
                </div>
              )}
            </div>
          ) : (
            <div className="select-prompt">
              Select a book to view its chapters
            </div>
          )}
        </div>

        {/* Sections List */}
        <div className="sections-section">
          <div className="section-header">
            <h2 className="section-title">
              <List className="section-icon" />
              Sections
            </h2>
            {selectedChapter && (
              <button
                onClick={() => setShowCreateSection(true)}
                className="btn btn-sm btn-primary"
              >
                <Plus className="btn-icon" />
                Add Section
              </button>
            )}
          </div>
          
          {selectedChapter ? (
            <div className="sections-list">
              {selectedChapter.sections && selectedChapter.sections.length > 0 ? (
                selectedChapter.sections.map((section) => (
                  <div key={section.id} className="section-card">
                    <div className="section-content">
                      <h5 className="section-title">
                        Section {section.sectionNumber}: {section.title}
                      </h5>
                      {section.description && (
                        <p className="section-description">{section.description}</p>
                      )}
                    </div>
                    
                    <div className="section-actions">
                      <button
                        onClick={() => setEditingSection(section)}
                        className="action-btn"
                        title="Edit section"
                      >
                        <Edit className="action-icon" />
                      </button>
                      <button
                        onClick={() => toggleReadStatus('section', section.id)}
                        className="action-btn"
                      >
                        {section.read ? (
                          <CheckCircle className="action-icon read" />
                        ) : (
                          <Circle className="action-icon unread" />
                        )}
                      </button>
                    </div>
                    
                    {/* Linked Events Section */}
                    {eventCounts[`section_${section.id}`] > 0 && (
                      <div className="linked-events-section">
                        <button
                          onClick={() => toggleLinkedEvents('section', section.id)}
                          className="linked-events-toggle"
                        >
                          <Calendar className="linked-events-icon" />
                          {showLinkedEvents[`section_${section.id}`] ? 'Hide' : 'Show'} Linked Events ({eventCounts[`section_${section.id}`]})
                        </button>
                        
                        {showLinkedEvents[`section_${section.id}`] && (
                          <div className="linked-events-content">
                            <LinkedEvents 
                              events={linkedEvents[`section_${section.id}`]} 
                              type="section" 
                              id={section.id} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <List className="empty-icon" />
                  <p>No sections yet</p>
                  <p className="empty-subtitle">Click "Add Section" to get started</p>
                </div>
              )}
            </div>
          ) : (
            <div className="select-prompt">
              Select a chapter to view its sections
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateBook && (
        <CreateBookModal
          onClose={() => setShowCreateBook(false)}
          onBookCreated={fetchBooks}
        />
      )}

      {showCreateChapter && selectedBook && (
        <CreateChapterModal
          bookId={selectedBook.id}
          onClose={() => setShowCreateChapter(false)}
          onChapterCreated={() => fetchBookDetails(selectedBook.id)}
        />
      )}

      {showCreateSection && selectedChapter && (
        <CreateSectionModal
          chapterId={selectedChapter.id}
          onClose={() => setShowCreateSection(false)}
          onSectionCreated={() => fetchChapterDetails(selectedChapter.id)}
        />
      )}

      {editingBook && (
        <EditBookModal
          book={editingBook}
          onClose={() => setEditingBook(null)}
          onBookUpdated={() => {
            fetchBooks();
            if (selectedBook?.id === editingBook.id) {
              fetchBookDetails(editingBook.id);
            }
          }}
        />
      )}

      {editingChapter && (
        <EditChapterModal
          chapter={editingChapter}
          onClose={() => setEditingChapter(null)}
          onChapterUpdated={() => {
            if (selectedBook) {
              fetchBookDetails(selectedBook.id);
            }
          }}
        />
      )}

      {editingSection && (
        <EditSectionModal
          section={editingSection}
          onClose={() => setEditingSection(null)}
          onSectionUpdated={() => {
            if (selectedChapter) {
              fetchChapterDetails(selectedChapter.id);
            }
          }}
        />
      )}

      {showBookSearchImport && (
        <BookSearchImportModal
          onClose={() => setShowBookSearchImport(false)}
          onBookImported={(book) => {
            fetchBooks();
            setShowBookSearchImport(false);
          }}
        />
      )}
    </div>
  );
};

// Linked Events Component
const LinkedEvents = ({ events, type, id }) => {
  if (!events || events.length === 0) {
    return (
      <div className="no-events">
        No linked events found
      </div>
    );
  }

  return (
    <div className="linked-events-list">
      <div className="linked-events-header">
        Linked Events ({events.length})
      </div>
      {events.map((event) => (
        <div key={event.id} className="linked-event-item">
          <div className="event-content">
            <div className="event-title">{event.title}</div>
            <div className="event-date">
              {event.startDate}{event.endDate && ` - ${event.endDate}`}
            </div>
            <div className="event-category">{event.category}</div>
          </div>
          <div className="event-actions">
            {event.reviewed && (
              <CheckCircle className="event-reviewed" />
            )}
            <ExternalLink className="event-link" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Create Book Modal Component
const CreateBookModal = ({ onClose, onBookCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    isbn: '',
    publisher: '',
    publishYear: '',
    pageCount: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author) return;

    setSaving(true);
    try {
      const response = await fetch('/api/history-plus/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onBookCreated();
        onClose();
      } else {
        throw new Error('Failed to create book');
      }
    } catch (err) {
      console.error('Error creating book:', err);
      alert('Failed to create book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Add New Book</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Author *</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="3"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ISBN</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Publisher</label>
              <input
                type="text"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Publish Year</label>
              <input
                type="number"
                value={formData.publishYear}
                onChange={(e) => setFormData({ ...formData, publishYear: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Page Count</label>
              <input
                type="number"
                value={formData.pageCount}
                onChange={(e) => setFormData({ ...formData, pageCount: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Creating...' : 'Create Book'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Chapter Modal Component
const CreateChapterModal = ({ bookId, onClose, onChapterCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    chapterNumber: '',
    pageStart: '',
    pageEnd: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    setSaving(true);
    try {
      const chapterData = { ...formData, bookId };
      
      const response = await fetch('/api/history-plus/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chapterData)
      });

      if (response.ok) {
        onChapterCreated();
        onClose();
      } else {
        throw new Error('Failed to create chapter');
      }
    } catch (err) {
      console.error('Error creating chapter:', err);
      alert('Failed to create chapter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Add New Chapter</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Chapter Number</label>
            <input
              type="number"
              value={formData.chapterNumber}
              onChange={(e) => setFormData({ ...formData, chapterNumber: e.target.value })}
              className="form-input"
              placeholder="Auto-generated if not provided"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Page</label>
              <input
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">End Page</label>
              <input
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Creating...' : 'Create Chapter'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Section Modal Component
const CreateSectionModal = ({ chapterId, onClose, onSectionCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sectionNumber: '',
    pageStart: '',
    pageEnd: '',
    content: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    setSaving(true);
    try {
      const sectionData = { ...formData, chapterId };
      
      const response = await fetch('/api/history-plus/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionData)
      });

      if (response.ok) {
        onSectionCreated();
        onClose();
      } else {
        throw new Error('Failed to create section');
      }
    } catch (err) {
      console.error('Error creating section:', err);
      alert('Failed to create section');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Add New Section</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="2"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Section Number</label>
            <input
              type="number"
              value={formData.sectionNumber}
              onChange={(e) => setFormData({ ...formData, sectionNumber: e.target.value })}
              className="form-input"
              placeholder="Auto-generated if not provided"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Page</label>
              <input
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">End Page</label>
              <input
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="form-textarea"
              rows="3"
              placeholder="Optional notes or content summary"
            />
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Creating...' : 'Create Section'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Book Modal Component
const EditBookModal = ({ book, onClose, onBookUpdated }) => {
  const [formData, setFormData] = useState({
    title: book.title || '',
    author: book.author || '',
    description: book.description || '',
    isbn: book.isbn || '',
    publisher: book.publisher || '',
    publishYear: book.publishYear || '',
    pageCount: book.pageCount || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/history-plus/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onBookUpdated();
        onClose();
      } else {
        throw new Error('Failed to update book');
      }
    } catch (err) {
      console.error('Error updating book:', err);
      alert('Failed to update book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Edit Book</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Author *</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="3"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ISBN</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Publisher</label>
              <input
                type="text"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Publish Year</label>
              <input
                type="number"
                value={formData.publishYear}
                onChange={(e) => setFormData({ ...formData, publishYear: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Page Count</label>
              <input
                type="number"
                value={formData.pageCount}
                onChange={(e) => setFormData({ ...formData, pageCount: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Updating...' : 'Update Book'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Chapter Modal Component
const EditChapterModal = ({ chapter, onClose, onChapterUpdated }) => {
  const [formData, setFormData] = useState({
    title: chapter.title || '',
    description: chapter.description || '',
    chapterNumber: chapter.chapterNumber || '',
    pageStart: chapter.pageStart || '',
    pageEnd: chapter.pageEnd || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/history-plus/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onChapterUpdated();
        onClose();
      } else {
        throw new Error('Failed to update chapter');
      }
    } catch (err) {
      console.error('Error updating chapter:', err);
      alert('Failed to update chapter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Edit Chapter</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Chapter Number</label>
            <input
              type="number"
              value={formData.chapterNumber}
              onChange={(e) => setFormData({ ...formData, chapterNumber: e.target.value })}
              className="form-input"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Page</label>
              <input
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">End Page</label>
              <input
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Updating...' : 'Update Chapter'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Section Modal Component
const EditSectionModal = ({ section, onClose, onSectionUpdated }) => {
  const [formData, setFormData] = useState({
    title: section.title || '',
    description: section.description || '',
    sectionNumber: section.sectionNumber || '',
    pageStart: section.pageStart || '',
    pageEnd: section.pageEnd || '',
    content: section.content || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/history-plus/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSectionUpdated();
        onClose();
      } else {
        throw new Error('Failed to update section');
      }
    } catch (err) {
      console.error('Error updating section:', err);
      alert('Failed to update section');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Edit Section</h3>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows="2"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Section Number</label>
            <input
              type="number"
              value={formData.sectionNumber}
              onChange={(e) => setFormData({ ...formData, sectionNumber: e.target.value })}
              className="form-input"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Page</label>
              <input
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: e.target.value })}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">End Page</label>
              <input
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="form-textarea"
              rows="3"
              placeholder="Optional notes or content summary"
            />
          </div>
          
          <div className="modal-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Updating...' : 'Update Section'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Book Search Import Modal Component
const BookSearchImportModal = ({ onClose, onBookImported }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Import from Open Library</h3>
        <p>Book import functionality coming soon...</p>
        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
};

export default Books;
