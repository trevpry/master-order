import React from 'react';

const VideoCard = ({ 
  video, 
  onToggleWatch, 
  onToggleAssignLater, 
  onEdit, 
  onDelete,
  isEditing,
  editFormData,
  events,
  channels,
  onEditSubmit,
  onEditCancel,
  onEditInputChange
}) => {
  if (!video) return null;

  const handleToggleWatch = () => {
    const isWatched = video.user_video_watches && video.user_video_watches.watched;
    onToggleWatch(video.id, isWatched);
  };

  const handleToggleAssignLater = () => {
    onToggleAssignLater(video.id, video.assignLater);
  };

  const handleEdit = () => {
    onEdit(video);
  };

  const handleDelete = () => {
    onDelete(video.id);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title}
              className="w-32 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-32 h-20 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-400 text-sm">No thumbnail</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
              {video.title}
            </h3>
            <div className="flex gap-1 flex-shrink-0">
              {video.user_video_watches && video.user_video_watches.watched && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  ✓ Watched
                </span>
              )}
              {video.assignLater && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  📌 Assign Later
                </span>
              )}
            </div>
          </div>

          {video.description && (
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {video.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            {video.type && (
              <span className="flex items-center gap-1">
                {video.type === 'youtube' && '📺'}
                {video.type === 'educational' && '📚'}
                {video.type === 'Great Courses' && '🎓'}
                {video.type === 'other' && '🔗'}
                {video.type}
              </span>
            )}
            {video.duration && (
              <span>⏱️ {video.duration}</span>
            )}
            {video.channel?.name && (
              <span>📺 {video.channel.name}</span>
            )}
            {video.event?.title && (
              <span>📅 {video.event.title}</span>
            )}
          </div>

          {video.url && (
            <div className="mb-3">
              <a 
                href={video.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm truncate block"
              >
                🔗 {video.url}
              </a>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleToggleWatch}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                video.user_video_watches && video.user_video_watches.watched 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {video.user_video_watches && video.user_video_watches.watched ? '✓ Watched' : 'Mark Watched'}
            </button>

            <button
              onClick={handleToggleAssignLater}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                video.assignLater 
                  ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {video.assignLater ? '📌 Assigned Later' : 'Assign Later'}
            </button>

            <button
              onClick={handleEdit}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 rounded transition-colors"
            >
              ✏️ Edit
            </button>

            <button
              onClick={handleDelete}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 hover:bg-red-200 rounded transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;