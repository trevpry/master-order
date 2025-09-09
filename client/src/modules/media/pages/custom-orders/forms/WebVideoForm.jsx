import React from 'react';
import Button from '../../../../../shared/components/Button';

const WebVideoForm = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  editingItem
}) => {
  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const title = editingItem ? 'Edit Web Video' : 'Add Web Video';
  const submitText = editingItem ? 'Update Web Video' : 'Add Web Video';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter video title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://youtube.com/watch?v=... or any video URL"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the video"
              rows="3"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!formData.title.trim() || !formData.url.trim()}
              className="flex-1"
            >
              {submitText}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebVideoForm;
