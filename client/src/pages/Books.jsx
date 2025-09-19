/**
 * Unified Books Page
 * 
 * Main books management interface for the unified book system.
 * Displays books from all sources (Custom Orders, History Plus, standalone)
 * with comprehensive functionality for reading, progress tracking, and management.
 * 
 * Features:
 * - Book browsing with search and filtering
 * - Chapter and section navigation
 * - Progress tracking and completion
 * - Reading session management
 * - Integration with Custom Orders and History Plus
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Book, 
  FileText, 
  List, 
  CheckCircle, 
  Circle, 
  Edit, 
  Calendar, 
  ExternalLink, 
  Search, 
  BarChart3, 
  Clock, 
  Target,
  PlayCircle,
  PauseCircle,
  BookOpen,
  Bookmark,
  Filter,
  SortAsc,
  Eye,
  Download,
  Trash2
} from 'lucide-react';
import readingSessionService from '../services/readingSessionService';

const Books = () => {
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    author: '',
    genre: '',
    completed: '',
    hasChapters: ''
  });
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [activeReadingSession, setActiveReadingSession] = useState(null);
  
  // Editing states
  const [editingBook, setEditingBook] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [editingSection, setEditingSection] = useState(null);

  // Book re-selection states
  const [showBookReselection, setShowBookReselection] = useState(false);
  const [reselectingBook, setReselectingBook] = useState(null);
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);
  
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: ''
  });

  // Statistics
  const [systemStats, setSystemStats] = useState({});

  useEffect(() => {
    fetchBooks();
    fetchSystemStats();
    checkActiveReadingSession(); // Check for active reading session on load
  }, [searchQuery, filters, sortBy, sortOrder, currentPage]);

  // Handle book ID from URL parameter
  useEffect(() => {
    const bookId = searchParams.get('id');
    if (bookId && books.length > 0) {
      const book = books.find(b => b.id === parseInt(bookId));
      if (book) {
        setSelectedBook(book);
      }
    }
  }, [searchParams, books]);

  // Add window focus and visibility listeners for reading session synchronization
  useEffect(() => {
    const handleFocus = () => {
      console.log('Books page gained focus, checking for active reading session and refreshing book data...');
      checkActiveReadingSession();
      fetchBooks(); // Refresh book list to show updated progress
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Books page became visible, checking for active reading session and refreshing book data...');
        checkActiveReadingSession();
        fetchBooks(); // Refresh book list to show updated progress
      }
    };

    // Add event listeners
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array - only set up listeners once

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        sortBy,
        sortOrder,
        ...(searchQuery && { search: searchQuery }),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await fetch(`/api/books?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setBooks(data.data.books || []);
        setTotalPages(Math.ceil((data.data.total || 0) / 20));
      } else {
        throw new Error(data.error || 'Failed to fetch books');
      }
    } catch (err) {
      setError(`Failed to fetch books: ${err.message}`);
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/books/stats');
      const data = await response.json();
      if (data.success) {
        setSystemStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  };

  const fetchBookDetails = async (bookId) => {
    try {
      const response = await fetch(`/api/books/${bookId}?includeChapters=true&includeProgress=true`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedBook(data.data);
        setSelectedChapter(null);
      } else {
        throw new Error(data.error || 'Failed to fetch book details');
      }
    } catch (err) {
      console.error('Error fetching book details:', err);
      setError(`Failed to fetch book details: ${err.message}`);
    }
  };

  const deleteBook = async (bookId) => {
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove book from the list
        setBooks(books.filter(book => book.id !== bookId));
        // Clear selected book if it was the deleted one
        if (selectedBook?.id === bookId) {
          setSelectedBook(null);
        }
        setShowDeleteConfirm(false);
        setBookToDelete(null);
      } else {
        throw new Error(data.error || 'Failed to delete book');
      }
    } catch (err) {
      console.error('Error deleting book:', err);
      setError(`Failed to delete book: ${err.message}`);
    }
  };

  const confirmDelete = (book) => {
    setBookToDelete(book);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setBookToDelete(null);
  };

  // ==========================================
  // UNIFIED READING SESSION FUNCTIONS
  // ==========================================

  const checkActiveReadingSession = async () => {
    try {
      const activeSession = await readingSessionService.getActiveSession();
      setActiveReadingSession(activeSession);
    } catch (error) {
      console.error('Error checking active reading session:', error);
      // Don't show error for no active session
      if (!error.message.includes('No active reading session')) {
        setError(`Failed to check active reading session: ${error.message}`);
      }
    }
  };

  const startReadingSession = async (bookId, chapterId = null, sectionId = null) => {
    try {
      if (!selectedBook) {
        throw new Error('No book selected');
      }

      // Create session parameters using the service helper
      const sessionParams = readingSessionService.createSessionParams(
        selectedBook,
        chapterId ? selectedBook.chapters?.find(c => c.id === chapterId) : null,
        sectionId ? selectedBook.chapters?.flatMap(c => c.sections).find(s => s.id === sectionId) : null
      );

      const session = await readingSessionService.startSession(sessionParams);
      setActiveReadingSession(session);
      
      console.log('Reading session started:', session.id);
    } catch (err) {
      console.error('Error starting reading session:', err);
      setError(`Failed to start reading session: ${err.message}`);
    }
  };

  const pauseResumeReadingSession = async () => {
    try {
      const updatedSession = await readingSessionService.pauseResumeSession();
      setActiveReadingSession(updatedSession);
      
      console.log('Reading session paused/resumed:', updatedSession.id);
    } catch (err) {
      console.error('Error pausing/resuming reading session:', err);
      setError(`Failed to pause/resume reading session: ${err.message}`);
    }
  };

  const stopReadingSession = async (progressData = {}) => {
    try {
      const completedSession = await readingSessionService.stopSession(progressData);
      setActiveReadingSession(null);
      
      // Refresh book details to show updated progress
      if (selectedBook) {
        fetchBookDetails(selectedBook.id);
      }
      fetchBooks(); // Refresh main list
      
      console.log('Reading session stopped:', completedSession);
    } catch (err) {
      console.error('Error stopping reading session:', err);
      setError(`Failed to stop reading session: ${err.message}`);
    }
  };

  const toggleCompletion = async (type, id) => {
    try {
      let url;
      let isHistoryPlus = false;
      
      // Determine if this specific content is History Plus by checking for event associations
      if (type === 'book' && selectedBook) {
        // For books, check if ANY chapter has an event (indicating this is a History Plus book)
        isHistoryPlus = selectedBook.chapters && selectedBook.chapters.some(chapter => chapter.event);
      } else if (type === 'chapter' && selectedBook) {
        // For chapters, check if THIS specific chapter has an event
        const chapter = selectedBook.chapters?.find(c => c.id === id);
        isHistoryPlus = chapter && chapter.event;
      } else if (type === 'section' && selectedBook) {
        // For sections, check if the parent chapter has an event
        const parentChapter = selectedBook.chapters?.find(chapter => 
          chapter.sections?.some(section => section.id === id)
        );
        isHistoryPlus = parentChapter && parentChapter.event;
      }

      // Choose endpoint based on whether it's History Plus content
      if (isHistoryPlus) {
        // Use History Plus toggle endpoints (which now use unified completion system)
        switch (type) {
          case 'book':
            url = `/api/history-plus/books/${id}/toggle-read`;
            break;
          case 'chapter':
            url = `/api/history-plus/chapters/${id}/toggle-read`;
            break;
          case 'section':
            url = `/api/history-plus/sections/${id}/toggle-read`;
            break;
          default:
            throw new Error('Invalid completion type');
        }
      } else {
        // Use regular books toggle endpoints
        switch (type) {
          case 'book':
            url = `/api/books/${id}/toggle-complete`;
            break;
          case 'chapter':
            url = `/api/books/${selectedBook.id}/chapters/${id}/toggle-complete`;
            break;
          case 'section':
            // Find the chapter that contains this section
            const containingChapter = selectedBook.chapters?.find(chapter => 
              chapter.sections?.some(section => section.id === id)
            );
            if (!containingChapter) {
              throw new Error('Could not find chapter containing this section');
            }
            url = `/api/books/${selectedBook.id}/chapters/${containingChapter.id}/sections/${id}/toggle-complete`;
            break;
          default:
            throw new Error('Invalid completion type');
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        // Refresh relevant data
        if (selectedBook) {
          fetchBookDetails(selectedBook.id);
        }
        fetchBooks();
      } else {
        throw new Error(data.error || 'Failed to toggle completion');
      }
    } catch (err) {
      console.error('Error toggling completion:', err);
      setError(`Failed to toggle completion: ${err.message}`);
    }
  };

  const createBook = async (bookData) => {
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookData)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateBook(false);
        fetchBooks();
        setSelectedBook(data.data);
      } else {
        throw new Error(data.error || 'Failed to create book');
      }
    } catch (err) {
      console.error('Error creating book:', err);
      setError(`Failed to create book: ${err.message}`);
    }
  };

  // BOOK RE-SELECTION FUNCTIONS
  const handleReselectBook = (book) => {
    setReselectingBook(book);
    setBookFormData({
      title: book.title || '',
      author: book.author || '',
      year: book.publishYear ? book.publishYear.toString() : '',
      isbn: book.isbn || ''
    });
    setShowBookReselection(true);
  };

  const searchOpenLibraryBooks = async () => {
    if (!bookFormData.title.trim()) {
      setError('Please enter a book title to search');
      return;
    }

    try {
      setBookSearchLoading(true);
      let searchQuery = bookFormData.title.trim();
      
      if (bookFormData.author.trim()) {
        searchQuery += ` ${bookFormData.author.trim()}`;
      }

      const response = await fetch(`/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setBookSearchResults(data.slice(0, 10)); // Limit to 10 results
      } else {
        throw new Error('Failed to search books');
      }
    } catch (err) {
      console.error('Error searching books:', err);
      setError(`Failed to search books: ${err.message}`);
      setBookSearchResults([]);
    } finally {
      setBookSearchLoading(false);
    }
  };

  const handleSelectBook = async (selectedBook) => {
    try {
      // Fetch detailed book information to get page count
      let pageCount = null;
      if (selectedBook.id) {
        try {
          const bookDetailsResponse = await fetch(`/api/openlibrary/book/${encodeURIComponent(selectedBook.id)}`);
          if (bookDetailsResponse.ok) {
            const bookDetails = await bookDetailsResponse.json();
            pageCount = bookDetails.pageCount || null;
          }
        } catch (error) {
          console.warn(`Failed to fetch page count for ${selectedBook.title}:`, error.message);
        }
      }

      const updateData = {
        title: selectedBook.title,
        author: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
        publishYear: selectedBook.firstPublishYear || null,
        isbn: selectedBook.isbn || null,
        publisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
        openLibraryId: selectedBook.id || null,
        coverUrl: selectedBook.coverUrl || null,
        pageCount: pageCount
      };

      const response = await fetch(`/api/books/${reselectingBook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (data.success) {
        setShowBookReselection(false);
        setReselectingBook(null);
        setBookFormData({ title: '', author: '', year: '', isbn: '' });
        setBookSearchResults([]);
        
        // Refresh the books list
        fetchBooks();
        
        // Update selected book if it's the one we just updated
        if (selectedBook && selectedBook.id === reselectingBook.id) {
          fetchBookDetails(reselectingBook.id);
        }
        
        console.log(`Book updated successfully: "${selectedBook.title}"`);
      } else {
        throw new Error(data.error || 'Failed to update book');
      }
    } catch (err) {
      console.error('Error updating book:', err);
      setError(`Failed to update book: ${err.message}`);
    }
  };

  const renderProgressBar = (progress) => {
    const percentage = progress?.percentageComplete || 0;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className="bg-green-600 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };

  const renderBookCard = (book) => {
    // Check if the book is completed for the current user ("default")
    const userBookCompletion = book.bookCompletions && book.bookCompletions.find(completion => 
      completion.userId === "default"
    );
    const isCompleted = userBookCompletion && userBookCompletion.isCompleted;
    
    return (
    <div 
      key={book.id} 
      className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow relative group ${isCompleted ? 'ring-2 ring-green-200' : ''}`}
    >
      {/* Completion indicator */}
      {isCompleted && (
        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 z-10">
          <CheckCircle className="w-4 h-4" />
        </div>
      )}
      
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          confirmDelete(book);
        }}
        className="absolute top-2 left-2 p-1 text-red-500 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Delete book"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      
      <div 
        className="flex items-start space-x-4 cursor-pointer"
        onClick={() => fetchBookDetails(book.id)}
      >
        {book.coverUrl && (
          <img 
            src={book.coverUrl} 
            alt={book.title}
            className="w-16 h-24 object-cover rounded"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-semibold truncate ${isCompleted ? 'text-green-700' : 'text-gray-900'}`}>
            {book.title}
          </h3>
          {book.author && (
            <p className="text-sm text-gray-600 truncate">by {book.author}</p>
          )}
          {book.publishYear && (
            <p className="text-xs text-gray-500">{book.publishYear}</p>
          )}
          
          {isCompleted && (
            <div className="flex items-center mt-1">
              <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
              <span className="text-xs text-green-600 font-medium">Completed</span>
            </div>
          )}
          
          {book.progress && renderProgressBar(book.progress)}
          
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            {book.stats?.chapterCount > 0 && (
              <span className="flex items-center">
                <FileText className="w-3 h-3 mr-1" />
                {book.stats.chapterCount} chapters
              </span>
            )}
            {(book.pageCount || (book.customOrderItems && book.customOrderItems[0]?.bookPageCount)) && (
              <span className="flex items-center">
                📄 {book.pageCount || book.customOrderItems[0]?.bookPageCount} pages
              </span>
            )}
            {book.sources?.customOrders && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Custom Order</span>
            )}
            {book.customOrderItems && book.customOrderItems.length > 0 && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                📋 Used in {book.customOrderItems.length} order{book.customOrderItems.length !== 1 ? 's' : ''}
              </span>
            )}
            {book.sources?.historyPlus && (
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">History Plus</span>
            )}
            {book.sources?.standalone && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Standalone</span>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderBookDetails = () => {
    if (!selectedBook) return null;

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start space-x-6">
            {selectedBook.coverUrl && (
              <img 
                src={selectedBook.coverUrl} 
                alt={selectedBook.title}
                className="w-32 h-48 object-cover rounded-lg shadow-md"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedBook.title}</h1>
              {selectedBook.author && (
                <p className="text-xl text-gray-600 mb-2">by {selectedBook.author}</p>
              )}
              {selectedBook.description && (
                <p className="text-gray-700 mb-4">{selectedBook.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                {selectedBook.publisher && (
                  <div><span className="font-medium">Publisher:</span> {selectedBook.publisher}</div>
                )}
                {selectedBook.publishYear && (
                  <div><span className="font-medium">Year:</span> {selectedBook.publishYear}</div>
                )}
                {selectedBook.isbn && (
                  <div><span className="font-medium">ISBN:</span> {selectedBook.isbn}</div>
                )}
                {(selectedBook.pageCount || (selectedBook.customOrderItems && selectedBook.customOrderItems[0]?.bookPageCount)) && (
                  <div><span className="font-medium">Pages:</span> {selectedBook.pageCount || selectedBook.customOrderItems[0]?.bookPageCount}</div>
                )}
              </div>

              {/* History Plus Links */}
              {selectedBook.historyBookLinks && selectedBook.historyBookLinks.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Historical Context</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedBook.historyBookLinks.map(link => (
                      <span key={link.id} className="inline-flex items-center text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        <Calendar className="w-3 h-3 mr-1" />
                        🏛️ {link.event.title} ({link.event.startDate})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedBook.progress && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Reading Progress</h4>
                  {renderProgressBar(selectedBook.progress)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-2">
            {activeReadingSession ? (
              <div className="flex flex-col space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800 font-medium">
                    {activeReadingSession.isPaused ? 'Reading Session Paused' : 'Reading Session Active'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {activeReadingSession.title}
                  </p>
                </div>
                
                <button
                  onClick={pauseResumeReadingSession}
                  className={`flex items-center px-4 py-2 rounded-lg ${
                    activeReadingSession.isPaused 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  } text-white`}
                >
                  {activeReadingSession.isPaused ? (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Resume Session
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-4 h-4 mr-2" />
                      Pause Session
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => stopReadingSession()}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Stop Session
                </button>
              </div>
            ) : (
              <button
                onClick={() => startReadingSession(selectedBook.id)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Reading
              </button>
            )}
            
            <button
              onClick={() => toggleCompletion('book', selectedBook.id)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Toggle Complete
            </button>
            
            <button
              onClick={() => confirmDelete(selectedBook)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              title="Delete this book"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Book
            </button>
            
            <button
              onClick={() => handleReselectBook(selectedBook)}
              className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              Re-select Book
            </button>
          </div>
        </div>

        {/* Chapters Section */}
        {selectedBook.chapters && selectedBook.chapters.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Chapters</h3>
            <div className="space-y-3">
              {selectedBook.chapters.map(chapter => {
                // Check if the chapter is completed for the current user ("default")
                const userCompletion = chapter.chapterCompletions && chapter.chapterCompletions.find(completion => 
                  completion.userId === "default"
                );
                const isChapterCompleted = userCompletion && userCompletion.isCompleted;
                
                return (
                <div key={chapter.id} className={`border rounded-lg p-4 hover:bg-gray-50 ${isChapterCompleted ? 'bg-green-50 border-green-200' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        {isChapterCompleted && (
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        )}
                        <h4 className={`font-medium ${isChapterCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                          Chapter {chapter.chapterNumber}: {chapter.title}
                        </h4>
                      </div>
                      {chapter.description && (
                        <p className="text-sm text-gray-600 mt-1">{chapter.description}</p>
                      )}
                      {chapter.pageStart && chapter.pageEnd && (
                        <p className="text-xs text-gray-500 mt-1">
                          Pages {chapter.pageStart}-{chapter.pageEnd}
                        </p>
                      )}
                      {chapter.event && (
                        <div className="flex items-center mt-2">
                          <Calendar className="w-3 h-3 text-blue-500 mr-1" />
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            📚 {chapter.event.title} ({chapter.event.startDate})
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => startReadingSession(selectedBook.id, chapter.id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded"
                        title="Start reading this chapter"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => toggleCompletion('chapter', chapter.id)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                        title="Toggle chapter completion"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sections for this chapter */}
                  {chapter.sections && chapter.sections.length > 0 && (
                    <div className="mt-3 ml-4 space-y-2">
                      {chapter.sections.map(section => {
                        // Check if the section is completed (user-specific completion)
                        const isSectionCompleted = section.completion && section.completion.some(c => c.userId === 'default');
                        
                        return (
                        <div key={section.id} className={`flex items-center justify-between p-2 rounded ${isSectionCompleted ? 'bg-green-100 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex-1">
                            <div className="flex items-center">
                              {isSectionCompleted && (
                                <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                              )}
                              <span className={`text-sm font-medium ${isSectionCompleted ? 'text-green-700' : ''}`}>
                                {section.title}
                              </span>
                            </div>
                            {section.pageStart && section.pageEnd && (
                              <span className="text-xs text-gray-500 ml-2">
                                (p. {section.pageStart}-{section.pageEnd})
                              </span>
                            )}
                            {section.event && (
                              <div className="flex items-center mt-1">
                                <Calendar className="w-3 h-3 text-purple-500 mr-1" />
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                  📖 {section.event.title} ({section.event.startDate})
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => startReadingSession(selectedBook.id, chapter.id, section.id)}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="Start reading this section"
                            >
                              <PlayCircle className="w-3 h-3" />
                            </button>
                            
                            <button
                              onClick={() => toggleCompletion('section', section.id)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Toggle section completion"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Book className="w-8 h-8 mr-3 text-blue-600" />
                Books
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your unified book collection from all sources
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateBook(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Book
            </button>
          </div>

          {/* System Statistics */}
          {systemStats && Object.keys(systemStats).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">{systemStats.totalBooks || 0}</div>
                <div className="text-sm text-gray-600">Total Books</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">{systemStats.completedBooks || 0}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">{systemStats.totalChapters || 0}</div>
                <div className="text-sm text-gray-600">Chapters</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">{systemStats.readingSessions || 0}</div>
                <div className="text-sm text-gray-600">Reading Sessions</div>
              </div>
            </div>
          )}
        </div>

        {/* Active Reading Session Banner */}
        {activeReadingSession && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BookOpen className="w-5 h-5 text-green-600 mr-2" />
                <span className="font-medium text-green-800">
                  Active Reading Session: {activeReadingSession.title}
                </span>
              </div>
              <button
                onClick={() => stopReadingSession()}
                className="text-green-600 hover:text-green-800"
              >
                Stop Session
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search books by title, author, or ISBN..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={filters.completed}
                onChange={(e) => setFilters({...filters, completed: e.target.value})}
              >
                <option value="">All Books</option>
                <option value="true">Completed</option>
                <option value="false">In Progress</option>
              </select>
              
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="title">Sort by Title</option>
                <option value="author">Sort by Author</option>
                <option value="publishYear">Sort by Year</option>
                <option value="createdAt">Sort by Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Books List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Books</h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading books...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={fetchBooks}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : books.length === 0 ? (
              <div className="text-center py-8">
                <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No books found</p>
                <button
                  onClick={() => setShowCreateBook(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Your First Book
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {books.map(renderBookCard)}
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-2 text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Book Details */}
          <div className="lg:col-span-2">
            {selectedBook ? (
              renderBookDetails()
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Select a Book</h3>
                <p className="text-gray-600">Choose a book from the list to view details and start reading</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Book Re-selection Modal */}
      {showBookReselection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Re-select Book</h2>
              <p className="text-gray-600 mt-1">Search OpenLibrary to update book information</p>
            </div>
            
            <div className="p-6">
              {/* Search Form */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={bookFormData.title}
                    onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter book title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                  <input
                    type="text"
                    value={bookFormData.author}
                    onChange={(e) => setBookFormData({ ...bookFormData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter author name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="text"
                    value={bookFormData.year}
                    onChange={(e) => setBookFormData({ ...bookFormData, year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Publication year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ISBN</label>
                  <input
                    type="text"
                    value={bookFormData.isbn}
                    onChange={(e) => setBookFormData({ ...bookFormData, isbn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ISBN"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="mb-6">
                <button
                  onClick={searchOpenLibraryBooks}
                  disabled={bookSearchLoading || !bookFormData.title.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bookSearchLoading ? 'Searching...' : 'Search OpenLibrary'}
                </button>
              </div>

              {/* Search Results */}
              {bookSearchResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Search Results</h3>
                  <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                    {bookSearchResults.map((book, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start space-x-4">
                          {book.coverUrl && (
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-16 h-24 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{book.title}</h4>
                            {book.authors && book.authors.length > 0 && (
                              <p className="text-sm text-gray-600">by {book.authors.join(', ')}</p>
                            )}
                            {book.firstPublishYear && (
                              <p className="text-sm text-gray-600">Published: {book.firstPublishYear}</p>
                            )}
                            {book.publishers && book.publishers.length > 0 && (
                              <p className="text-sm text-gray-600">Publisher: {book.publishers[0]}</p>
                            )}
                            <button
                              onClick={() => handleSelectBook(book)}
                              className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              Select This Book
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBookReselection(false);
                  setReselectingBook(null);
                  setBookFormData({ title: '', author: '', year: '', isbn: '' });
                  setBookSearchResults([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && bookToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Delete Book</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone.</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700">
                  Are you sure you want to delete "<strong>{bookToDelete.title}</strong>"
                  {bookToDelete.author && <span> by {bookToDelete.author}</span>}?
                </p>
                
                {bookToDelete.customOrderItems && bookToDelete.customOrderItems.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <FileText className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-yellow-800">
                          Warning: Book is used in Custom Orders
                        </h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          This book is referenced by {bookToDelete.customOrderItems.length} custom order item(s). 
                          Deleting it will also remove those items from their custom orders.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-gray-500 mt-2">
                  This will remove the book from your library and all associated reading progress.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteBook(bookToDelete.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Book
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;