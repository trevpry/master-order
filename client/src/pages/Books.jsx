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
import { historyPlusApi } from '../modules/history-plus/services/historyPlusApi';
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
  Trash2,
  Clipboard,
  Upload
} from 'lucide-react';
import readingSessionService from '../services/readingSessionService';
import {
  buildExistingEventsCsv,
  copyTextToClipboard,
  downloadCsvFile,
  getExistingEventsCsvFileName,
  getExistingEventsCsvReferenceText
} from '../modules/history-plus/utils/existingEventsCsv';

const DEFAULT_BOOK_AI_PROMPT_TEMPLATE = `I need a structured breakdown of the book "{{BOOK_TITLE}}"{{BOOK_AUTHOR_SEGMENT}}{{BOOK_ISBN_SEGMENT}}.

Please provide all chapters and their sections/subsections in the following JSON format. Each chapter and section should include an "event" field that either links to an existing historical event or creates a new one.

Existing Historical Events:
{{EXISTING_EVENTS}}

Available Categories:
{{AVAILABLE_CATEGORIES}}

{{SHARED_EVENT_DECISION_GUIDANCE}}

JSON Format:
{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter Title",
      "pageStart": null,
      "pageEnd": null,
      "event": {
        "action": "CREATE_NEW",
        "title": "Historical Event Title",
        "startDate": "YYYY-MM-DD or YYYY",
        "endDate": "YYYY-MM-DD or YYYY or null",
        "category": "Category Name",
        "details": "Brief description of the event"
      },
      "sections": [
        {
          "sectionNumber": 1,
          "title": "Section Title",
          "pageStart": null,
          "pageEnd": null,
          "event": {
            "action": "LINK_EXISTING",
            "title": "Exact Title of Existing Event"
          }
        }
      ]
    }
  ]
}

Event action options:
- "CREATE_NEW": Create a new historical event. Required fields: title, startDate, category. Optional: endDate, details
- "LINK_EXISTING": Link to an existing event. Required field: title (must EXACTLY match one of the existing event titles listed above, case-sensitive)
- "NONE": No event association for this chapter/section
- Or omit the "event" field entirely to skip event linking

Category rules:
- For CREATE_NEW events, the category MUST exactly match one of the available categories listed above
- Only suggest a new category if none of the existing categories fit

Rules:
- Include ALL chapters and sections from the table of contents
- Use the exact titles from the book
- chapterNumber and sectionNumber should be sequential integers starting at 1
- pageStart and pageEnd are optional - include them if you know the page numbers, otherwise use null
- sections array can be empty [] if a chapter has no subsections
- For event linking, be specific with historical events - prefer narrow time periods over broad eras
- If a chapter covers the same event as a section, you can link both to the same event
- Return ONLY the JSON, no additional text`;

const DEFAULT_SHARED_EVENT_DECISION_GUIDANCE = `SHARED EVENT DECISION GUIDANCE:

1. Prefer assigning to an existing event when the content clearly matches one listed event in topic, date range, and scope.
2. Create a new event when the content is more specific than the available events, when no listed event accurately fits, or when the content centers on a distinct sub-event within a broader period.
3. New events should be narrowly scoped, historically grounded, date-aware, and reusable for future related content.
4. Do not force a broad existing event if the content is really about a more focused battle, campaign, treaty, dynasty change, expedition, reform movement, or other discrete historical development.
5. If choosing an existing event, use the exact event title from the provided list.
6. If creating a new event, make the title specific and provide the best justified start date, end date, category, and concise description from the material.
7. When uncertain between a weak existing-event match and a clearly supported new event, prefer the better-evidenced option rather than the broader one by default.`;

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
    hasChapters: '',
    owned: ''
  });
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiImportJson, setAiImportJson] = useState('');
  const [aiImportError, setAiImportError] = useState('');
  const [aiImporting, setAiImporting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [aiPromptEvents, setAiPromptEvents] = useState([]);
  const [aiPromptCategories, setAiPromptCategories] = useState([]);
  const [aiPromptLoading, setAiPromptLoading] = useState(false);
  const [aiPromptTemplate, setAiPromptTemplate] = useState(DEFAULT_BOOK_AI_PROMPT_TEMPLATE);
  const [sharedEventDecisionGuidance, setSharedEventDecisionGuidance] = useState(DEFAULT_SHARED_EVENT_DECISION_GUIDANCE);
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
  
  // Event linking state
  const [showEventLinker, setShowEventLinker] = useState(false);
  const [eventLinkTarget, setEventLinkTarget] = useState(null); // { type: 'book'|'chapter'|'section', id, label }
  const [eventsList, setEventsList] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: ''
  });

  // Statistics
  const [systemStats, setSystemStats] = useState({});

  const buildBookAiPrompt = (book, categoriesList, csvFileName, template = DEFAULT_BOOK_AI_PROMPT_TEMPLATE) => {
    const categoriesListText = categoriesList.length > 0
      ? categoriesList.map(c => typeof c === 'string' ? `- "${c}"` : `- "${c.name}"${c.description ? ': ' + c.description : ''}`).join('\n')
      : '(No categories yet)';

    return String(template || DEFAULT_BOOK_AI_PROMPT_TEMPLATE)
      .replaceAll('{{BOOK_TITLE}}', book?.title || 'Untitled Book')
      .replaceAll('{{BOOK_AUTHOR_SEGMENT}}', book?.author ? ` by ${book.author}` : '')
      .replaceAll('{{BOOK_ISBN_SEGMENT}}', book?.isbn ? ` (ISBN: ${book.isbn})` : '')
      .replaceAll('{{EXISTING_EVENTS}}', getExistingEventsCsvReferenceText(csvFileName))
      .replaceAll('{{SHARED_EVENT_DECISION_GUIDANCE}}', sharedEventDecisionGuidance)
      .replaceAll('{{AVAILABLE_CATEGORIES}}', categoriesListText);
  };

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

  const toggleOwnedStatus = async (bookId, currentStatus) => {
    try {
      const response = await fetch(`/api/books/${bookId}/owned`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ owned: !currentStatus })
      });
      const data = await response.json();
      
      if (data.success) {
        // Update the book in the list
        setBooks(books.map(book => 
          book.id === bookId ? { ...book, owned: !currentStatus } : book
        ));
        // Update selected book if it's the same
        if (selectedBook?.id === bookId) {
          setSelectedBook({ ...selectedBook, owned: !currentStatus });
        }
      } else {
        throw new Error(data.error || 'Failed to update owned status');
      }
    } catch (err) {
      console.error('Error updating owned status:', err);
      setError(`Failed to update owned status: ${err.message}`);
    }
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

  // EVENT LINKING FUNCTIONS
  const openEventLinker = async (type, id, label) => {
    setEventLinkTarget({ type, id, label });
    setShowEventLinker(true);
    setEventSearchQuery('');
    setEventsLoading(true);
    try {
      const response = await fetch('/api/history-plus/events');
      const data = await response.json();
      const events = data.data?.events || data.data || data.events || [];
      setEventsList(Array.isArray(events) ? events : []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setEventsList([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const linkToEvent = async (eventId) => {
    if (!eventLinkTarget) return;
    try {
      const { type, id } = eventLinkTarget;
      let url;
      let body;
      if (type === 'book') {
        url = `/api/books/history-events/${eventId}/link-book`;
        body = { bookId: id };
      } else if (type === 'chapter') {
        url = `/api/books/history-events/${eventId}/link-chapter`;
        body = { chapterId: id };
      } else if (type === 'section') {
        url = `/api/books/history-events/${eventId}/link-section`;
        body = { sectionId: id };
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        setShowEventLinker(false);
        setEventLinkTarget(null);
        if (selectedBook) fetchBookDetails(selectedBook.id);
      } else {
        setError(data.error || 'Failed to link to event');
      }
    } catch (err) {
      setError(`Failed to link to event: ${err.message}`);
    }
  };

  const unlinkFromEvent = async (type, id, eventId) => {
    try {
      let url;
      if (type === 'book') {
        url = `/api/books/history-events/${eventId}/unlink-book/${id}`;
      } else if (type === 'chapter') {
        url = `/api/books/history-events/${eventId}/unlink-chapter/${id}`;
      } else if (type === 'section') {
        url = `/api/books/history-events/${eventId}/unlink-section/${id}`;
      }
      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        if (selectedBook) fetchBookDetails(selectedBook.id);
      } else {
        setError(data.error || 'Failed to unlink from event');
      }
    } catch (err) {
      setError(`Failed to unlink from event: ${err.message}`);
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
    const isOwned = book.owned;
    
    return (
    <div 
      key={book.id} 
      className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow relative group ${isCompleted ? 'ring-2 ring-green-200' : ''} ${isOwned ? 'border-l-4 border-l-blue-500' : ''}`}
    >
      {/* Status indicators */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {isOwned && (
          <div className="bg-blue-500 text-white rounded-full p-1" title="Owned">
            <Bookmark className="w-4 h-4" />
          </div>
        )}
        {isCompleted && (
          <div className="bg-green-500 text-white rounded-full p-1" title="Completed">
            <CheckCircle className="w-4 h-4" />
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleOwnedStatus(book.id, isOwned);
          }}
          className={`p-1 rounded-full ${isOwned ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
          title={isOwned ? "Mark as not owned" : "Mark as owned"}
        >
          <Bookmark className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            confirmDelete(book);
          }}
          className="p-1 text-red-500 hover:bg-red-100 rounded-full"
          title="Delete book"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
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
          
          <div className="flex items-center gap-3 mt-1">
            {isOwned && (
              <div className="flex items-center">
                <Bookmark className="w-3 h-3 text-blue-600 mr-1" />
                <span className="text-xs text-blue-600 font-medium">Owned</span>
              </div>
            )}
            {isCompleted && (
              <div className="flex items-center">
                <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                <span className="text-xs text-green-600 font-medium">Completed</span>
              </div>
            )}
          </div>
          
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
              
              {/* Owned Status */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Bookmark className={`w-5 h-5 ${selectedBook.owned ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${selectedBook.owned ? 'text-blue-600' : 'text-gray-600'}`}>
                    {selectedBook.owned ? 'Owned' : 'Not Owned'}
                  </span>
                </div>
                <button
                  onClick={() => toggleOwnedStatus(selectedBook.id, selectedBook.owned)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedBook.owned 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {selectedBook.owned ? 'Mark as Not Owned' : 'Mark as Owned'}
                </button>
              </div>
              
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
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Historical Context</h4>
                  <button
                    onClick={() => openEventLinker('book', selectedBook.id, selectedBook.title)}
                    className="flex items-center text-xs px-2 py-1 text-amber-700 hover:bg-amber-50 rounded border border-dashed border-amber-300"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Link to Event
                  </button>
                </div>
                {selectedBook.historyBookLinks && selectedBook.historyBookLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedBook.historyBookLinks.map(link => (
                      <span key={link.id} className="inline-flex items-center text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded group">
                        <Calendar className="w-3 h-3 mr-1" />
                        🏛️ {link.event.title} ({link.event.startDate})
                        <button
                          onClick={() => unlinkFromEvent('book', selectedBook.id, link.event.id)}
                          className="ml-1 text-amber-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Unlink from event"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No events linked. Click "Link to Event" to associate with a historical event.</p>
                )}
              </div>

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
        {selectedBook && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Chapters</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    setShowAIPrompt(true); setAiImportJson(''); setAiImportError(''); setPromptCopied(false);
                    setAiPromptLoading(true);
                    try {
                      const [eventsRes, catsRes, templateResponse, sharedGuidanceResponse] = await Promise.all([
                        historyPlusApi.getEvents(),
                        historyPlusApi.getCategories(),
                        historyPlusApi.getBookPromptTemplate(),
                        historyPlusApi.getPromptTemplate('eventDecision')
                      ]);
                      const eventsData = eventsRes;
                      const catsData = catsRes;
                      const events = eventsData.data?.events || eventsData.data || eventsData.events || [];
                      setAiPromptEvents(Array.isArray(events) ? events : []);
                      const cats = catsData.data || catsData.categories || [];
                      setAiPromptCategories(Array.isArray(cats) ? cats : []);
                      setAiPromptTemplate(templateResponse.data?.template || DEFAULT_BOOK_AI_PROMPT_TEMPLATE);
                      setSharedEventDecisionGuidance(sharedGuidanceResponse.data?.template || DEFAULT_SHARED_EVENT_DECISION_GUIDANCE);
                    } catch (err) {
                      console.error('Error fetching events/categories for AI prompt:', err);
                      setAiPromptTemplate(DEFAULT_BOOK_AI_PROMPT_TEMPLATE);
                      setSharedEventDecisionGuidance(DEFAULT_SHARED_EVENT_DECISION_GUIDANCE);
                    } finally {
                      setAiPromptLoading(false);
                    }
                  }}
                  className="flex items-center px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Clipboard className="w-3 h-3 mr-1" />
                  AI Import
                </button>
                <button
                  onClick={() => setShowCreateChapter(true)}
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Chapter
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {selectedBook.chapters && selectedBook.chapters.length > 0 ? selectedBook.chapters.map(chapter => {
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
                        onClick={() => openEventLinker('chapter', chapter.id, `Chapter ${chapter.chapterNumber}: ${chapter.title}`)}
                        className="p-2 text-amber-600 hover:bg-amber-100 rounded"
                        title="Link chapter to event"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      
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
                  <div className="mt-3 ml-4">
                    {chapter.sections && chapter.sections.length > 0 && (
                    <div className="space-y-2">
                      {chapter.sections.map(section => {
                        // Check if the section is completed (user-specific completion)
                        const isSectionCompleted = section.sectionCompletions && section.sectionCompletions.some(c => c.userId === 'default' && c.isCompleted);
                        
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
                              onClick={() => openEventLinker('section', section.id, `Section: ${section.title}`)}
                              className="p-1 text-amber-600 hover:bg-amber-100 rounded"
                              title="Link section to event"
                            >
                              <Calendar className="w-3 h-3" />
                            </button>
                            
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
                    <button
                      onClick={() => { setSelectedChapter(chapter); setShowCreateSection(true); }}
                      className="flex items-center mt-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-300"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Section
                    </button>
                  </div>
                </div>
                );
              }) : (
                <p className="text-gray-500 text-sm">No chapters yet. Click "Add Chapter" to get started.</p>
              )}
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
                value={filters.owned}
                onChange={(e) => setFilters({...filters, owned: e.target.value})}
              >
                <option value="">All Ownership</option>
                <option value="true">Owned</option>
                <option value="false">Not Owned</option>
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
                <option value="owned">Sort by Owned Status</option>
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

      {/* Event Linker Modal */}
      {showEventLinker && eventLinkTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-2">Link to Historical Event</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select an event for: <strong>{eventLinkTarget.label}</strong>
            </p>
            <input
              type="text"
              placeholder="Search events..."
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            />
            <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
              {eventsLoading ? (
                <p className="text-center text-gray-500 py-4">Loading events...</p>
              ) : (
                eventsList
                  .filter(evt => !eventSearchQuery || evt.title.toLowerCase().includes(eventSearchQuery.toLowerCase()) || (evt.category && evt.category.toLowerCase().includes(eventSearchQuery.toLowerCase())))
                  .map(evt => (
                    <button
                      key={evt.id}
                      onClick={() => linkToEvent(evt.id)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                    >
                      <div className="font-medium text-sm">{evt.title}</div>
                      <div className="text-xs text-gray-500">
                        {evt.category && <span className="mr-2">{evt.category}</span>}
                        {evt.startDate}{evt.endDate && evt.endDate !== evt.startDate ? ` – ${evt.endDate}` : ''}
                      </div>
                    </button>
                  ))
              )}
              {!eventsLoading && eventsList.filter(evt => !eventSearchQuery || evt.title.toLowerCase().includes(eventSearchQuery.toLowerCase())).length === 0 && (
                <p className="text-center text-gray-500 py-4">No events found</p>
              )}
            </div>
            <div className="flex justify-end pt-4 border-t mt-3">
              <button
                onClick={() => { setShowEventLinker(false); setEventLinkTarget(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Chapter Modal */}
      {showCreateChapter && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add Chapter to "{selectedBook.title}"</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              try {
                const response = await fetch(`/api/books/${selectedBook.id}/chapters`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: formData.get('title'),
                    chapterNumber: parseInt(formData.get('chapterNumber')),
                    description: formData.get('description') || null,
                    pageStart: formData.get('pageStart') ? parseInt(formData.get('pageStart')) : null,
                    pageEnd: formData.get('pageEnd') ? parseInt(formData.get('pageEnd')) : null
                  })
                });
                const data = await response.json();
                if (data.success) {
                  setShowCreateChapter(false);
                  fetchBookDetails(selectedBook.id);
                } else {
                  setError(data.error || 'Failed to create chapter');
                }
              } catch (err) {
                setError(`Failed to create chapter: ${err.message}`);
              }
            }} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Chapter # *</label>
                  <input type="number" name="chapterNumber" className="w-full border rounded-lg px-3 py-2" required min="1" defaultValue={(selectedBook.chapters?.length || 0) + 1} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input type="text" name="title" className="w-full border rounded-lg px-3 py-2" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Page Start</label>
                  <input type="number" name="pageStart" className="w-full border rounded-lg px-3 py-2" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Page End</label>
                  <input type="number" name="pageEnd" className="w-full border rounded-lg px-3 py-2" min="1" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateChapter(false)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Prompt / Import Modal */}
      {showAIPrompt && selectedBook && (() => {
        const eventsCsvFileName = getExistingEventsCsvFileName(selectedBook.title || 'book-ai-import');
        const aiPrompt = buildBookAiPrompt(selectedBook, aiPromptCategories, eventsCsvFileName, aiPromptTemplate);

        const handleCopyPrompt = async () => {
          const copied = await copyTextToClipboard(aiPrompt);
          if (!copied) {
            alert('Existing events CSV downloaded, but clipboard copy failed in this browser.');
          }
          downloadCsvFile(eventsCsvFileName, buildExistingEventsCsv(aiPromptEvents || []));
          setPromptCopied(true);
          setTimeout(() => setPromptCopied(false), 2000);
        };

        const handleImport = async () => {
          setAiImportError('');
          setAiImporting(true);
          try {
            const parsed = JSON.parse(aiImportJson.trim());
            if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
              throw new Error('JSON must contain a "chapters" array');
            }

            // Fetch existing events for matching
            const eventsRes = await fetch('/api/history-plus/events');
            const eventsData = await eventsRes.json();
            const existingEvents = eventsData.data?.events || eventsData.data || eventsData.events || [];
            const eventsByTitle = {};
            if (Array.isArray(existingEvents)) {
              existingEvents.forEach(evt => { eventsByTitle[evt.title.toLowerCase()] = evt; });
            }

            const resolveEvent = async (eventSpec) => {
              if (!eventSpec || eventSpec.action === 'NONE') return null;

              if (eventSpec.action === 'LINK_EXISTING') {
                const match = eventsByTitle[eventSpec.title?.toLowerCase()];
                if (!match) {
                  console.warn(`Event not found: "${eventSpec.title}" - skipping link`);
                  return null;
                }
                return match.id;
              }

              if (eventSpec.action === 'CREATE_NEW') {
                // Check if we already created an event with this title in this import
                const existing = eventsByTitle[eventSpec.title?.toLowerCase()];
                if (existing) return existing.id;

                const createRes = await fetch('/api/history-plus/events', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: eventSpec.title,
                    startDate: eventSpec.startDate,
                    endDate: eventSpec.endDate || null,
                    category: eventSpec.category,
                    details: eventSpec.details || null
                  })
                });
                const createData = await createRes.json();
                if (!createData.success) {
                  console.warn(`Failed to create event "${eventSpec.title}": ${createData.error} - skipping link`);
                  return null;
                }
                // Cache so duplicate titles reuse the same event
                eventsByTitle[eventSpec.title.toLowerCase()] = createData.data;
                return createData.data.id;
              }
              return null;
            };

            for (const chapter of parsed.chapters) {
              const chapterRes = await fetch(`/api/books/${selectedBook.id}/chapters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: chapter.title,
                  chapterNumber: chapter.chapterNumber,
                  description: chapter.description || null,
                  pageStart: chapter.pageStart || null,
                  pageEnd: chapter.pageEnd || null
                })
              });
              const chapterData = await chapterRes.json();
              if (!chapterData.success) {
                throw new Error(`Failed to create chapter ${chapter.chapterNumber}: ${chapterData.error}`);
              }

              // Link chapter to event
              const chapterEventId = await resolveEvent(chapter.event);
              if (chapterEventId) {
                await fetch(`/api/books/history-events/${chapterEventId}/link-chapter`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chapterId: chapterData.data.id })
                });
              }

              if (chapter.sections && chapter.sections.length > 0) {
                for (const section of chapter.sections) {
                  const sectionRes = await fetch(`/api/books/${selectedBook.id}/chapters/${chapterData.data.id}/sections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: section.title,
                      sectionNumber: section.sectionNumber,
                      description: section.description || null,
                      pageStart: section.pageStart || null,
                      pageEnd: section.pageEnd || null
                    })
                  });
                  const sectionData = await sectionRes.json();
                  if (!sectionData.success) {
                    throw new Error(`Failed to create section ${section.sectionNumber} in chapter ${chapter.chapterNumber}: ${sectionData.error}`);
                  }

                  // Link section to event
                  const sectionEventId = await resolveEvent(section.event);
                  if (sectionEventId) {
                    await fetch(`/api/books/history-events/${sectionEventId}/link-section`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sectionId: sectionData.data.id })
                    });
                  }
                }
              }
            }
            setShowAIPrompt(false);
            setAiImportJson('');
            fetchBookDetails(selectedBook.id);
          } catch (err) {
            setAiImportError(err.message);
          } finally {
            setAiImporting(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">AI Chapter Import for "{selectedBook.title}"</h3>
              
              {/* Step 1: Copy Prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Step 1: Copy this prompt and paste it into an AI assistant</label>
                {aiPromptLoading ? (
                  <div className="bg-gray-50 border rounded-lg p-6 text-center text-gray-500">
                    Loading events and categories...
                  </div>
                ) : (
                <div className="relative">
                  <pre className="bg-gray-50 border rounded-lg p-3 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{aiPrompt}</pre>
                  <div className="mt-2 text-xs text-gray-600">
                    Existing events will be downloaded as <strong>{eventsCsvFileName}</strong> with columns: Event Title, Start Date, End Date, Event Description.
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className={`absolute top-2 right-2 px-3 py-1 text-xs rounded ${
                      promptCopied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {promptCopied ? 'Copied!' : 'Copy Prompt + CSV'}
                  </button>
                </div>
                )}
              </div>

              {/* Step 2: Paste JSON */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Step 2: Paste the AI's JSON response here</label>
                <textarea
                  value={aiImportJson}
                  onChange={(e) => setAiImportJson(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-48"
                  placeholder='{\n  "chapters": [\n    ...\n  ]\n}'
                />
                {aiImportError && (
                  <p className="text-red-600 text-sm mt-1">{aiImportError}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowAIPrompt(false); setAiImportJson(''); setAiImportError(''); }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!aiImportJson.trim() || aiImporting}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {aiImporting ? 'Importing...' : 'Import Chapters'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Section Modal */}
      {showCreateSection && selectedChapter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add Section to Chapter {selectedChapter.chapterNumber}: "{selectedChapter.title}"</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              try {
                const response = await fetch(`/api/books/${selectedBook.id}/chapters/${selectedChapter.id}/sections`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: formData.get('title'),
                    sectionNumber: parseInt(formData.get('sectionNumber')),
                    description: formData.get('description') || null,
                    pageStart: formData.get('pageStart') ? parseInt(formData.get('pageStart')) : null,
                    pageEnd: formData.get('pageEnd') ? parseInt(formData.get('pageEnd')) : null
                  })
                });
                const data = await response.json();
                if (data.success) {
                  setShowCreateSection(false);
                  setSelectedChapter(null);
                  fetchBookDetails(selectedBook.id);
                } else {
                  setError(data.error || 'Failed to create section');
                }
              } catch (err) {
                setError(`Failed to create section: ${err.message}`);
              }
            }} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Section # *</label>
                  <input type="number" name="sectionNumber" className="w-full border rounded-lg px-3 py-2" required min="1" defaultValue={(selectedChapter.sections?.length || 0) + 1} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input type="text" name="title" className="w-full border rounded-lg px-3 py-2" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Page Start</label>
                  <input type="number" name="pageStart" className="w-full border rounded-lg px-3 py-2" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Page End</label>
                  <input type="number" name="pageEnd" className="w-full border rounded-lg px-3 py-2" min="1" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowCreateSection(false); setSelectedChapter(null); }} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Book Modal */}
      {showCreateBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Book</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createBook({
                title: formData.get('title'),
                author: formData.get('author'),
                description: formData.get('description'),
                isbn: formData.get('isbn'),
                publisher: formData.get('publisher'),
                publishYear: formData.get('publishYear') || null,
                pageCount: formData.get('pageCount') ? parseInt(formData.get('pageCount')) : null
              });
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input type="text" name="title" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Author *</label>
                <input type="text" name="author" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" className="w-full border rounded-lg px-3 py-2" rows="3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ISBN</label>
                  <input type="text" name="isbn" className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Publisher</label>
                  <input type="text" name="publisher" className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Publish Year</label>
                  <input type="number" name="publishYear" className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Page Count</label>
                  <input type="number" name="pageCount" className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateBook(false)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create Book
                </button>
              </div>
            </form>
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