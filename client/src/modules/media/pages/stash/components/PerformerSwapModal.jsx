import React, { useState, useEffect } from 'react';

/**
 * PerformerSwapModal - Reusable modal for swapping performers in scenes
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * Features:
 * - Search existing performers
 * - Create new performer
 * - Visual confirmation before swap
 * - Error handling and user feedback
 */
export default function PerformerSwapModal({
  isOpen,
  onClose,
  sceneId,
  performer,
  onSwapComplete
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPerformerName, setNewPerformerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPerformer(null);
      setShowCreateForm(false);
      setNewPerformerName('');
      setError(null);
    }
  }, [isOpen]);

  // Search performers with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch(`/api/stash/performers/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        
        if (!response.ok) {
          throw new Error('Failed to search performers');
        }

        const data = await response.json();
        setSearchResults(data.data || []);
      } catch (err) {
        console.error('Error searching performers:', err);
        setError('Failed to search performers. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleCreatePerformer = async () => {
    if (!newPerformerName.trim()) {
      setError('Please enter a performer name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/stash/performers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPerformerName.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create performer');
      }

      const data = await response.json();
      const newPerformer = data.data;

      // Select the newly created performer
      setSelectedPerformer(newPerformer);
      setShowCreateForm(false);
      setNewPerformerName('');
      
      // Add to search results so it appears in the list
      setSearchResults([newPerformer, ...searchResults]);

    } catch (err) {
      console.error('Error creating performer:', err);
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedPerformer) {
      setError('Please select a performer to swap to');
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      const response = await fetch(`/api/stash/scenes/${sceneId}/performers/${performer.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPerformerId: selectedPerformer.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to swap performer');
      }

      const data = await response.json();
      console.log('✅ Performer swapped:', data.data.swap);

      // Call success callback
      if (onSwapComplete) {
        onSwapComplete(data.data);
      }

      // Close modal
      onClose();

    } catch (err) {
      console.error('Error swapping performer:', err);
      setError(err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  if (!isOpen || !performer) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content performer-swap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h3>🔄 Swap Performer</h3>
        
        {/* Current Performer */}
        <div className="current-performer">
          <h4>Current Performer:</h4>
          <div className="performer-info">
            {performer.image && (
              <img 
                src={performer.image} 
                alt={performer.name}
                className="performer-avatar"
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            )}
            <span className="performer-name">{performer.name}</span>
          </div>
        </div>

        <div className="swap-arrow" style={{ textAlign: 'center', fontSize: '1.5rem', margin: '1rem 0' }}>↓</div>

        {/* Search/Create Section */}
        {!showCreateForm ? (
          <div className="search-section">
            <h4>Select New Performer:</h4>
            
            <input
              type="text"
              placeholder="Search for performer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem' }}
            />

            {isSearching && (
              <div className="searching-message" style={{ textAlign: 'center', padding: '1rem' }}>
                <span>🔍 Searching...</span>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="search-results" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '1rem' }}>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={`result-item ${selectedPerformer?.id === result.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPerformer(result)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      cursor: 'pointer',
                      background: selectedPerformer?.id === result.id ? 'var(--accent-color)' : 'transparent',
                      color: selectedPerformer?.id === result.id ? 'white' : 'inherit'
                    }}
                  >
                    {result.image && (
                      <img 
                        src={result.image} 
                        alt={result.name}
                        className="result-avatar"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <span className="result-name" style={{ flex: 1, fontWeight: 500 }}>{result.name}</span>
                    {selectedPerformer?.id === result.id && (
                      <span className="checkmark" style={{ fontSize: '1.25rem' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="no-results" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <p style={{ marginBottom: '1rem' }}>No performers found matching "{searchQuery}"</p>
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setNewPerformerName(searchQuery);
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  ➕ Create New Performer
                </button>
              </div>
            )}

            {searchQuery.length === 0 && (
              <div className="create-option" style={{ textAlign: 'center', padding: '1rem' }}>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  ➕ Create New Performer
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="create-section">
            <h4>Create New Performer:</h4>
            
            <input
              type="text"
              placeholder="Performer name..."
              value={newPerformerName}
              onChange={(e) => setNewPerformerName(e.target.value)}
              className="create-input"
              autoFocus
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreatePerformer();
                }
              }}
            />

            <div className="create-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={handleCreatePerformer}
                disabled={isCreating || !newPerformerName.trim()}
                className="btn-primary"
                style={{ padding: '0.5rem 1rem' }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewPerformerName('');
                }}
                className="btn-cancel"
                disabled={isCreating}
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Selected Performer Preview */}
        {selectedPerformer && !showCreateForm && (
          <div className="selected-performer" style={{ marginTop: '1.5rem' }}>
            <h4>New Performer:</h4>
            <div className="performer-info highlight" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              padding: '0.75rem', 
              background: 'var(--accent-color)', 
              color: 'white',
              borderRadius: '8px'
            }}>
              {selectedPerformer.image && (
                <img 
                  src={selectedPerformer.image} 
                  alt={selectedPerformer.name}
                  className="performer-avatar"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <span className="performer-name" style={{ fontWeight: 500 }}>{selectedPerformer.name}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message" style={{ 
            padding: '0.75rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: '6px', 
            color: '#ef4444',
            margin: '1rem 0',
            textAlign: 'center'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Action Buttons */}
        {!showCreateForm && (
          <div className="modal-actions" style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            justifyContent: 'center', 
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button
              onClick={handleSwap}
              disabled={!selectedPerformer || isSwapping}
              className="btn-primary"
              style={{ padding: '0.5rem 1.5rem' }}
            >
              {isSwapping ? 'Swapping...' : 'Swap Performer'}
            </button>
            <button
              onClick={onClose}
              className="btn-cancel"
              disabled={isSwapping}
              style={{ padding: '0.5rem 1.5rem' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
