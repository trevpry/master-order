import React from 'react';
import Button from '../../../../../../shared/components/Button';
import MovieSearchResults from '../MovieSearchResults';

const MovieFormModal = ({
  show,
  editingItem,
  movieFormData,
  setMovieFormData,
  movieSearchLoading,
  movieSearchResults,
  onSubmit,
  onSelectMovie,
  onClose
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit Movie' : 'Add Movie'}</h3>
          <Button
            onClick={onClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={onSubmit} className="movie-form">
          <div className="form-group">
            <label htmlFor="movieTitle">Movie Title *</label>
            <input
              type="text"
              id="movieTitle"
              value={movieFormData.title}
              onChange={(e) => setMovieFormData({
                ...movieFormData,
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
              value={movieFormData.year}
              onChange={(e) => setMovieFormData({
                ...movieFormData,
                year: e.target.value
              })}
              placeholder="e.g., 2012"
            />
            <small>Adding a year helps find the correct movie when multiple versions exist</small>
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={movieSearchLoading}
              className="primary"
            >
              {movieSearchLoading ? 'Searching...' : (editingItem ? 'Update Movie' : 'Search & Add Movie')}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
        
        {/* Movie Search Results */}
        <MovieSearchResults 
          movieSearchResults={movieSearchResults}
          onSelectMovie={onSelectMovie}
        />
      </div>
    </div>
  );
};

export default MovieFormModal;
