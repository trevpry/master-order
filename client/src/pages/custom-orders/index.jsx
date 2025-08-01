import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import './CustomOrders.css';

function CustomOrders() {  
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);  const [editingItem, setEditingItem] = useState(null);
  const [viewingOrderItems, setViewingOrderItems] = useState(null);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [episodeFormData, setEpisodeFormData] = useState({
    series: '',
    season: '',
    episode: ''
  });  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);  const [showMovieForm, setShowMovieForm] = useState(false);
  const [movieFormData, setMovieFormData] = useState({
    title: '',
    year: ''
  });
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);  const [reselectingItem, setReselectingItem] = useState(null); // For tracking which item is being re-selected
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: ''
  });  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [showComicForm, setShowComicForm] = useState(false);  const [comicFormData, setComicFormData] = useState({
    series: '',
    year: '',
    issue: '',
    title: ''
  });const [comicSearchResults, setComicSearchResults] = useState([]);
  const [comicSearchLoading, setComicSearchLoading] = useState(false);
  const [showShortStoryForm, setShowShortStoryForm] = useState(false);
  const [shortStoryFormData, setShortStoryFormData] = useState({
    title: '',
    author: '',
    year: '',
    url: '',
    containedInBookId: '',
    coverUrl: ''
  });  const [shortStorySearchResults, setShortStorySearchResults] = useState([]);
  
  // Web Video Form state
  const [showWebVideoForm, setShowWebVideoForm] = useState(false);
  const [webVideoFormData, setWebVideoFormData] = useState({
    title: '',
    url: '',
    description: ''
  });
  
  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Watched items filter state
  const [showWatchedItems, setShowWatchedItems] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: ''
  });
    // Helper function to filter items based on preferences
  const getFilteredItems = (items) => {
    return items.filter(item => {
      // Filter out reference books (books that contain short stories)
      if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
        return false;
      }
      
      // Filter based on watched status toggle
      if (!showWatchedItems && item.isWatched) {
        return false;
      }
      
      return true;
    });
  };
  
  // Helper function to get all items excluding reference books (for stats)
  const getAllNonReferenceItems = (items) => {
    return items.filter(item => {
      // Filter out reference books (books that contain short stories)
      if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
        return false;
      }
      return true;
    });
  };
  
  // Helper function to get unwatched items excluding reference books (for stats)
  const getUnwatchedNonReferenceItems = (items) => {
    return items.filter(item => {
      // Filter out reference books (books that contain short stories)
      if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
        return false;
      }
      return !item.isWatched;
    });
  };
  // Helper function to generate artwork URLs for custom order items
  const getItemArtworkUrl = (item) => {
    // Check if we have cached artwork
    if (item.localArtworkPath) {
      // Extract just the filename from the full path
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
        ? item.localArtworkPath.split(/[\\\/]/).pop() 
        : item.localArtworkPath;
      return `http://localhost:3001/api/artwork/${filename}`;
    }
    
    // For items without cached artwork, try to get remote artwork URLs
    // This matches the logic from the artworkCacheService
    switch (item.mediaType) {
      case 'comic':
        if (item.comicSeries && item.comicYear) {
          const comicString = `${item.comicSeries} (${item.comicYear}) #${item.comicIssue || '1'}`;
          return `http://localhost:3001/api/comicvine-artwork?url=${encodeURIComponent(`http://localhost:3001/api/comicvine-cover?comic=${encodeURIComponent(comicString)}`)}`;
        }
        break;
      
      case 'book':
        if (item.bookCoverUrl) {
          return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(item.bookCoverUrl)}`;
        } else if (item.bookOpenLibraryId) {
          return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(`https://covers.openlibrary.org/b/olid/${item.bookOpenLibraryId}-M.jpg`)}`;
        }
        break;
      
      case 'shortstory':
        if (item.storyCoverUrl) {
          return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(item.storyCoverUrl)}`;
        } else if (item.storyContainedInBook?.bookCoverUrl) {
          return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(item.storyContainedInBook.bookCoverUrl)}`;
        }
        break;
      
      case 'episode':
      case 'movie':
        // For Plex items, we would need the plexKey and settings, which requires backend call
        // Fall back to null for now - the artwork caching service will handle this
        break;
    }
    
    // For items without cached artwork, return null to show fallback
    return null;
  };

  // Fetch custom orders when component mounts
  useEffect(() => {
    fetchCustomOrders();
  }, []);

  const fetchCustomOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:3001/api/custom-orders');
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

    try {      const response = await fetch('http://127.0.0.1:3001/api/custom-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim()
        }),
      });

      if (response.ok) {
        setMessage('Custom order created successfully');
        setFormData({ name: '', description: '', icon: '' });
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
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`, {
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
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`, {
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

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setFormData({
      name: order.name,
      description: order.description || '',
      icon: order.icon || ''
    });
    setMessage('');
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Order name is required');
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim()
        }),
      });

      if (response.ok) {
        setMessage('Custom order updated successfully');
        setFormData({ name: '', description: '', icon: '' });
        setEditingOrder(null);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === editingOrder.id) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${editingOrder.id}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }    } catch (error) {
      console.error('Error updating custom order:', error);
      setMessage('Error updating custom order');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    
    // Set appropriate form data based on item type
    switch (item.mediaType) {
      case 'episode':
        setEpisodeFormData({
          series: item.series || '',
          season: item.season || '',
          episode: item.episode || ''
        });
        setShowEpisodeForm(true);
        break;
      case 'book':
        setBookFormData({
          title: item.title || '',
          author: item.author || '',
          year: item.publicationYear || '',
          isbn: item.isbn || ''
        });
        setShowBookForm(true);
        break;      case 'comic':
        setComicFormData({
          series: item.comicSeries || '',
          year: item.comicYear || '',
          issue: item.comicIssue || '',
          title: item.customTitle || ''
        });
        setShowComicForm(true);
        break;      case 'shortstory':
        setShortStoryFormData({
          title: item.title || '',
          author: item.author || '',
          year: item.publicationYear || '',
          url: item.url || '',
          containedInBookId: item.containedInBookId || '',
          coverUrl: item.coverUrl || ''
        });
        setShowShortStoryForm(true);
        break;
      case 'webvideo':
        setWebVideoFormData({
          title: item.title || '',
          url: item.url || '',
          description: item.description || ''
        });
        setShowWebVideoForm(true);
        break;
      default:
        // For movies or other types, we might need a different approach
        setMessage(`Editing ${item.mediaType} items is not yet supported`);
    }
  };

  const handleUpdateItem = async (updatedItemData) => {
    if (!editingItem || !viewingOrderItems) return;

    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedItemData),
      });

      if (response.ok) {
        setMessage('Item updated successfully');
        setEditingItem(null);
          // Close the appropriate form
        setShowEpisodeForm(false);
        setShowBookForm(false);
        setShowComicForm(false);
        setShowShortStoryForm(false);
        setShowWebVideoForm(false);
          // Reset form data
        setEpisodeFormData({ series: '', season: '', episode: '' });
        setBookFormData({ title: '', author: '', year: '', isbn: '' });
        setComicFormData({ series: '', year: '', issue: '', title: '' });
        setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
        setWebVideoFormData({ title: '', url: '', description: '' });
        
        // Refresh the order items
        const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
        const updatedOrderData = await updatedOrder.json();
        setViewingOrderItems(updatedOrderData);
        
      } else {
        const errorData = await response.json();
        setMessage(`Error updating item: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setMessage('Error updating item');
    }
  };

  const resetWatchedStatus = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to mark all items in "${orderName}" as unwatched?`)) {
      return;
    }

    try {
      // Get the order details first
      const orderResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
      const orderData = await orderResponse.json();

      // Update each item to be unwatched
      for (const item of orderData.items) {
        await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${item.id}`, {
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
      // Check if this is a short story before deletion
      const itemToRemove = viewingOrderItems.items.find(item => item.id === itemId);
      let containingBookId = null;
      
      if (itemToRemove && itemToRemove.mediaType === 'shortstory' && itemToRemove.storyContainedInBookId) {
        containingBookId = itemToRemove.storyContainedInBookId;
      }

      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Item removed successfully');
        
        // If this was a short story from a book, check if we need to remove the containing book
        if (containingBookId) {
          // Get the updated order data to check remaining short stories
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          
          // Check if there are any other short stories from the same book
          const remainingStoriesFromBook = updatedOrderData.items.filter(item => 
            item.mediaType === 'shortstory' && 
            item.storyContainedInBookId === containingBookId
          );
          
          // If no other short stories from this book remain, remove the book
          if (remainingStoriesFromBook.length === 0) {
            const containingBook = updatedOrderData.items.find(item => 
              item.id === containingBookId && item.mediaType === 'book'
            );
            
            if (containingBook) {
              const bookRemoveResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${containingBookId}`, {
                method: 'DELETE',
              });
              
              if (bookRemoveResponse.ok) {
                setMessage(`Item and containing book "${containingBook.bookTitle || containingBook.title}" removed successfully`);
              } else {
                setMessage('Item removed successfully, but failed to remove empty containing book');
              }
            }
          }
        }
        
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
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
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
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
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
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
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
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
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as unwatched:', error);
      setMessage('Error marking item as unwatched');    }
  };

  const handleReselectBook = (item) => {
    setReselectingItem(item);
    
    setBookFormData({
      title: item.bookTitle || item.title || '',
      author: item.bookAuthor || '',
      year: item.bookYear ? item.bookYear.toString() : '',
      isbn: item.bookIsbn || ''
    });
    
    setShowBookForm(true);
  };
  const handleReselectComic = (item) => {
    setReselectingItem(item);
      setComicFormData({
      series: item.comicSeries || '',
      year: item.comicYear ? item.comicYear.toString() : '',
      issue: item.comicIssue || '',
      title: item.customTitle || ''
    });
    
    setShowComicForm(true);
  };
  const handleCollectedIn = (item) => {
    setReselectingItem(item);
    
    // Pre-populate search with story author if available
    setBookFormData({
      title: '',
      author: item.storyAuthor || '',
      year: item.storyYear ? item.storyYear.toString() : '',
      isbn: ''
    });
    
    setShowBookForm(true);
  };
  // Drag and Drop handlers
  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem({ index });
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverItem(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.index === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      setIsDragging(false);
      return;
    }    try {
      // Get filtered items (same filter as in render)
      const filteredItems = getFilteredItems(viewingOrderItems.items);

      // Reorder the items array
      const newItems = [...filteredItems];
      const draggedItemData = newItems[draggedItem.index];
      
      // Remove dragged item and insert at new position
      newItems.splice(draggedItem.index, 1);
      newItems.splice(dropIndex, 0, draggedItemData);

      // Update sortOrder for all affected items
      const updatePromises = newItems.map((item, index) => {
        const newSortOrder = index + 1;
        return fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sortOrder: newSortOrder
          }),
        });
      });

      await Promise.all(updatePromises);

      // Refresh the order data
      const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
      const updatedOrderData = await updatedOrder.json();
      setViewingOrderItems(updatedOrderData);
      
      setMessage('Items reordered successfully');
    } catch (error) {
      console.error('Error reordering items:', error);
      setMessage('Error reordering items');
    }

    // Reset drag state
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragging(false);
  };

  const handleSearchMedia = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:3001/api/search?query=${encodeURIComponent(query)}`);
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
  };  const handleAddMediaToOrder = async (orderId, mediaItem, skipUIUpdate = false) => {
    try {
      const requestBody = {
        mediaType: mediaItem.mediaType || mediaItem.type,
        title: mediaItem.title
      };      // Add fields based on media type
      const mediaType = mediaItem.mediaType || mediaItem.type;      if (mediaType === 'comic') {
        requestBody.comicSeries = mediaItem.comicSeries;
        requestBody.comicYear = mediaItem.comicYear;
        requestBody.comicIssue = mediaItem.comicIssue;
        requestBody.customTitle = mediaItem.customTitle;} else if (mediaType === 'book') {
        requestBody.bookTitle = mediaItem.bookTitle;
        requestBody.bookAuthor = mediaItem.bookAuthor;
        requestBody.bookYear = mediaItem.bookYear;
        requestBody.bookIsbn = mediaItem.bookIsbn;
        requestBody.bookPublisher = mediaItem.bookPublisher;
        requestBody.bookOpenLibraryId = mediaItem.bookOpenLibraryId;
        requestBody.bookCoverUrl = mediaItem.bookCoverUrl;      } else if (mediaType === 'shortstory') {
        requestBody.storyTitle = mediaItem.storyTitle;
        requestBody.storyAuthor = mediaItem.storyAuthor;
        requestBody.storyYear = mediaItem.storyYear;
        requestBody.storyUrl = mediaItem.storyUrl;
        requestBody.storyContainedInBookId = mediaItem.storyContainedInBookId;
        requestBody.storyCoverUrl = mediaItem.storyCoverUrl;
      } else if (mediaType === 'webvideo' || mediaType === 'web') {
        // Normalize 'web' to 'webvideo'
        requestBody.mediaType = 'webvideo';
        requestBody.webTitle = mediaItem.webTitle;
        requestBody.webUrl = mediaItem.webUrl;
        requestBody.webDescription = mediaItem.webDescription;
      } else {
        requestBody.plexKey = mediaItem.ratingKey;
        requestBody.seasonNumber = mediaItem.parentIndex;
        requestBody.episodeNumber = mediaItem.index;
        requestBody.seriesTitle = mediaItem.grandparentTitle;
      }const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });      if (response.ok) {
        // Only update UI if not skipping updates (for individual adds, not bulk imports)
        if (!skipUIUpdate) {
          setMessage('Media added to custom order successfully');
          fetchCustomOrders(); // Refresh the list
          
          // Update the viewing order if it's currently being viewed
          if (viewingOrderItems && viewingOrderItems.id === orderId) {
            const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
            const updatedOrderData = await updatedOrder.json();
            setViewingOrderItems(updatedOrderData);
          }
        }
        return true;
      } else {
        const errorData = await response.json();
        if (!skipUIUpdate) {
          if (response.status === 409) {
            setMessage(`Duplicate item: "${errorData.existingItem.title}" is already in this custom order`);
          } else {
            setMessage(`Error: ${errorData.error}`);
          }
        }
        return false;
      }
    } catch (error) {
      console.error('Error adding media to custom order:', error);
      if (!skipUIUpdate) {
        setMessage('Error adding media to custom order');
      }
      return false;
    }
  };const handleSearchTVEpisode = async (e) => {
    e.preventDefault();
    
    // Validate all required fields are filled
    if (!episodeFormData.series.trim() || !episodeFormData.season || !episodeFormData.episode) {
      setMessage('Please fill in all episode fields');
      return;
    }

    setEpisodeSearchLoading(true);
    try {
      // If we're editing an item, update it directly without searching
      if (editingItem) {
        const updatedItemData = {
          series: episodeFormData.series.trim(),
          season: parseInt(episodeFormData.season),
          episode: parseInt(episodeFormData.episode)
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      // Search Plex TV library for episodes matching the series name
      const searchQuery = `${episodeFormData.series.trim()}`;
      const response = await fetch(`http://127.0.0.1:3001/api/search?query=${encodeURIComponent(searchQuery)}&type=tv`);
      
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
        });

        if (targetEpisode) {
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

  const handleSearchMovies = async (e) => {
    e.preventDefault();
    
    // Validate required fields are filled
    if (!movieFormData.title.trim()) {
      setMessage('Please enter a movie title');
      return;
    }

    setMovieSearchLoading(true);
    try {
      // If we're editing an item, update it directly without searching
      if (editingItem) {
        const updatedItemData = {
          title: movieFormData.title.trim(),
          year: movieFormData.year ? parseInt(movieFormData.year) : null
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      // Search Plex movie library
      let searchUrl = `http://127.0.0.1:3001/api/search?query=${encodeURIComponent(movieFormData.title.trim())}`;
      
      // Add year parameter if provided
      if (movieFormData.year && movieFormData.year.trim()) {
        searchUrl += `&year=${movieFormData.year.trim()}`;
      }
      
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const results = await response.json();
        
        // Filter for movies and find the best match
        const movieCandidates = results.filter(item => 
          item.type === 'movie' &&
          (item.title.toLowerCase().includes(movieFormData.title.toLowerCase()) ||
           movieFormData.title.toLowerCase().includes(item.title.toLowerCase()))
        );
        
        if (movieCandidates.length > 0) {
          setMovieSearchResults(movieCandidates);
          
          // If only one result or exact year match, can auto-select
          if (movieCandidates.length === 1) {
            const success = await handleAddMediaToOrder(viewingOrderItems.id, movieCandidates[0]);
            if (success !== false) {
              setShowMovieForm(false);
              setMovieFormData({ title: '', year: '' });
              setMovieSearchResults([]);
            }
          } else {
            // Multiple results found, let user choose
            setMessage(`Found ${movieCandidates.length} movies matching "${movieFormData.title}". Please select one below.`);
          }
        } else {
          setMessage(`Movie not found: "${movieFormData.title}". Please check the title and try again.`);
          setMovieSearchResults([]);
        }
      } else {
        setMessage('Error searching for movie');
        setMovieSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching for movie:', error);
      setMessage('Error searching for movie');
      setMovieSearchResults([]);
    } finally {
      setMovieSearchLoading(false);
    }
  };

  const handleSelectMovie = async (selectedMovie) => {
    try {
      const success = await handleAddMediaToOrder(viewingOrderItems.id, selectedMovie);
      if (success !== false) {
        setShowMovieForm(false);
        setMovieFormData({ title: '', year: '' });
        setMovieSearchResults([]);
      }
    } catch (error) {
      console.error('Error selecting movie:', error);
      setMessage('Error adding movie to order');
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
        
        const columns = line.split('\t');        // Validate required columns (support 4-6 column formats for web videos)
        if (columns.length < 4) {
          errors.push(`Line ${i + 1}: Not enough columns (need 4-6: Series/Movie, Season/Episode, Title, Type, [Year], [URL for web videos])`);
          continue;
        }
        
        const [seriesOrMovie, seasonEpisode, title, rawMediaType, yearColumn, urlColumn] = columns.map(col => col.trim());
          if (!seriesOrMovie || !title || !rawMediaType) {
          errors.push(`Line ${i + 1}: Missing required data (Series/Movie, Title, or Type)`);
          continue;
        }        // Normalize media types
        let mediaType = rawMediaType.toLowerCase();
        if (mediaType === 'tv series') {
          mediaType = 'episode';
        } else if (mediaType === 'short story') {
          mediaType = 'shortstory';
        } else if (mediaType === 'film') {
          mediaType = 'movie';
        } else if (mediaType === 'web') {
          mediaType = 'webvideo';
        }
        
        // Initialize comic-specific fields
        let comicSeries = null;
        let comicYear = null;
        let comicIssue = null;
          // Initialize book-specific fields
        let bookAuthor = null;
        let bookYear = null;
        
        // Parse year from the optional 5th column
        let mediaYear = null;
        if (yearColumn && yearColumn.trim()) {
          const parsedYear = parseInt(yearColumn.trim());
          if (!isNaN(parsedYear) && parsedYear > 1800 && parsedYear <= new Date().getFullYear() + 10) {
            mediaYear = parsedYear;
          }
        }
        
        // Parse season and episode for TV episodes, comic details for comics, or book details for books
        let seasonNumber = null;
        let episodeNumber = null;
        
        if (mediaType === 'episode' && seasonEpisode) {
          // Try to parse various formats: "S1E1", "S01E01", "1x1", "1,1", or "1-1"
          const seasonEpMatch = seasonEpisode.match(/(?:S?(\d+)(?:[xXeE]|,|\s)+(\d+))|(?:(\d+)\s*[\-\/]\s*(\d+))/i);
          if (seasonEpMatch) {
            seasonNumber = parseInt(seasonEpMatch[1] || seasonEpMatch[3]);
            episodeNumber = parseInt(seasonEpMatch[2] || seasonEpMatch[4]);
          } else {
            errors.push(`Line ${i + 1}: Invalid season/episode format. Use S1E1, S01E01, 1x1, 1,1, or 1-1`);
            continue;
          }        } else if (mediaType === 'comic') {
          // Check if using new format: separate columns for series, issue, and title
          if (seasonEpisode && seasonEpisode.toLowerCase().includes('issue')) {
            // New format: Column 1 = Series, Column 2 = Issue, Column 3 = Title
            comicSeries = seriesOrMovie;
            
            // Clean the series name according to new rules:
            // - If parentheses contain a 4-digit year, keep it
            // - If parentheses contain anything else (like "Vol. 1"), remove the entire parentheses portion
            const parenthesesMatch = comicSeries.match(/^(.+?)\s*\((.+?)\)(.*)$/);
            if (parenthesesMatch) {
              const beforeParens = parenthesesMatch[1].trim();
              const parenthesesContent = parenthesesMatch[2].trim();
              const afterParens = parenthesesMatch[3].trim();
              
              // Check if parentheses content is a 4-digit year
              const yearMatch = parenthesesContent.match(/^\d{4}$/);
              if (yearMatch) {
                // Keep the year
                comicYear = parseInt(parenthesesContent);
                comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
              } else {
                // Remove the entire parentheses portion
                comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
                comicYear = null;
              }
            } else {
              comicYear = null;
            }
            
            // Parse issue number from seasonEpisode column (e.g., "Issue #07", "#07", "07")
            const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
            if (issueMatch) {
              comicIssue = parseInt(issueMatch[1]);
            } else {
              errors.push(`Line ${i + 1}: Invalid issue format. Use "Issue #07", "#07", or "07" format`);
              continue;
            }
          } else {
            // Legacy format: Parse comic format from first column: "Series Name (Year) #Issue" or "Series Name #Issue"
            let comicMatch = seriesOrMovie.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+)$/);
            if (comicMatch) {
              // Format with year
              comicSeries = comicMatch[1].trim();
              comicYear = parseInt(comicMatch[2]);
              comicIssue = parseInt(comicMatch[3]);
            } else {
              // Try format without year: "Series Name #Issue"
              comicMatch = seriesOrMovie.match(/^(.+?)\s*#(\d+)$/);
              if (comicMatch) {
                comicSeries = comicMatch[1].trim();
                comicYear = null;
                comicIssue = parseInt(comicMatch[2]);
              } else {
                errors.push(`Line ${i + 1}: Invalid comic format. Use new format: "Series Name\\tIssue #07\\tComic Title\\tComic" or legacy format: "Series Name (Year) #Issue\\t\\tTitle\\tComic"`);
                continue;
              }
            }
          }} else if (mediaType === 'book') {
          // Parse book format: "Author Name (Year)" in the season/episode field, or just "Author Name"
          if (seasonEpisode) {
            const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
            if (bookMatch) {
              bookAuthor = bookMatch[1].trim();
              if (bookMatch[2]) {
                bookYear = parseInt(bookMatch[2]);
              }
            } else {
              bookAuthor = seasonEpisode.trim();
            }
          }
          // If no season/episode field, we'll try to extract author from the title later
        } else if (mediaType === 'shortstory') {
          // Parse short story format: "Author Name (Year)" in the season/episode field, or just "Author Name"
          if (seasonEpisode) {
            const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
            if (bookMatch) {
              bookAuthor = bookMatch[1].trim();
              if (bookMatch[2]) {
                bookYear = parseInt(bookMatch[2]);
              }
            } else {
              bookAuthor = seasonEpisode.trim();
            }          }
          // If no season/episode field, we'll try to extract author from the title later
        } else if (mediaType === 'web') {
          // For web videos, the URL should be in the 6th column
          if (!urlColumn || !urlColumn.trim()) {
            errors.push(`Line ${i + 1}: Web videos require a URL in the 6th column`);
            continue;
          }
          // Validate URL format
          if (!urlColumn.match(/^https?:\/\/.+/)) {
            errors.push(`Line ${i + 1}: Invalid URL format for web video. URLs must start with http:// or https://`);
            continue;
          }
        }          items.push({
          seriesOrMovie,
          seasonNumber,
          episodeNumber,
          comicSeries,
          comicYear,
          comicIssue,
          bookAuthor,
          bookYear,
          title,
          mediaType: mediaType,
          lineNumber: i + 1,
          year: mediaYear, // Add the optional year from the 5th column
          url: urlColumn // Add the optional URL from the 6th column for web videos
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
      const failedItems = [];        for (const item of items) {
        try {
          let targetMedia = null;          if (item.mediaType === 'comic') {
            // For comics with new format, search ComicVine to find the correct issue
            console.log(`Searching for comic: ${item.comicSeries} #${item.comicIssue} - ${item.title}`);
              try {              // Normalize title characters to handle smart quotes and other encoding issues
                const normalizeTitle = (title) => {
                  return title
                    .replace(/’/g, "'") // Convert right smart apostrophe (U+2019) to regular apostrophe (U+0027)
                    .replace(/‘/g, "'") // Convert left smart apostrophe (U+2018) to regular apostrophe (U+0027)
                    .replace(/”/g, '"') // Convert right smart quote (U+201D) to regular quote (U+0022)
                    .replace(/“/g, '"') // Convert left smart quote (U+201C) to regular quote (U+0022)
                    .replace(/[，﹐﹑]/g, ',') // Convert full-width, small, and ideographic commas to standard comma
                    .replace(/–/g, '-') // Convert en-dash (U+2013) to regular dash
                    .replace(/—/g, '-'); // Convert em-dash (U+2014) to regular dash
                };
              
              const normalizedTitle = normalizeTitle(item.title);
              console.log(`Original title: "${item.title}"`);
              console.log(`Normalized title: "${normalizedTitle}"`);
              
              // Search using only the cleaned series name (don't include issue title in the series search)
              // This is more accurate since ComicVine series search should only use the series name
              console.log(`Series search query: "${item.comicSeries}" for issue #${item.comicIssue}`);
                // Use the ComicVine search with issue filtering to find the correct series
              const response = await fetch(`http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(item.comicSeries)}&issueNumber=${encodeURIComponent(item.comicIssue)}&issueTitle=${encodeURIComponent(normalizedTitle)}`);
                if (response.ok) {
                const searchResults = await response.json();
                console.log(`Found ${searchResults.length} comic series with issue #${item.comicIssue}`);
                console.log('Raw ComicVine search results:', JSON.stringify(searchResults, null, 2));
                  // Find the best match based on issue title or just use the first result if title search fails
                let selectedSeries = null;
                if (searchResults.length > 0) {
                  // Backend now handles title matching and sorting, so first result is the best match
                  selectedSeries = searchResults[0];
                  console.log(`✓ Using backend-sorted best match: "${selectedSeries.name}" with issue title: "${selectedSeries.issueName}"`);
                    // Create enhanced comic data with ComicVine information
                  targetMedia = {
                    title: normalizedTitle,
                    type: 'comic',
                    comicSeries: selectedSeries.name, // Use ComicVine series name
                    comicYear: item.comicYear || selectedSeries.start_year,
                    comicIssue: item.comicIssue,
                    comicVineId: selectedSeries.api_detail_url,
                    comicVineDetailsJson: JSON.stringify(selectedSeries)
                  };
                  
                  console.log(`✓ Enhanced comic data with ComicVine info: ${selectedSeries.name} (${targetMedia.comicYear}) #${item.comicIssue}`);                } else {
                  console.log(`No ComicVine results found, using original data`);
                  // Fallback to original data if no ComicVine results
                  targetMedia = {
                    title: normalizedTitle,
                    type: 'comic',
                    comicSeries: item.comicSeries,
                    comicYear: item.comicYear,
                    comicIssue: item.comicIssue
                  };
                }
              } else {
                console.log(`ComicVine search failed, using original data`);
                // Fallback to original data if search fails
                targetMedia = {
                  title: normalizedTitle,
                  type: 'comic',
                  comicSeries: item.comicSeries,
                  comicYear: item.comicYear,
                  comicIssue: item.comicIssue
                };
              }
            } catch (searchError) {
              console.log(`ComicVine search error: ${searchError.message}, using original data`);
              // Fallback to original data if search encounters an error
              targetMedia = {
                title: item.title,
                type: 'comic',
                comicSeries: item.comicSeries,
                comicYear: item.comicYear,
                comicIssue: item.comicIssue
              };
            }
          } else if (item.mediaType === 'book') {
            // For books, search OpenLibrary and use the first result
            try {
              let searchQuery = item.title;
              if (item.bookAuthor) {
                searchQuery += ` author:"${item.bookAuthor}"`;
              }
              if (item.bookYear) {
                searchQuery += ` first_publish_year:${item.bookYear}`;
              }
              
              const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=1`);
              
              if (response.ok) {
                const results = await response.json();
                
                if (results && results.length > 0) {
                  const book = results[0];
                  targetMedia = {
                    title: book.title,
                    type: 'book',
                    bookTitle: book.title,
                    bookAuthor: book.authors && book.authors[0] ? book.authors[0] : (item.bookAuthor || 'Unknown Author'),
                    bookYear: book.firstPublishYear || item.bookYear || null,
                    bookIsbn: book.isbn || null,
                    bookPublisher: book.publishers && book.publishers[0] ? book.publishers[0] : null,
                    bookOpenLibraryId: book.id || null,
                    bookCoverUrl: book.coverUrl || null
                  };
                } else {
                  // If no results from OpenLibrary, create a basic book entry
                  targetMedia = {
                    title: item.title,
                    type: 'book',
                    bookTitle: item.title,
                    bookAuthor: item.bookAuthor || 'Unknown Author',
                    bookYear: item.bookYear || null,
                    bookIsbn: null,
                    bookPublisher: null,
                    bookOpenLibraryId: null,
                    bookCoverUrl: null
                  };
                }
              } else {
                // If OpenLibrary search fails, create a basic book entry
                targetMedia = {
                  title: item.title,
                  type: 'book',
                  bookTitle: item.title,
                  bookAuthor: item.bookAuthor || 'Unknown Author',
                  bookYear: item.bookYear || null,
                  bookIsbn: null,
                  bookPublisher: null,
                  bookOpenLibraryId: null,
                  bookCoverUrl: null
                };
              }
            } catch (bookError) {
              console.error('Book search error:', bookError);
              // Create a basic book entry if search fails
              targetMedia = {
                title: item.title,
                type: 'book',
                bookTitle: item.title,                bookAuthor: item.bookAuthor || 'Unknown Author',
                bookYear: item.bookYear || null,
                bookIsbn: null,
                bookPublisher: null,
                bookOpenLibraryId: null,
                bookCoverUrl: null
              };
            }          } else if (item.mediaType === 'shortstory') {
            // For short stories, create the media object directly since we have all the info
            targetMedia = {
              title: item.title,
              type: 'shortstory',
              storyTitle: item.title,
              storyAuthor: item.bookAuthor,
              storyYear: item.bookYear,
              storyUrl: item.url || null,
              storyContainedInBookId: null,
              storyCoverUrl: null
            };} else if (item.mediaType === 'webvideo') {
            // For web videos, create the media object directly with the provided URL
            targetMedia = {
              title: item.title,
              type: 'webvideo',
              webTitle: item.title,
              webUrl: item.url,
              webDescription: null
            };
          } else {
            // For movies and TV episodes, search Plex
            let searchQuery = item.seriesOrMovie;
            let searchUrl = `http://127.0.0.1:3001/api/search?query=${encodeURIComponent(searchQuery)}`;
            
            // Add year parameter if available
            if (item.year) {
              searchUrl += `&year=${item.year}`;
            }
            
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
                   item.seriesOrMovie.toLowerCase().includes(result.grandparentTitle.toLowerCase())) &&
                  (!item.year || !result.year || result.year === item.year) // Match year if both are available
                );
              } else if (item.mediaType === 'movie') {
                // Find movie by title and optionally by year
                let movieCandidates = results.filter(result => 
                  result.type === 'movie' &&
                  (result.title.toLowerCase().includes(item.title.toLowerCase()) ||
                   item.title.toLowerCase().includes(result.title.toLowerCase()))
                );
                
                // If year is specified, prefer movies with matching year
                if (item.year && movieCandidates.length > 1) {
                  const exactYearMatch = movieCandidates.find(movie => movie.year === item.year);
                  if (exactYearMatch) {
                    targetMedia = exactYearMatch;
                  } else {
                    // If no exact year match, use the first candidate
                    targetMedia = movieCandidates[0];
                  }
                } else {
                  targetMedia = movieCandidates[0];
                }
              }
            }
          }          if (targetMedia) {
            // Add to custom order with UI updates skipped during bulk import
            const success = await handleAddMediaToOrder(viewingOrderItems.id, targetMedia, true);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else if (item.mediaType === 'movie' || item.mediaType === 'episode') {
            // For movies and episodes not found in Plex, create a minimal media object
            // and let the server handle adding items that don't exist in Plex yet
            const notInPlexMedia = {
              title: item.title,
              type: item.mediaType,
              mediaType: item.mediaType
            };
            
            // Add episode-specific fields
            if (item.mediaType === 'episode') {
              notInPlexMedia.seriesTitle = item.seriesOrMovie;
              notInPlexMedia.seasonNumber = item.seasonNumber;
              notInPlexMedia.episodeNumber = item.episodeNumber;
            }
            
            // Add year if available (for movies)
            if (item.year) {
              notInPlexMedia.bookYear = item.year; // Using bookYear as the year field
            }
            
            const success = await handleAddMediaToOrder(viewingOrderItems.id, notInPlexMedia, true);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else {
            const notFoundMessage = item.mediaType === 'book' 
              ? `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (could not process book)`
              : `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (unknown media type)`;
            failedItems.push(notFoundMessage);
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
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
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
  const handleSearchBooks = async (e) => {
    e.preventDefault();
    
    if (!bookFormData.title.trim()) {
      setMessage('Please enter a book title to search');
      return;
    }

    // If we're editing an item, update it directly without searching
    if (editingItem) {
      const updatedItemData = {
        title: bookFormData.title.trim(),
        author: bookFormData.author.trim(),
        publicationYear: bookFormData.year ? parseInt(bookFormData.year) : null,
        isbn: bookFormData.isbn.trim()
      };
      await handleUpdateItem(updatedItemData);
      return;
    }

    setBookSearchLoading(true);
    setBookSearchResults([]);
    
    try {
      // Build search query
      let searchQuery = bookFormData.title.trim();
      if (bookFormData.author.trim()) {
        searchQuery += ` author:"${bookFormData.author.trim()}"`;
      }
      if (bookFormData.year) {
        searchQuery += ` first_publish_year:${bookFormData.year}`;
      }

      const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      
      if (response.ok) {
        const results = await response.json();
        setBookSearchResults(results);
        
        if (results.length === 0) {
          setMessage('No books found with those search criteria. Try a different title or author.');
        }
      } else {
        setMessage('Error searching for books. Please try again.');
        setBookSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching books:', error);
      setMessage('Error searching for books. Please try again.');
      setBookSearchResults([]);
    } finally {
      setBookSearchLoading(false);
    }
  };  const handleSelectBook = async (selectedBook) => {
    try {
      // Handle both editing and reselecting cases
      const targetItem = editingItem || reselectingItem;
      
      if (targetItem) {
        // Check if this is a short story being linked to a book
        if (targetItem.mediaType === 'shortstory') {
          // Check if this book already exists in the order
          const existingBook = viewingOrderItems.items.find(item => 
            item.mediaType === 'book' && 
            item.bookOpenLibraryId === selectedBook.id
          );

          let bookId;
            if (existingBook) {
            // Use the existing book
            bookId = existingBook.id;
          } else {            // Create a new reference book (not added to collection order)
            const bookData = {
              title: selectedBook.title,
              bookTitle: selectedBook.title,
              bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
              bookYear: selectedBook.firstPublishYear || null,
              bookIsbn: selectedBook.isbn || null,
              bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
              bookOpenLibraryId: selectedBook.id || null,
              bookCoverUrl: selectedBook.coverUrl || null,
              customOrderId: viewingOrderItems.id // Provide order context for schema compliance
            };

            const bookResponse = await fetch(`http://127.0.0.1:3001/api/books/reference`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(bookData),
            });

            if (bookResponse.ok) {
              const createdBook = await bookResponse.json();
              bookId = createdBook.id;
            } else {
              const errorData = await bookResponse.json();
              setMessage(`Error creating reference book: ${errorData.error}`);
              return;
            }
          }
          
          // Now update the short story to reference this book (either existing or newly created)
          const storyUpdateData = {
            storyContainedInBookId: bookId,
            storyCoverUrl: selectedBook.coverUrl || null
          };

          const storyResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${targetItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(storyUpdateData),
          });

          if (storyResponse.ok) {
            setMessage(`Short story "${targetItem.storyTitle || targetItem.title}" is now linked to the book "${selectedBook.title}"`);
            setShowBookForm(false);
            setReselectingItem(null);
            setEditingItem(null);
            setBookFormData({ title: '', author: '', year: '', isbn: '' });
            setBookSearchResults([]);
            
            // Refresh the order items
            fetchCustomOrders();
            if (viewingOrderItems) {
              const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
              const updatedOrderData = await updatedOrder.json();
              setViewingOrderItems(updatedOrderData);
            }
          } else {
            const errorData = await storyResponse.json();
            setMessage(`Error linking story to book: ${errorData.error}`);
          }
        } else {
          // Regular book re-selection/editing for book items
          const updateData = {
            title: selectedBook.title,
            bookTitle: selectedBook.title,
            bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
            bookYear: selectedBook.firstPublishYear || null,
            bookIsbn: selectedBook.isbn || null,
            bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
            bookOpenLibraryId: selectedBook.id || null,
            bookCoverUrl: selectedBook.coverUrl || null
          };

          const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${targetItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
          });

          if (response.ok) {
            setMessage(`Book updated successfully: "${selectedBook.title}"`);
            setShowBookForm(false);
            setReselectingItem(null);
            setEditingItem(null);
            setBookFormData({ title: '', author: '', year: '', isbn: '' });
            setBookSearchResults([]);
            
            // Refresh the order items
            fetchCustomOrders();
            if (viewingOrderItems) {
              const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
              const updatedOrderData = await updatedOrder.json();
              setViewingOrderItems(updatedOrderData);
            }
          } else {
            const errorData = await response.json();
            setMessage(`Error updating book: ${errorData.error}`);
          }
        }
      } else {
        // Add new book to order (existing functionality)
        const bookMedia = {
          type: 'book',
          title: selectedBook.title,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
          bookYear: selectedBook.firstPublishYear || null,
          bookIsbn: selectedBook.isbn || null,
          bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
          bookOpenLibraryId: selectedBook.id || null,
          bookCoverUrl: selectedBook.coverUrl || null
        };

        const success = await handleAddMediaToOrder(viewingOrderItems.id, bookMedia);
        if (success !== false) {
          setShowBookForm(false);
          setBookFormData({ title: '', author: '', year: '', isbn: '' });
          setBookSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error selecting book:', error);
      setMessage('Error selecting book. Please try again.');
    }
  };const handleSearchComics = async (e) => {
    e.preventDefault();
    
    if (!comicFormData.series.trim()) {
      setMessage('Please enter a comic series name to search');
      return;
    }
    
    if (!comicFormData.issue.trim()) {
      setMessage('Please enter an issue number to search');
      return;
    }    // If we're editing an item, update it directly without searching
    if (editingItem) {
      const updatedItemData = {
        comicSeries: comicFormData.series.trim(),
        comicYear: comicFormData.year ? parseInt(comicFormData.year) : null,
        comicIssue: comicFormData.issue.trim(),
        customTitle: comicFormData.title.trim() || null
      };
      await handleUpdateItem(updatedItemData);
      return;
    }

    setComicSearchLoading(true);
    setComicSearchResults([]);
    
    try {
      // Build search query for ComicVine with issue filtering
      const searchQuery = comicFormData.series.trim();
      const issueNumber = comicFormData.issue.trim();

      const response = await fetch(`http://127.0.0.1:3001/api/comicvine/search-with-issues?query=${encodeURIComponent(searchQuery)}&issueNumber=${encodeURIComponent(issueNumber)}`);
      
      if (response.ok) {
        const results = await response.json();
        setComicSearchResults(results);
        
        if (results.length === 0) {
          setMessage(`No comic series found with issue #${issueNumber}. Try a different series name or issue number.`);
        } else {
          setMessage(`Found ${results.length} series that have issue #${issueNumber}`);
        }
      } else {
        setMessage('Error searching for comics. Please try again.');
        setComicSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching comics:', error);
      setMessage('Error searching for comics. Please try again.');
      setComicSearchResults([]);
    } finally {
      setComicSearchLoading(false);
    }
  };const handleSelectComic = async (selectedSeries) => {
    try {
      // Validate required fields
      if (!comicFormData.issue) {
        setMessage('Please enter an issue number before adding the comic.');
        return;
      }

      // Create the comic string in the expected format
      // Use the series start year from ComicVine if no year is provided
      const seriesYear = comicFormData.year || selectedSeries.start_year;
      const comicString = seriesYear 
        ? `${selectedSeries.name} (${seriesYear}) #${comicFormData.issue}`
        : `${selectedSeries.name} #${comicFormData.issue}`;
        if (reselectingItem) {        // Update existing item with new comic selection
        const updateData = {
          title: comicString,
          comicSeries: selectedSeries.name,
          comicYear: seriesYear ? parseInt(seriesYear) : null,
          comicIssue: comicFormData.issue,
          customTitle: comicFormData.title.trim() || null,
          comicVineId: selectedSeries.api_detail_url || null,
          comicVineDetailsJson: JSON.stringify(selectedSeries)
        };

        const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${reselectingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (response.ok) {
          setMessage(`Comic updated successfully: "${comicString}"`);          setShowComicForm(false);
          setReselectingItem(null);
          setComicFormData({ series: '', year: '', issue: '', title: '' });
          setComicSearchResults([]);
          
          // Refresh the order items
          fetchCustomOrders();
          if (viewingOrderItems) {
            const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
            const updatedOrderData = await updatedOrder.json();
            setViewingOrderItems(updatedOrderData);
          }
        } else {
          const errorData = await response.json();
          setMessage(`Error updating comic: ${errorData.error}`);
        }      } else {        // Add new comic to order (existing functionality)
        const comicMedia = {
          mediaType: 'comic',
          title: comicString,
          comicSeries: selectedSeries.name,
          comicYear: seriesYear ? parseInt(seriesYear) : null,
          comicIssue: comicFormData.issue,
          customTitle: comicFormData.title.trim() || null,
          comicVineId: selectedSeries.api_detail_url || null,
          comicVineDetailsJson: JSON.stringify(selectedSeries)
        };const success = await handleAddMediaToOrder(viewingOrderItems.id, comicMedia);
        if (success !== false) {
          setShowComicForm(false);
          setComicFormData({ series: '', year: '', issue: '', title: '' });
          setComicSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error selecting comic:', error);
      setMessage('Error selecting comic. Please try again.');
    }
  };  const handleSearchShortStoryBooks = async (e) => {
    e.preventDefault();
    
    if (!shortStoryFormData.title.trim()) {
      setMessage('Please enter a short story title');
      return;
    }

    // If we're editing an item, handle it differently
    if (editingItem) {
      // For short stories being edited, just update the item directly
      await handleAddShortStory();
      return;
    }

    setShortStorySearchResults([]);
    
    try {
      // For short stories, we search for books that could contain this story
      // If author is provided, use it in the search, otherwise just search by title
      let searchQuery = shortStoryFormData.author.trim() || shortStoryFormData.title.trim();
      if (shortStoryFormData.year) {
        searchQuery += ` first_publish_year:${shortStoryFormData.year}`;
      }

      const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
      
      if (response.ok) {
        const results = await response.json();
        setShortStorySearchResults(results);
        
        if (results.length === 0) {
          setMessage('No books found. You can still add the short story without selecting a containing book.');
        }
      } else {
        setMessage('Error searching for books. You can still add the short story without selecting a containing book.');
        setShortStorySearchResults([]);
      }
    } catch (error) {
      console.error('Error searching books for short story:', error);
      setMessage('Error searching for books. You can still add the short story without selecting a containing book.');
      setShortStorySearchResults([]);
    }
  };

  const handleAddShortStory = async (containedInBook = null) => {
    try {
      // Validate required fields
      if (!shortStoryFormData.title.trim()) {
        setMessage('Please enter a short story title');
        return;
      }

      // If we're editing an item, update it
      if (editingItem) {
        const updatedItemData = {
          title: shortStoryFormData.title.trim(),
          storyTitle: shortStoryFormData.title.trim(),
          storyAuthor: shortStoryFormData.author.trim() || null,
          storyYear: shortStoryFormData.year ? parseInt(shortStoryFormData.year) : null,
          storyUrl: shortStoryFormData.url.trim() || null,
          storyContainedInBookId: containedInBook ? containedInBook.id : null,
          storyCoverUrl: shortStoryFormData.coverUrl.trim() || null
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      const shortStoryMedia = {
        mediaType: 'shortstory',
        title: shortStoryFormData.title.trim(),
        storyTitle: shortStoryFormData.title.trim(),
        storyAuthor: shortStoryFormData.author.trim() || null,
        storyYear: shortStoryFormData.year ? parseInt(shortStoryFormData.year) : null,
        storyUrl: shortStoryFormData.url.trim() || null,
        storyContainedInBookId: containedInBook ? containedInBook.id : null,
        storyCoverUrl: shortStoryFormData.coverUrl.trim() || null
      };

      const success = await handleAddMediaToOrder(viewingOrderItems.id, shortStoryMedia);
      if (success !== false) {
        setShowShortStoryForm(false);
        setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
        setShortStorySearchResults([]);
      }    } catch (error) {
      console.error('Error adding short story:', error);
      setMessage('Error adding short story. Please try again.');
    }
  };

  const handleAddWebVideo = async () => {
    try {
      // Validate required fields
      if (!webVideoFormData.title.trim()) {
        setMessage('Please enter a web video title');
        return;
      }
      
      if (!webVideoFormData.url.trim()) {
        setMessage('Please enter a web video URL');
        return;
      }

      // If we're editing an item, update it
      if (editingItem) {
        const updatedItemData = {
          title: webVideoFormData.title.trim(),
          webTitle: webVideoFormData.title.trim(),
          webUrl: webVideoFormData.url.trim(),
          webDescription: webVideoFormData.description.trim() || null
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      const webVideoMedia = {
        mediaType: 'webvideo',
        title: webVideoFormData.title.trim(),
        webTitle: webVideoFormData.title.trim(),
        webUrl: webVideoFormData.url.trim(),
        webDescription: webVideoFormData.description.trim() || null
      };

      const success = await handleAddMediaToOrder(viewingOrderItems.id, webVideoMedia);
      if (success !== false) {
        setShowWebVideoForm(false);
        setWebVideoFormData({ title: '', url: '', description: '' });
      }
    } catch (error) {
      console.error('Error adding web video:', error);
      setMessage('Error adding web video. Please try again.');
    }
  };

  // Scroll helper functions for items list navigation
  const scrollToTop = () => {
    const itemsList = document.querySelector('.items-list');
    if (itemsList) {
      itemsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToBottom = () => {
    const itemsList = document.querySelector('.items-list');
    if (itemsList) {
      const lastItem = itemsList.lastElementChild;
      if (lastItem) {
        lastItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
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
        <div className="order-items-view">          <div className="order-items-header">
            <div className="order-header-content">
              <div className="order-header-info">
                <h3>Managing Items: {viewingOrderItems.name}</h3>
                {viewingOrderItems.description && (
                  <p className="order-description">{viewingOrderItems.description}</p>
                )}
              </div>
              {viewingOrderItems.icon && (
                <div 
                  className="order-header-icon" 
                  dangerouslySetInnerHTML={{ __html: viewingOrderItems.icon }}
                />
              )}
            </div>            <div className="order-stats">
              <div className="stat">
                <span className="stat-label">Total Items:</span>
                <span className="stat-value">
                  {getAllNonReferenceItems(viewingOrderItems.items).length}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Unwatched:</span>
                <span className="stat-value">
                  {getUnwatchedNonReferenceItems(viewingOrderItems.items).length}
                </span>
              </div>            </div><div className="manage-items-actions">
              <Button
                onClick={() => {
                  setShowMovieForm(true);
                  setMovieFormData({ title: '', year: '' });
                }}
                className="primary"
              >
                Add Movie
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
                  setShowBookForm(true);
                  setBookFormData({ title: '', author: '', year: '', isbn: '' });
                }}
                className="secondary"
              >
                Add Book
              </Button>              <Button                onClick={() => {
                  setShowComicForm(true);
                  setComicFormData({ series: '', year: '', issue: '', title: '' });
                }}
                className="secondary"
              >
                Add Comic
              </Button>              <Button
                onClick={() => {
                  setShowShortStoryForm(true);
                  setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                }}
                className="secondary"
              >
                Add Short Story
              </Button>
              <Button
                onClick={() => {
                  setShowWebVideoForm(true);
                  setWebVideoFormData({ title: '', url: '', description: '' });
                }}
                className="secondary"
              >
                Add Web Video
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
          </div>
          
          {/* Filter Controls */}
          <div className="filter-controls">
            <div className="filter-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showWatchedItems}
                  onChange={(e) => setShowWatchedItems(e.target.checked)}
                  className="toggle-checkbox"
                />
                <span className="toggle-text">
                  {showWatchedItems ? 'Hide Watched Items' : 'Show Watched Items'}
                </span>
              </label>
            </div>
          </div>          {viewingOrderItems.items.length === 0 ? (
            <div className="empty-state">
              <p>No items in this custom order yet.</p>
              <p>Add some movies, TV episodes, or comics to get started!</p>
            </div>
          ) : getFilteredItems(viewingOrderItems.items).length === 0 ? (
            <div className="empty-state">
              <p>No items match the current filter.</p>
              <p>{showWatchedItems ? 'All items are hidden.' : 'All unwatched items are hidden. Toggle "Show Watched Items" to see watched items.'}</p>
            </div>
          ) : (
            <>
              {/* Scroll Navigation Buttons - only show when there are more than 5 items */}
              {getFilteredItems(viewingOrderItems.items).length > 5 && (
                <div className="scroll-navigation">
                  <Button
                    onClick={scrollToBottom}
                    className="secondary"
                    size="small"
                  >
                    ↓ Scroll to Bottom
                  </Button>
                </div>
              )}
                <div className="items-list">
              {getFilteredItems(viewingOrderItems.items).map((item, index) => (
                <div 
                  key={item.id} 
                  className={`item-card ${item.isWatched ? 'watched' : ''} ${
                    isDragging && draggedItem?.id === item.id ? 'dragging' : ''
                  } ${
                    dragOverItem?.id === item.id ? 'drag-over' : ''
                  }`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="drag-handle" title="Drag to reorder">
                    ⋮⋮
                  </div>
                  <div className="item-position">#{index + 1}</div>
                  <div className="item-thumbnail">
                    {getItemArtworkUrl(item) ? (
                      <img 
                        src={getItemArtworkUrl(item)} 
                        alt={`${item.title} artwork`}
                        className="thumbnail-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="thumbnail-fallback" 
                      style={{ display: getItemArtworkUrl(item) ? 'none' : 'flex' }}
                    >
                      {item.mediaType === 'tv' ? '📺' : 
                       item.mediaType === 'movie' ? '🎬' :
                       item.mediaType === 'comic' ? '📚' :
                       item.mediaType === 'book' ? '📖' :
                       item.mediaType === 'shortstory' ? '📖' : '📄'}
                    </div>
                  </div>                  <div className="item-info">
                    <div className="item-details">
                      <h4>
                        {item.mediaType === 'comic' && item.customTitle 
                          ? item.customTitle 
                          : item.title
                        }
                      </h4>
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
                      {(item.mediaType === 'book' || item.mediaType === 'shortstory') && (
                        <p className="item-series">
                          {item.bookAuthor && `${item.bookAuthor}`}
                          {item.bookYear && ` (${item.bookYear})`}
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
                      onClick={() => handleEditItem(item)}
                      className="secondary"
                      size="small"
                    >
                      Edit Item
                    </Button>
                    <Button
                      onClick={() => handleRemoveItem(viewingOrderItems.id, item.id, item.title)}
                      className="danger"
                      size="small"
                    >
                      Remove
                    </Button>
                    {item.mediaType === 'book' && (
                      <Button
                        onClick={() => handleReselectBook(item)}
                        className="secondary"
                        size="small"
                      >
                        Re-select Book
                      </Button>
                    )}                    {item.mediaType === 'comic' && (
                      <Button
                        onClick={() => handleReselectComic(item)}
                        className="secondary"
                        size="small"
                      >
                        Re-select Comic
                      </Button>
                    )}
                    {item.mediaType === 'shortstory' && (
                      <Button
                        onClick={() => handleCollectedIn(item)}
                        className="secondary"
                        size="small"
                      >
                        Collected In...
                      </Button>
                    )}
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
                      >                        Mark as Unwatched
                      </Button>
                    )}
                  </div>
                </div>              ))}
            </div>
              {/* Scroll to Top button at bottom - only show when there are more than 5 items */}
            {getFilteredItems(viewingOrderItems.items).length > 5 && (
              <div className="scroll-navigation-bottom">
                <Button
                  onClick={scrollToTop}
                  className="secondary"
                  size="small"
                >
                  ↑ Scroll to Top
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Create New Order Button */}
          <div className="custom-orders-header">            <Button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setFormData({ name: '', description: '', icon: '' });
                setEditingOrder(null);
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
              />            </div>
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
            <div className="form-group">
              <label htmlFor="orderIcon">Icon (SVG)</label>
              <textarea
                id="orderIcon"
                value={formData.icon}
                onChange={(e) => setFormData({...formData, icon: e.target.value})}
                placeholder="Paste SVG icon code here (optional)..."
                rows="3"
              />
              {formData.icon && (
                <div className="icon-preview">
                  <span>Preview: </span>
                  <div 
                    className="custom-order-icon" 
                    dangerouslySetInnerHTML={{__html: formData.icon}}
                  />
                </div>
              )}
            </div>            <div className="form-actions">
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

      {/* Edit Form */}
      {editingOrder && (
        <div className="create-form">
          <h3>Edit Custom Order</h3>
          <form onSubmit={handleUpdateOrder}>
            <div className="form-group">
              <label htmlFor="editOrderName">Order Name *</label>
              <input
                type="text"
                id="editOrderName"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Marvel Movies & Shows"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="editOrderDescription">Description</label>
              <textarea
                id="editOrderDescription"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description of this custom order..."
                rows="3"
              />
            </div>
            <div className="form-group">
              <label htmlFor="editOrderIcon">Icon (SVG)</label>
              <textarea
                id="editOrderIcon"
                value={formData.icon}
                onChange={(e) => setFormData({...formData, icon: e.target.value})}
                placeholder="Paste SVG icon code here (optional)..."
                rows="3"              />
              {formData.icon && (
                <div className="icon-preview">
                  <span>Preview: </span>
                  <div 
                    className="custom-order-icon" 
                    dangerouslySetInnerHTML={{__html: formData.icon}}
                  />
                </div>
              )}
            </div>
            <div className="form-actions">
              <Button type="submit" className="primary">Update Order</Button>
              <Button 
                type="button" 
                onClick={() => {
                  setEditingOrder(null);
                  setFormData({ name: '', description: '', icon: '' });
                  setMessage('');
                }}
                className="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Orders List */}
      <div className="orders-list">
        {customOrders.length === 0 ? (
          <div className="empty-state">
            <p>No custom orders yet. Create your first custom order to get started!</p>
          </div>
        ) : (
          <div className="orders-grid">
            {customOrders.map(order => (
              <div key={order.id} className={`order-card ${order.isActive ? 'active' : 'inactive'}`}>                <div className="order-header">
                  <div className="order-title-section">
                    <div className="title-with-icon">
                      <h3 
                        className="clickable-title"
                        onClick={() => setViewingOrderItems(order)}
                      >
                        {order.icon && (
                          <span 
                            className="custom-order-icon inline-icon" 
                            dangerouslySetInnerHTML={{__html: order.icon}}
                          />
                        )}
                        {order.name}
                      </h3>
                    </div>
                    {order.description && <p className="order-description">{order.description}</p>}
                  </div>
                  <div className="order-status">
                    <span className={`status-indicator ${order.isActive ? 'active' : 'inactive'}`}>
                      {order.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="order-stats">
                  <div className="stat">
                    <span className="stat-label">Total Items:</span>
                    <span className="stat-value">{order.items.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Completed:</span>
                    <span className="stat-value">{order.items.filter(item => item.isWatched).length}</span>
                  </div>
                </div>                <div className="order-meta">
                  <div className="order-created">
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="order-actions">
                  <Button
                    onClick={() => handleToggleActive(order.id, order.isActive)}
                    className="secondary"
                    size="small"
                  >
                    {order.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    onClick={() => setViewingOrderItems(order)}
                    className="primary"
                    size="small"
                  >
                    View Items
                  </Button>
                  <Button
                    onClick={() => handleEditOrder(order)}
                    className="secondary"
                    size="small"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="danger"
                    size="small"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        </>
      )}

      {/* Movie Form Modal */}
      {showMovieForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingItem ? 'Edit Movie' : 'Add Movie'}</h3>
              <Button
                onClick={() => {
                  setShowMovieForm(false);
                  setMovieFormData({ title: '', year: '' });
                  setMovieSearchResults([]);
                  setEditingItem(null);
                }}
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
                  onClick={() => {
                    setShowMovieForm(false);
                    setMovieFormData({ title: '', year: '' });
                    setMovieSearchResults([]);
                    setEditingItem(null);
                  }}
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
      )}

      {/* Episode Form Modal */}
      {showEpisodeForm && (
        <div className="modal-overlay">
          <div className="modal-content">            <div className="modal-header">
              <h3>{editingItem ? 'Edit TV Episode' : 'Add TV Episode'}</h3>
              <Button
                onClick={() => {
                  setShowEpisodeForm(false);
                  setEpisodeFormData({ series: '', season: '', episode: '' });
                  setEditingItem(null);
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
              
              <div className="form-actions">                <Button 
                  type="submit" 
                  disabled={episodeSearchLoading}
                  className="primary"
                >
                  {episodeSearchLoading 
                    ? (editingItem ? 'Updating...' : 'Searching...') 
                    : (editingItem ? 'Update Episode' : 'Add Episode')
                  }
                </Button>                <Button
                  type="button"
                  onClick={() => {
                    setShowEpisodeForm(false);
                    setEditingItem(null);
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
      )}      {/* Bulk Import Modal */}
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
                <p>Paste tab-separated data with 4-5 columns in order:</p>
                <ol>
                  <li><strong>Series/Movie/Comic/Book Name:</strong> The name of the TV series, movie, comic, or book (for comics use "Series Name (Year) #Issue" format)</li>
                  <li><strong>Season/Episode/Author:</strong> For episodes: S1E1, S01E01, 1x1, 1,1, or 1-1 format; For books: Author name (optionally with year: "Author Name (Year)"); Leave blank for movies and comics</li>
                  <li><strong>Title:</strong> The specific episode title, movie title, comic issue title, or book title</li>
                  <li><strong>Type:</strong> "episode" (or "TV Series") for TV episodes, "movie" for movies, "comic" for comics, "book" for books</li>
                  <li><strong>Year (Optional):</strong> Release year for more accurate matching (especially useful for movies and TV shows)</li>
                </ol>
                
                <div className="example-data">
                  <strong>Example:</strong>
                  <pre>
Breaking Bad	S1E1	Pilot	episode	2008
Breaking Bad	S01E02	Cat's in the Bag...	episode	2008
The Avengers		The Avengers	movie	2012
Superman		Superman	movie	1978
Game of Thrones	1x1	Winter Is Coming	episode	2011
The Amazing Spider-Man (2018) #1		Amazing Spider-Man	comic
The High Republic Adventures (2022) #7		The Monster of Temple Peak Part 1	comic
The High Republic: Convergence	Zoraida Córdova (2022)	The High Republic: Convergence	book
Dune	Frank Herbert (1965)	Dune	book
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
                    setBulkImportData('Batman Adventures (Vol. 1)\tIssue #01\tPenguin\'s Big Score\tComic');
                  }}
                  className="secondary"
                  style={{ marginLeft: '10px' }}
                >
                  Test Batman Adventures
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
        </div>      )}

      {/* Book Search Modal */}
      {showBookForm && (
        <div className="modal-overlay">
          <div className="modal-content">            <div className="modal-header">
              <h3>
                {editingItem 
                  ? 'Edit Book'
                  : reselectingItem && reselectingItem.mediaType === 'shortstory' 
                    ? 'Select Book for Story Collection'
                    : reselectingItem 
                      ? 'Re-select Book' 
                      : 'Add Book'
                }
              </h3>
              <Button
                onClick={() => {
                  setShowBookForm(false);
                  setReselectingItem(null);
                  setEditingItem(null);
                  setBookFormData({ title: '', author: '', year: '', isbn: '' });
                  setBookSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchBooks} className="book-search-form">
              <div className="form-group">
                <label htmlFor="bookTitle">Book Title *</label>
                <input
                  type="text"
                  id="bookTitle"
                  value={bookFormData.title}
                  onChange={(e) => setBookFormData({...bookFormData, title: e.target.value})}
                  placeholder="Enter book title..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookAuthor">Author</label>
                <input
                  type="text"
                  id="bookAuthor"
                  value={bookFormData.author}
                  onChange={(e) => setBookFormData({...bookFormData, author: e.target.value})}
                  placeholder="Enter author name (optional)..."
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookYear">Publication Year</label>
                <input
                  type="number"
                  id="bookYear"
                  value={bookFormData.year}
                  onChange={(e) => setBookFormData({...bookFormData, year: e.target.value})}
                  placeholder="e.g., 2020"
                  min="1000"
                  max="2030"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookIsbn">ISBN</label>
                <input
                  type="text"
                  id="bookIsbn"
                  value={bookFormData.isbn}
                  onChange={(e) => setBookFormData({...bookFormData, isbn: e.target.value})}
                  placeholder="Enter ISBN (optional)..."
                />
              </div>
              
              <div className="form-actions">                <Button 
                  type="submit" 
                  disabled={bookSearchLoading}
                  className="primary"
                >
                  {bookSearchLoading 
                    ? (editingItem ? 'Updating...' : 'Searching...') 
                    : (editingItem ? 'Update Book' : 'Search Books')
                  }
                </Button>                <Button
                  type="button"
                  onClick={() => {
                    setShowBookForm(false);
                    setReselectingItem(null);
                    setEditingItem(null);
                    setBookFormData({ title: '', author: '', year: '', isbn: '' });
                    setBookSearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            {/* Search Results */}
            {bookSearchResults.length > 0 && (
              <div className="book-search-results">
                <h4>Search Results</h4>
                <div className="book-results-list">
                  {bookSearchResults.map((book, index) => (
                    <div key={index} className="book-result-item">
                      <div className="book-info">
                        {book.coverUrl && (
                          <img 
                            src={book.coverUrl} 
                            alt={`Cover of ${book.title}`} 
                            className="book-cover-small"
                          />
                        )}
                        <div className="book-details">
                          <h5>{book.title}</h5>
                          <p className="book-author">
                            {book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author'}
                          </p>
                          {book.firstPublishYear && (
                            <p className="book-year">Published: {book.firstPublishYear}</p>
                          )}
                          {book.publishers && book.publishers[0] && (
                            <p className="book-publisher">Publisher: {book.publishers[0]}</p>
                          )}
                        </div>
                      </div>                      <Button
                        onClick={() => handleSelectBook(book)}
                        className="primary"
                        size="small"
                      >
                        {reselectingItem && reselectingItem.mediaType === 'shortstory' 
                          ? 'Story is in This Book'
                          : reselectingItem 
                            ? 'Re-select This Book' 
                            : 'Add This Book'
                        }
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comic Search Modal */}
      {showComicForm && (
        <div className="modal-overlay">
          <div className="modal-content">            <div className="modal-header">
              <h3>{editingItem ? 'Edit Comic' : reselectingItem ? 'Re-select Comic' : 'Add Comic'}</h3>              <Button
                onClick={() => {
                  setShowComicForm(false);
                  setReselectingItem(null);
                  setEditingItem(null);
                  setComicFormData({ series: '', year: '', issue: '', title: '' });
                  setComicSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchComics} className="comic-search-form">
              <div className="form-group">
                <label htmlFor="comicSeries">Comic Series *</label>
                <input
                  type="text"
                  id="comicSeries"
                  value={comicFormData.series}
                  onChange={(e) => setComicFormData({...comicFormData, series: e.target.value})}
                  placeholder="Enter comic series name..."
                  required
                />
              </div>
                <div className="form-row">
                <div className="form-group">
                  <label htmlFor="comicYear">Year</label>
                  <input
                    type="number"
                    id="comicYear"
                    value={comicFormData.year}
                    onChange={(e) => setComicFormData({...comicFormData, year: e.target.value})}
                    placeholder="e.g., 2022 (optional)"
                    min="1930"
                    max="2030"
                  />
                </div>
                  <div className="form-group">
                  <label htmlFor="comicIssue">Issue Number *</label>
                  <input
                    type="text"
                    id="comicIssue"
                    value={comicFormData.issue}
                    onChange={(e) => setComicFormData({...comicFormData, issue: e.target.value})}
                    placeholder="e.g., 1 or 1-2"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="comicTitle">Title (optional)</label>
                <input
                  type="text"
                  id="comicTitle"
                  value={comicFormData.title}
                  onChange={(e) => setComicFormData({...comicFormData, title: e.target.value})}
                  placeholder="Custom title or differentiator..."
                />
                <small className="form-help">
                  Add a custom title to differentiate duplicate comics or provide additional context
                </small>
              </div>
              
              <div className="form-actions"><Button 
                  type="submit" 
                  disabled={comicSearchLoading}
                  className="primary"
                >
                  {comicSearchLoading 
                    ? (editingItem ? 'Updating...' : 'Searching...') 
                    : (editingItem ? 'Update Comic' : 'Search Comic Series')
                  }
                </Button>                <Button
                  type="button"
                  onClick={() => {
                    setShowComicForm(false);
                    setEditingItem(null);
                    setComicFormData({ series: '', year: '', issue: '', title: '' });
                    setComicSearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
              {/* Search Results */}
            {comicSearchResults.length > 0 && (
              <div className="comic-search-results">
                <h4>Select Comic Series</h4>                <p className="search-note">
                  Found {comicSearchResults.length} series that have issue #{comicFormData.issue}. Select the correct series:
                </p>                <div className="comic-results-list">
                  {comicSearchResults.map((series, index) => (
                    <div key={index} className="comic-result-item">
                      <div className="comic-info">
                        {series.coverUrl && (
                          <div className="comic-cover-container">
                            <img 
                              src={series.coverUrl} 
                              alt={`Cover of ${series.name} #${comicFormData.issue}`} 
                              className="comic-cover-small"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="comic-details">
                          <h5>
                            {series.name}
                            {series.isFuzzyMatch && (
                              <span className="fuzzy-match-indicator" title={`${Math.round(series.similarity * 100)}% similarity match`}>
                                ~{Math.round(series.similarity * 100)}%
                              </span>
                            )}
                          </h5>
                          <p className="comic-publisher">
                            Publisher: {series.publisher?.name || 'Unknown'}
                          </p>
                          {series.start_year && (
                            <p className="comic-year">Started: {series.start_year}</p>
                          )}
                          {series.issue_count && (
                            <p className="comic-issues">Total Issues: {series.issue_count}</p>
                          )}
                          {series.issueName && (
                            <p className="comic-issue-name">Issue #{comicFormData.issue}: {series.issueName}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSelectComic(series)}
                        className="primary"
                        size="small"
                      >
                        {reselectingItem ? 'Re-select This Comic' : 'Add This Comic'}
                      </Button>
                    </div>
                  ))}                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Short Story Search Modal */}
      {showShortStoryForm && (
        <div className="modal-overlay">
          <div className="modal-content">            <div className="modal-header">
              <h3>{editingItem ? 'Edit Short Story' : 'Add Short Story'}</h3>
              <Button
                onClick={() => {
                  setShowShortStoryForm(false);
                  setEditingItem(null);
                  setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                  setShortStorySearchResults([]);
                }}
                className="close-modal"
              >
                ×
              </Button>
            </div>
            
            <form onSubmit={handleSearchShortStoryBooks} className="shortstory-search-form">
              <div className="form-group">
                <label htmlFor="shortstory-title">Story Title *</label>
                <input
                  type="text"
                  id="shortstory-title"
                  value={shortStoryFormData.title}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter short story title"
                  required
                />
              </div>
                <div className="form-group">
                <label htmlFor="shortstory-author">Author (optional)</label>
                <input
                  type="text"
                  id="shortstory-author"
                  value={shortStoryFormData.author}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Enter author name (optional)"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-year">Year (optional)</label>
                <input
                  type="number"
                  id="shortstory-year"
                  value={shortStoryFormData.year}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, year: e.target.value }))}
                  placeholder="Publication year"
                  min="1000"
                  max={new Date().getFullYear() + 5}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-url">Story URL (optional)</label>
                <input
                  type="url"
                  id="shortstory-url"
                  value={shortStoryFormData.url}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/story-link"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-cover">Cover Image URL (optional)</label>
                <input
                  type="url"
                  id="shortstory-cover"
                  value={shortStoryFormData.coverUrl}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, coverUrl: e.target.value }))}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
                <div className="form-actions">
                <Button type="submit" className="primary">
                  {editingItem ? 'Update Story' : 'Search for Books to Contain This Story'}
                </Button>
                {!editingItem && (
                  <Button
                    type="button"
                    onClick={() => handleAddShortStory()}
                    className="secondary"
                  >
                    Add Story Without Container Book
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    setShowShortStoryForm(false);
                    setEditingItem(null);
                    setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                    setShortStorySearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            {/* Search Results */}
            {shortStorySearchResults.length > 0 && (
              <div className="shortstory-search-results">
                <h4>Select Container Book</h4>
                <p className="search-note">
                  Found {shortStorySearchResults.length} books by {shortStoryFormData.author}. Select which book contains the story "{shortStoryFormData.title}", or add the story without a container book.
                </p>                <div className="book-results-list">
                  {shortStorySearchResults.map((book, index) => (
                    <div key={index} className="book-result-item">
                      <div className="book-info">
                        {book.coverUrl && (
                          <img 
                            src={book.coverUrl} 
                            alt={`Cover of ${book.title}`} 
                            className="book-cover-small"
                          />
                        )}
                        <div className="book-details">
                          <h5>{book.title}</h5>
                          <p className="book-author">
                            {book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author'}
                          </p>
                          {book.firstPublishYear && (
                            <p className="book-year">Published: {book.firstPublishYear}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAddShortStory(book)}
                        className="primary"
                        size="small"
                      >
                        Story is in This Book
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="no-book-option">
                  <Button
                    onClick={() => handleAddShortStory()}
                    className="secondary"
                  >
                    None of These - Add Story Without Container Book
                  </Button>
                </div>
              </div>
            )}
          </div>        </div>
      )}

      {/* Web Video Form Modal */}
      {showWebVideoForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingItem ? 'Edit Web Video' : 'Add Web Video'}</h3>
              <Button
                onClick={() => {
                  setShowWebVideoForm(false);
                  setEditingItem(null);
                  setWebVideoFormData({ title: '', url: '', description: '' });
                }}
                className="close-modal"
              >
                ×
              </Button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAddWebVideo(); }} className="webvideo-form">
              <div className="form-group">
                <label htmlFor="webvideo-title">Video Title *</label>
                <input
                  type="text"
                  id="webvideo-title"
                  value={webVideoFormData.title}
                  onChange={(e) => setWebVideoFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter video title"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="webvideo-url">Video URL *</label>
                <input
                  type="url"
                  id="webvideo-url"
                  value={webVideoFormData.url}
                  onChange={(e) => setWebVideoFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=... or any video URL"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="webvideo-description">Description (optional)</label>
                <textarea
                  id="webvideo-description"
                  value={webVideoFormData.description}
                  onChange={(e) => setWebVideoFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the video"
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <Button type="submit" className="primary">
                  {editingItem ? 'Update Web Video' : 'Add Web Video'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowWebVideoForm(false);
                    setEditingItem(null);
                    setWebVideoFormData({ title: '', url: '', description: '' });
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

