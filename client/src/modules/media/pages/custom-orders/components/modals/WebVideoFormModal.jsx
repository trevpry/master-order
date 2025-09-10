import React from 'react';
import Button from '../../../../../../shared/components/Button';

const WebVideoFormModal = ({
  show,
  editingItem,
  webVideoFormData,
  setWebVideoFormData,
  onClose,
  onSubmit
}) => {
  if (!show) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const handleClose = () => {
    setWebVideoFormData({ title: '', url: '', description: '' });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit Web Video' : 'Add Web Video'}</h3>
          <Button
            onClick={handleClose}
            className="close-modal"
          >
            ×
          </Button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="webvideo-form">
          <div className="form-group">
            <label htmlFor="webvideo-title">Video Title *</label>
            <input
              type="text"
              id="webvideo-title"
              value={webVideoFormData.title}
              onChange={(e) => setWebVideoFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter video title"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="webvideo-url">Video URL *</label>
            <input
              type="url"
              id="webvideo-url"
              value={webVideoFormData.url}
              onChange={(e) => setWebVideoFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://youtube.com/watch?v=... or any video URL"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="webvideo-description">Description (optional)</label>
            <textarea
              id="webvideo-description"
              value={webVideoFormData.description}
              onChange={(e) => setWebVideoFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the video"
              rows="3"
            />
          </div>
          
          <div className="form-actions">
            <Button type="submit" className="primary">
              {editingItem ? 'Update Web Video' : 'Add Web Video'}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              className="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebVideoFormModal;
