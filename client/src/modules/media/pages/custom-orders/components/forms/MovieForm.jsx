import React from 'react';
import Button from '../../../../../../shared/components/Button';

const MovieForm = ({ 
  isOpen, 
  onClose, 
  formData, 
  setFormData, 
  onSubmit, 
  isLoading, 
  editingItem,
  searchResults = [],
  onSelectMovie 
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const handleClose = () => {
    setFormData({ title: '', year: '' });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit Movie' : 'Add Movie'}</h3>
          <Button
            onClick={handleClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="movie-form">
          <div className="form-group">
            <label htmlFor="movieTitle">Movie Title *</label>
            <input
              type="text"
              id="movieTitle"
              value={formData.title}
              onChange={(e) => setFormData({
                ...formData,
                title: e.target.value
              })}
              placeholder="e.g., The Avengers"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="movieYear">Year (optional)</label>
            <input
              type="number"
              id="movieYear"
              min="1800"
              max="2030"
              value={formData.year}
              onChange={(e) => setFormData({
                ...formData,
                year: e.target.value
              })}
              placeholder="e.g., 2012"
            />
            <small>Adding a year helps find the correct movie when multiple versions exist</small>
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="primary"
            >
              {isLoading ? 'Searching...' : (editingItem ? 'Update Movie' : 'Search & Add Movie')}
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
        
        {/* Movie Search Results */}
        {searchResults.length > 1 && (
          <div className="search-results-section">
            <h4>Multiple movies found - Please select one:</h4>
            <div className="search-results">
              {searchResults.map(movie => (
                <div key={movie.ratingKey} className="search-result-item">
                  <div className="result-info">
                    <h4>{movie.title}</h4>
                    {movie.year && <p>({movie.year})</p>}
                    <span className="result-type">Movie</span>
                  </div>
                  <Button
                    onClick={() => onSelectMovie(movie)}
                    className="primary"
                    size="small"
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieForm;
