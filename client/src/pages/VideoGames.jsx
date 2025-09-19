/**
 * Video Games Page
 * 
 * Main video games management interface for the unified game system.
 * Displays games from the RAWG API and unified VideoGame library
 * with comprehensive functionality for searching, importing, and managing games.
 * 
 * Features:
 * - Game browsing with search and filtering
 * - RAWG API integration for game search and import
 * - Progress tracking and completion
 * - Platform and genre filtering
 * - Integration with Custom Orders
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Gamepad2, 
  Search, 
  CheckCircle, 
  Circle, 
  Edit, 
  Trash2,
  ExternalLink, 
  Filter,
  SortAsc,
  Eye,
  Download,
  Star,
  Calendar,
  Monitor,
  Trophy,
  Clock,
  Tag
} from 'lucide-react';

const VideoGames = () => {
  // State management
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  
  // UI state
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showRawgSearch, setShowRawgSearch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('title');
  
  // Editing state
  const [editingGame, setEditingGame] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  // Filter state
  const [filters, setFilters] = useState({
    completed: '',
    platform: '',
    genre: '',
    rating: ''
  });
  
  // RAWG search state
  const [rawgSearchQuery, setRawgSearchQuery] = useState('');
  const [rawgResults, setRawgResults] = useState([]);
  const [rawgSearchLoading, setRawgSearchLoading] = useState(false);
  const [importingGameId, setImportingGameId] = useState(null);

  // Load games on component mount
  useEffect(() => {
    fetchGames();
  }, [currentPage, sortBy, filters, searchQuery]);

  // Handle URL params for direct game access
  useEffect(() => {
    const gameId = searchParams.get('game');
    if (gameId && games.length > 0) {
      const game = games.find(g => g.id === parseInt(gameId));
      if (game) {
        setSelectedGame(game);
      }
    }
  }, [searchParams, games]);

  // Fetch games from unified library
  const fetchGames = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: (currentPage - 1) * 50,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.platform && { platform: filters.platform }),
        ...(filters.genre && { genre: filters.genre })
      });

      const response = await fetch(`/api/rawg/library?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data.data || []);
      
      // Calculate total pages (assuming 50 items per page)
      setTotalPages(Math.ceil((data.data?.length || 0) / 50));
    } catch (err) {
      console.error('Error fetching games:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search RAWG API
  const searchRawgGames = async () => {
    if (!rawgSearchQuery.trim()) return;

    try {
      setRawgSearchLoading(true);
      const response = await fetch(`/api/rawg/search?query=${encodeURIComponent(rawgSearchQuery)}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to search RAWG');
      }

      const data = await response.json();
      setRawgResults(data.data || []);
    } catch (err) {
      console.error('Error searching RAWG:', err);
      alert('Failed to search RAWG: ' + err.message);
    } finally {
      setRawgSearchLoading(false);
    }
  };

  // Import game from RAWG
  const importGameFromRawg = async (rawgId) => {
    try {
      setImportingGameId(rawgId);
      const response = await fetch(`/api/rawg/import/${rawgId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to import game');
      }

      const data = await response.json();
      
      // Refresh games list
      await fetchGames();
      
      // Select the newly imported game
      setSelectedGame(data.data);
      
      alert('Game imported successfully!');
      setShowRawgSearch(false);
    } catch (err) {
      console.error('Error importing game:', err);
      alert('Failed to import game: ' + err.message);
    } finally {
      setImportingGameId(null);
    }
  };

  // Update game completion
  const updateGameCompletion = async (gameId, isCompleted) => {
    try {
      const response = await fetch(`/api/rawg/library/${gameId}/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isCompleted })
      });

      if (!response.ok) {
        throw new Error('Failed to update completion');
      }

      // Refresh games list
      await fetchGames();
      
      // Update selected game if it's the one being modified
      if (selectedGame && selectedGame.id === gameId) {
        const updatedGame = games.find(g => g.id === gameId);
        if (updatedGame) {
          setSelectedGame(updatedGame);
        }
      }
    } catch (err) {
      console.error('Error updating completion:', err);
      alert('Failed to update completion status');
    }
  };

  // Delete game
  const deleteGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/rawg/library/${gameId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete game');
      }

      // Clear selection if deleted game was selected
      if (selectedGame && selectedGame.id === gameId) {
        setSelectedGame(null);
      }

      // Refresh games list
      await fetchGames();
      
      alert('Game deleted successfully');
    } catch (err) {
      console.error('Error deleting game:', err);
      alert('Failed to delete game: ' + err.message);
    }
  };

  // Update game details
  const updateGame = async (gameId, gameData) => {
    try {
      const response = await fetch(`/api/rawg/library/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
      });

      if (!response.ok) {
        throw new Error('Failed to update game');
      }

      const data = await response.json();
      
      // Refresh games list
      await fetchGames();
      
      // Update selected game
      setSelectedGame(data.data);
      
      alert('Game updated successfully');
      return data.data;
    } catch (err) {
      console.error('Error updating game:', err);
      alert('Failed to update game: ' + err.message);
      throw err;
    }
  };

  // Start editing a game
  const startEditing = (game) => {
    setEditingGame(game);
    setEditForm({
      title: game.title || '',
      developer: game.developer || '',
      publisher: game.publisher || '',
      releaseDate: game.releaseDate ? new Date(game.releaseDate).toISOString().split('T')[0] : '',
      description: game.description || '',
      platforms: game.platforms ? JSON.parse(game.platforms) : [],
      genres: game.genres ? JSON.parse(game.genres) : [],
      rating: game.rating || '',
      metacriticRating: game.metacriticRating || '',
      esrbRating: game.esrbRating || '',
      playtimeHours: game.playtimeHours || '',
      website: game.website || '',
      webvideoUrl: game.webvideoUrl || '',
      coverUrl: game.coverUrl || ''
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingGame(null);
    setEditForm({});
  };

  // Save game edits
  const saveGameEdits = async () => {
    if (!editForm.title?.trim()) {
      alert('Game title is required');
      return;
    }

    try {
      const gameData = {
        ...editForm,
        releaseDate: editForm.releaseDate || null,
        platforms: editForm.platforms,
        genres: editForm.genres,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
        metacriticRating: editForm.metacriticRating ? parseInt(editForm.metacriticRating) : null,
        playtimeHours: editForm.playtimeHours ? parseInt(editForm.playtimeHours) : null
      };

      await updateGame(editingGame.id, gameData);
      cancelEditing();
    } catch (err) {
      // Error handling is done in updateGame
    }
  };

  // Render individual game card
  const renderGameCard = (game) => {
    const isCompleted = game.gameCompletions && game.gameCompletions.length > 0 && game.gameCompletions[0].isCompleted;
    const platforms = game.platforms ? JSON.parse(game.platforms) : [];
    const genres = game.genres ? JSON.parse(game.genres) : [];

    return (
      <div 
        key={game.id}
        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:shadow-md ${
          selectedGame?.id === game.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
        onClick={() => setSelectedGame(game)}
      >
        <div className="flex items-start gap-3">
          {/* Game Cover */}
          {game.coverUrl && (
            <img 
              src={game.coverUrl} 
              alt={`${game.title} cover`}
              className="w-16 h-16 object-cover rounded"
            />
          )}
          
          {/* Game Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 truncate">{game.title}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateGameCompletion(game.id, !isCompleted);
                }}
                className="ml-2"
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
            
            {game.developer && (
              <p className="text-sm text-gray-600 mt-1">{game.developer}</p>
            )}
            
            {game.releaseDate && (
              <p className="text-xs text-gray-500">
                Released: {new Date(game.releaseDate).getFullYear()}
              </p>
            )}
            
            {/* Platforms */}
            {platforms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {platforms.slice(0, 3).map((platform, index) => (
                  <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {platform}
                  </span>
                ))}
                {platforms.length > 3 && (
                  <span className="text-xs text-gray-500">+{platforms.length - 3} more</span>
                )}
              </div>
            )}
            
            {/* Rating */}
            {game.rating && (
              <div className="flex items-center mt-2">
                <Star className="w-4 h-4 text-yellow-400 mr-1" />
                <span className="text-sm text-gray-600">{game.rating.toFixed(1)}</span>
                {game.metacriticRating && (
                  <span className="text-xs text-gray-500 ml-2">
                    Metacritic: {game.metacriticRating}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render game details panel
  const renderGameDetails = () => {
    if (!selectedGame) return null;

    const platforms = selectedGame.platforms ? JSON.parse(selectedGame.platforms) : [];
    const genres = selectedGame.genres ? JSON.parse(selectedGame.genres) : [];
    const isCompleted = selectedGame.gameCompletions && selectedGame.gameCompletions.length > 0 && selectedGame.gameCompletions[0].isCompleted;
    const completion = selectedGame.gameCompletions && selectedGame.gameCompletions.length > 0 ? selectedGame.gameCompletions[0] : null;

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Game Header */}
        <div className="flex items-start gap-4 mb-6">
          {selectedGame.coverUrl && (
            <img 
              src={selectedGame.coverUrl} 
              alt={`${selectedGame.title} cover`}
              className="w-32 h-32 object-cover rounded-lg"
            />
          )}
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{selectedGame.title}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditing(selectedGame)}
                  className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Edit game"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => deleteGame(selectedGame.id)}
                  className="flex items-center px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Delete game"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
              {selectedGame.developer && (
                <div><span className="font-medium">Developer:</span> {selectedGame.developer}</div>
              )}
              {selectedGame.publisher && (
                <div><span className="font-medium">Publisher:</span> {selectedGame.publisher}</div>
              )}
              {selectedGame.releaseDate && (
                <div><span className="font-medium">Released:</span> {new Date(selectedGame.releaseDate).toLocaleDateString()}</div>
              )}
              {selectedGame.esrbRating && (
                <div><span className="font-medium">ESRB:</span> {selectedGame.esrbRating}</div>
              )}
              {selectedGame.playtimeHours && (
                <div><span className="font-medium">Playtime:</span> {selectedGame.playtimeHours} hours</div>
              )}
              {selectedGame.rating && (
                <div className="flex items-center">
                  <span className="font-medium mr-2">Rating:</span>
                  <Star className="w-4 h-4 text-yellow-400 mr-1" />
                  {selectedGame.rating.toFixed(1)}
                </div>
              )}
            </div>

            {/* Platforms */}
            {platforms.length > 0 && (
              <div className="mb-4">
                <span className="font-medium text-gray-700 block mb-2">Platforms:</span>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Genres */}
            {genres.length > 0 && (
              <div className="mb-4">
                <span className="font-medium text-gray-700 block mb-2">Genres:</span>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre, index) => (
                    <span key={index} className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {selectedGame.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed">{selectedGame.description}</p>
          </div>
        )}

        {/* Progress Tracking */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Tracking</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Completion Status</span>
                <button
                  onClick={() => updateGameCompletion(selectedGame.id, !isCompleted)}
                  className={`px-3 py-1 rounded text-sm ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  {isCompleted ? 'Completed' : 'In Progress'}
                </button>
              </div>
              {completion?.completedAt && (
                <p className="text-sm text-gray-600">
                  Completed: {new Date(completion.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {completion?.hoursPlayed !== null && completion?.hoursPlayed !== undefined && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="font-medium block mb-2">Hours Played</span>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-lg font-semibold">{completion.hoursPlayed}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* External Links */}
        <div className="border-t pt-6 mt-6">
          <div className="flex gap-4">
            {selectedGame.rawgUrl && (
              <a 
                href={selectedGame.rawgUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on RAWG
              </a>
            )}
            {selectedGame.website && (
              <a 
                href={selectedGame.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Official Website
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render RAWG search modal
  const renderRawgSearchModal = () => {
    if (!showRawgSearch) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Import Games from RAWG</h2>
              <button
                onClick={() => setShowRawgSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search Form */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search for games..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={rawgSearchQuery}
                  onChange={(e) => setRawgSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchRawgGames()}
                />
              </div>
              <button
                onClick={searchRawgGames}
                disabled={rawgSearchLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {rawgSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {rawgResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Search Results</h3>
                {rawgResults.map((game) => (
                  <div key={game.id} className="border rounded-lg p-4 hover:shadow-md">
                    <div className="flex items-start gap-4">
                      {game.background_image && (
                        <img 
                          src={game.background_image} 
                          alt={`${game.name} cover`}
                          className="w-20 h-20 object-cover rounded"
                        />
                      )}
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{game.name}</h4>
                        
                        {game.released && (
                          <p className="text-sm text-gray-600 mt-1">
                            Released: {game.released}
                          </p>
                        )}
                        
                        {game.platforms && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {game.platforms.slice(0, 3).map((platform, index) => (
                              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {platform.platform.name}
                              </span>
                            ))}
                            {game.platforms.length > 3 && (
                              <span className="text-xs text-gray-500">+{game.platforms.length - 3} more</span>
                            )}
                          </div>
                        )}
                        
                        {game.rating && (
                          <div className="flex items-center mt-2">
                            <Star className="w-4 h-4 text-yellow-400 mr-1" />
                            <span className="text-sm text-gray-600">{game.rating.toFixed(1)}</span>
                            {game.metacritic && (
                              <span className="text-xs text-gray-500 ml-2">
                                Metacritic: {game.metacritic}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => importGameFromRawg(game.id)}
                        disabled={importingGameId === game.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {importingGameId === game.id ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rawgSearchLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Searching RAWG...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Gamepad2 className="w-8 h-8 mr-3 text-purple-600" />
                Video Games
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your video game collection with RAWG integration
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowRawgSearch(true)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Import from RAWG
              </button>
              <button
                onClick={() => setShowCreateGame(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Game
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center">
                <Gamepad2 className="w-5 h-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Total Games</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{games.length}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center">
                <Trophy className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Completed</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {games.filter(g => g.gameCompletions?.length > 0 && g.gameCompletions[0].isCompleted).length}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">In Progress</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {games.filter(g => !g.gameCompletions?.length || !g.gameCompletions[0].isCompleted).length}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center">
                <Monitor className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Platforms</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {new Set(games.flatMap(g => g.platforms ? JSON.parse(g.platforms) : [])).size}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search games by title, developer, or genre..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                value={filters.completed}
                onChange={(e) => setFilters({...filters, completed: e.target.value})}
              >
                <option value="">All Games</option>
                <option value="true">Completed</option>
                <option value="false">In Progress</option>
              </select>
              
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="title">Sort by Title</option>
                <option value="releaseDate">Sort by Release Date</option>
                <option value="rating">Sort by Rating</option>
                <option value="createdAt">Sort by Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Games List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Games</h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading games...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={fetchGames}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Retry
                </button>
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-8">
                <Gamepad2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No games found</p>
                <button
                  onClick={() => setShowRawgSearch(true)}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Import Your First Game
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {games.map(renderGameCard)}
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-2 text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Game Details */}
          <div className="lg:col-span-2">
            {selectedGame ? (
              renderGameDetails()
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <Gamepad2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Select a Game</h3>
                <p className="text-gray-600">Choose a game from the list to view details and track progress</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RAWG Search Modal */}
      {renderRawgSearchModal()}

      {/* Manual Game Creation Modal - Placeholder */}
      {showCreateGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Game Manually</h2>
              <p className="text-gray-600 mb-4">
                Manual game creation coming soon. Use "Import from RAWG" for now.
              </p>
              <button
                onClick={() => setShowCreateGame(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Game</h2>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                {/* Developer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Developer</label>
                  <input
                    type="text"
                    value={editForm.developer || ''}
                    onChange={(e) => setEditForm({...editForm, developer: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                {/* Publisher */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={editForm.publisher || ''}
                    onChange={(e) => setEditForm({...editForm, publisher: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                {/* Release Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                  <input
                    type="date"
                    value={editForm.releaseDate || ''}
                    onChange={(e) => setEditForm({...editForm, releaseDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platforms (comma-separated)</label>
                  <input
                    type="text"
                    value={Array.isArray(editForm.platforms) ? editForm.platforms.join(', ') : ''}
                    onChange={(e) => setEditForm({...editForm, platforms: e.target.value.split(',').map(p => p.trim()).filter(p => p)})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="PC, PlayStation 5, Xbox Series X"
                  />
                </div>

                {/* Genres */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genres (comma-separated)</label>
                  <input
                    type="text"
                    value={Array.isArray(editForm.genres) ? editForm.genres.join(', ') : ''}
                    onChange={(e) => setEditForm({...editForm, genres: e.target.value.split(',').map(g => g.trim()).filter(g => g)})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Action, Adventure, RPG"
                  />
                </div>

                {/* Rating and Metacritic */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RAWG Rating (0-5)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={editForm.rating || ''}
                      onChange={(e) => setEditForm({...editForm, rating: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metacritic Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.metacriticRating || ''}
                      onChange={(e) => setEditForm({...editForm, metacriticRating: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* ESRB Rating and Playtime */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ESRB Rating</label>
                    <select
                      value={editForm.esrbRating || ''}
                      onChange={(e) => setEditForm({...editForm, esrbRating: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Select Rating</option>
                      <option value="Everyone">Everyone</option>
                      <option value="Everyone 10+">Everyone 10+</option>
                      <option value="Teen">Teen</option>
                      <option value="Mature 17+">Mature 17+</option>
                      <option value="Adults Only 18+">Adults Only 18+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Playtime (hours)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.playtimeHours || ''}
                      onChange={(e) => setEditForm({...editForm, playtimeHours: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Website and Webvideo URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Official Website</label>
                  <input
                    type="url"
                    value={editForm.website || ''}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Webvideo URL (YouTube, etc.)</label>
                  <input
                    type="url"
                    value={editForm.webvideoUrl || ''}
                    onChange={(e) => setEditForm({...editForm, webvideoUrl: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                {/* Cover URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={editForm.coverUrl || ''}
                    onChange={(e) => setEditForm({...editForm, coverUrl: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://example.com/cover.jpg"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveGameEdits}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Save Changes
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGames;