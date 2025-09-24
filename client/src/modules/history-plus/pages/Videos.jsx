import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { historyPlusApi } from '../services/historyPlusApi';
import VideoCard from '../components/VideoCard';
import VideoForm from '../components/VideoForm';
import './Videos.css';

const Videos = () => {
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
      await fetchData(); // Refresh data
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

  const handleCreateNewEvent = async (videoId, eventSuggestion) => {
    try {
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
    </div>
  );
};

export default Videos;