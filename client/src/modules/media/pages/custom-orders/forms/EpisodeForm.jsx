import React from 'react';
import Button from '../../../../../shared/components/Button';

const EpisodeForm = ({
  showEpisodeForm,
  setShowEpisodeForm,
  episodeFormData,
  setEpisodeFormData,
  episodeSearchLoading,
  setEpisodeSearchLoading,
  editingItem,
  setEditingItem,
  handleSearchTVEpisode,
  resetEpisodeForm
}) => {
  if (!showEpisodeForm) return null;

  const handleClose = () => {
    setShowEpisodeForm(false);
    setEditingItem(null);
    resetEpisodeForm();
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
        
        <form onSubmit={handleSearchTVEpisode} className="episode-form">
          <div className="form-group">
            <label htmlFor="series">Series Name *</label>
            <input
              type="text"
              id="series"
              value={episodeFormData.series}
              onChange={(e) => setEpisodeFormData({
                ...episodeFormData,
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
                value={episodeFormData.season}
                onChange={(e) => setEpisodeFormData({
                  ...episodeFormData,
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
                value={episodeFormData.episode}
                onChange={(e) => setEpisodeFormData({
                  ...episodeFormData,
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
              disabled={episodeSearchLoading}
              className="primary"
            >
              {episodeSearchLoading 
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
