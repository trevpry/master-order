import React from 'react';
import Button from '../../../../../shared/components/Button';

const MovieForm = ({
  showMovieForm,
  setShowMovieForm,
  movieFormData,
  setMovieFormData,
  movieSearchResults,
  setMovieSearchResults,
  movieSearchLoading,
  setMovieSearchLoading,
  editingItem,
  setEditingItem,
  handleSearchMovies,
  handleSelectMovie,
  resetMovieForm
}) => {
  if (!showMovieForm) return null;

  const handleClose = () => {
    setShowMovieForm(false);
    setEditingItem(null);
    setMovieSearchResults([]);
    resetMovieForm();
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
        
        <form onSubmit={handleSearchMovies} className="movie-form">
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
              onClick={handleClose}
              className="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
        
        {/* Movie Search Results */}
        {movieSearchResults.length > 1 && (
          <div className="search-results-section">
            <h4>Multiple movies found - Please select one:</h4>
            <div className="search-results">
              {movieSearchResults.map(movie => (
                <div key={movie.ratingKey} className="search-result-item">
                  <div className="result-info">
                    <h4>{movie.title}</h4>
                    {movie.year && <p>({movie.year})</p>}
                    <span className="result-type">Movie</span>
                  </div>
                  <Button
                    onClick={() => handleSelectMovie(movie)}
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
