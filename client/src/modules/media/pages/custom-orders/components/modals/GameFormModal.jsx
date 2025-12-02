import React from 'react';
import Button from '../../../../../../shared/components/Button';

// Helper function to safely parse JSON strings
const parseJsonField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    console.warn('Failed to parse JSON field:', e);
    return [];
  }
};

const GameFormModal = ({
  show,
  gameSearchLoading,
  gameSearchResults,
  gameSearchQuery,
  setGameSearchQuery,
  viewingOrderItems,
  onSubmit,
  onSelectGame,
  onClose
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add Video Game</h3>
          <Button
            onClick={onClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={onSubmit} className="game-search-form">
          <div className="form-group">
            <label htmlFor="gameSearch">Search Your Video Game Library</label>
            <input
              type="text"
              id="gameSearch"
              value={gameSearchQuery}
              onChange={(e) => setGameSearchQuery(e.target.value)}
              placeholder="Search by game title..."
              autoFocus
            />
          </div>
          
          <div className="form-actions">
            <Button
              type="submit"
              disabled={gameSearchLoading || !gameSearchQuery.trim()}
              className="primary"
            >
              {gameSearchLoading ? 'Searching...' : 'Search Library'}
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

        {/* Search Results */}
        {gameSearchResults.length > 0 && (
          <div className="search-results">
            <h4>Games from Your Library ({gameSearchResults.length} found)</h4>
            <div className="game-results-list">
              {gameSearchResults.map((game) => {
                const platforms = parseJsonField(game.platforms);
                const genres = parseJsonField(game.genres);
                
                return (
                  <div key={game.id} className="game-result-item">
                    <div className="game-result-content">
                      {game.coverUrl && (
                        <img 
                          src={game.coverUrl} 
                          alt={game.title}
                          className="game-cover-thumb"
                        />
                      )}
                      <div className="game-result-info">
                        <div className="game-result-title">{game.title}</div>
                        <div className="game-result-meta">
                          {game.releaseDate && (
                            <span className="game-year">
                              {new Date(game.releaseDate).getFullYear()}
                            </span>
                          )}
                          {platforms.length > 0 && (
                            <span className="game-platforms">
                              {platforms.slice(0, 3).map(p => p.name).join(', ')}
                            </span>
                          )}
                          {genres.length > 0 && (
                            <span className="game-genres">
                              {genres.slice(0, 2).map(g => g.name).join(', ')}
                            </span>
                          )}
                        </div>
                        {game.rating && (
                          <div className="game-rating">
                            ⭐ {game.rating.toFixed(1)}/5
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => onSelectGame(game)}
                      className="primary"
                      size="small"
                    >
                      Add to Order
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!gameSearchLoading && gameSearchResults.length === 0 && gameSearchQuery && (
          <div className="no-results">
            <p>No games found in your library matching "{gameSearchQuery}"</p>
            <p className="help-text">
              Try searching with a different title, or visit the Video Games page to import games from RAWG first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameFormModal;
