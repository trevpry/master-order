import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import './CustomOrders.css';

function CustomOrders() {  
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingOrderItems, setViewingOrderItems] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [episodeFormData, setEpisodeFormData] = useState({
    series: '',
    season: '',
    episode: ''
  });  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // Fetch custom orders when component mounts
  useEffect(() => {
    fetchCustomOrders();
  }, []);

  const fetchCustomOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/custom-orders');
      const orders = await response.json();
      setCustomOrders(orders);
    } catch (error) {
      console.error('Error fetching custom orders:', error);
      setMessage('Failed to load custom orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Order name is required');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/custom-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim()
        }),
      });

      if (response.ok) {
        setMessage('Custom order created successfully');
        setFormData({ name: '', description: '' });
        setShowCreateForm(false);
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error creating custom order:', error);
      setMessage('Error creating custom order');
    }
  };

  const handleToggleActive = async (orderId, currentStatus) => {
    try {
      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
      });

      if (response.ok) {
        setMessage(`Custom order ${!currentStatus ? 'activated' : 'deactivated'}`);
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating custom order:', error);
      setMessage('Error updating custom order');
    }
  };

  const handleDeleteOrder = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to delete "${orderName}"? This will also delete all items in this custom order.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Custom order deleted successfully');
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting custom order:', error);
      setMessage('Error deleting custom order');
    }
  };
  const resetWatchedStatus = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to mark all items in "${orderName}" as unwatched?`)) {
      return;
    }

    try {
      // Get the order details first
      const orderResponse = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`);
      const orderData = await orderResponse.json();

      // Update each item to be unwatched
      for (const item of orderData.items) {
        await fetch(`http://localhost:3001/api/custom-orders/${orderId}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isWatched: false
          }),
        });
      }

      setMessage('All items marked as unwatched');
      fetchCustomOrders(); // Refresh the list
    } catch (error) {
      console.error('Error resetting watched status:', error);
      setMessage('Error resetting watched status');
    }
  };

  const handleViewItems = (order) => {
    setViewingOrderItems(order);
    setMessage('');
  };

  const handleRemoveItem = async (orderId, itemId, itemTitle) => {
    if (!confirm(`Are you sure you want to remove "${itemTitle}" from this custom order?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Item removed successfully');
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error removing item:', error);
      setMessage('Error removing item');
    }
  };
  const handleMarkAsWatched = async (orderId, itemId, itemTitle) => {
    try {
      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isWatched: true
        }),
      });

      if (response.ok) {
        setMessage(`"${itemTitle}" marked as watched`);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as watched:', error);
      setMessage('Error marking item as watched');
    }
  };

  const handleMarkAsUnwatched = async (orderId, itemId, itemTitle) => {
    try {
      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isWatched: false
        }),
      });

      if (response.ok) {
        setMessage(`"${itemTitle}" marked as unwatched`);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as unwatched:', error);
      setMessage('Error marking item as unwatched');
    }
  };

  const handleSearchMedia = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // This is a placeholder for Plex media search functionality
      // In a real implementation, you would need to create an endpoint that searches Plex
      const response = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);      } else {
        setSearchResults([]);
        setMessage('Media search functionality coming soon');
      }
    } catch (error) {
      console.error('Error searching media:', error);
      setSearchResults([]);
      setMessage('Media search functionality coming soon');    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMediaToOrder = async (orderId, mediaItem) => {
    try {
      const requestBody = {
        mediaType: mediaItem.type,
        title: mediaItem.title
      };

      // Add fields based on media type
      if (mediaItem.type === 'comic') {
        requestBody.comicSeries = mediaItem.comicSeries;
        requestBody.comicYear = mediaItem.comicYear;
        requestBody.comicIssue = mediaItem.comicIssue;
      } else {
        // For Plex media (movies and TV episodes)
        requestBody.plexKey = mediaItem.ratingKey;
        requestBody.seasonNumber = mediaItem.parentIndex;
        requestBody.episodeNumber = mediaItem.index;
        requestBody.seriesTitle = mediaItem.grandparentTitle;      }

      const response = await fetch(`http://localhost:3001/api/custom-orders/${orderId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (response.ok) {
        setMessage('Media added to custom order successfully');
        setShowSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://localhost:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
        return true;
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          // Handle duplicate item error
          setMessage(`Duplicate item: "${errorData.existingItem.title}" is already in this custom order`);
        } else {
          setMessage(`Error: ${errorData.error}`);
        }
        return false;
      }
    } catch (error) {
      console.error('Error adding media to custom order:', error);
      setMessage('Error adding media to custom order');
      return false;
    }
  };
  const handleSearchTVEpisode = async (e) => {
    e.preventDefault();
    
    // Validate all required fields are filled
    if (!episodeFormData.series.trim() || !episodeFormData.season || !episodeFormData.episode) {
      setMessage('Please fill in all episode fields');
      return;
    }    setEpisodeSearchLoading(true);
    try {
      // Search Plex TV library for episodes matching the series name
      const searchQuery = `${episodeFormData.series.trim()}`;
      const response = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(searchQuery)}&type=tv`);
      
      if (response.ok) {
        const results = await response.json();
          // Filter for the specific episode with improved matching
        const targetEpisode = results.find(item => {
          if (item.type !== 'episode') return false;
          if (item.parentIndex !== parseInt(episodeFormData.season)) return false;
          if (item.index !== parseInt(episodeFormData.episode)) return false;
          
          // Improved series name matching - check for exact match or close match
          const seriesInput = episodeFormData.series.toLowerCase().trim();
          const seriesTitle = item.grandparentTitle.toLowerCase();
          
          return seriesTitle.includes(seriesInput) || seriesInput.includes(seriesTitle);
        });        if (targetEpisode) {
          // Add the episode directly
          const success = await handleAddMediaToOrder(viewingOrderItems.id, targetEpisode);
          // Only close the form and show success message if the add was successful
          if (success !== false) {
            setShowEpisodeForm(false);
            setEpisodeFormData({ series: '', season: '', episode: '' });
            // Don't set success message here since handleAddMediaToOrder handles messages
          }
        } else {
          // Check if any episodes were found for this series
          const seriesEpisodes = results.filter(item => 
            item.type === 'episode' && 
            item.grandparentTitle.toLowerCase().includes(episodeFormData.series.toLowerCase())
          );
          
          if (seriesEpisodes.length > 0) {
            setMessage(`Episode not found: ${episodeFormData.series} S${episodeFormData.season}E${episodeFormData.episode}. Found ${seriesEpisodes.length} other episodes for this series.`);
          } else {
            setMessage(`Series not found: "${episodeFormData.series}". Please check the series name and try again.`);
          }
        }
      } else {
        setMessage('Error searching for episode');
      }
    } catch (error) {
      console.error('Error searching for TV episode:', error);
      setMessage('Error searching for TV episode');
    } finally {
      setEpisodeSearchLoading(false);
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    
    if (!bulkImportData.trim()) {
      setMessage('Please enter tab-delimited data to import');
      return;
    }

    setBulkImportLoading(true);
    
    try {
      // Parse tab-delimited data
      const lines = bulkImportData.trim().split('\n');
      const items = [];
      const errors = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        const columns = line.split('\t');
        
        // Validate required columns
        if (columns.length < 4) {
          errors.push(`Line ${i + 1}: Not enough columns (need 4: Series/Movie, Season/Episode, Title, Type)`);
          continue;
        }
        
        const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
        
        if (!seriesOrMovie || !title || !rawMediaType) {
          errors.push(`Line ${i + 1}: Missing required data (Series/Movie, Title, or Type)`);
          continue;
        }
        
        // Normalize media types
        const mediaType = rawMediaType.toLowerCase() === 'tv series' ? 'episode' : rawMediaType.toLowerCase();
        
        // Initialize comic-specific fields
        let comicSeries = null;
        let comicYear = null;
        let comicIssue = null;
        
        // Parse season and episode for TV episodes or comic details for comics
        let seasonNumber = null;
        let episodeNumber = null;
        
        if (mediaType === 'episode' && seasonEpisode) {
          // Try to parse various formats: "S1E1", "S01E01", "1x1", "1,1", "1 1"
          const seasonEpMatch = seasonEpisode.match(/(?:S?(\d+)(?:[xXeE]|,|\s)+(\d+))|(?:(\d+)\s*[\-\/]\s*(\d+))/i);
          if (seasonEpMatch) {
            seasonNumber = parseInt(seasonEpMatch[1] || seasonEpMatch[3]);
            episodeNumber = parseInt(seasonEpMatch[2] || seasonEpMatch[4]);
          } else {
            errors.push(`Line ${i + 1}: Invalid season/episode format. Use S1E1, S01E01, 1x1, 1,1, or 1-1`);
            continue;
          }
        } else if (mediaType === 'comic') {
          // Parse comic format: "Series Name (Year) #Issue"
          const comicMatch = seriesOrMovie.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+)$/);
          if (comicMatch) {
            comicSeries = comicMatch[1].trim();
            comicYear = parseInt(comicMatch[2]);
            comicIssue = parseInt(comicMatch[3]);
          } else {
            errors.push(`Line ${i + 1}: Invalid comic format. Use "Series Name (Year) #Issue" format (e.g., "The Amazing Spider-Man (2018) #1")`);
            continue;
          }
        }
        
        items.push({
          seriesOrMovie,
          seasonNumber,
          episodeNumber,
          comicSeries,
          comicYear,
          comicIssue,
          title,
          mediaType: mediaType,
          lineNumber: i + 1
        });
      }
      
      if (errors.length > 0) {
        setMessage(`Import errors:\n${errors.join('\n')}`);
        setBulkImportLoading(false);
        return;
      }
      
      if (items.length === 0) {
        setMessage('No valid items found to import');
        setBulkImportLoading(false);
        return;
      }
      
      // Process each item
      let successCount = 0;
      let failCount = 0;
      const failedItems = [];
      
      for (const item of items) {
        try {
          let targetMedia = null;          if (item.mediaType === 'comic') {
            // For comics, create the media object directly since we have all the info
            targetMedia = {
              title: item.title,
              type: 'comic',
              comicSeries: item.comicSeries,
              comicYear: item.comicYear,
              comicIssue: item.comicIssue
            };
          } else {
            // For movies and TV episodes, search Plex
            let searchQuery = item.seriesOrMovie;
            let searchUrl = `http://localhost:3001/api/search?query=${encodeURIComponent(searchQuery)}`;
            
            // For TV episodes, use the TV-specific search to get all episodes
            if (item.mediaType === 'episode') {
              searchUrl += '&type=tv';
            }
            
            const response = await fetch(searchUrl);
            
            if (response.ok) {
              const results = await response.json();
              
              if (item.mediaType === 'episode') {
                // Find specific episode
                targetMedia = results.find(result => 
                  result.type === 'episode' &&
                  result.parentIndex === item.seasonNumber &&
                  result.index === item.episodeNumber &&
                  (result.grandparentTitle.toLowerCase().includes(item.seriesOrMovie.toLowerCase()) ||
                   item.seriesOrMovie.toLowerCase().includes(result.grandparentTitle.toLowerCase()))
                );
              } else if (item.mediaType === 'movie') {
                // Find movie by title
                targetMedia = results.find(result => 
                  result.type === 'movie' &&
                  (result.title.toLowerCase().includes(item.title.toLowerCase()) ||
                   item.title.toLowerCase().includes(result.title.toLowerCase()))
                );
              }
            }
          }          if (targetMedia) {
            // Add to custom order
            const success = await handleAddMediaToOrder(viewingOrderItems.id, targetMedia);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else {
            failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (not found in Plex)`);
            failCount++;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing item on line ${item.lineNumber}:`, error);
          failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (processing error)`);
          failCount++;
        }
      }
      
      // Show results
      let resultMessage = `Bulk import completed: ${successCount} items added successfully`;
      if (failCount > 0) {
        resultMessage += `, ${failCount} items failed`;
        if (failedItems.length > 0) {
          resultMessage += `:\n${failedItems.join('\n')}`;
        }
      }
      
      setMessage(resultMessage);
      
      if (successCount > 0) {
        // Clear the form and close modal
        setBulkImportData('');
        setShowBulkImportModal(false);
        
        // Refresh the order items
        fetchCustomOrders();
        if (viewingOrderItems) {
          const updatedOrder = await fetch(`http://localhost:3001/api/custom-orders/${viewingOrderItems.id}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      }
      
    } catch (error) {
      console.error('Error during bulk import:', error);
      setMessage('Error during bulk import process');
    } finally {
      setBulkImportLoading(false);
    }
  };

  if (loading) {
    return (
      <main>
        <h2>Custom Orders</h2>
        <p>Loading custom orders...</p>
      </main>
    );
  }
  return (
    <main>
      <h2>Custom Orders</h2>
      <p>Create and manage custom playlists of mixed media (movies, TV episodes, comics, etc.)</p>

      {/* Back button when viewing items */}
      {viewingOrderItems && (
        <div className="back-navigation">
          <Button
            onClick={() => setViewingOrderItems(null)}
            className="secondary"
          >
            ← Back to Custom Orders
          </Button>
        </div>
      )}

      {/* Item Management View */}
      {viewingOrderItems ? (
        <div className="order-items-view">
          <div className="order-items-header">
            <h3>Managing Items: {viewingOrderItems.name}</h3>
            {viewingOrderItems.description && (
              <p className="order-description">{viewingOrderItems.description}</p>
            )}
            <div className="order-stats">
              <div className="stat">
                <span className="stat-label">Total Items:</span>
                <span className="stat-value">{viewingOrderItems.items.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Unwatched:</span>
                <span className="stat-value">
                  {viewingOrderItems.items.filter(item => !item.isWatched).length}
                </span>
              </div>            </div>            <div className="manage-items-actions">
              <Button
                onClick={() => {
                  setShowSearchModal(true);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="primary"
              >
                Add Media
              </Button>
              <Button
                onClick={() => {
                  setShowEpisodeForm(true);
                  setEpisodeFormData({ series: '', season: '', episode: '' });
                }}
                className="secondary"
              >
                Add TV Episode
              </Button>
              <Button
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportData('');
                }}
                className="secondary"
              >
                Bulk Import
              </Button>
            </div>
          </div>          {viewingOrderItems.items.length === 0 ? (
            <div className="empty-state">
              <p>No items in this custom order yet.</p>
              <p>Add some movies, TV episodes, or comics to get started!</p>
            </div>
          ) : (
            <div className="items-list">
              {viewingOrderItems.items.map((item, index) => (                <div key={item.id} className={`item-card ${item.isWatched ? 'watched' : ''}`}>
                  <div className="item-info">
                    <div className="item-position">#{index + 1}</div>
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      {item.seriesTitle && (
                        <p className="item-series">
                          {item.seriesTitle} - S{item.seasonNumber}E{item.episodeNumber}
                        </p>
                      )}
                      {item.comicSeries && (
                        <p className="item-series">
                          {item.comicSeries} ({item.comicYear}) #{item.comicIssue}
                        </p>
                      )}
                      <div className="item-meta">
                        <span className="item-type">{item.mediaType}</span>
                        <span className={`item-status ${item.isWatched ? 'watched' : 'unwatched'}`}>
                          {item.isWatched ? 'Watched' : 'Unwatched'}
                        </span>
                      </div>
                    </div>
                  </div><div className="item-actions">
                    <Button
                      onClick={() => handleRemoveItem(viewingOrderItems.id, item.id, item.title)}
                      className="danger"
                      size="small"
                    >
                      Remove
                    </Button>
                    {!item.isWatched && (
                      <Button
                        onClick={() => handleMarkAsWatched(viewingOrderItems.id, item.id, item.title)}
                        className="primary"
                        size="small"
                      >
                        Mark as Watched
                      </Button>
                    )}
                    {item.isWatched && (
                      <Button
                        onClick={() => handleMarkAsUnwatched(viewingOrderItems.id, item.id, item.title)}
                        className="secondary"
                        size="small"
                      >
                        Mark as Unwatched
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Create New Order Button */}
          <div className="custom-orders-header">
            <Button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setFormData({ name: '', description: '' });
                setMessage('');
              }}
            >
              {showCreateForm ? 'Cancel' : 'Create New Custom Order'}
            </Button>
          </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <h3>Create New Custom Order</h3>
          <form onSubmit={handleCreateOrder}>
            <div className="form-group">
              <label htmlFor="orderName">Order Name *</label>
              <input
                type="text"
                id="orderName"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Marvel Movies & Shows"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="orderDescription">Description</label>
              <textarea
                id="orderDescription"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description of this custom order..."
                rows="3"
              />
            </div>
            <div className="form-actions">
              <Button type="submit">Create Order</Button>
              <Button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Orders List */}
      <div className="custom-orders-list">
        {customOrders.length === 0 ? (
          <div className="empty-state">
            <p>No custom orders created yet.</p>
            <p>Create your first custom order to get started!</p>
          </div>
        ) : (
          <div className="orders-grid">
            {customOrders.map(order => (
              <div key={order.id} className={`order-card ${!order.isActive ? 'inactive' : ''}`}>
                <div className="order-header">
                  <h3>{order.name}</h3>
                  <div className="order-status">
                    <span className={`status-badge ${order.isActive ? 'active' : 'inactive'}`}>
                      {order.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                {order.description && (
                  <p className="order-description">{order.description}</p>
                )}
                
                <div className="order-stats">
                  <div className="stat">
                    <span className="stat-label">Total Items:</span>
                    <span className="stat-value">{order.items.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Unwatched:</span>
                    <span className="stat-value">
                      {order.items.filter(item => !item.isWatched).length}
                    </span>
                  </div>
                </div>                <div className="order-actions">
                  <Button
                    onClick={() => handleToggleActive(order.id, order.isActive)}
                    className={order.isActive ? 'secondary' : 'primary'}
                    size="small"
                  >
                    {order.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  
                  <Button
                    onClick={() => handleViewItems(order)}
                    className="primary"
                    size="small"
                  >
                    Manage Items
                  </Button>
                  
                  {order.items.length > 0 && (
                    <Button
                      onClick={() => resetWatchedStatus(order.id, order.name)}
                      className="secondary"
                      size="small"
                    >
                      Reset Watched
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleDeleteOrder(order.id, order.name)}
                    className="danger"
                    size="small"
                  >
                    Delete
                  </Button>
                </div>                <div className="order-created">
                  Created: {new Date(order.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Media to Custom Order</h3>
              <Button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <div className="search-section">
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder="Search for movies or TV episodes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchMedia(e.target.value);
                  }}
                  className="search-input"
                />
                {searchLoading && <div className="search-loading">Searching...</div>}
              </div>
              
              <div className="search-results">
                {searchResults.length === 0 && searchQuery && !searchLoading && (
                  <div className="no-results">
                    <p>Media search functionality coming soon!</p>
                    <p>For now, you can manually add media using Plex keys through the API.</p>
                  </div>
                )}
                
                {searchResults.map(result => (
                  <div key={result.ratingKey} className="search-result-item">
                    <div className="result-info">
                      <h4>{result.title}</h4>
                      {result.grandparentTitle && (
                        <p>{result.grandparentTitle} - S{result.parentIndex}E{result.index}</p>
                      )}
                      <span className="result-type">{result.type}</span>
                    </div>
                    <Button
                      onClick={() => handleAddMediaToOrder(viewingOrderItems.id, result)}
                      className="primary"
                      size="small"
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
                <div className="manual-add-section">
                <p className="manual-add-note">
                  <strong>Note:</strong> Advanced users can manually add media by creating a Plex search endpoint. 
                  For now, items can be added programmatically through the API endpoints.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episode Form Modal */}
      {showEpisodeForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add TV Episode</h3>
              <Button
                onClick={() => {
                  setShowEpisodeForm(false);
                  setEpisodeFormData({ series: '', season: '', episode: '' });
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchTVEpisode} className="episode-form">
              <div className="form-group">
                <label htmlFor="series">Series Name *</label>
                <input
                  type="text"
                  id="series"
                  value={episodeFormData.series}
                  onChange={(e) => setEpisodeFormData({
                    ...episodeFormData,
                    series: e.target.value
                  })}
                  placeholder="e.g., Breaking Bad"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="season">Season Number *</label>
                  <input
                    type="number"
                    id="season"
                    min="1"
                    value={episodeFormData.season}
                    onChange={(e) => setEpisodeFormData({
                      ...episodeFormData,
                      season: e.target.value
                    })}
                    placeholder="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="episode">Episode Number *</label>
                  <input
                    type="number"
                    id="episode"
                    min="1"
                    value={episodeFormData.episode}
                    onChange={(e) => setEpisodeFormData({
                      ...episodeFormData,
                      episode: e.target.value
                    })}
                    placeholder="1"
                    required
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={episodeSearchLoading}
                  className="primary"
                >
                  {episodeSearchLoading ? 'Searching...' : 'Add Episode'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowEpisodeForm(false);
                    setEpisodeFormData({ series: '', season: '', episode: '' });
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Import Media</h3>
              <Button
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkImportData('');
                  setMessage('');
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleBulkImport} className="bulk-import-form">
              <div className="form-group">
                <label htmlFor="bulkData">Paste your tab-delimited data here *</label>
                <textarea
                  id="bulkData"
                  value={bulkImportData}
                  onChange={(e) => setBulkImportData(e.target.value)}
                  placeholder="Series/Movie&#9;Season/Episode&#9;Title&#9;Type"
                  rows="10"
                  required
                />
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={bulkImportLoading}
                  className="primary"
                >
                  {bulkImportLoading ? 'Importing...' : 'Import Media'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                    setMessage('');
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            <div className="bulk-import-note">
              <p><strong>Note:</strong> This feature is for advanced users. Please ensure your data is correctly formatted.</p>
              <p>Example format:</p>
              <pre>
                {`Breaking Bad\tS1E1\tPilot\tEpisode
The Godfather\t\tThe Godfather\tMovie`}
              </pre>
            </div>
          </div>
        </div>      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Import Media</h3>
              <Button
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkImportData('');
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleBulkImport} className="bulk-import-form">              <div className="bulk-import-instructions">
                <h4>Tab-Delimited Import Format</h4>
                <p>Paste tab-separated data with these 4 columns in order:</p>
                <ol>
                  <li><strong>Series/Movie/Comic Name:</strong> The name of the TV series, movie, or comic (for comics use "Series Name (Year) #Issue" format)</li>
                  <li><strong>Season/Episode:</strong> For episodes: S1E1, S01E01, 1x1, 1,1, or 1-1 format (leave blank for movies and comics)</li>
                  <li><strong>Title:</strong> The specific episode title, movie title, or comic issue title</li>
                  <li><strong>Type:</strong> "episode" (or "TV Series") for TV episodes, "movie" for movies, "comic" for comics</li>
                </ol>
                
                <div className="example-data">
                  <strong>Example:</strong>
                  <pre>
Breaking Bad	S1E1	Pilot	episode
Breaking Bad	S01E02	Cat's in the Bag...	episode
The Avengers		The Avengers	movie
Game of Thrones	1x1	Winter Is Coming	episode
The Amazing Spider-Man (2018) #1		Amazing Spider-Man	comic
The High Republic Adventures (2022) #7		The Monster of Temple Peak Part 1	comic
                  </pre>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="bulkData">Tab-Delimited Data *</label>
                <textarea
                  id="bulkData"
                  value={bulkImportData}
                  onChange={(e) => setBulkImportData(e.target.value)}
                  placeholder="Paste your tab-delimited data here..."
                  rows="10"
                  className="bulk-import-textarea"
                  required
                />
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={bulkImportLoading}
                  className="primary"
                >
                  {bulkImportLoading ? 'Importing...' : 'Import Items'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {message && (
        <div className="message">
          <p>{message}</p>
        </div>
      )}
    </main>
  );
}

export default CustomOrders;
