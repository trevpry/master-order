import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { historyPlusApi } from '../services/historyPlusApi';
import VideoCard from '../components/VideoCard';
import VideoForm from '../components/VideoForm';
import {
  buildExistingEventsCsv,
  downloadCsvFile,
  getExistingEventsCsvFileName,
  getExistingEventsCsvReferenceText
} from '../utils/existingEventsCsv';
import './Videos.css';

const Videos = () => {
  const DEFAULT_SHARED_EVENT_DECISION_GUIDANCE = `SHARED EVENT DECISION GUIDANCE:

1. Prefer assigning to an existing event when the content clearly matches one listed event in topic, date range, and scope.
2. Create a new event when the content is more specific than the available events, when no listed event accurately fits, or when the content centers on a distinct sub-event within a broader period.
3. New events should be narrowly scoped, historically grounded, date-aware, and reusable for future related content.
4. Do not force a broad existing event if the content is really about a more focused battle, campaign, treaty, dynasty change, expedition, reform movement, or other discrete historical development.
5. If choosing an existing event, use the exact event title from the provided list.
6. If creating a new event, make the title specific and provide the best justified start date, end date, category, and concise description from the material.
7. When uncertain between a weak existing-event match and a clearly supported new event, prefer the better-evidenced option rather than the broader one by default.`;

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, watched: 0, unwatched: 0, unassigned: 0, assignLater: 0 });
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [aiAssignmentFilter, setAiAssignmentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [videosPerPage] = useState(20);
  const [events, setEvents] = useState([]);
  const [channels, setChannels] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    type: 'youtube',
    eventId: '',
    channelId: '',
    description: '',
    duration: '',
    thumbnailUrl: '',
    assignLater: false
  });
  
  // AI Prompt Editor state
  const [showAiPromptEditor, setShowAiPromptEditor] = useState(false);
  const [aiPromptData, setAiPromptData] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [defaultPromptTemplate, setDefaultPromptTemplate] = useState('');
  const [isCustomPromptTemplate, setIsCustomPromptTemplate] = useState(false);
  const [promptTemplateSaving, setPromptTemplateSaving] = useState(false);
  const [promptTemplateStatus, setPromptTemplateStatus] = useState('');
  const [sharedEventDecisionGuidance, setSharedEventDecisionGuidance] = useState(DEFAULT_SHARED_EVENT_DECISION_GUIDANCE);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [videosResponse, statsResponse, eventsResponse, channelsResponse] = await Promise.all([
        historyPlusApi.getVideos(),
        historyPlusApi.getVideoStats(),
        historyPlusApi.getEvents(),
        historyPlusApi.getChannels()
      ]);

      // Ensure videos is always an array - handle nested data structure
      const videosData = videosResponse?.data?.videos || videosResponse?.videos || videosResponse?.data || videosResponse;
      setVideos(Array.isArray(videosData) ? videosData : []);
      
      setStats(statsResponse.data || statsResponse || { total: 0, watched: 0, unwatched: 0, unassigned: 0, assignLater: 0 });
      
      const eventsData = eventsResponse.data || eventsResponse;
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      
      const channelsData = channelsResponse.data || channelsResponse;
      setChannels(Array.isArray(channelsData) ? channelsData : []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      // Ensure we have fallback arrays even on error
      setVideos([]);
      setEvents([]);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container p-6 mx-auto">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading videos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container p-6 mx-auto">
        <div className="px-4 py-3 text-red-700 bg-red-100 border border-red-400 rounded">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  // Filter videos based on search and filters
  const filteredVideos = (Array.isArray(videos) ? videos : []).filter(video => {
    // Search filter
    if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Main status filter
    if (filter === 'watched' && !(video.user_video_watches && video.user_video_watches.watched)) {
      return false;
    }
    if (filter === 'unwatched' && (video.user_video_watches && video.user_video_watches.watched)) {
      return false;
    }
    if (filter === 'assignLater' && !video.assignLater) {
      return false;
    }
    if (filter === 'notAssignLater' && video.assignLater) {
      return false;
    }

    // Assignment filter (based on eventId only - channelId doesn't determine assignment)
    if (assignmentFilter === 'assigned' && !video.eventId) {
      return false;
    }
    if (assignmentFilter === 'unassigned' && video.eventId) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && video.type !== typeFilter) {
      return false;
    }

    // AI Assignment filter
    if (aiAssignmentFilter === 'ai-assigned' && !video.assignedByAI) {
      return false;
    }
    if (aiAssignmentFilter === 'manual-assigned' && video.assignedByAI) {
      return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const currentVideos = filteredVideos.slice(
    (currentPage - 1) * videosPerPage,
    currentPage * videosPerPage
  );

  // Calculate type counts for filter buttons (considering current filters)
  const getTypeCount = (type) => {
    if (!Array.isArray(videos)) return 0;
    return videos.filter(video => {
      // Apply search filter
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply main status filter (watch status, assign later)
      if (filter === 'watched' && !(video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'unwatched' && (video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'assignLater' && !video.assignLater) {
        return false;
      }
      if (filter === 'notAssignLater' && video.assignLater) {
        return false;
      }
      
      // Apply assignment filter (based on eventId only - channelId doesn't determine assignment)
      if (assignmentFilter === 'assigned' && !video.eventId) {
        return false;
      }
      if (assignmentFilter === 'unassigned' && video.eventId) {
        return false;
      }
      
      // Apply AI assignment filter
      if (aiAssignmentFilter === 'ai-assigned' && !video.assignedByAI) {
        return false;
      }
      if (aiAssignmentFilter === 'manual-assigned' && video.assignedByAI) {
        return false;
      }
      
      // Check type match
      return video.type === type;
    }).length;
  };

  // Calculate assignment counts for filter buttons (considering current filters)
  const getAssignmentCount = (assignmentType) => {
    if (!Array.isArray(videos)) return 0;
    return videos.filter(video => {
      // Apply search filter
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply main status filter
      if (filter === 'watched' && !(video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'unwatched' && (video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'assignLater' && !video.assignLater) {
        return false;
      }
      if (filter === 'notAssignLater' && video.assignLater) {
        return false;
      }
      
      // Apply type filter
      if (typeFilter !== 'all' && video.type !== typeFilter) {
        return false;
      }
      
      // Apply AI assignment filter
      if (aiAssignmentFilter === 'ai-assigned' && !video.assignedByAI) {
        return false;
      }
      if (aiAssignmentFilter === 'manual-assigned' && video.assignedByAI) {
        return false;
      }
      
      // Check assignment match (based on eventId only - channelId doesn't determine assignment)
      if (assignmentType === 'assigned') {
        return video.eventId;
      } else if (assignmentType === 'unassigned') {
        return !video.eventId;
      }
      return true;
    }).length;
  };

  // Calculate AI assignment counts for filter buttons (considering current filters)
  const getAiAssignmentCount = (aiAssignmentType) => {
    if (!Array.isArray(videos)) return 0;
    return videos.filter(video => {
      // Apply search filter
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply main status filter
      if (filter === 'watched' && !(video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'unwatched' && (video.user_video_watches && video.user_video_watches.watched)) {
        return false;
      }
      if (filter === 'assignLater' && !video.assignLater) {
        return false;
      }
      if (filter === 'notAssignLater' && video.assignLater) {
        return false;
      }
      
      // Apply assignment filter
      if (assignmentFilter === 'assigned' && !video.eventId) {
        return false;
      }
      if (assignmentFilter === 'unassigned' && video.eventId) {
        return false;
      }
      
      // Apply type filter
      if (typeFilter !== 'all' && video.type !== typeFilter) {
        return false;
      }
      
      // Check AI assignment match
      if (aiAssignmentType === 'ai-assigned') {
        return video.assignedByAI;
      } else if (aiAssignmentType === 'manual-assigned') {
        return !video.assignedByAI;
      }
      return true;
    }).length;
  };

  // Handler functions
  const handleEdit = (video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title || '',
      url: video.url || '',
      type: video.type || 'youtube',
      eventId: video.eventId || '',
      channelId: video.channelId || '',
      description: video.description || '',
      duration: video.duration || '',
      thumbnailUrl: video.thumbnailUrl || '',
      assignLater: video.assignLater || false
    });
  };

  const handleDelete = async (videoId) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
      await historyPlusApi.deleteVideo(videoId);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  const handleToggleWatch = async (videoId, watched) => {
    try {
      await historyPlusApi.toggleVideoWatched(videoId);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error toggling watch status:', error);
      alert('Failed to update watch status');
    }
  };

  const handleToggleAssignLater = async (videoId, assignLater) => {
    try {
      await historyPlusApi.updateVideo(videoId, { assignLater: !assignLater });
      
      // Update the specific video in state instead of fetching all data
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === videoId 
            ? { ...video, assignLater: !assignLater }
            : video
        )
      );
      
      // Update stats to reflect the change
      setStats(prevStats => ({
        ...prevStats,
        assignLater: !assignLater 
          ? prevStats.assignLater + 1 
          : prevStats.assignLater - 1
      }));
    } catch (error) {
      console.error('Error toggling assign later status:', error);
      alert('Failed to update assign later status');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingVideo) {
        await historyPlusApi.updateVideo(editingVideo.id, formData);
      } else {
        await historyPlusApi.createVideo(formData);
      }
      
      setShowCreateForm(false);
      setEditingVideo(null);
      setFormData({
        title: '',
        url: '',
        type: 'youtube',
        eventId: '',
        channelId: '',
        description: '',
        duration: '',
        thumbnailUrl: '',
        assignLater: false
      });
      
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Failed to save video');
    }
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingVideo(null);
    setFormData({
      title: '',
      url: '',
      type: 'youtube',
      eventId: '',
      channelId: '',
      description: '',
      duration: '',
      thumbnailUrl: '',
      assignLater: false
    });
  };

  // AI Assignment Handlers
  const handleAssignToEvent = async (videoId, eventId) => {
    try {
      const response = await fetch(`/api/history-plus/ai/assign-video-to-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, eventId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign video: ${response.statusText}`);
      }

      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error assigning video to event:', error);
      alert('Failed to assign video to event');
    }
  };

  const renderVideoPromptPreview = (template, eventsList = [], categoriesList = []) => {
    const activeTemplate = String(template || '');
    const existingEventsCsvFileName = getExistingEventsCsvFileName('video-ai-assignment');

    const renderedCategories = categoriesList.map(category => 
      `- "${category.name}": ${category.description || 'Historical category'}`
    ).join('\n');

    return activeTemplate
      .replaceAll('{{VIDEO_URL}}', 'https://www.youtube.com/watch?v=SAMPLE_VIDEO_ID')
      .replaceAll('{{VIDEO_TITLE_LINE}}', 'Video Title: Sample Educational History Video')
      .replaceAll('{{VIDEO_DESCRIPTION_LINE}}', 'Video Description: Sample video description for AI analysis')
      .replaceAll('{{EXISTING_EVENTS}}', getExistingEventsCsvReferenceText(existingEventsCsvFileName))
      .replaceAll('{{SHARED_EVENT_DECISION_GUIDANCE}}', sharedEventDecisionGuidance)
      .replaceAll('{{AVAILABLE_CATEGORIES}}', renderedCategories || 'No available categories');
  };

  const downloadExistingEventsCsv = (fileBaseName = 'video-ai-assignment') => {
    const fileName = getExistingEventsCsvFileName(fileBaseName);
    downloadCsvFile(fileName, buildExistingEventsCsv(aiPromptData?.events || []));
    return fileName;
  };

  // AI Prompt Editor Handlers
  const handleOpenAiPromptEditor = async () => {
    setLoadingPrompt(true);
    setShowAiPromptEditor(true);
    
    try {
      // Fetch sample data to build a representative prompt
      const [eventsResponse, categoriesResponse, templateResponse, sharedGuidanceResponse] = await Promise.all([
        historyPlusApi.getEvents(),
        historyPlusApi.getCategories(),
        historyPlusApi.getVideoPromptTemplate(),
        historyPlusApi.getPromptTemplate('eventDecision')
      ]);
      
      const events = eventsResponse.data || eventsResponse;
      const categories = categoriesResponse.data || categoriesResponse;
      const templatePayload = templateResponse.data || {};
      const loadedTemplate = templatePayload.template || '';

      setPromptTemplate(loadedTemplate);
      setDefaultPromptTemplate(templatePayload.defaultTemplate || '');
      setIsCustomPromptTemplate(Boolean(templatePayload.isCustom));
      setSharedEventDecisionGuidance(sharedGuidanceResponse.data?.template || DEFAULT_SHARED_EVENT_DECISION_GUIDANCE);
      setPromptTemplateStatus('');
      
      setAiPromptData({
        events,
        categories,
        eventsCount: events.length,
        categoriesCount: categories.length
      });
      
    } catch (error) {
      console.error('Error loading AI prompt data:', error);
      alert('Failed to load AI prompt data');
    } finally {
      setLoadingPrompt(false);
    }
  };
  
  const handleCopyAiPrompt = () => {
    if (aiPromptData) {
      const preview = renderVideoPromptPreview(promptTemplate, aiPromptData.events, aiPromptData.categories);
      downloadExistingEventsCsv('video-ai-assignment');
      navigator.clipboard.writeText(preview);
      alert('AI prompt copied to clipboard and existing events CSV downloaded!');
    }
  };

  const handleSaveAiPromptTemplate = async () => {
    try {
      setPromptTemplateSaving(true);
      const response = await historyPlusApi.saveVideoPromptTemplate(promptTemplate);
      const payload = response.data || {};

      setPromptTemplate(payload.template || promptTemplate);
      setDefaultPromptTemplate(payload.defaultTemplate || defaultPromptTemplate);
      setIsCustomPromptTemplate(Boolean(payload.isCustom));
      setPromptTemplateStatus('Template saved');
    } catch (error) {
      console.error('Error saving video AI prompt template:', error);
      setPromptTemplateStatus('Failed to save template');
    } finally {
      setPromptTemplateSaving(false);
      setTimeout(() => setPromptTemplateStatus(''), 2500);
    }
  };

  const handleResetAiPromptTemplate = async () => {
    try {
      setPromptTemplateSaving(true);
      const response = await historyPlusApi.saveVideoPromptTemplate('');
      const payload = response.data || {};

      setPromptTemplate(payload.template || defaultPromptTemplate);
      setDefaultPromptTemplate(payload.defaultTemplate || defaultPromptTemplate);
      setIsCustomPromptTemplate(false);
      setPromptTemplateStatus('Template reset to default');
    } catch (error) {
      console.error('Error resetting video AI prompt template:', error);
      setPromptTemplateStatus('Failed to reset template');
    } finally {
      setPromptTemplateSaving(false);
      setTimeout(() => setPromptTemplateStatus(''), 2500);
    }
  };

  const handleCreateNewEvent = async (videoId, eventSuggestion, options = {}) => {
    try {
      // If skipApiCall is true, this is just a notification to refresh data
      if (options.skipApiCall) {
        console.log('🔄 Event created by child component, refreshing data...');
        await fetchData(); // Just refresh data
        return;
      }

      // Otherwise, make the API call (for direct parent usage)
      const response = await fetch(`/api/history-plus/ai/create-event-for-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, eventData: eventSuggestion }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
      }

      // Event created successfully - try to refresh data but don't fail if refresh fails
      try {
        await fetchData(); // Refresh data
      } catch (refreshError) {
        console.warn('Event created successfully, but failed to refresh data:', refreshError);
        // Don't throw - the event creation was successful
      }
    } catch (error) {
      console.error('Error creating new event for video:', error);
      alert('Failed to create new event');
    }
  };

  return (
    <div className="container p-6 mx-auto">
      <h1 className="mb-4 text-4xl font-bold text-gray-800">Video Library</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="p-4 bg-blue-100 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800">Total Videos</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="p-4 bg-green-100 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800">Watched</h3>
          <p className="text-3xl font-bold text-green-600">{stats.watched}</p>
        </div>
        <div className="p-4 bg-orange-100 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800">Unwatched</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.unwatched}</p>
        </div>
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800">Unassigned</h3>
          <p className="text-3xl font-bold text-gray-600">{stats.unassigned}</p>
        </div>
        <div className="p-4 bg-orange-100 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800">📌 Assign Later</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.assignLater}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="🔍 Search videos by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:text-gray-800 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            filter === 'all' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Videos ({stats.total})
        </button>
        <button
          onClick={() => setFilter('unwatched')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            filter === 'unwatched' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Unwatched ({stats.unwatched})
        </button>
        <button
          onClick={() => setFilter('watched')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            filter === 'watched' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Watched ({stats.watched})
        </button>
        <button
          onClick={() => setFilter('assignLater')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            filter === 'assignLater' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📌 Assign Later ({stats.assignLater})
        </button>
        <button
          onClick={() => setFilter('notAssignLater')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            filter === 'notAssignLater' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          ✅ Not Assign Later ({stats.total - stats.assignLater})
        </button>
      </div>

      {/* Assignment Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="self-center mr-2 text-sm font-medium text-gray-700">Assignment:</span>
        <button
          onClick={() => setAssignmentFilter('all')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            assignmentFilter === 'all' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({getAssignmentCount('assigned') + getAssignmentCount('unassigned')})
        </button>
        <button
          onClick={() => setAssignmentFilter('assigned')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            assignmentFilter === 'assigned' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Assigned ({getAssignmentCount('assigned')})
        </button>
        <button
          onClick={() => setAssignmentFilter('unassigned')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            assignmentFilter === 'unassigned' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Unassigned ({getAssignmentCount('unassigned')})
        </button>
      </div>

      {/* AI Assignment Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="self-center mr-2 text-sm font-medium text-gray-700">AI Assignment:</span>
        <button
          onClick={() => setAiAssignmentFilter('all')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            aiAssignmentFilter === 'all' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({getAiAssignmentCount('ai-assigned') + getAiAssignmentCount('manual-assigned')})
        </button>
        <button
          onClick={() => setAiAssignmentFilter('ai-assigned')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            aiAssignmentFilter === 'ai-assigned' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          🤖 AI Assigned ({getAiAssignmentCount('ai-assigned')})
        </button>
        <button
          onClick={() => setAiAssignmentFilter('manual-assigned')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            aiAssignmentFilter === 'manual-assigned' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          👤 Manual Assigned ({getAiAssignmentCount('manual-assigned')})
        </button>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="self-center mr-2 text-sm font-medium text-gray-700">Filter by type:</span>
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            typeFilter === 'all' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Types ({getTypeCount('youtube') + getTypeCount('great-courses-plus') + getTypeCount('Great Courses')})
        </button>
        <button
          onClick={() => setTypeFilter('youtube')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            typeFilter === 'youtube' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📺 YouTube ({getTypeCount('youtube')})
        </button>
        <button
          onClick={() => setTypeFilter('great-courses-plus')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            typeFilter === 'great-courses-plus' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📚 Great Courses Plus ({getTypeCount('great-courses-plus')})
        </button>
        <button
          onClick={() => setTypeFilter('Great Courses')}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
            typeFilter === 'Great Courses' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          🎓 Great Courses ({getTypeCount('Great Courses')})
        </button>
      </div>

      {/* Admin Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 text-white transition-colors bg-green-500 rounded-lg hover:bg-green-600"
        >
          + Add Video
        </button>
        <button
          onClick={handleOpenAiPromptEditor}
          disabled={loadingPrompt}
          className="px-4 py-2 text-white transition-colors bg-purple-500 rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed"
        >
          {loadingPrompt ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
              Loading...
            </>
          ) : (
            '🤖 Edit AI Prompt'
          )}
        </button>
        <Link to="/channels">
          <button className="px-4 py-2 text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600">
            Manage Channels
          </button>
        </Link>
      </div>

      {/* Video List */}
      <div className="mb-6 space-y-4">
        {currentVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleWatch={handleToggleWatch}
            onToggleAssignLater={handleToggleAssignLater}
            onAssignToEvent={handleAssignToEvent}
            onCreateNewEvent={handleCreateNewEvent}
          />
        ))}
        
        {currentVideos.length === 0 && filteredVideos.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500">No videos found matching the current filters.</p>
          </div>
        )}
        
        {currentVideos.length === 0 && filteredVideos.length > 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500">No videos on this page. Try a different page.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing {((currentPage - 1) * videosPerPage) + 1} to {Math.min(currentPage * videosPerPage, filteredVideos.length)} of {filteredVideos.length} videos
          </p>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 border rounded ${
                  currentPage === page 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingVideo) && (
        <VideoForm
          video={editingVideo}
          events={events}
          channels={channels}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isEditing={!!editingVideo}
        />
      )}
      
      {/* AI Prompt Editor Modal */}
      {showAiPromptEditor && aiPromptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">🤖 Video AI Assignment Prompt Editor</h3>
                <button
                  onClick={() => setShowAiPromptEditor(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">📊 System Context</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Available Events:</strong> {aiPromptData.eventsCount} historical events</div>
                    <div><strong>Available Categories:</strong> {aiPromptData.categoriesCount} categories</div>
                    <div><strong>Usage:</strong> This prompt is used for all video AI assignments</div>
                    <div><strong>Status:</strong> {isCustomPromptTemplate ? 'Custom template saved' : 'Using default template'}</div>
                  </div>
                </div>

                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Template Placeholders</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs text-purple-800">
                    <div>{'{{VIDEO_URL}}'}</div>
                    <div>{'{{VIDEO_TITLE_LINE}}'}</div>
                    <div>{'{{VIDEO_DESCRIPTION_LINE}}'}</div>
                    <div>{'{{EXISTING_EVENTS}}'}</div>
                    <div>{'{{SHARED_EVENT_DECISION_GUIDANCE}}'}</div>
                    <div>{'{{AVAILABLE_CATEGORIES}}'}</div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Editable Template</h4>
                  <textarea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    className="w-full min-h-[320px] border border-gray-300 rounded p-3 font-mono text-xs"
                    placeholder="Enter video AI assignment prompt template..."
                  />
                </div>

                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">📚 Existing Events CSV Export</h4>
                  <div className="text-sm space-y-1 text-gray-700">
                    <div><strong>Rows:</strong> {aiPromptData.eventsCount}</div>
                    <div><strong>Columns:</strong> Event Title, Start Date, End Date, Event Description</div>
                    <div><strong>File:</strong> {getExistingEventsCsvFileName('video-ai-assignment')}</div>
                    <button
                      onClick={() => downloadExistingEventsCsv('video-ai-assignment')}
                      className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Download Existing Events CSV
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2">🏷️ Categories Context ({aiPromptData.categoriesCount} total)</h4>
                  <div className="text-sm max-h-32 overflow-y-auto">
                    {aiPromptData.categories?.length > 0 ? (
                      <ul className="space-y-1">
                        {aiPromptData.categories.map((category, index) => (
                          <li key={index} className="text-gray-700">
                            • "{category.name}": {category.description || 'Historical category'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">No categories available</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">🤖 Rendered Prompt Preview</h4>
                  <div className="bg-white p-3 rounded border font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {renderVideoPromptPreview(promptTemplate, aiPromptData.events, aiPromptData.categories)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              {promptTemplateStatus && (
                <div className="flex-1 self-center text-sm text-green-700">{promptTemplateStatus}</div>
              )}
              <button
                onClick={handleResetAiPromptTemplate}
                disabled={promptTemplateSaving}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Reset Default
              </button>
              <button
                onClick={handleSaveAiPromptTemplate}
                disabled={promptTemplateSaving}
                className="px-4 py-2 border border-purple-300 text-purple-700 rounded hover:bg-purple-50 disabled:opacity-50"
              >
                {promptTemplateSaving ? 'Saving...' : 'Save Template'}
              </button>
              <button
                onClick={handleCopyAiPrompt}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium"
              >
                📋 Copy Preview + Download CSV
              </button>
              <button
                onClick={() => setShowAiPromptEditor(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Videos;