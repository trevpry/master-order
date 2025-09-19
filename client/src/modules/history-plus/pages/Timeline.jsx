import React, { useState, useEffect } from 'react';
import { historyPlusApi } from '../services/historyPlusApi';
import TimelineItem from '../components/TimelineItem';
import EventForm from '../components/EventForm';
import SearchFilters from '../components/SearchFilters';
import LoadingSpinner from '../../../components/LoadingSpinner';

const Timeline = () => {
  // Helper function to parse BCE/CE dates for proper chronological sorting
  const parseHistoricalDate = (dateInput) => {
    if (!dateInput) return 0;
    
    const dateString = String(dateInput);
    
    // Handle BCE dates (negative years in our format: "-YYYY-MM-DD")
    if (dateString.startsWith('-')) {
      const year = parseInt(dateString.slice(1, 5));
      const month = parseInt(dateString.slice(6, 8)) || 1;
      const day = parseInt(dateString.slice(9, 11)) || 1;
      
      // For BCE, convert to negative number for sorting (higher BCE numbers = earlier in time)
      return -(year * 10000 + month * 100 + day);
    } else {
      // Handle CE dates (positive years: "YYYY-MM-DD")
      const year = parseInt(dateString.slice(0, 4));
      const month = parseInt(dateString.slice(5, 7)) || 1;
      const day = parseInt(dateString.slice(8, 10)) || 1;
      
      // For CE, use positive number (normal chronological order)
      return year * 10000 + month * 100 + day;
    }
  };

  // State management
  // State management
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reviewedFilter, setReviewedFilter] = useState('unreviewed');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Apply filters when search criteria change
  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, selectedCategory, reviewedFilter, contentTypeFilter, startDateFilter, endDateFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, reviewedFilter, contentTypeFilter, startDateFilter, endDateFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsResponse, categoriesResponse] = await Promise.all([
        historyPlusApi.getAllEvents(),
        historyPlusApi.getCategories()
      ]);
      
      setEvents(eventsResponse.data || []);
      setCategories(categoriesResponse.data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading timeline data:', err);
      setError('Failed to load timeline data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    // Search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(event => 
        event.title?.toLowerCase().includes(term) ||
        event.details?.toLowerCase().includes(term) ||
        event.category?.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Reviewed filter
    if (reviewedFilter !== 'all') {
      const isReviewed = reviewedFilter === 'reviewed';
      filtered = filtered.filter(event => event.reviewed === isReviewed);
    }

    // Content type filter
    if (contentTypeFilter !== 'all') {
      filtered = filtered.filter(event => {
        switch (contentTypeFilter) {
          case 'videos':
            return event.videos && event.videos.length > 0;
          case 'books':
            return event.books && event.books.length > 0;
          case 'chapters':
            return event.chapters && event.chapters.length > 0;
          case 'sections':
            return event.sections && event.sections.length > 0;
          case 'no-content':
            return (!event.videos || event.videos.length === 0) &&
                   (!event.books || event.books.length === 0) &&
                   (!event.chapters || event.chapters.length === 0) &&
                   (!event.sections || event.sections.length === 0);
          default:
            return true;
        }
      });
    }

    // Date range filters
    if (startDateFilter) {
      filtered = filtered.filter(event => {
        if (!event.startDate) return false;
        return event.startDate >= startDateFilter;
      });
    }

    if (endDateFilter) {
      filtered = filtered.filter(event => {
        if (!event.startDate) return false;
        const eventEndDate = event.endDate || event.startDate;
        return eventEndDate <= endDateFilter;
      });
    }

    // Sort by start date (earliest first)
    filtered.sort((a, b) => {
      const dateA = parseHistoricalDate(a.startDate || '0000-01-01');
      const dateB = parseHistoricalDate(b.startDate || '0000-01-01');
      return dateA - dateB;
    });

    setFilteredEvents(filtered);
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await historyPlusApi.deleteEvent(eventId);
      await loadData(); // Reload data
    } catch (err) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event');
    }
  };

  const handleToggleReviewed = async (eventId, reviewed) => {
    try {
      await historyPlusApi.markEventReviewed(eventId, { reviewed });
      await loadData(); // Reload data
    } catch (err) {
      console.error('Error updating event review status:', err);
      setError('Failed to update event review status');
    }
  };

  const handleEventSaved = async () => {
    setShowEventForm(false);
    setEditingEvent(null);
    await loadData(); // Reload data
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    console.log('Uploading files:', files.map(f => f.name));
    setImporting(true);
    setImportStatus({ type: 'info', message: `Uploading ${files.length} CSV files...` });

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('csvFiles', file);
      });

      const response = await fetch('/api/history-plus/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadedFiles(result.data);
        setImportStatus({ 
          type: 'success', 
          message: `Successfully uploaded ${result.data.summary.uploaded} files. ${result.data.ready ? 'Ready to import!' : `Missing ${result.data.summary.missing} required files.`}` 
        });
        setShowUpload(false);
      } else {
        setImportStatus({ 
          type: 'error', 
          message: result.error || 'Failed to upload files' 
        });
      }
    } catch (err) {
      console.error('Error uploading files:', err);
      setImportStatus({ 
        type: 'error', 
        message: 'Failed to upload files' 
      });
    } finally {
      setImporting(false);
      // Clear status after 10 seconds
      setTimeout(() => setImportStatus(null), 10000);
    }
  };

  const handleImportUploadedFiles = async () => {
    console.log('🚀 handleImportUploadedFiles called');
    console.log('📄 uploadedFiles:', uploadedFiles);
    
    if (!uploadedFiles || !uploadedFiles.ready) {
      setImportStatus({ type: 'error', message: 'No files uploaded or missing required files' });
      return;
    }

    let force = false;
    try {
      const statusCheck = await checkImportStatus();
      
      if (statusCheck && statusCheck.hasData) {
        if (!window.confirm('⚠️ WARNING: This will DELETE ALL existing History Plus data and import fresh data from uploaded CSV files. This cannot be undone. Are you sure?')) {
          return;
        }
        force = window.confirm('Force update existing records? (Select "OK" to update existing, "Cancel" to skip duplicates)');
      } else {
        if (!window.confirm('This will import all History Plus data from uploaded CSV files. Are you sure?')) {
          return;
        }
      }
    } catch (error) {
      console.error('Error checking import status:', error);
      if (!window.confirm('⚠️ WARNING: This will DELETE ALL existing History Plus data and import fresh data from uploaded CSV files. This cannot be undone. Are you sure?')) {
        return;
      }
    }

    setImporting(true);
    setImportStatus({ type: 'info', message: 'Starting full History Plus import...' });

    try {
      const response = await fetch('/api/history-plus/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          force,
          useUploaded: true // Flag to use uploaded files instead of mounted directory
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const stats = result.data?.statistics;
        let message = 'Import completed successfully! ';
        if (stats) {
          if (stats.deleted > 0) {
            message += `Deleted: ${stats.deleted}, `;
          }
          message += `Imported: ${stats.imported || 0}, Updated: ${stats.updated || 0}, Skipped: ${stats.skipped || 0}, Errors: ${stats.errors || 0}`;
        }
        setImportStatus({ 
          type: 'success', 
          message: message
        });
        setUploadedFiles(null); // Clear uploaded files after successful import
        await loadData(); // Reload timeline data
      } else {
        setImportStatus({ 
          type: 'error', 
          message: result.error || 'Import failed' 
        });
      }
    } catch (err) {
      console.error('Error importing data:', err);
      setImportStatus({ 
        type: 'error', 
        message: 'Failed to start import process' 
      });
    } finally {
      setImporting(false);
      setTimeout(() => setImportStatus(null), 10000);
    }
  };

  const handleImportData = async () => {
    console.log('🚀 handleImportData called (legacy directory import)');
    // First check if data already exists
    let force = false;
    try {
      const statusCheck = await checkImportStatus();
      
      if (statusCheck && statusCheck.hasData) {
        if (!window.confirm('History Plus data already exists. This will import additional data from CSV files. Are you sure?')) {
          return;
        }
        force = window.confirm('Force update existing records? (Select "OK" to update existing, "Cancel" to skip duplicates)');
      } else {
        if (!window.confirm('This will import all History Plus data from CSV files. Are you sure?')) {
          return;
        }
      }
    } catch (error) {
      console.error('Error checking import status:', error);
      // If status check fails, just proceed with basic confirmation
      if (!window.confirm('This will import all History Plus data from CSV files. Are you sure?')) {
        return;
      }
    }

    setImporting(true);
    setImportStatus({ type: 'info', message: 'Starting full History Plus import...' });

    try {
      const response = await fetch('/api/history-plus/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
      });

      const result = await response.json();

      if (response.ok) {
        const stats = result.data?.statistics;
        let message = 'Import completed successfully! ';
        if (stats) {
          message += `Imported: ${stats.imported || 0}, Updated: ${stats.updated || 0}, Skipped: ${stats.skipped || 0}, Errors: ${stats.errors || 0}`;
        }
        setImportStatus({ 
          type: 'success', 
          message: message
        });
        await loadData(); // Reload timeline data
      } else {
        setImportStatus({ 
          type: 'error', 
          message: result.error || 'Import failed' 
        });
      }
    } catch (err) {
      console.error('Error importing data:', err);
      setImportStatus({ 
        type: 'error', 
        message: 'Failed to start import process' 
      });
    } finally {
      setImporting(false);
      // Clear status after 10 seconds
      setTimeout(() => setImportStatus(null), 10000);
    }
  };

  const checkImportStatus = async () => {
    try {
      const response = await fetch('/api/history-plus/import-status');
      
      if (!response.ok) {
        console.error('Import status request failed:', response.status, response.statusText);
        return { ready: false, csvFiles: [] };
      }
      
      const result = await response.json();
      return result.data || { ready: false, csvFiles: [] };
    } catch (err) {
      console.error('Error checking import status:', err);
      return { ready: false, csvFiles: [] };
    }
  };

  const handleGeneratePrompt = (event) => {
    console.log('Generate prompt for event:', event);
    // TODO: Implement prompt generation functionality
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setReviewedFilter('all');
    setContentTypeFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Historical Timeline</h1>
          <p className="text-gray-600">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Import Section */}
          <div className="flex items-center gap-3">
            {/* Upload CSV Files Button */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              disabled={importing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {showUpload ? '✖️ Cancel' : '📤 Upload CSV Files'}
            </button>

            {/* Import from Uploaded Files Button */}
            {uploadedFiles && uploadedFiles.ready && (
              <button
                onClick={handleImportUploadedFiles}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>� Import Books to Unified System</>
                )}
              </button>
            )}

            {/* Legacy Import Button (for mounted directories) */}
            <button
              onClick={handleImportData}
              disabled={importing}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
              title="Import books directly to unified Books system from mounted directory (requires volume mount or docker cp)"
            >
              📁 Import Books from Directory
            </button>
          </div>
          
          <button
            onClick={handleCreateEvent}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Event
          </button>
        </div>
      </div>

      {/* File Upload Interface */}
      {showUpload && (
        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Upload History Plus CSV Files</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Select CSV files to upload (select multiple files at once):
            </label>
            <input
              type="file"
              multiple
              accept=".csv"
              onChange={handleFileUpload}
              disabled={importing}
              className="block w-full text-sm text-blue-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 disabled:opacity-50"
            />
          </div>

          <div className="text-sm text-blue-600">
            <p className="font-medium mb-2">Required CSV files:</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div>• export_metadata.csv</div>
              <div>• user_event_reviews.csv</div>
              <div>• historical_events.csv</div>
              <div>• user_video_watches.csv</div>
              <div>• history_books.csv</div>
              <div>• user_book_reads.csv</div>
              <div>• history_channels.csv</div>
              <div>• user_chapter_reads.csv</div>
              <div>• history_chapters.csv</div>
              <div>• user_section_reads.csv</div>
              <div>• history_sections.csv</div>
              <div>• history_videos.csv</div>
            </div>
          </div>

          {uploadedFiles && (
            <div className="mt-4 p-3 bg-white border border-blue-300 rounded">
              <h4 className="font-medium text-blue-800 mb-2">Upload Summary:</h4>
              <div className="text-sm text-blue-600 space-y-1">
                <div>✅ Uploaded: {uploadedFiles.summary.uploaded} files</div>
                <div>📋 Expected: {uploadedFiles.summary.expected} files</div>
                {uploadedFiles.summary.missing > 0 && (
                  <div className="text-red-600">⚠️ Missing: {uploadedFiles.summary.missing} required files</div>
                )}
                {uploadedFiles.summary.extra > 0 && (
                  <div className="text-orange-600">ℹ️ Extra: {uploadedFiles.summary.extra} files (will be ignored)</div>
                )}
                <div className={uploadedFiles.ready ? 'text-green-600 font-medium' : 'text-red-600'}>
                  {uploadedFiles.ready ? '✅ Ready to import!' : '❌ Cannot import - missing required files'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Status */}
      {importStatus && (
        <div className={`mb-4 p-4 rounded-lg ${
          importStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          importStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {importStatus.type === 'success' && <span>✅</span>}
            {importStatus.type === 'error' && <span>❌</span>}
            {importStatus.type === 'info' && <span>ℹ️</span>}
            <span>{importStatus.message}</span>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <SearchFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        reviewedFilter={reviewedFilter}
        setReviewedFilter={setReviewedFilter}
        contentTypeFilter={contentTypeFilter}
        setContentTypeFilter={setContentTypeFilter}
        startDateFilter={startDateFilter}
        setStartDateFilter={setStartDateFilter}
        endDateFilter={endDateFilter}
        setEndDateFilter={setEndDateFilter}
        categories={categories}
        onClearFilters={clearFilters}
        resultCount={filteredEvents.length}
        totalCount={events.length}
      />

      {/* Items per page selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="itemsPerPage" className="text-sm text-gray-600">
            Items per page:
          </label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Pagination info */}
        {filteredEvents.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredEvents.length)} of {filteredEvents.length}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Timeline Events */}
      {currentEvents.length > 0 ? (
        <div className="space-y-6 mb-8">
          {currentEvents.map((event) => (
            <TimelineItem
              key={event.id}
              event={event}
              categories={categories}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onToggleReviewed={handleToggleReviewed}
              onGeneratePrompt={handleGeneratePrompt}
              canEdit={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Events Found</h3>
          <p className="text-gray-500 mb-6">
            {events.length === 0 
              ? "Start by creating your first historical event"
              : "Try adjusting your search filters"
            }
          </p>
          {events.length === 0 && (
            <button
              onClick={handleCreateEvent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Create First Event
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {showEventForm && (
        <EventForm
          event={editingEvent}
          categories={categories}
          onSave={handleEventSaved}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
};

export default Timeline;
