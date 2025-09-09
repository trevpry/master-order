import React from 'react';
import Button from '../../../../../../shared/components/Button';

const EpisodeForm = ({ 
  isOpen, 
  onClose, 
  formData, 
  setFormData, 
  onSubmit, 
  isLoading, 
  editingItem 
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const handleClose = () => {
    setFormData({ series: '', season: '', episode: '' });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit TV Episode' : 'Add TV Episode'}</h3>
          <Button
            onClick={handleClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="episode-form">
          <div className="form-group">
            <label htmlFor="series">Series Name *</label>
            <input
              type="text"
              id="series"
              value={formData.series}
              onChange={(e) => setFormData({
                ...formData,
                series: e.target.value
              })}
              placeholder="e.g., Breaking Bad"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="season">Season Number *</label>
              <input
                type="number"
                id="season"
                min="1"
                value={formData.season}
                onChange={(e) => setFormData({
                  ...formData,
                  season: e.target.value
                })}
                placeholder="1"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="episode">Episode Number *</label>
              <input
                type="number"
                id="episode"
                min="1"
                value={formData.episode}
                onChange={(e) => setFormData({
                  ...formData,
                  episode: e.target.value
                })}
                placeholder="1"
                required
              />
            </div>
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="primary"
            >
              {isLoading 
                ? (editingItem ? 'Updating...' : 'Searching...') 
                : (editingItem ? 'Update Episode' : 'Add Episode')
              }
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

export default EpisodeForm;
