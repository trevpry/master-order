import React from 'react';

const VideoForm = ({
  formData,
  events,
  channels,
  onInputChange,
  onSubmit,
  onCancel,
  isEditing = false
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-800 mb-4">
        {isEditing ? 'Edit Video' : 'Add New Video'}
      </h3>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={onInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter video title"
            />
          </div>

          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={formData.url}
              onChange={onInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={onInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="youtube">📺 YouTube</option>
              <option value="educational">📚 Educational</option>
              <option value="Great Courses">🎓 Great Courses</option>
              <option value="other">🔗 Other</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration
            </label>
            <input
              type="text"
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={onInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 10:30, 1h 30m"
            />
          </div>

          {/* Channel */}
          <div>
            <label htmlFor="channelId" className="block text-sm font-medium text-gray-700 mb-1">
              Channel
            </label>
            <select
              id="channelId"
              name="channelId"
              value={formData.channelId}
              onChange={onInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a channel...</option>
              {channels?.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          {/* Event */}
          <div>
            <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
              Event
            </label>
            <select
              id="eventId"
              name="eventId"
              value={formData.eventId}
              onChange={onInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an event...</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thumbnail URL */}
        <div>
          <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Thumbnail URL
          </label>
          <input
            type="url"
            id="thumbnailUrl"
            name="thumbnailUrl"
            value={formData.thumbnailUrl}
            onChange={onInputChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={onInputChange}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter video description..."
          />
        </div>

        {/* Assign Later Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="assignLater"
            name="assignLater"
            checked={formData.assignLater}
            onChange={onInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="assignLater" className="ml-2 text-sm text-gray-700">
            📌 Assign Later
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            {isEditing ? 'Update Video' : 'Add Video'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default VideoForm;