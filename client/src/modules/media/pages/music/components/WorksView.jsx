import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../../../config';
import './WorksView.css';

const WorksView = () => {
  const navigate = useNavigate();
  const [works, setWorks] = useState([]);
  const [artistTypes, setArtistTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWork, setEditingWork] = useState(null);
  const [expandedWork, setExpandedWork] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    composerKey: '',
    parts: []
  });
  const [composers, setComposers] = useState([]);
  const [searchingComposer, setSearchingComposer] = useState(false);
  const [composerSearch, setComposerSearch] = useState('');

  useEffect(() => {
    loadWorks();
    loadArtistTypes();
  }, []);

  const loadWorks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/works`);
      if (!response.ok) throw new Error('Failed to load works');
      const result = await response.json();
      setWorks(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadArtistTypes = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/artist-types`);
      if (!response.ok) throw new Error('Failed to load artist types');
      const result = await response.json();
      setArtistTypes(result.data?.artistTypes || []);
    } catch (err) {
      console.error('Error loading artist types:', err);
    }
  };

  const searchComposers = async (query) => {
    if (!query || query.length < 2) {
      setComposers([]);
      return;
    }

    try {
      setSearchingComposer(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!response.ok) throw new Error('Failed to search composers');
      const data = await response.json();
      setComposers(data.artists || data);
    } catch (err) {
      console.error('Error searching composers:', err);
    } finally {
      setSearchingComposer(false);
    }
  };

  const handleCreateWork = () => {
    setFormData({ title: '', composerKey: '', parts: [] });
    setComposerSearch('');
    setComposers([]);
    setShowCreateModal(true);
  };

  const handleEditWork = (work) => {
    setEditingWork(work);
    setFormData({
      title: work.title,
      composerKey: work.composerKey,
      parts: work.parts.map(part => ({
        id: part.id,
        title: part.title,
        order: part.order,
        trackKeys: part.tracks.map(t => t.trackKey),
        artistTypeIds: part.artistTypes?.map(at => at.artistType.id) || []
      }))
    });
    setComposerSearch(work.composer.title);
    setComposers([work.composer]);
    setShowEditModal(true);
  };

  const handleSaveWork = async () => {
    try {
      const url = editingWork
        ? `${config.apiBaseUrl}/api/works/${editingWork.id}`
        : `${config.apiBaseUrl}/api/works`;
      
      // Filter out parts without titles
      const dataToSend = {
        ...formData,
        parts: formData.parts.filter(part => part.title && part.title.trim())
      };
      
      const response = await fetch(url, {
        method: editingWork ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save work');
      }
      
      const savedWork = await response.json();
      const workId = savedWork.data?.id || editingWork?.id;

      // Now assign artist types to parts
      if (workId && savedWork.data?.parts) {
        for (let i = 0; i < savedWork.data.parts.length; i++) {
          const part = savedWork.data.parts[i];
          const formPart = formData.parts.find(fp => fp.order === part.order);
          
          if (formPart?.artistTypeIds) {
            // Assign each artist type
            for (const artistTypeId of formPart.artistTypeIds) {
              try {
                await fetch(
                  `${config.apiBaseUrl}/api/works/${workId}/parts/${part.id}/artist-types/${artistTypeId}`,
                  { method: 'POST' }
                );
              } catch (err) {
                console.error(`Error assigning artist type ${artistTypeId}:`, err);
              }
            }
          }
        }
      }
      
      await loadWorks();
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingWork(null);
    } catch (err) {
      console.error('Error saving work:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteWork = async (workId) => {
    if (!confirm('Are you sure you want to delete this work?')) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/works/${workId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete work');
      
      await loadWorks();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const addPart = () => {
    setFormData({
      ...formData,
      parts: [
        ...formData.parts,
        {
          title: '',
          order: formData.parts.length + 1,
          trackKeys: [],
          artistTypeIds: []
        }
      ]
    });
  };

  const updatePart = (index, field, value) => {
    const newParts = [...formData.parts];
    newParts[index] = { ...newParts[index], [field]: value };
    setFormData({ ...formData, parts: newParts });
  };

  const removePart = (index) => {
    const newParts = formData.parts.filter((_, i) => i !== index);
    setFormData({ ...formData, parts: newParts });
  };

  if (loading) {
    return <div className="works-view"><div className="loading">Loading works...</div></div>;
  }

  if (error) {
    return <div className="works-view"><div className="error">Error: {error}</div></div>;
  }

  return (
    <div className="works-view">
      <div className="works-header">
        <h2>Musical Works</h2>
        <button className="btn-create-work" onClick={handleCreateWork}>
          ➕ Create Work
        </button>
      </div>

      {works.length === 0 ? (
        <div className="empty-state">
          <p>No works yet. Create your first musical work!</p>
        </div>
      ) : (
        <div className="works-list">
          {works.map(work => (
            <div key={work.id} className="work-card">
              <div className="work-header">
                <div className="work-info">
                  <h3 
                    className="work-title-link"
                    onClick={() => navigate(`/music?view=workDetail&work=${work.id}`)}
                  >
                    {work.title}
                  </h3>
                  <p className="composer">by {work.composer.title}</p>
                  <p className="parts-count">{work.parts.length} parts</p>
                  {work.totalPlayCount !== undefined && work.totalPlayCount > 0 && (
                    <p className="work-play-count">
                      {work.totalPlayCount} {work.totalPlayCount === 1 ? 'play' : 'plays'}
                    </p>
                  )}
                </div>
                <div className="work-actions">
                  <button
                    className="btn-expand"
                    onClick={() => setExpandedWork(expandedWork === work.id ? null : work.id)}
                  >
                    {expandedWork === work.id ? '▼' : '▶'}
                  </button>
                  <button className="btn-edit" onClick={() => handleEditWork(work)}>
                    ✏️
                  </button>
                  <button className="btn-delete" onClick={() => handleDeleteWork(work.id)}>
                    🗑️
                  </button>
                </div>
              </div>

              {expandedWork === work.id && (
                <div className="work-parts">
                  <h4>Parts:</h4>
                  {work.parts.map(part => (
                    <div key={part.id} className="part-item">
                      <div className="part-header">
                        <span className="part-order">{part.order}.</span>
                        <span 
                          className="part-title part-title-link"
                          onClick={() => navigate(`/music?view=workDetail&work=${work.id}`)}
                        >
                          {part.title}
                        </span>
                        <span className="part-tracks-count">
                          ({part.tracks.length} track{part.tracks.length !== 1 ? 's' : ''})
                        </span>
                        {part.totalPlayCount !== undefined && part.totalPlayCount > 0 && (
                          <span className="part-play-count">
                            • {part.totalPlayCount} {part.totalPlayCount === 1 ? 'play' : 'plays'}
                          </span>
                        )}
                      </div>
                      {part.artistTypes && part.artistTypes.length > 0 && (
                        <div className="part-artist-types-display">
                          {part.artistTypes.map(({ artistType }) => (
                            <span
                              key={artistType.id}
                              className="artist-type-badge"
                              style={artistType.color ? { backgroundColor: artistType.color } : {}}
                            >
                              {artistType.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {part.tracks.length > 0 && (
                        <div className="part-tracks">
                          {part.tracks.map(({ track }) => (
                            <div key={track.ratingKey} className="track-item">
                              <span className="track-title">{track.title}</span>
                              {track.album && (
                                <span className="track-album"> - {track.album.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Work Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingWork ? 'Edit Work' : 'Create New Work'}</h2>
            
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Symphony No. 5"
              />
            </div>

            <div className="form-group">
              <label>Composer *</label>
              <input
                type="text"
                value={composerSearch}
                onChange={e => {
                  setComposerSearch(e.target.value);
                  searchComposers(e.target.value);
                }}
                placeholder="Search for composer..."
              />
              {searchingComposer && <div className="searching">Searching...</div>}
              {composers.length > 0 && (
                <div className="composer-results">
                  {composers.map(composer => (
                    <div
                      key={composer.ratingKey}
                      className={`composer-item ${formData.composerKey === composer.ratingKey ? 'selected' : ''}`}
                      onClick={() => {
                        setFormData({ ...formData, composerKey: composer.ratingKey });
                        setComposerSearch(composer.title);
                        setComposers([]);
                      }}
                    >
                      {composer.title}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Parts</label>
              <button className="btn-add-part" onClick={addPart}>
                ➕ Add Part
              </button>
              <div className="parts-list">
                {formData.parts.map((part, index) => (
                  <div key={index} className="part-form-item">
                    <div className="part-form-row">
                      <input
                        type="number"
                        value={part.order}
                        onChange={e => updatePart(index, 'order', parseInt(e.target.value))}
                        placeholder="Order"
                        className="part-order-input"
                      />
                      <input
                        type="text"
                        value={part.title}
                        onChange={e => updatePart(index, 'title', e.target.value)}
                        placeholder="Part title (e.g., 'Allegro con brio')"
                        className="part-title-input"
                      />
                      <button
                        className="btn-remove-part"
                        onClick={() => removePart(index)}
                      >
                        ✖
                      </button>
                    </div>
                    <div className="part-artist-types">
                      <label className="part-artist-types-label">Artist Types:</label>
                      {artistTypes.length > 0 ? (
                        <div className="artist-type-selector">
                          <div className="artist-type-add-row">
                            <select 
                              className="artist-type-dropdown"
                              onChange={e => {
                                const selectedId = parseInt(e.target.value);
                                if (selectedId && !(part.artistTypeIds || []).includes(selectedId)) {
                                  updatePart(index, 'artistTypeIds', [...(part.artistTypeIds || []), selectedId]);
                                }
                                e.target.value = '';
                              }}
                              value=""
                            >
                              <option value="">Select artist type...</option>
                              {artistTypes
                                .filter(at => !(part.artistTypeIds || []).includes(at.id))
                                .map(artistType => (
                                  <option key={artistType.id} value={artistType.id}>
                                    {artistType.name}
                                  </option>
                                ))
                              }
                            </select>
                          </div>
                          {part.artistTypeIds && part.artistTypeIds.length > 0 && (
                            <div className="selected-artist-types">
                              {part.artistTypeIds.map(typeId => {
                                const artistType = artistTypes.find(at => at.id === typeId);
                                if (!artistType) return null;
                                return (
                                  <span
                                    key={typeId}
                                    className="artist-type-tag"
                                    style={artistType.color ? { backgroundColor: artistType.color } : {}}
                                  >
                                    {artistType.name}
                                    <button
                                      className="remove-type-btn"
                                      onClick={() => {
                                        const newIds = part.artistTypeIds.filter(id => id !== typeId);
                                        updatePart(index, 'artistTypeIds', newIds);
                                      }}
                                    >
                                      ✖
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="no-artist-types-message">
                          No artist types available. Create artist types from an artist's detail page first.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-save"
                onClick={handleSaveWork}
                disabled={!formData.title || !formData.composerKey}
              >
                Save
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingWork(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorksView;
