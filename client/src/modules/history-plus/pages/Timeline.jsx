import React, { useState, useEffect } from 'react';
import { historyPlusApi } from '../services/historyPlusApi';
import TimelineItem from '../components/TimelineItem';
import EventForm from '../components/EventForm';
import SearchFilters from '../components/SearchFilters';
import SearchableEventSelect from '../components/SearchableEventSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';

const DEFAULT_TIMELINE_PROMPT_TEMPLATE = `You are assisting with curation for a historical timeline knowledge base.

Analyze the event below and provide an improved event profile that can be reused by AI systems to better assign videos and books to this event in the future.

Event Context
- Event Title: {{eventTitle}}
- Date Range: {{dateRange}}
- Existing Description:
{{eventDescription}}

Linked YouTube Videos
{{linkedYouTubeVideos}}

Tasks
1. Write a clear, historically accurate event description suitable for future AI matching of videos/books.
2. Confirm whether the current date range is correct.
3. If the date range is inaccurate or too broad/narrow, propose a corrected range and explain why.
4. Identify key subtopics, people, places, and keywords that define this event for better matching.
5. Recommend additional YouTube videos that cover this event (or major subtopics), including direct URLs when possible.

Output Format
Return your response in this exact structure:

## Improved Event Description
[Write 1-3 paragraphs]

## Date Range Validation
- Current Range Assessment: [Accurate / Partially Accurate / Inaccurate]
- Suggested Range: [YYYY-MM-DD to YYYY-MM-DD, BCE format if applicable]
- Rationale: [Concise explanation]

## AI Matching Metadata
- Core Topics: [bullet list]
- Key People: [bullet list]
- Key Places: [bullet list]
- Search Keywords: [comma-separated list]
- Recommended Category Label(s): [1-3 labels]

## Additional YouTube Coverage
List at least 5 relevant videos (or as many as you can find) with:
- Video Title
- Channel
- URL
- Why it is relevant

If information is uncertain, say so explicitly rather than guessing.`;

const Timeline = () => {
  // Helper function to parse BCE/CE dates for proper chronological sorting
  const parseHistoricalDate = (dateInput) => {
    if (!dateInput) return 0;
    
    const dateString = String(dateInput);
    
    // Handle BCE dates (negative years in our format: "-YYYY...-MM-DD")
    if (dateString.startsWith('-')) {
      // Find the second dash (after the year)
      const secondDashIndex = dateString.indexOf('-', 1);
      
      if (secondDashIndex === -1) {
        // No second dash found, treat entire string after '-' as year
        const year = parseInt(dateString.slice(1));
        return -(year * 10000 + 101); // Default to Jan 1
      }
      
      // Extract year between first and second dash
      const yearStr = dateString.slice(1, secondDashIndex);
      const year = parseInt(yearStr);
      
      // Extract month and day after second dash
      const remainingDate = dateString.slice(secondDashIndex);
      const parts = remainingDate.split('-');
      const month = parseInt(parts[1]) || 1;
      const day = parseInt(parts[2]) || 1;
      
      // For BCE, convert to negative number for sorting (higher BCE numbers = earlier in time)
      return -(year * 10000 + month * 100 + day);
    } else {
      // Handle CE dates (positive years: "YYYY...-MM-DD")
      const firstDashIndex = dateString.indexOf('-');
      
      if (firstDashIndex === -1) {
        // No dash found, treat entire string as year
        const year = parseInt(dateString);
        return year * 10000 + 101; // Default to Jan 1
      }
      
      const yearStr = dateString.slice(0, firstDashIndex);
      const year = parseInt(yearStr);
      const remainingDate = dateString.slice(firstDashIndex);
      const parts = remainingDate.split('-');
      const month = parseInt(parts[1]) || 1;
      const day = parseInt(parts[2]) || 1;
      
      // For CE, use positive number (normal chronological order)
      return year * 10000 + month * 100 + day;
    }
  };

  const compareTimelineEvents = (a, b) => {
    const startDateA = parseHistoricalDate(a.startDate || '0000-01-01');
    const startDateB = parseHistoricalDate(b.startDate || '0000-01-01');

    if (startDateA !== startDateB) {
      return startDateA - startDateB;
    }

    const endDateA = parseHistoricalDate(a.endDate || a.startDate || '0000-01-01');
    const endDateB = parseHistoricalDate(b.endDate || b.startDate || '0000-01-01');

    if (endDateA !== endDateB) {
      return endDateB - endDateA;
    }

    return (a.title || '').localeCompare(b.title || '');
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

  // Merge selection state
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeForm, setMergeForm] = useState({
    primaryEventId: '',
    title: '',
    category: '',
    startDate: '',
    endDate: '',
    details: ''
  });

  // AI prompt generation state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptData, setPromptData] = useState(null);
  const [promptCopyStatus, setPromptCopyStatus] = useState('');
  const [showPromptTemplateEditor, setShowPromptTemplateEditor] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_TIMELINE_PROMPT_TEMPLATE);
  const [promptTemplateStatus, setPromptTemplateStatus] = useState('');
  const [promptTemplateLoading, setPromptTemplateLoading] = useState(false);
  const [promptTemplateSaving, setPromptTemplateSaving] = useState(false);
  const [defaultPromptTemplate, setDefaultPromptTemplate] = useState(DEFAULT_TIMELINE_PROMPT_TEMPLATE);
  const [isCustomPromptTemplate, setIsCustomPromptTemplate] = useState(false);

  // Content reassignment state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignEventId, setReassignEventId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  
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

  useEffect(() => {
    loadPromptTemplate();
  }, []);

  const loadPromptTemplate = async () => {
    try {
      setPromptTemplateLoading(true);
      const response = await historyPlusApi.getTimelinePromptTemplate();
      const payload = response.data || {};

      setPromptTemplate(payload.template || DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setDefaultPromptTemplate(payload.defaultTemplate || DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setIsCustomPromptTemplate(Boolean(payload.isCustom));
    } catch (loadError) {
      console.error('Error loading Timeline AI prompt template:', loadError);
      setPromptTemplateStatus('Failed to load saved template; using default');
      setPromptTemplate(DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setDefaultPromptTemplate(DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setIsCustomPromptTemplate(false);
      setTimeout(() => setPromptTemplateStatus(''), 2500);
    } finally {
      setPromptTemplateLoading(false);
    }
  };

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

    // Sort by start date (earliest first), then by end date (latest first)
    // so broader date ranges appear before narrower ones when starts match.
    filtered.sort(compareTimelineEvents);

    setFilteredEvents(filtered);
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const selectedEvents = events.filter(event => selectedEventIds.includes(event.id));

  const deriveMergeDefaults = (mergeCandidates) => {
    const sortedByStartDate = [...mergeCandidates].sort(compareTimelineEvents);

    const sortedByEndDate = [...mergeCandidates]
      .filter(event => event.endDate)
      .sort((a, b) => parseHistoricalDate(b.endDate) - parseHistoricalDate(a.endDate));

    const details = mergeCandidates
      .map(event => (event.details || '').trim())
      .filter(Boolean)
      .join('\n\n');

    const hasOngoingEvent = mergeCandidates.some(event => !event.endDate);
    const primary = sortedByStartDate[0];

    return {
      primaryEventId: primary?.id || '',
      title: primary?.title || '',
      category: primary?.category || '',
      startDate: sortedByStartDate[0]?.startDate || '',
      endDate: hasOngoingEvent ? '' : (sortedByEndDate[0]?.endDate || ''),
      details
    };
  };

  const toggleEventSelection = (eventId) => {
    setSelectedEventIds(prev => (
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    ));
  };

  const toggleSelectAllCurrentPage = () => {
    const currentPageIds = currentEvents.map(event => event.id);
    const allSelected = currentPageIds.every(id => selectedEventIds.includes(id));

    if (allSelected) {
      setSelectedEventIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedEventIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const clearSelection = () => {
    setSelectedEventIds([]);
  };

  const openMergeModal = () => {
    if (selectedEventIds.length < 2) {
      setError('Select at least two events to merge');
      return;
    }

    const defaults = deriveMergeDefaults(selectedEvents);
    setMergeForm(defaults);
    setShowMergeModal(true);
  };

  const closeMergeModal = () => {
    setShowMergeModal(false);
  };

  const handleMergeSubmit = async (event) => {
    event.preventDefault();

    if (selectedEventIds.length < 2) {
      setError('Select at least two events to merge');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await historyPlusApi.mergeEvents({
        eventIds: selectedEventIds,
        primaryEventId: mergeForm.primaryEventId,
        mergedData: {
          title: mergeForm.title,
          category: mergeForm.category,
          startDate: mergeForm.startDate,
          endDate: mergeForm.endDate || null,
          details: mergeForm.details
        }
      });

      setSelectedEventIds([]);
      setShowMergeModal(false);
      await loadData();
    } catch (err) {
      console.error('Error merging events:', err);
      setError('Failed to merge selected events');
    } finally {
      setLoading(false);
    }
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

  const getDateRangeLabel = (startDate, endDate) => {
    if (startDate && endDate) {
      return `${startDate} to ${endDate}`;
    }

    if (startDate) {
      return `${startDate} to Ongoing/Unknown end`;
    }

    if (endDate) {
      return `Unknown start to ${endDate}`;
    }

    return 'Unknown date range';
  };

  const getYouTubeVideosForPrompt = (event) => {
    const videos = Array.isArray(event?.videos) ? event.videos : [];

    return videos
      .filter(video => {
        const url = String(video?.url || '').toLowerCase();
        return url.includes('youtube.com') || url.includes('youtu.be');
      })
      .map((video, index) => ({
        id: video.id || `yt-${index + 1}`,
        title: video.title || `Linked YouTube Video ${index + 1}`,
        url: video.url
      }));
  };

  const buildEventAIPrompt = (event, youtubeVideos) => {
    const title = event?.title || 'Untitled Event';
    const dateRange = getDateRangeLabel(event?.startDate, event?.endDate);
    const details = (event?.details || 'No description currently stored for this event.').trim();

    const linkedVideosSection = youtubeVideos.length > 0
      ? youtubeVideos.map((video, index) => `${index + 1}. ${video.title}\n   URL: ${video.url}`).join('\n')
      : 'No linked YouTube videos are currently attached to this event.';

    return (promptTemplate || DEFAULT_TIMELINE_PROMPT_TEMPLATE)
      .replaceAll('{{eventTitle}}', title)
      .replaceAll('{{dateRange}}', dateRange)
      .replaceAll('{{eventDescription}}', details)
      .replaceAll('{{linkedYouTubeVideos}}', linkedVideosSection);
  };

  const handleSavePromptTemplate = async () => {
    try {
      setPromptTemplateSaving(true);
      const response = await historyPlusApi.saveTimelinePromptTemplate(promptTemplate);
      const payload = response.data || {};

      setPromptTemplate(payload.template || promptTemplate);
      setDefaultPromptTemplate(payload.defaultTemplate || DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setIsCustomPromptTemplate(Boolean(payload.isCustom));
      setPromptTemplateStatus('Prompt template saved');
    } catch (saveError) {
      console.error('Unable to save timeline prompt template:', saveError);
      setPromptTemplateStatus('Could not save prompt template');
    } finally {
      setPromptTemplateSaving(false);
      setTimeout(() => {
        setPromptTemplateStatus('');
      }, 2500);
    }
  };

  const handleResetPromptTemplate = async () => {
    try {
      setPromptTemplateSaving(true);
      const response = await historyPlusApi.saveTimelinePromptTemplate('');
      const payload = response.data || {};

      setPromptTemplate(payload.template || DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setDefaultPromptTemplate(payload.defaultTemplate || DEFAULT_TIMELINE_PROMPT_TEMPLATE);
      setIsCustomPromptTemplate(false);
      setPromptTemplateStatus('Prompt template reset to default');
    } catch (resetError) {
      console.error('Unable to reset timeline prompt template:', resetError);
      setPromptTemplateStatus('Could not reset prompt template');
    } finally {
      setPromptTemplateSaving(false);
      setTimeout(() => {
        setPromptTemplateStatus('');
      }, 2500);
    }
  };

  const copyTextToClipboard = async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn('Clipboard API copy failed, falling back to textarea copy:', error);
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch (error) {
      console.error('Fallback clipboard copy failed:', error);
      return false;
    }
  };

  const handleGeneratePrompt = (event) => {
    const youtubeVideos = getYouTubeVideosForPrompt(event);
    const fullPrompt = buildEventAIPrompt(event, youtubeVideos);

    setPromptData({
      event,
      youtubeVideos,
      fullPrompt
    });
    setPromptCopyStatus('');
    setShowPromptModal(true);
  };

  const handleCopyPrompt = async () => {
    if (!promptData?.fullPrompt) return;

    const copied = await copyTextToClipboard(promptData.fullPrompt);
    if (copied) {
      setPromptCopyStatus('Prompt copied to clipboard');
    } else {
      setPromptCopyStatus('Could not copy automatically - select and copy manually');
    }

    setTimeout(() => {
      setPromptCopyStatus('');
    }, 2500);
  };

  const handleOpenReassignModal = ({ type, item, sourceEventId, sourceEventTitle }) => {
    setReassignTarget({ type, item, sourceEventId, sourceEventTitle });
    setReassignEventId('');
    setShowReassignModal(true);
  };

  const getReassignLabel = () => {
    if (!reassignTarget) return '';

    const title = reassignTarget.item?.title || `ID ${reassignTarget.item?.id}`;
    switch (reassignTarget.type) {
      case 'video':
        return `Video: ${title}`;
      case 'book':
        return `Book: ${title}`;
      case 'chapter':
        return `Chapter: ${title}`;
      case 'section':
        return `Section: ${title}`;
      default:
        return title;
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();

    if (!reassignTarget || !reassignEventId) {
      setError('Please select a destination event');
      return;
    }

    const destinationEventId = Number(reassignEventId);

    try {
      setReassignLoading(true);
      setError(null);

      if (reassignTarget.type === 'video') {
        await historyPlusApi.updateVideo(reassignTarget.item.id, { eventId: destinationEventId });
      } else if (reassignTarget.type === 'book') {
        const linkResponse = await fetch(`/api/books/history-events/${destinationEventId}/link-book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: reassignTarget.item.id })
        });

        if (!linkResponse.ok) {
          throw new Error('Failed to link book to destination event');
        }

        const unlinkResponse = await fetch(`/api/books/history-events/${reassignTarget.sourceEventId}/unlink-book/${reassignTarget.item.id}`, {
          method: 'DELETE'
        });

        if (!unlinkResponse.ok) {
          throw new Error('Failed to unlink book from source event');
        }
      } else if (reassignTarget.type === 'chapter') {
        const response = await fetch(`/api/books/history-events/${destinationEventId}/link-chapter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterId: reassignTarget.item.id })
        });

        if (!response.ok) {
          throw new Error('Failed to reassign chapter');
        }
      } else if (reassignTarget.type === 'section') {
        const response = await fetch(`/api/books/history-events/${destinationEventId}/link-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId: reassignTarget.item.id })
        });

        if (!response.ok) {
          throw new Error('Failed to reassign section');
        }
      }

      setShowReassignModal(false);
      setReassignTarget(null);
      setReassignEventId('');
      await loadData();
    } catch (err) {
      console.error('Error reassigning content:', err);
      setError(`Failed to reassign content: ${err.message}`);
    } finally {
      setReassignLoading(false);
    }
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

            <button
              onClick={async () => {
                setShowPromptTemplateEditor(true);
                await loadPromptTemplate();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ✏️ Edit Prompt Template
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
        <div className="flex items-center gap-2 flex-wrap">
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

          <button
            onClick={toggleSelectAllCurrentPage}
            disabled={currentEvents.length === 0}
            className="ml-2 px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {currentEvents.length > 0 && currentEvents.every(evt => selectedEventIds.includes(evt.id))
              ? 'Unselect Page'
              : 'Select Page'}
          </button>

          <button
            onClick={openMergeModal}
            disabled={selectedEventIds.length < 2}
            className="px-3 py-1 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            Merge Selected ({selectedEventIds.length})
          </button>

          <button
            onClick={clearSelection}
            disabled={selectedEventIds.length === 0}
            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Clear Selection
          </button>
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
              selected={selectedEventIds.includes(event.id)}
              onToggleSelect={toggleEventSelection}
              onReassignContent={handleOpenReassignModal}
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

      {showPromptModal && promptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-indigo-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-semibold">AI Event Prompt Preview</h2>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-190px)]">
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                <p><strong>Event:</strong> {promptData.event?.title}</p>
                <p><strong>Date Range:</strong> {getDateRangeLabel(promptData.event?.startDate, promptData.event?.endDate)}</p>
                <p><strong>Linked YouTube Videos:</strong> {promptData.youtubeVideos.length}</p>
              </div>

              {promptData.youtubeVideos.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-sm">
                  <h3 className="font-medium text-red-900 mb-2">YouTube Links Included in Prompt</h3>
                  <ul className="space-y-1 text-red-800">
                    {promptData.youtubeVideos.map(video => (
                      <li key={video.id}>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-red-900"
                        >
                          {video.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Generated Prompt</h3>
                <textarea
                  readOnly
                  value={promptData.fullPrompt}
                  className="w-full min-h-[360px] border border-gray-300 rounded p-3 font-mono text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex flex-wrap items-center justify-end gap-2">
              {promptCopyStatus && (
                <span className="text-sm text-green-700 mr-auto">{promptCopyStatus}</span>
              )}
              <button
                onClick={handleCopyPrompt}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Copy Prompt
              </button>
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromptTemplateEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-purple-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Timeline Prompt Template</h2>
                <p className="text-sm text-purple-100">Customize the prompt used by the Generate Prompt button.</p>
              </div>
              <button
                onClick={() => setShowPromptTemplateEditor(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-170px)] space-y-4">
              {promptTemplateLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-600">
                  Loading prompt template...
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <p className="font-medium">Available placeholders</p>
                      <span className="text-xs text-purple-700">
                        Status: {isCustomPromptTemplate ? 'Custom template saved' : 'Using default template'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                      <div>{'{{eventTitle}}'}</div>
                      <div>{'{{dateRange}}'}</div>
                      <div>{'{{eventDescription}}'}</div>
                      <div>{'{{linkedYouTubeVideos}}'}</div>
                    </div>
                  </div>

                  <textarea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    className="w-full min-h-[420px] border border-gray-300 rounded p-3 font-mono text-sm"
                  />
                </>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex flex-wrap items-center justify-end gap-2">
              {promptTemplateStatus && (
                <span className="text-sm text-green-700 mr-auto">{promptTemplateStatus}</span>
              )}
              <button
                onClick={handleResetPromptTemplate}
                disabled={promptTemplateLoading || promptTemplateSaving}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Reset Default
              </button>
              <button
                onClick={handleSavePromptTemplate}
                disabled={promptTemplateLoading || promptTemplateSaving}
                className="px-4 py-2 border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
              >
                {promptTemplateSaving ? 'Saving...' : 'Save Template'}
              </button>
              <button
                onClick={() => setShowPromptTemplateEditor(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Merge Events</h2>
            <p className="text-sm text-gray-600 mb-4">
              Merging will keep one event and move content from the others into it.
            </p>

            <form onSubmit={handleMergeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Event</label>
                <select
                  value={mergeForm.primaryEventId}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, primaryEventId: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                >
                  {selectedEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title} ({event.startDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merged Title</label>
                <input
                  type="text"
                  value={mergeForm.title}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={mergeForm.category}
                    onChange={(e) => setMergeForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="text"
                    value={mergeForm.startDate}
                    onChange={(e) => setMergeForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                <input
                  type="text"
                  value={mergeForm.endDate}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  value={mergeForm.details}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, details: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 min-h-[140px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeMergeModal}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Merge Events
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReassignModal && reassignTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6">
            <h2 className="text-xl font-semibold mb-2">Reassign Content</h2>
            <p className="text-sm text-gray-600 mb-4">
              Move this item from <strong>{reassignTarget.sourceEventTitle}</strong> to another event.
            </p>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              {getReassignLabel()}
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Event</label>
                <SearchableEventSelect
                  events={events.filter(evt => evt.id !== reassignTarget.sourceEventId)}
                  value={reassignEventId}
                  onChange={(e) => setReassignEventId(e.target.value)}
                  placeholder="Search events to reassign..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReassignModal(false);
                    setReassignTarget(null);
                    setReassignEventId('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {reassignLoading ? 'Reassigning...' : 'Reassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timeline;
