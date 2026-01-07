import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import './ArtistTypesManager.css';

const ArtistTypesManager = ({ artistKey }) => {
  const [artistTypes, setArtistTypes] = useState([]);
  const [assignedTypes, setAssignedTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [artistKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all artist types
      const typesResponse = await fetch(`${config.apiBaseUrl}/api/artist-types`);
      if (!typesResponse.ok) throw new Error('Failed to load artist types');
      const typesData = await typesResponse.json();
      setArtistTypes(typesData.data?.artistTypes || []);

      // Load assigned types for this artist
      const assignedResponse = await fetch(`${config.apiBaseUrl}/api/artist-types/artist/${artistKey}`);
      if (!assignedResponse.ok) throw new Error('Failed to load assigned types');
      const assignedData = await assignedResponse.json();
      setAssignedTypes(assignedData.data?.artistTypes || []);
    } catch (err) {
      console.error('Error loading artist types:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignType = async (typeId) => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/artist-types/${typeId}/artists/${artistKey}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign artist type');
      }

      await loadData();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error assigning type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveType = async (typeId) => {
    if (!confirm('Remove this artist type?')) return;

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/artist-types/${typeId}/artists/${artistKey}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove artist type');
      }

      await loadData();
    } catch (err) {
      console.error('Error removing type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) {
      alert('Please enter a name for the artist type');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/artist-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTypeName.trim(),
          description: newTypeDescription.trim() || null,
          color: newTypeColor.trim() || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create artist type');
      }

      await loadData();
      setShowCreateModal(false);
      setNewTypeName('');
      setNewTypeDescription('');
      setNewTypeColor('');
    } catch (err) {
      console.error('Error creating type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleEditType = async () => {
    if (!editingType || !newTypeName.trim()) {
      alert('Please enter a name for the artist type');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/artist-types/${editingType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTypeName.trim(),
          description: newTypeDescription.trim() || null,
          color: newTypeColor.trim() || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update artist type');
      }

      await loadData();
      setShowEditModal(false);
      setEditingType(null);
      setNewTypeName('');
      setNewTypeDescription('');
      setNewTypeColor('');
    } catch (err) {
      console.error('Error updating type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteType = async (typeId) => {
    if (!confirm('Delete this artist type? This will remove it from all artists.')) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/artist-types/${typeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete artist type');
      }

      await loadData();
    } catch (err) {
      console.error('Error deleting type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openEditModal = (type) => {
    setEditingType(type);
    setNewTypeName(type.name);
    setNewTypeDescription(type.description || '');
    setNewTypeColor(type.color || '');
    setShowEditModal(true);
  };

  const unassignedTypes = artistTypes.filter(
    type => !assignedTypes.find(assigned => assigned.id === type.id)
  );

  if (loading) {
    return <div className="artist-types-loading">Loading artist types...</div>;
  }

  if (error) {
    return <div className="artist-types-error">Error: {error}</div>;
  }

  return (
    <div className="artist-types-manager">
      <div className="artist-types-header">
        <h3>Artist Types</h3>
        <div className="artist-types-actions">
          <button 
            className="btn-add-type"
            onClick={() => setShowAddModal(true)}
          >
            ➕ Assign Type
          </button>
          <button 
            className="btn-create-type"
            onClick={() => setShowCreateModal(true)}
          >
            ✨ Create New Type
          </button>
        </div>
      </div>

      {/* Assigned Types */}
      {assignedTypes.length > 0 ? (
        <div className="assigned-types-list">
          {assignedTypes.map(type => (
            <div 
              key={type.id} 
              className="type-badge"
              style={type.color ? { backgroundColor: type.color } : {}}
            >
              <span className="type-name">{type.name}</span>
              <button
                className="btn-remove-type"
                onClick={() => handleRemoveType(type.id)}
                title="Remove this type"
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-types-message">No artist types assigned. Click "Assign Type" to add one.</p>
      )}

      {/* Add Type Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Artist Type</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ✖
              </button>
            </div>
            <div className="modal-body">
              {unassignedTypes.length > 0 ? (
                <div className="type-selection-list">
                  {unassignedTypes.map(type => (
                    <div key={type.id} className="type-selection-item">
                      <div className="type-info">
                        <div 
                          className="type-color-indicator"
                          style={type.color ? { backgroundColor: type.color } : {}}
                        />
                        <div className="type-details">
                          <div className="type-name-row">
                            <strong>{type.name}</strong>
                            <div className="type-item-actions">
                              <button
                                className="btn-edit-type-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAddModal(false);
                                  openEditModal(type);
                                }}
                                title="Edit type"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-delete-type-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteType(type.id);
                                }}
                                title="Delete type"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          {type.description && (
                            <div className="type-description">{type.description}</div>
                          )}
                          {type._count && (
                            <div className="type-count">{type._count.artists} artist{type._count.artists !== 1 ? 's' : ''}</div>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn-assign"
                        onClick={() => handleAssignType(type.id)}
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-types-available">All available types are already assigned. Create a new type to add more.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Type Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Artist Type</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✖
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="type-name">Name *</label>
                <input
                  id="type-name"
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g., Composer, Conductor, Soloist"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="type-description">Description</label>
                <textarea
                  id="type-description"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="Optional description"
                  className="form-input"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="type-color">Color</label>
                <input
                  id="type-color"
                  type="color"
                  value={newTypeColor || '#007bff'}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                  className="form-input-color"
                />
                <small className="form-help">Choose a color for this type's badge</small>
              </div>
              <div className="modal-actions">
                <button 
                  className="btn-primary"
                  onClick={handleCreateType}
                  disabled={!newTypeName.trim()}
                >
                  Create Type
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Artist Type</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ✖
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-type-name">Name *</label>
                <input
                  id="edit-type-name"
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g., Composer, Conductor, Soloist"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-type-description">Description</label>
                <textarea
                  id="edit-type-description"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="Optional description"
                  className="form-input"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-type-color">Color</label>
                <input
                  id="edit-type-color"
                  type="color"
                  value={newTypeColor || '#007bff'}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                  className="form-input-color"
                />
                <small className="form-help">Choose a color for this type's badge</small>
              </div>
              <div className="modal-actions">
                <button 
                  className="btn-primary"
                  onClick={handleEditType}
                  disabled={!newTypeName.trim()}
                >
                  Save Changes
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
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

export default ArtistTypesManager;
