import React, { useState, useEffect } from 'react';
import VideoModal from './VideoModal';
import EventEditModal from './EventEditModal';

const TimelineItem = ({ 
  event, 
  categories = [],
  onEdit, 
  onDelete, 
  onToggleReviewed,
  onGeneratePrompt,
  canEdit = true
}) => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [localEvent, setLocalEvent] = useState(event);
  const [showAllVideos, setShowAllVideos] = useState(false);
  
  // Reset showAllVideos when event changes
  useEffect(() => {
    setLocalEvent(event);
    setShowAllVideos(false);
  }, [event]);
  
  // Helper function to get category color
  const getCategoryColor = (categoryName) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#3B82F6'; // Default to blue if category not found
  };
  
  // Helper function to generate lighter background color from hex
  const getLighterColor = (hexColor) => {
    // Remove # if present
    const color = hexColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    // Make it lighter (mix with white)
    const lighterR = Math.round(r + (255 - r) * 0.8);
    const lighterG = Math.round(g + (255 - g) * 0.8);
    const lighterB = Math.round(b + (255 - b) * 0.8);
    return `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
  };

  // Helper function to extract YouTube video ID from URL
  const getYouTubeVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper function to get YouTube thumbnail URL
  const getYouTubeThumbnail = (url) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  // Handle video modal
  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  const handleCloseVideoModal = () => {
    setShowVideoModal(false);
    setSelectedVideo(null);
  };

  // Handle watch status change for videos
  const handleWatchStatusChanged = (videoId, newWatchedStatus) => {
    // Update the local event state
    setLocalEvent(prevEvent => ({
      ...prevEvent,
      videos: prevEvent.videos?.map(video => 
        video.id === videoId 
          ? { ...video, watched: newWatchedStatus }
          : video
      ) || []
    }));
  };

  // Helper function to format dates for display (without leading zeros on years)
  const formatHistoricalDate = (dateString) => {
    if (!dateString) return '';
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (dateString.startsWith('-')) {
      // BCE date - handle both full format (-YYYY-MM-DD) and year-only format (-YYYY)
      const firstDashIndex = dateString.indexOf('-', 1);
      let yearStr, remainingDate, month = '01', day = '01';
      
      if (firstDashIndex > 1) {
        // Full format: -YYYY...-MM-DD
        yearStr = dateString.slice(1, firstDashIndex);
        remainingDate = dateString.slice(firstDashIndex);
        month = remainingDate.slice(1, 3) || '01';
        day = remainingDate.slice(4, 6) || '01';
      } else {
        // Year-only format: -YYYY...
        yearStr = dateString.slice(1);
        month = '01';
        day = '01';
      }
      
      const year = parseInt(yearStr).toLocaleString(); // Format with commas
      
      if (day && day !== '01') {
        const monthName = monthNames[parseInt(month) - 1];
        return `${monthName} ${parseInt(day)}, ${year} BCE`;
      } else if (month && month !== '01') {
        const monthName = monthNames[parseInt(month) - 1];
        return `${monthName} ${year} BCE`;
      } else {
        return `${year} BCE`;
      }
    } else {
      // CE date - handle both full format (YYYY-MM-DD) and year-only format (YYYY)
      const firstDashIndex = dateString.indexOf('-');
      let yearStr, month = '01', day = '01';
      
      if (firstDashIndex > 0) {
        // Full format: YYYY-MM-DD or YYYY...-MM-DD
        yearStr = dateString.slice(0, firstDashIndex);
        month = dateString.slice(firstDashIndex + 1, firstDashIndex + 3) || '01';
        day = dateString.slice(firstDashIndex + 4, firstDashIndex + 6) || '01';
      } else {
        // Year-only format: YYYY...
        yearStr = dateString;
        month = '01';
        day = '01';
      }
      
      const year = parseInt(yearStr).toLocaleString(); // Format with commas
      
      if (day && day !== '01') {
        const monthName = monthNames[parseInt(month) - 1];
        return `${monthName} ${parseInt(day)}, ${year} CE`;
      } else if (month && month !== '01') {
        const monthName = monthNames[parseInt(month) - 1];
        return `${monthName} ${year} CE`;
      } else {
        return `${year} CE`;
      }
    }
  };

  // Helper function to format date range
  const formatDateRange = (startDate, endDate) => {
    const start = formatHistoricalDate(startDate);
    if (!endDate) return start;
    
    const end = formatHistoricalDate(endDate);
    return `${start} - ${end}`;
  };

  return (
    <div className="p-4 sm:p-6 transition-shadow bg-white border-l-4 border-blue-500 rounded-lg shadow-md hover:shadow-lg">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and Category */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">
              {localEvent.title}
            </h3>
            
            <div className="flex flex-wrap gap-2">
              {localEvent.category && (
                <span 
                  className="px-2 py-1 text-xs rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: getLighterColor(getCategoryColor(localEvent.category)),
                    color: getCategoryColor(localEvent.category),
                    border: `1px solid ${getCategoryColor(localEvent.category)}`
                  }}
                >
                  {localEvent.category}
                </span>
              )}
              <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                localEvent.reviewed 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {localEvent.reviewed ? '✓ Reviewed' : '◯ Unreviewed'}
              </span>
            </div>
          </div>
          
          {/* Date */}
          <div className="mb-3 text-base sm:text-lg font-medium text-blue-600">
            📅 {formatDateRange(localEvent.startDate, localEvent.endDate)}
          </div>
          
          {/* Details */}
          {localEvent.details && (
            <p className="mb-4 text-sm sm:text-base text-gray-600 leading-relaxed">{localEvent.details}</p>
          )}

          {/* Content counts */}
          <div className="flex flex-wrap gap-2 text-sm">
            {localEvent.videos && localEvent.videos.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 text-red-700 rounded bg-red-50">
                🎬 {localEvent.videos.length} video{localEvent.videos.length !== 1 ? 's' : ''}
              </span>
            )}
            {localEvent.books && localEvent.books.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 text-blue-700 rounded bg-blue-50">
                📚 {localEvent.books.length} book{localEvent.books.length !== 1 ? 's' : ''}
                {localEvent.books.some(book => book.read) && <span className="flex-shrink-0 text-green-600">✓</span>}
              </span>
            )}
            {localEvent.chapters && localEvent.chapters.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 text-purple-700 rounded bg-purple-50">
                📝 {localEvent.chapters.length} chapter{localEvent.chapters.length !== 1 ? 's' : ''}
                {localEvent.chapters.some(chapter => chapter.read) && <span className="flex-shrink-0 text-green-600">✓</span>}
              </span>
            )}
            {localEvent.sections && localEvent.sections.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 text-green-700 rounded bg-green-50">
                📄 {localEvent.sections.length} section{localEvent.sections.length !== 1 ? 's' : ''}
                {localEvent.sections.some(section => section.read) && <span className="flex-shrink-0 text-green-600">✓</span>}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
          {/* Mark Reviewed button */}
          {onToggleReviewed && (
            <button
              onClick={() => onToggleReviewed(event.id, !localEvent.reviewed)}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors w-full sm:w-auto ${
                localEvent.reviewed 
                  ? "text-yellow-600 border border-yellow-300 hover:text-yellow-700 hover:border-yellow-400" 
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {localEvent.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
            </button>
          )}
          
          {/* Admin buttons */}
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2">
              {onGeneratePrompt && (
                <button
                  onClick={() => onGeneratePrompt(event)}
                  className="px-4 py-2 text-sm border border-purple-300 text-purple-600 hover:text-purple-700 rounded font-medium transition-colors w-full sm:w-auto"
                >
                  🤖 Generate Prompt
                </button>
              )}
              
              {onEdit && (
                <button
                  onClick={() => onEdit(event)}
                  className="px-4 py-2 text-sm border border-blue-300 text-blue-600 hover:text-blue-700 rounded font-medium transition-colors w-full sm:w-auto"
                >
                  ✏️ Edit
                </button>
              )}
              
              {onDelete && (
                <button
                  onClick={() => onDelete(event.id)}
                  className="px-4 py-2 text-sm border border-red-300 text-red-600 hover:text-red-700 rounded font-medium transition-colors w-full sm:w-auto"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Links */}
      {(event.videos?.length > 0 || event.books?.length > 0 || event.chapters?.length > 0 || event.sections?.length > 0) && (
        <div className="pt-4 mt-4 border-t border-gray-200">
          {event.videos?.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  📺 Related Videos ({localEvent.videos.length})
                </h4>
                {localEvent.videos.length > 3 && (
                  <button
                    onClick={() => {
                      // Open first 5 videos with staggered timing to avoid popup blocking
                      localEvent.videos.slice(0, 5).forEach((video, idx) => {
                        setTimeout(() => window.open(video.url, '_blank'), idx * 200);
                      });
                    }}
                    className="px-3 py-2 text-xs text-white bg-red-600 hover:bg-red-700 w-full sm:w-auto rounded font-medium transition-colors"
                    title="Open multiple videos (first 5)"
                  >
                    🚀 Watch All (First 5)
                  </button>
                )}
              </div>

              {/* Video grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {localEvent.videos.slice(0, showAllVideos ? localEvent.videos.length : 6).map((video, index) => {
                  const isYouTube = video.url.includes('youtube.com') || video.url.includes('youtu.be');
                  const displayTitle = video.title || `${isYouTube ? 'YouTube' : 'Video'} ${index + 1}`;
                  const truncatedTitle = displayTitle.length > 40 
                    ? displayTitle.substring(0, 40) + '...' 
                    : displayTitle;
                  
                  return (
                    <button
                      key={video.id}
                      onClick={() => handleVideoClick(video)}
                      className="flex items-center justify-start gap-2 p-3 text-xs text-red-700 transition-colors border border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-800 h-auto min-h-[2.5rem] rounded"
                      title={`${displayTitle}${video.watched ? ' (Watched)' : ' (Unwatched)'}${canEdit ? ' - Click to view' : ''}`}
                    >
                      <span className="flex-shrink-0">
                        {isYouTube ? '📺' : '▶️'}
                      </span>
                      <span className="flex-1 text-left leading-tight">{truncatedTitle}</span>
                      <div className="flex items-center gap-1">
                        {video.watched && <span className="flex-shrink-0 text-green-600">✓</span>}
                      </div>
                    </button>
                  );
                })}
                
                {localEvent.videos.length > 6 && !showAllVideos && (
                  <button
                    onClick={() => setShowAllVideos(true)}
                    className="flex items-center justify-center p-3 text-xs text-blue-600 border border-dashed border-blue-300 hover:text-blue-800 hover:border-blue-400 hover:bg-blue-50 min-h-[2.5rem] transition-colors rounded"
                    title={`Show ${localEvent.videos.length - 6} more videos`}
                  >
                    <span className="mr-1">👁️</span>
                    Show {localEvent.videos.length - 6} more videos
                    <span className="ml-1">▼</span>
                  </button>
                )}
                
                {showAllVideos && localEvent.videos.length > 6 && (
                  <button
                    onClick={() => setShowAllVideos(false)}
                    className="flex items-center justify-center p-3 text-xs text-gray-600 border border-dashed hover:text-gray-800 hover:bg-gray-50 min-h-[2.5rem] transition-colors rounded"
                    title="Show fewer videos"
                  >
                    <span className="mr-1">👁️</span>
                    Show fewer videos
                    <span className="ml-1">▲</span>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Books, Chapters, Sections sections would go here */}
          {/* Simplified for now but can be expanded with full functionality */}
          
          {event.books?.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                📚 Related Books ({event.books.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.books.slice(0, 4).map((book) => (
                  <div
                    key={book.id}
                    className={`flex items-center justify-start gap-2 p-3 text-xs border-blue-200 h-auto min-h-[2.5rem] rounded ${
                      book.read 
                        ? 'text-blue-800 bg-blue-100' 
                        : 'text-blue-700 bg-blue-50'
                    }`}
                    title={`${book.title}${book.read ? ' (Read)' : ' (Unread)'}`}
                  >
                    <span className="flex-shrink-0">📖</span>
                    <span className="flex-1 text-left leading-tight">{book.title}</span>
                    <div className="flex items-center gap-1">
                      {book.read && <span className="flex-shrink-0 text-green-600">✓</span>}
                    </div>
                  </div>
                ))}
                {event.books.length > 4 && (
                  <div className="flex items-center justify-center p-3 text-xs text-gray-500 border border-dashed border-gray-300 rounded min-h-[2.5rem]">
                    +{event.books.length - 4} more books
                  </div>
                )}
              </div>
            </div>
          )}

          {event.chapters?.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                📖 Related Chapters ({event.chapters.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.chapters.slice(0, 4).map((chapter) => (
                  <div
                    key={chapter.id}
                    className={`flex items-center justify-start gap-2 p-3 text-xs border-green-200 h-auto min-h-[2.5rem] rounded ${
                      chapter.read 
                        ? 'text-green-800 bg-green-100' 
                        : 'text-green-700 bg-green-50'
                    }`}
                    title={`${chapter.title} from ${chapter.book?.title}${chapter.read ? ' (Read)' : ' (Unread)'}`}
                  >
                    <span className="flex-shrink-0">📝</span>
                    <div className="flex-1 text-left leading-tight">
                      <div className="font-medium">{chapter.title}</div>
                      <div className="text-gray-600 text-xs">{chapter.book?.title}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {chapter.read && <span className="flex-shrink-0 text-green-600">✓</span>}
                    </div>
                  </div>
                ))}
                {event.chapters.length > 4 && (
                  <div className="flex items-center justify-center p-3 text-xs text-gray-500 border border-dashed border-gray-300 rounded min-h-[2.5rem]">
                    +{event.chapters.length - 4} more chapters
                  </div>
                )}
              </div>
            </div>
          )}

          {event.sections?.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                📄 Related Sections ({event.sections.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.sections.slice(0, 4).map((section) => (
                  <div
                    key={section.id}
                    className={`flex items-center justify-start gap-2 p-3 text-xs border-purple-200 h-auto min-h-[2.5rem] rounded ${
                      section.read 
                        ? 'text-purple-800 bg-purple-100' 
                        : 'text-purple-700 bg-purple-50'
                    }`}
                    title={`${section.title} from ${section.chapter?.book?.title}${section.read ? ' (Read)' : ' (Unread)'}`}
                  >
                    <span className="flex-shrink-0">📄</span>
                    <div className="flex-1 text-left leading-tight">
                      <div className="font-medium">{section.title}</div>
                      <div className="text-gray-600 text-xs">{section.chapter?.title} - {section.chapter?.book?.title}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {section.read && <span className="flex-shrink-0 text-green-600">✓</span>}
                    </div>
                  </div>
                ))}
                {event.sections.length > 4 && (
                  <div className="flex items-center justify-center p-3 text-xs text-gray-500 border border-dashed border-gray-300 rounded min-h-[2.5rem]">
                    +{event.sections.length - 4} more sections
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && selectedVideo && (
        <VideoModal
          video={selectedVideo}
          isOpen={showVideoModal}
          onClose={handleCloseVideoModal}
          onWatchStatusChanged={handleWatchStatusChanged}
        />
      )}
    </div>
  );
};

export default TimelineItem;
