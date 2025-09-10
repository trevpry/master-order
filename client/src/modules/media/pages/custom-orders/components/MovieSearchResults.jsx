import React from 'react';
import Button from '../../../../../shared/components/Button';
import TypeIndicator from './TypeIndicator';

const MovieSearchResults = ({ 
  movieSearchResults, 
  onSelectMovie 
}) => {
  if (movieSearchResults.length <= 1) {
    return null;
  }

  return (
    <div className="search-results-section">
      <h4>Multiple movies found - Please select one:</h4>
      <div className="search-results">
        {movieSearchResults.map(movie => (
          <div key={movie.ratingKey} className="search-result-item">
            <div className="result-info">
              <h4>{movie.title}</h4>
              {movie.year && <p>({movie.year})</p>}
              <TypeIndicator type="Movie" />
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
  );
};

export default MovieSearchResults;
