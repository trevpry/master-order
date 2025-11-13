import React, { useState, useEffect } from 'react';
import config from '../../../../../config';

/**
 * AddPerformerModal - Modal for adding performers to a scene
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * Features:
 * - Search existing performers by name and alias
 * - Create new performer
 * - Visual confirmation before adding
 * - Error handling and user feedback
 */
export default function AddPerformerModal({
  isOpen,
  onClose,
  sceneId,
  existingPerformers = [],
  onAddComplete
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
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
        const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/search?q=${encodeURIComponent(searchQuery)}`);
        
        if (!response.ok) {
          throw new Error('Failed to search performers');
        }

        const data = await response.json();
        
        // Filter out performers already in the scene
        const existingIds = new Set(existingPerformers.map(p => p.id));
        const filteredResults = (data.data || []).filter(p => !existingIds.has(p.id));
        
        setSearchResults(filteredResults);
      } catch (err) {
        console.error('Error searching performers:', err);
        setError('Failed to search performers. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, existingPerformers]);

  const handleCreatePerformer = async () => {
    if (!newPerformerName.trim()) {
      setError('Please enter a performer name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers`, {
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

      console.log('✅ Created new performer:', newPerformer.name);

      // Select the newly created performer
      setSelectedPerformer(newPerformer);
      setShowCreateForm(false);
      setNewPerformerName('');
    } catch (err) {
      console.error('Error creating performer:', err);
      setError(err.message || 'Failed to create performer');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddPerformer = async () => {
    if (!selectedPerformer) {
      setError('Please select a performer');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performerId: selectedPerformer.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add performer');
      }

      const data = await response.json();
      console.log('✅ Added performer to scene:', selectedPerformer.name);

      // Notify parent component
      if (onAddComplete) {
        onAddComplete(data.data);
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error adding performer:', err);
      setError(err.message || 'Failed to add performer');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h2>Add Performer to Scene</h2>

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00'
          }}>
            {error}
          </div>
        )}

        {!showCreateForm ? (
          <>
            {/* Search Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Search Performers
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or alias..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                autoFocus
              />
              {isSearching && (
                <div style={{ marginTop: '8px', color: '#666', fontSize: '13px' }}>
                  Searching...
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}>
                  {searchResults.map((performer) => (
                    <div
                      key={performer.id}
                      onClick={() => setSelectedPerformer(performer)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        background: selectedPerformer?.id === performer.id ? '#e3f2fd' : 'white',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPerformer?.id !== performer.id) {
                          e.currentTarget.style.background = '#f5f5f5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPerformer?.id !== performer.id) {
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>{performer.name}</span>
                        {performer.disambiguation && (
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#666', 
                            background: '#f0f0f0',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            ({performer.disambiguation})
                          </span>
                        )}
                      </div>
                      {performer.alias && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          Alias: {performer.alias}
                        </div>
                      )}
                      {performer.gender && (
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {performer.gender}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                background: '#f9f9f9',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                No performers found matching "{searchQuery}"
              </div>
            )}

            {/* Selected Performer Confirmation */}
            {selectedPerformer && (
              <div style={{
                padding: '16px',
                background: '#e8f5e9',
                border: '1px solid #4caf50',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Selected: {selectedPerformer.name}</span>
                  {selectedPerformer.disambiguation && (
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: 'normal',
                      color: '#666', 
                      background: '#d4edda',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      ({selectedPerformer.disambiguation})
                    </span>
                  )}
                </div>
                {selectedPerformer.alias && (
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    Alias: {selectedPerformer.alias}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setNewPerformerName(searchQuery);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Create New Performer
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    background: '#ddd',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleAddPerformer}
                  disabled={!selectedPerformer || isAdding}
                  style={{
                    padding: '10px 20px',
                    background: selectedPerformer && !isAdding ? '#4caf50' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedPerformer && !isAdding ? 'pointer' : 'not-allowed',
                    fontSize: '14px'
                  }}
                >
                  {isAdding ? 'Adding...' : 'Add Performer'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Create New Performer Form */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                New Performer Name
              </label>
              <input
                type="text"
                value={newPerformerName}
                onChange={(e) => setNewPerformerName(e.target.value)}
                placeholder="Enter performer name..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreatePerformer();
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewPerformerName('');
                }}
                style={{
                  padding: '10px 20px',
                  background: '#ddd',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Back
              </button>

              <button
                onClick={handleCreatePerformer}
                disabled={!newPerformerName.trim() || isCreating}
                style={{
                  padding: '10px 20px',
                  background: newPerformerName.trim() && !isCreating ? '#4caf50' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newPerformerName.trim() && !isCreating ? 'pointer' : 'not-allowed',
                  fontSize: '14px'
                }}
              >
                {isCreating ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
