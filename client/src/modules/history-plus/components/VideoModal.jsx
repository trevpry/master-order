import React from 'react';
import { historyPlusApi } from '../services/historyPlusApi';

const VideoModal = ({ video, isOpen, onClose, onWatchStatusChanged }) => {
  if (!isOpen || !video) return null;

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

  // Helper function to get video type icon
  const getVideoTypeIcon = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return '📺';
    } else if (url.includes('wondrium.com') || url.includes('thegreatcourses')) {
      return '🎓';
    }
    return '🎬';
  };

  // Helper function to get video platform name
  const getVideoPlatform = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'YouTube';
    } else if (url.includes('wondrium.com') || url.includes('thegreatcourses')) {
      return 'Wondrium';
    }
    return 'Video';
  };

  const handleToggleWatched = async () => {
    try {
      const response = await historyPlusApi.toggleVideoWatched(video.id);
      // Notify parent component about the status change if callback provided
      if (onWatchStatusChanged) {
        onWatchStatusChanged(video.id, !video.watched);
      }
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error updating watch status:', error);
    }
  };

  const thumbnailUrl = getYouTubeThumbnail(video.url);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Video Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video Info */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getVideoTypeIcon(video.url)}</span>
                <span className="text-sm text-gray-500 uppercase font-medium">
                  {getVideoPlatform(video.url)}
                </span>
                {video.watched && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    ✓ Watched
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {video.title || 'Untitled Video'}
              </h3>
              
              {video.description && (
                <p className="text-gray-600 mb-4">{video.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                {video.duration && (
                  <span>Duration: {video.duration}</span>
                )}
                {video.channel && (
                  <span>Channel: {video.channel.name}</span>
                )}
                {video.event && (
                  <span>Event: {video.event.title}</span>
                )}
              </div>
            </div>

            {/* Thumbnail */}
            {thumbnailUrl && (
              <div className="flex-shrink-0">
                <img
                  src={thumbnailUrl}
                  alt={video.title || 'Video thumbnail'}
                  className="w-40 h-24 object-cover rounded-lg shadow-sm border border-gray-200"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.open(video.url, '_blank')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-medium transition-colors"
            >
              Watch Video
            </button>
            
            <button
              onClick={handleToggleWatched}
              className={`px-6 py-2 rounded font-medium transition-colors ${
                video.watched 
                  ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {video.watched ? 'Mark as Unwatched' : 'Mark as Watched'}
            </button>
          </div>

          {/* URL Display */}
          <div className="mt-6 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={video.url}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
              />
              <button
                onClick={() => navigator.clipboard.writeText(video.url)}
                className="px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;
